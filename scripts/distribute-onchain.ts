import 'dotenv/config';

/**
 * On-Chain Distribution — Publish Propolis Wallet to Hive blockchain
 *
 * Uses a root-post-plus-comments model:
 *   Root post:  propolis-wallet-v{version}-{locale}
 *     json_metadata.propolis = { version, locale, hash, manifest[] }
 *   Comments:   part-01, part-02, ... (each is a reply to the root)
 *     Body wrapped in code fences; bootstrap strips them on reassembly.
 *
 * Usage:
 *   npx tsx distribute-onchain.ts [--dry-run] [--version 1] [--locale en]
 *   npx tsx distribute-onchain.ts --all-locales [--dry-run] [--version 1]
 *
 * Environment variables:
 *   PROPOLIS_ACCOUNT    - Hive account to publish under
 *   PROPOLIS_POSTING_KEY - Private posting key (WIF)
 */

import { Transaction, PrivateKey, config as hiveTxConfig } from 'hive-tx';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { buildSync } from 'esbuild';

// -- Types --

interface ManifestEntry {
  permlink: string;
  hash: string;
}

interface PropolisMetadata {
  version: string;
  locale: string;
  hash: string;
  manifest: ManifestEntry[];
}

// -- Config --

const CHUNK_SIZE = 55_000; // 55KB per comment body (safe margin under 65KB limit)
const SUPPORTED_LOCALES = ['en', 'zh', 'ar', 'fa', 'ru', 'tr', 'vi'];
const POST_DELAY_MS = 4000; // delay between broadcasts to avoid rate limiting
const DIST_DIR = resolve(import.meta.dirname, '..', 'wallet', 'dist');

// -- Parse args --

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const allLocales = args.includes('--all-locales');

function getArg(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const version = getArg('--version', '1');
const singleLocale = getArg('--locale', 'en');

// -- Load environment --

const ACCOUNT = process.env.PROPOLIS_ACCOUNT || process.env.HAA_SERVICE_ACCOUNT;
const POSTING_KEY = process.env.PROPOLIS_POSTING_KEY || process.env.HAA_POSTING_KEY;

if (!ACCOUNT || !POSTING_KEY) {
  console.error('Missing environment variables.');
  console.error('Required: PROPOLIS_ACCOUNT, PROPOLIS_POSTING_KEY');
  console.error('  (or legacy: HAA_SERVICE_ACCOUNT, HAA_POSTING_KEY)');
  process.exit(1);
}

// -- Helpers --

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex');
}

function splitIntoChunks(data: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
}

function padNum(n: number): string {
  return String(n).padStart(2, '0');
}

async function broadcast(operations: any[]): Promise<{ tx_id: string; status: string }> {
  const tx = new Transaction();
  for (const op of operations) {
    await tx.addOperation(op[0], op[1]);
  }
  const key = PrivateKey.from(POSTING_KEY!);
  tx.sign(key);
  return await tx.broadcast(true);
}

async function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// -- Publish for a single locale --

async function publishLocale(locale: string): Promise<void> {
  const walletFilename = `propolis-wallet-${locale}.html`;
  const walletPath = resolve(DIST_DIR, walletFilename);

  // Read wallet file
  let walletHtml: string;
  try {
    walletHtml = readFileSync(walletPath, 'utf-8');
  } catch {
    console.error(`Failed to read ${walletPath}`);
    console.error(`Run "npm run build:all" in wallet/ first.`);
    process.exit(1);
  }

  const wholeHash = sha256(walletHtml);
  const size = Buffer.byteLength(walletHtml, 'utf-8');
  const chunks = splitIntoChunks(walletHtml, CHUNK_SIZE);

  console.log(`\n--- ${locale.toUpperCase()} ---`);
  console.log(`File: ${walletFilename}`);
  console.log(`Size: ${(size / 1024).toFixed(1)} KB`);
  console.log(`SHA-256: ${wholeHash}`);
  console.log(`Chunks: ${chunks.length}`);

  // Build manifest
  const manifest: ManifestEntry[] = chunks.map((chunk, i) => ({
    permlink: `v${version}-${locale}-part-${padNum(i + 1)}`,
    hash: sha256(chunk),
  }));

  // Root post permlink and metadata
  const rootPermlink = `propolis-wallet-v${version}-${locale}`;
  const propolisMetadata: PropolisMetadata = {
    version: `${version}.0.0`,
    locale,
    hash: wholeHash,
    manifest,
  };

  // Publish root post
  const rootTitle = `Propolis Wallet v${version} (${locale.toUpperCase()})`;
  const rootBody = [
    `# Propolis Wallet v${version} (${locale.toUpperCase()})`,
    '',
    `Self-contained Hive wallet distributed on-chain.`,
    '',
    `**SHA-256:** \`${wholeHash}\``,
    `**Size:** ${(size / 1024).toFixed(1)} KB`,
    `**Parts:** ${chunks.length}`,
    '',
    'This post and its comments contain the complete wallet application.',
    'Use the Propolis bootstrap loader or the reassemble script to build the wallet from these parts.',
    '',
    '---',
    `Published by @${ACCOUNT} using Propolis distribution tools.`,
  ].join('\n');

  console.log(`\n  Root: @${ACCOUNT}/${rootPermlink}`);

  if (!dryRun) {
    try {
      const result = await broadcast([
        ['comment', {
          parent_author: '',
          parent_permlink: 'propolis-wallet',
          author: ACCOUNT,
          permlink: rootPermlink,
          title: rootTitle,
          body: rootBody,
          json_metadata: JSON.stringify({
            app: 'propolis-wallet/1.0.0',
            tags: ['propolis-wallet', 'hive-wallet'],
            propolis: propolisMetadata,
          }),
        }],
      ]);
      console.log(`    Published! TX: ${result.tx_id?.slice(0, 12)}... (${result.status})`);
    } catch (e) {
      console.error(`    FAILED: ${(e as Error).message}`);
      process.exit(1);
    }
    await delay(POST_DELAY_MS);
  } else {
    console.log('    [DRY RUN] Would publish root post');
    console.log(`    json_metadata.propolis = ${JSON.stringify(propolisMetadata, null, 2)}`);
  }

  // Publish chunk comments
  for (let i = 0; i < chunks.length; i++) {
    const entry = manifest[i];
    const chunkBody = `\`\`\`\n${chunks[i]}\n\`\`\``;
    const commentPermlink = entry.permlink;

    console.log(`  Comment ${padNum(i + 1)}/${padNum(chunks.length)}: ${commentPermlink} (${chunks[i].length} bytes, hash: ${entry.hash.slice(0, 12)}...)`);

    if (!dryRun) {
      try {
        const result = await broadcast([
          ['comment', {
            parent_author: ACCOUNT,
            parent_permlink: rootPermlink,
            author: ACCOUNT,
            permlink: commentPermlink,
            title: '',
            body: chunkBody,
            json_metadata: JSON.stringify({
              app: 'propolis-wallet/1.0.0',
            }),
          }],
        ]);
        console.log(`    Published! TX: ${result.tx_id?.slice(0, 12)}... (${result.status})`);
      } catch (e) {
        console.error(`    FAILED: ${(e as Error).message}`);
        process.exit(1);
      }
      await delay(POST_DELAY_MS);
    } else {
      console.log('    [DRY RUN] Would publish comment');
    }
  }

  // Generate bootstrap HTML for this locale
  generateBootstrap(locale, rootPermlink, propolisMetadata, cryptoBundleCache!, serviceKeyHexCache!);
}

// Caches for crypto bundle and service key (built once, reused per locale)
let cryptoBundleCache: string | null = null;
let serviceKeyHexCache: string | null = null;

// -- Build secp256k1 ECDH bundle for bootstrap --

function buildCryptoBundle(): string {
  const entryPoint = resolve(import.meta.dirname, 'bootstrap-crypto.mjs');
  const result = buildSync({
    entryPoints: [entryPoint],
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    write: false,
  });
  return new TextDecoder().decode(result.outputFiles[0].contents);
}

// -- Fetch service account public memo key --

async function getServiceMemoKeyHex(serviceAccount: string): Promise<string> {
  const response = await fetch(hiveTxConfig.nodes[0], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'condenser_api.get_accounts',
      params: [[serviceAccount]],
      id: 1,
    }),
  });
  const data = await response.json() as any;
  if (!data.result?.[0]) throw new Error(`Account @${serviceAccount} not found`);

  const memoKeyStr: string = data.result[0].memo_key; // e.g. "STM..."
  // Decode STM public key format: "STM" + Base58(33-byte-key + 4-byte-ripemd160-checksum)
  const bs58 = await import('bs58');
  const prefix = memoKeyStr.startsWith('STM') ? 3 : 0;
  const decoded = bs58.default.decode(memoKeyStr.slice(prefix));
  // First 33 bytes are the compressed public key
  const rawKey = decoded.slice(0, 33);
  return Array.from(rawKey).map(b => b.toString(16).padStart(2, '0')).join('');
}

// -- Bootstrap HTML generation --

function generateBootstrap(
  locale: string,
  rootPermlink: string,
  meta: PropolisMetadata,
  cryptoBundle: string,
  serviceKeyHex: string,
): void {
  // Build HTML by concatenation to avoid template literal issues with crypto bundle
  const htmlHead = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Propolis Wallet</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#111;color:#eee;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}
.c{max-width:420px;width:100%;text-align:center}
h1{font-size:1.3rem;margin-bottom:1rem}
.s{font-size:.85rem;color:#aaa;margin-bottom:.5rem}
.p{background:#222;border-radius:8px;height:6px;overflow:hidden;margin:1rem 0}
.p div{height:100%;background:#4a9;transition:width .3s}
.e{color:#e55;margin-top:1rem;font-size:.85rem}
button{background:#4a9;color:#fff;border:none;padding:.6rem 1.5rem;border-radius:4px;cursor:pointer;font-size:.9rem;margin-top:1rem}
button:hover{background:#3a8}
.mf{display:none;margin-top:1rem;text-align:left}
.mf.show{display:block}
.mf label{font-size:.8rem;color:#aaa;display:block;margin-bottom:.3rem}
.mf input,.mf textarea{width:100%;background:#222;color:#eee;border:1px solid #444;border-radius:4px;padding:.5rem;font-size:.85rem;margin-bottom:.8rem;font-family:monospace}
.mf textarea{min-height:3rem;resize:vertical}
.mf button{width:100%}
</style>
</head>
<body>
<div class="c">
<h1>Propolis Wallet</h1>
<p class="s" id="st">Initializing...</p>
<div class="p"><div id="pb" style="width:0%"></div></div>
<p class="e" id="er" style="display:none"></p>
<div class="mf" id="mf">
<div id="mfm"><label for="mi">Encrypted Memo</label>
<textarea id="mi" rows="2" placeholder="Paste encrypted memo here..."></textarea></div>
<label for="mk">Memo Key (WIF)</label>
<input type="password" id="mk" placeholder="5K...">
<button id="mb" type="button">Decrypt &amp; Connect</button>
</div>
</div>
`;

  const mainScript = `(async()=>{
"use strict";
const ACCOUNT="${ACCOUNT}";
const PERMLINK="${rootPermlink}";
const VERSION_HASH="${meta.hash}";
const MANIFEST=${JSON.stringify(meta.manifest)};
const NODES=["https://api.hive.blog","https://api.deathwing.me","https://hive-api.arcange.eu"];
const DB_NAME="propolis";
const DB_STORE="cache";
const DB_KEY="wallet-${locale}";
const EP_KEY="endpoints-${locale}";
const SERVICE_KEY="${serviceKeyHex}";

const st=document.getElementById("st");
const pb=document.getElementById("pb");
const er=document.getElementById("er");
const mf=document.getElementById("mf");
const progress=(p,msg)=>{pb.style.width=p+"%";if(msg)st.textContent=msg;};
const fail=(msg)=>{er.textContent=msg;er.style.display="block";st.textContent="Failed";};

// --- Base58 decode ---
const B58="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58dec(s){
  const map=new Uint8Array(128);for(let i=0;i<58;i++)map[B58.charCodeAt(i)]=i;
  let z=0;while(z<s.length&&s[z]==="1")z++;
  const b=new Uint8Array(s.length);let len=0;
  for(let i=z;i<s.length;i++){
    let c=map[s.charCodeAt(i)];
    for(let j=0;j<len;j++){const t=b[j]*58+c;b[j]=t&0xff;c=t>>8;}
    while(c>0){b[len++]=c&0xff;c>>=8;}
  }
  const out=new Uint8Array(z+len);
  for(let i=0;i<len;i++)out[z+i]=b[len-1-i];
  return out;
}

// --- Crypto helpers (Web Crypto) ---
async function sha256b(d){return new Uint8Array(await crypto.subtle.digest("SHA-256",d));}
async function sha512b(d){return new Uint8Array(await crypto.subtle.digest("SHA-512",d));}
async function sha256hex(text){
  const h=await sha256b(new TextEncoder().encode(text));
  return Array.from(h).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function aesCbcDec(key,iv,ct){
  const k=await crypto.subtle.importKey("raw",key,{name:"AES-CBC"},false,["decrypt"]);
  return new Uint8Array(await crypto.subtle.decrypt({name:"AES-CBC",iv},k,ct));
}

// --- WIF private key parse ---
async function parseWIF(wif){
  const raw=b58dec(wif);
  if(raw[0]!==0x80)throw new Error("Invalid WIF prefix");
  const keyEnd=raw.length-4;
  const check=raw.slice(keyEnd);
  const payload=raw.slice(0,keyEnd);
  const h=await sha256b(await sha256b(payload));
  for(let i=0;i<4;i++)if(h[i]!==check[i])throw new Error("WIF checksum failed");
  return payload.slice(1,33);
}

// --- Varint32 decode ---
function readVarint32(buf,off){
  let v=0,s=0,b;
  do{b=buf[off++];v|=(b&0x7f)<<s;s+=7;}while(b&0x80);
  return[v,off];
}

// --- Decrypt Hive encrypted memo ---
async function decryptMemo(memoB58,wifKey){
  const privKey=await parseWIF(wifKey);
  const raw=b58dec(memoB58);

  // Deserialize: from[33] + to[33] + nonce[8] + check[4] + varint32+encrypted
  const from=raw.slice(0,33);
  const to=raw.slice(33,66);
  const nonceBuf=raw.slice(66,74);
  const checkBuf=raw.slice(74,78);
  const check=checkBuf[0]|(checkBuf[1]<<8)|(checkBuf[2]<<16)|((checkBuf[3]<<24)>>>0);
  const[encLen,encOff]=readVarint32(raw,78);
  const encrypted=raw.slice(encOff,encOff+encLen);

  // Verify sender is trusted service account
  const fromHex=Array.from(from).map(b=>b.toString(16).padStart(2,"0")).join("");
  if(SERVICE_KEY&&fromHex!==SERVICE_KEY)throw new Error("Memo not from trusted service");

  // Try ECDH with 'from' first (sender's key); if checksum fails, try 'to'
  for(const candidate of[from,to]){
    try{
      const shared=__secp256k1_getSharedSecret(privKey,candidate);
      const S=await sha512b(shared.subarray(1));
      // Build nonce||S buffer (8+64=72 bytes)
      const buf=new Uint8Array(72);
      buf.set(nonceBuf,0);buf.set(S,8);
      const encKey=await sha512b(buf);
      const aesKey=encKey.slice(0,32);
      const iv=encKey.slice(32,48);
      // Verify checksum
      const ch=await sha256b(encKey);
      const check2=ch[0]|(ch[1]<<8)|(ch[2]<<16)|((ch[3]<<24)>>>0);
      if(check2!==check)continue;
      // Decrypt
      const dec=await aesCbcDec(aesKey,iv,encrypted);
      // Read varint32-prefixed string
      const[sLen,sOff]=readVarint32(dec,0);
      const text=new TextDecoder().decode(dec.slice(sOff,sOff+sLen));
      return JSON.parse(text);
    }catch(e){continue;}
  }
  throw new Error("Decryption failed - wrong memo key?");
}

// --- IndexedDB helpers ---
function openDB(){
  return new Promise((res,rej)=>{
    try{
      const r=indexedDB.open(DB_NAME,1);
      r.onupgradeneeded=()=>r.result.createObjectStore(DB_STORE);
      r.onsuccess=()=>res(r.result);
      r.onerror=()=>rej(r.error);
    }catch(e){rej(e);}
  });
}
async function cacheGet(db,key){
  return new Promise((res)=>{
    try{
      const tx=db.transaction(DB_STORE,"readonly");
      const r=tx.objectStore(DB_STORE).get(key);
      r.onsuccess=()=>res(r.result||null);
      r.onerror=()=>res(null);
    }catch(e){res(null);}
  });
}
async function cacheSet(db,key,val){
  try{
    const tx=db.transaction(DB_STORE,"readwrite");
    tx.objectStore(DB_STORE).put(val,key);
  }catch(e){}
}

// --- RPC with failover ---
async function rpc(method,params){
  for(const node of NODES){
    try{
      const r=await fetch(node,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({jsonrpc:"2.0",method,params,id:1})});
      const d=await r.json();
      if(d.error)continue;
      return d.result;
    }catch(e){continue;}
  }
  throw new Error("All RPC nodes failed");
}

// --- Cache & fetch ---
async function tryCache(){
  try{
    const db=await openDB();
    const cached=await cacheGet(db,DB_KEY);
    if(cached&&cached.hash===VERSION_HASH){
      progress(100,"Loading from cache...");
      return{html:cached.html,db};
    }
    return{html:null,db};
  }catch(e){
    return{html:null,db:null};
  }
}

async function fetchFromChain(){
  progress(5,"Fetching manifest...");
  const discussion=await rpc("bridge.get_discussion",{author:ACCOUNT,permlink:PERMLINK});
  if(!discussion)throw new Error("Post not found");
  const comments={};
  for(const key of Object.keys(discussion)){
    const post=discussion[key];
    if(post.author===ACCOUNT&&post.parent_author===ACCOUNT){
      comments[post.permlink]=post.body;
    }
  }
  progress(20,"Verifying chunks...");
  const chunks=[];
  for(let i=0;i<MANIFEST.length;i++){
    const entry=MANIFEST[i];
    const body=comments[entry.permlink];
    if(!body)throw new Error("Missing chunk: "+entry.permlink);
    const m=body.match(/\`\`\`\\n([\\s\\S]*?)\\n\`\`\`/);
    const content=m?m[1]:body.replace(/^\`\`\`\\n?/,"").replace(/\\n?\`\`\`$/,"");
    const h=await sha256hex(content);
    if(h!==entry.hash)throw new Error("Hash mismatch for "+entry.permlink);
    chunks.push(content);
    progress(20+Math.round((i+1)/MANIFEST.length*60),"Verifying chunk "+(i+1)+"/"+MANIFEST.length+"...");
  }
  progress(85,"Verifying assembly...");
  const assembled=chunks.join("");
  const fullHash=await sha256hex(assembled);
  if(fullHash!==VERSION_HASH)throw new Error("Full hash mismatch");
  progress(95,"Verified!");
  return assembled;
}

// Collect proxy endpoints discovered during bootstrap (memo decrypt, URL param, cache)
const proxyEndpoints=[];
// Memo key used during bootstrap decryption — handed off to wallet for pre-fill
let bootstrapMemoKey="";

function loadWallet(html){
  // Hand off proxy endpoints to the wallet via localStorage so the user
  // doesn't have to enter them again on the login screen
  if(proxyEndpoints.length){
    try{localStorage.setItem("propolis_manual_endpoints",JSON.stringify([...new Set(proxyEndpoints)]));}catch(e){}
  }
  // Hand off memo key for wallet login pre-fill (temporary — wallet reads once and deletes)
  if(bootstrapMemoKey){
    try{localStorage.setItem("propolis_bootstrap_memo_key",bootstrapMemoKey);}catch(e){}
    bootstrapMemoKey="";
  }
  document.open();
  document.write(html);
  document.close();
}

// --- Memo form UI ---
function showMemoForm(showMemoField){
  mf.classList.add("show");
  if(!showMemoField)document.getElementById("mfm").style.display="none";
  return new Promise((res,rej)=>{
    document.getElementById("mb").onclick=async()=>{
      try{
        const mi=document.getElementById("mi");
        const mk=document.getElementById("mk");
        const memoStr=mi?mi.value.trim():"";
        const keyStr=mk.value.trim();
        if(!keyStr){rej(new Error("Please enter your memo key"));return;}
        progress(0,"Decrypting memo...");
        mf.classList.remove("show");
        const payload=await decryptMemo(memoStr||urlMemo,keyStr);
        // Save key for wallet login pre-fill, then clear DOM input
        bootstrapMemoKey=keyStr;
        mk.value="";
        if(!payload.endpoints||!payload.endpoints.length)throw new Error("No endpoints in memo");
        if(payload.expires&&new Date(payload.expires)<new Date())throw new Error("Endpoints expired");
        res(payload.endpoints);
      }catch(e){rej(e);}
    };
  });
}

// --- Main flow ---
const params=new URLSearchParams(location.search);
const urlMemo=params.get("memo")||"";
const urlRpc=params.get("rpc")||"";

// Prepend dev RPC endpoint if provided
if(urlRpc){NODES.unshift(urlRpc);proxyEndpoints.push(urlRpc);}

try{
  // Check for cached endpoints
  let db;
  try{db=await openDB();}catch(e){db=null;}
  if(db){
    const epCache=await cacheGet(db,EP_KEY);
    if(epCache&&epCache.endpoints&&(!epCache.expires||new Date(epCache.expires)>new Date())){
      for(let i=epCache.endpoints.length-1;i>=0;i--)NODES.unshift(epCache.endpoints[i]);
      proxyEndpoints.push(...epCache.endpoints);
    }
  }

  // If memo in URL, decrypt first to get proxy endpoints
  if(urlMemo){
    try{
      const endpoints=await showMemoForm(false);
      for(let i=endpoints.length-1;i>=0;i--)NODES.unshift(endpoints[i]);
      proxyEndpoints.push(...endpoints);
      if(db)await cacheSet(db,EP_KEY,{endpoints,expires:null,cachedAt:Date.now()});
    }catch(e){
      fail("Memo decryption failed: "+e.message);
      return;
    }
  }

  // Try wallet cache
  const cached=await tryCache();
  if(cached.html){
    loadWallet(cached.html);
    return;
  }
  if(cached.db)db=cached.db;

  // Try fetching from chain
  let html;
  try{
    html=await fetchFromChain();
  }catch(fetchErr){
    // If no memo was used yet, show fallback memo form
    if(!urlMemo&&!urlRpc){
      fail("Could not reach Hive nodes. Enter an encrypted endpoint memo to connect via proxy.");
      try{
        const endpoints=await showMemoForm(true);
        for(let i=endpoints.length-1;i>=0;i--)NODES.unshift(endpoints[i]);
        proxyEndpoints.push(...endpoints);
        if(db)await cacheSet(db,EP_KEY,{endpoints,expires:null,cachedAt:Date.now()});
        er.style.display="none";
        html=await fetchFromChain();
      }catch(e2){
        // Try stale cache
        if(db){
          const stale=await cacheGet(db,DB_KEY);
          if(stale&&stale.html){
            fail("Connection failed. Loading cached version (may be outdated).");
            await new Promise(r=>setTimeout(r,2000));
            loadWallet(stale.html);
            return;
          }
        }
        fail(e2.message||"Unknown error");
        return;
      }
    }else{
      // Already had endpoints but still failed
      if(db){
        const stale=await cacheGet(db,DB_KEY);
        if(stale&&stale.html){
          fail("Fetch failed. Loading cached version (may be outdated).");
          await new Promise(r=>setTimeout(r,2000));
          loadWallet(stale.html);
          return;
        }
      }
      fail(fetchErr.message||"Unknown error");
      return;
    }
  }

  // Cache and load
  if(db)await cacheSet(db,DB_KEY,{hash:VERSION_HASH,html});
  progress(100,"Loading wallet...");
  await new Promise(r=>setTimeout(r,200));
  loadWallet(html);
}catch(e){
  fail(e.message||"Unknown error");
}
})();`;

  // Build final HTML by concatenation (avoids template literal issues with crypto bundle)
  const finalHtml = [
    htmlHead,
    '<script>\n',
    cryptoBundle,
    '\n</script>\n<script>\n',
    mainScript,
    '\n</script>\n</body>\n</html>',
  ].join('');

  const bootstrapPath = resolve(DIST_DIR, `propolis-bootstrap-${locale}.html`);
  mkdirSync(DIST_DIR, { recursive: true });
  writeFileSync(bootstrapPath, finalHtml, 'utf-8');
  const bootstrapSize = Buffer.byteLength(finalHtml, 'utf-8');
  console.log(`\n  Bootstrap: ${bootstrapPath} (${(bootstrapSize / 1024).toFixed(1)} KB)`);
}

// -- Main --

async function main() {
  console.log('=== Propolis On-Chain Distribution ===');
  console.log(`Account: @${ACCOUNT}`);
  console.log(`Version: v${version}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  // Configure hive-tx
  hiveTxConfig.nodes = ['https://api.hive.blog'];

  // Build crypto bundle for bootstrap (once)
  console.log('\nBuilding secp256k1 ECDH bundle for bootstrap...');
  cryptoBundleCache = buildCryptoBundle();
  console.log(`  Crypto bundle: ${(Buffer.byteLength(cryptoBundleCache) / 1024).toFixed(1)} KB`);

  // Fetch service account public memo key
  const serviceAccount = process.env.HAA_SERVICE_ACCOUNT || 'haa-service';
  console.log(`Fetching @${serviceAccount} public memo key...`);
  try {
    serviceKeyHexCache = await getServiceMemoKeyHex(serviceAccount);
    console.log(`  Service key: ${serviceKeyHexCache.slice(0, 12)}...`);
  } catch (e) {
    console.warn(`  WARNING: Could not fetch service key: ${(e as Error).message}`);
    console.warn('  Bootstrap will not verify memo sender. Set HAA_SERVICE_ACCOUNT in .env.');
    serviceKeyHexCache = '';
  }

  const locales = allLocales ? SUPPORTED_LOCALES : [singleLocale];
  const INTER_LOCALE_DELAY_MS = 5 * 60 * 1000 + 10_000; // 5 min 10s between root posts

  for (let i = 0; i < locales.length; i++) {
    if (i > 0 && !dryRun) {
      console.log(`\nWaiting ${INTER_LOCALE_DELAY_MS / 1000}s before next locale (Hive 5-min root post limit)...`);
      await delay(INTER_LOCALE_DELAY_MS);
    }
    await publishLocale(locales[i]);
  }

  console.log('\n=== Done ===');

  if (dryRun) {
    console.log('This was a dry run. No posts were published.');
    console.log('Remove --dry-run to publish for real.');
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
