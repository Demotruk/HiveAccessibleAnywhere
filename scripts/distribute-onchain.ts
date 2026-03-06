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
const SUPPORTED_LOCALES = ['en', 'zh'];
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
    permlink: `part-${padNum(i + 1)}`,
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
  generateBootstrap(locale, rootPermlink, propolisMetadata);
}

// -- Bootstrap HTML generation --

function generateBootstrap(locale: string, rootPermlink: string, meta: PropolisMetadata): void {
  const bootstrapHtml = `<!DOCTYPE html>
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
</style>
</head>
<body>
<div class="c">
<h1>Propolis Wallet</h1>
<p class="s" id="st">Initializing...</p>
<div class="p"><div id="pb" style="width:0%"></div></div>
<p class="e hidden" id="er"></p>
</div>
<script>
(async()=>{
"use strict";
const ACCOUNT="${ACCOUNT}";
const PERMLINK="${rootPermlink}";
const VERSION_HASH="${meta.hash}";
const MANIFEST=${JSON.stringify(meta.manifest)};
const NODES=["https://api.hive.blog","https://api.deathwing.me","https://hive-api.arcange.eu"];
const DB_NAME="propolis";
const DB_STORE="cache";
const DB_KEY="wallet-${locale}";

const st=document.getElementById("st");
const pb=document.getElementById("pb");
const er=document.getElementById("er");
const progress=(p,msg)=>{pb.style.width=p+"%";if(msg)st.textContent=msg;};
const fail=(msg)=>{er.textContent=msg;er.classList.remove("hidden");st.textContent="Failed";};

// IndexedDB helpers
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
async function cacheGet(db){
  return new Promise((res)=>{
    try{
      const tx=db.transaction(DB_STORE,"readonly");
      const r=tx.objectStore(DB_STORE).get(DB_KEY);
      r.onsuccess=()=>res(r.result||null);
      r.onerror=()=>res(null);
    }catch(e){res(null);}
  });
}
async function cacheSet(db,val){
  try{
    const tx=db.transaction(DB_STORE,"readwrite");
    tx.objectStore(DB_STORE).put(val,DB_KEY);
  }catch(e){/* ignore cache write failures */}
}

// SHA-256 via crypto.subtle
async function sha256(text){
  const buf=new TextEncoder().encode(text);
  const hash=await crypto.subtle.digest("SHA-256",buf);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

// RPC with failover
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

// Load cached wallet if hash matches
async function tryCache(){
  try{
    const db=await openDB();
    const cached=await cacheGet(db);
    if(cached&&cached.hash===VERSION_HASH){
      progress(100,"Loading from cache...");
      return{html:cached.html,db};
    }
    return{html:null,db};
  }catch(e){
    return{html:null,db:null};
  }
}

// Fetch and verify from chain
async function fetchFromChain(){
  progress(5,"Fetching manifest...");

  // Use bridge.get_discussion to get root + all comments in one call
  const discussion=await rpc("bridge.get_discussion",{author:ACCOUNT,permlink:PERMLINK,limit:100});
  if(!discussion)throw new Error("Post not found");

  // Filter to only comments by the publisher account
  const comments={};
  for(const key of Object.keys(discussion)){
    const post=discussion[key];
    if(post.author===ACCOUNT&&post.parent_author===ACCOUNT){
      comments[post.permlink]=post.body;
    }
  }

  progress(20,"Verifying chunks...");

  // Walk manifest, extract chunks, verify hashes
  const chunks=[];
  for(let i=0;i<MANIFEST.length;i++){
    const entry=MANIFEST[i];
    const body=comments[entry.permlink];
    if(!body)throw new Error("Missing chunk: "+entry.permlink);

    // Strip code fences
    const m=body.match(/\`\`\`\\n([\\s\\S]*?)\\n\`\`\`/);
    const content=m?m[1]:body.replace(/^\`\`\`\\n?/,"").replace(/\\n?\`\`\`$/,"");

    // Verify chunk hash
    const h=await sha256(content);
    if(h!==entry.hash)throw new Error("Hash mismatch for "+entry.permlink);

    chunks.push(content);
    progress(20+Math.round((i+1)/MANIFEST.length*60),"Verifying chunk "+(i+1)+"/"+MANIFEST.length+"...");
  }

  // Assemble and verify whole-file hash
  progress(85,"Verifying assembly...");
  const assembled=chunks.join("");
  const fullHash=await sha256(assembled);
  if(fullHash!==VERSION_HASH)throw new Error("Full hash mismatch");

  progress(95,"Verified!");
  return assembled;
}

// Execute: replace page with wallet
function loadWallet(html){
  document.open();
  document.write(html);
  document.close();
}

// Main
try{
  const{html:cached,db}=await tryCache();
  if(cached){
    loadWallet(cached);
    return;
  }

  const html=await fetchFromChain();

  // Cache for next time
  if(db){
    await cacheSet(db,{hash:VERSION_HASH,html});
  }

  progress(100,"Loading wallet...");
  await new Promise(r=>setTimeout(r,200));
  loadWallet(html);
}catch(e){
  // Try to fall back to cache even if stale
  try{
    const db=await openDB();
    const cached=await cacheGet(db);
    if(cached&&cached.html){
      fail("Fetch failed, loading cached version (may be outdated)");
      await new Promise(r=>setTimeout(r,2000));
      loadWallet(cached.html);
      return;
    }
  }catch(e2){/* no cache available */}
  fail(e.message||"Unknown error");
}
})();
<\\/script>
</body>
</html>`;

  // Fix the escaped closing script tag
  const finalHtml = bootstrapHtml.replace('<\\/script>', '</script>');

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

  const locales = allLocales ? SUPPORTED_LOCALES : [singleLocale];

  for (const locale of locales) {
    await publishLocale(locale);
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
