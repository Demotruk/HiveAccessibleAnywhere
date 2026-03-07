/**
 * Test that the bootstrap's memo decryption logic works correctly.
 * Replicates the exact same code from the generated bootstrap HTML.
 */
import 'dotenv/config';
import { webcrypto } from 'node:crypto';
import { secp256k1 } from '@noble/curves/secp256k1.js';

// --- Replicate bootstrap's Base58 decode ---
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58dec(s: string): Uint8Array {
  const map = new Uint8Array(128);
  for (let i = 0; i < 58; i++) map[B58.charCodeAt(i)] = i;
  let z = 0;
  while (z < s.length && s[z] === '1') z++;
  const b = new Uint8Array(s.length);
  let len = 0;
  for (let i = z; i < s.length; i++) {
    let c = map[s.charCodeAt(i)];
    for (let j = 0; j < len; j++) {
      const t = b[j] * 58 + c;
      b[j] = t & 0xff;
      c = t >> 8;
    }
    while (c > 0) {
      b[len++] = c & 0xff;
      c >>= 8;
    }
  }
  const out = new Uint8Array(z + len);
  for (let i = 0; i < len; i++) out[z + i] = b[len - 1 - i];
  return out;
}

// --- Crypto helpers (same as bootstrap, using Web Crypto) ---
const subtle = (webcrypto as any).subtle;
async function sha256b(d: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle.digest('SHA-256', d));
}
async function sha512b(d: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle.digest('SHA-512', d));
}
async function aesCbcDec(key: Uint8Array, iv: Uint8Array, ct: Uint8Array): Promise<Uint8Array> {
  const k = await subtle.importKey('raw', key, { name: 'AES-CBC' }, false, ['decrypt']);
  return new Uint8Array(await subtle.decrypt({ name: 'AES-CBC', iv }, k, ct));
}

// --- WIF parse ---
async function parseWIF(wif: string): Promise<Uint8Array> {
  const raw = b58dec(wif);
  if (raw[0] !== 0x80) throw new Error('Invalid WIF prefix');
  const keyEnd = raw.length - 4;
  const check = raw.slice(keyEnd);
  const payload = raw.slice(0, keyEnd);
  const h = await sha256b(await sha256b(payload));
  for (let i = 0; i < 4; i++) if (h[i] !== check[i]) throw new Error('WIF checksum failed');
  return payload.slice(1, 33);
}

// --- Varint32 ---
function readVarint32(buf: Uint8Array, off: number): [number, number] {
  let v = 0, s = 0, b: number;
  do {
    b = buf[off++];
    v |= (b & 0x7f) << s;
    s += 7;
  } while (b & 0x80);
  return [v, off];
}

// Service key from bootstrap
const SERVICE_KEY = '0227b54e3295b94bd4b44dec38375943d40ff9888a905a97735890b955270e8697';

// --- Decrypt Hive encrypted memo (same logic as bootstrap) ---
async function decryptMemo(memoB58: string, wifKey: string): Promise<any> {
  const privKey = await parseWIF(wifKey);
  const raw = b58dec(memoB58);

  const from = raw.slice(0, 33);
  const to = raw.slice(33, 66);
  const nonceBuf = raw.slice(66, 74);
  const checkBuf = raw.slice(74, 78);
  const check = checkBuf[0] | (checkBuf[1] << 8) | (checkBuf[2] << 16) | ((checkBuf[3] << 24) >>> 0);
  const [encLen, encOff] = readVarint32(raw, 78);
  const encrypted = raw.slice(encOff, encOff + encLen);

  const fromHex = Array.from(from).map(b => b.toString(16).padStart(2, '0')).join('');
  console.log('  From key hex:', fromHex.slice(0, 20) + '...');
  console.log('  Sender match:', fromHex === SERVICE_KEY);

  if (SERVICE_KEY && fromHex !== SERVICE_KEY) throw new Error('Memo not from trusted service');

  for (const candidate of [from, to]) {
    try {
      const shared = secp256k1.getSharedSecret(privKey, candidate);
      const S = await sha512b(shared.subarray(1));
      const buf = new Uint8Array(72);
      buf.set(nonceBuf, 0);
      buf.set(S, 8);
      const encKey = await sha512b(buf);
      const aesKey = encKey.slice(0, 32);
      const iv = encKey.slice(32, 48);
      const ch = await sha256b(encKey);
      const check2 = ch[0] | (ch[1] << 8) | (ch[2] << 16) | ((ch[3] << 24) >>> 0);
      if (check2 !== check) {
        console.log('  Checksum mismatch with candidate, trying next...');
        continue;
      }
      console.log('  Checksum matched!');
      const dec = await aesCbcDec(aesKey, iv, encrypted);
      const [sLen, sOff] = readVarint32(dec, 0);
      const text = new TextDecoder().decode(dec.slice(sOff, sOff + sLen));
      console.log('  Decrypted text:', text);
      return JSON.parse(text);
    } catch (e: any) {
      console.log('  Candidate failed:', e.message);
      continue;
    }
  }
  throw new Error('Decryption failed - wrong memo key?');
}

// --- Run test ---
async function main() {
  const memoKey = process.env.HAA_TEST_USER1_MEMO_KEY;
  if (!memoKey) {
    console.error('HAA_TEST_USER1_MEMO_KEY not set in .env');
    process.exit(1);
  }

  // The encrypted memo from haa-service to demotruktest27 (without # prefix)
  const encMemo = 'FqHKpybbBqu8zKsFParQj5juM6Z1zmExWZLPiGgd23SnFonY5ZvwCiQhX2Q7LZ6SVH6snQeXfb3jhAkhjgSh12ccq6dXUfwyHQdJNFF2aYHbHxQXYM45fF5ACHyQZ3mnVewopFGdco8omQE3y42RZkcpYhLqULKsjNPN4cf7VvMCryEob2v92Dj8GYW9qQrCSua6ViCkhPn2LxfNHGo6fqb8LCH3kGoKTDxqjb8Q3jjJ31X9pyqXDBexyToiE712ixAQ';

  console.log('=== Bootstrap Memo Decryption Test ===\n');
  console.log('Testing decryptMemo (same logic as bootstrap)...');

  try {
    const result = await decryptMemo(encMemo, memoKey);
    console.log('\n  Result:', JSON.stringify(result, null, 2));

    // Validate structure
    if (!result.v || !result.endpoints || !Array.isArray(result.endpoints)) {
      throw new Error('Invalid payload structure');
    }
    console.log('\n✓ All checks passed!');
    console.log('  - Payload version:', result.v);
    console.log('  - Endpoints:', result.endpoints);
    console.log('  - Expires:', result.expires);
  } catch (e: any) {
    console.error('\n✗ FAILED:', e.message);
    process.exit(1);
  }
}

main();
