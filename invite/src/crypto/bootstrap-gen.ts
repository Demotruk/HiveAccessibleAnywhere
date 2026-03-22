/**
 * Bootstrap file generator for robust invites.
 *
 * Generates a self-contained HTML file that:
 * 1. Prompts for the gift card PIN
 * 2. Decrypts embedded account keys
 * 3. Fetches the wallet from the blockchain via proxy endpoints
 * 4. Verifies SHA-256 hashes of all chunks
 * 5. Writes credentials + endpoints to localStorage
 * 6. Loads the wallet via document.open()/write()/close()
 *
 * The generated file has no external dependencies — all JS is inline.
 */

import { encryptWithPin } from './encrypt';
import type { WalletManifest, ManifestEntry } from '../hive/wallet-loader';
import type { DerivedKeys } from '../types';

export interface BootstrapParams {
  endpoints: string[];
  username: string;
  keys: DerivedKeys;
  pin: string;
  locale: string;
  manifest: WalletManifest;
}

/**
 * Generate a self-contained bootstrap HTML file.
 * Returns the complete HTML string.
 */
export async function generateBootstrapFile(params: BootstrapParams): Promise<string> {
  const { endpoints, username, keys, pin, locale, manifest } = params;

  // Encrypt credentials with PIN (same AES-256-GCM + PBKDF2 as the QR payload)
  // We embed all 4 WIF keys + username so no secp256k1 derivation is needed
  const credentials = JSON.stringify({
    account: username,
    owner: keys.owner.wif,
    active: keys.active.wif,
    posting: keys.posting.wif,
    memo: keys.memo.wif,
  });
  const encryptedCredentials = await encryptWithPin(credentials, pin);

  // Build manifest JSON for embedding
  const manifestJson = JSON.stringify(manifest.manifest);
  const endpointsJson = JSON.stringify(endpoints);

  return buildHtml({
    encryptedCredentials,
    endpoints: endpointsJson,
    publisher: 'propolis-publish',
    permlink: `propolis-wallet-v1-${locale}`,
    versionHash: manifest.hash,
    manifestEntries: manifestJson,
    locale,
  });
}

interface HtmlParams {
  encryptedCredentials: string;
  endpoints: string;
  publisher: string;
  permlink: string;
  versionHash: string;
  manifestEntries: string;
  locale: string;
}

function buildHtml(p: HtmlParams): string {
  // Note: string concatenation (not template literals) for the embedded JS
  // to avoid escaping issues with backticks in the generated code.
  return '<!DOCTYPE html>\n' +
    '<html lang="' + p.locale + '">\n' +
    '<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>Propolis Wallet</title>\n' +
    '<style>\n' +
    '*{margin:0;padding:0;box-sizing:border-box}\n' +
    'body{font-family:system-ui,sans-serif;background:#111;color:#eee;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}\n' +
    '.c{max-width:420px;width:100%;text-align:center}\n' +
    'h1{font-size:1.3rem;margin-bottom:1rem}\n' +
    '.s{font-size:.85rem;color:#aaa;margin-bottom:.5rem}\n' +
    '.p{background:#222;border-radius:8px;height:6px;overflow:hidden;margin:1rem 0}\n' +
    '.p div{height:100%;background:#4a9;transition:width .3s}\n' +
    '.e{color:#e55;margin-top:1rem;font-size:.85rem}\n' +
    'button{background:#4a9;color:#fff;border:none;padding:.6rem 1.5rem;border-radius:4px;cursor:pointer;font-size:.9rem;margin-top:.5rem}\n' +
    'button:hover{background:#3a8}\n' +
    'button:disabled{opacity:.5;cursor:default}\n' +
    '.pin-form{margin-top:1rem}\n' +
    '.pin-form input{background:#222;color:#eee;border:1px solid #444;border-radius:4px;padding:.5rem;font-size:1.1rem;text-align:center;letter-spacing:.3em;width:10em;font-family:monospace;text-transform:uppercase}\n' +
    '.pin-form input:focus{outline:none;border-color:#4a9}\n' +
    '.retry{margin-top:.5rem;font-size:.8rem;color:#aaa;cursor:pointer;text-decoration:underline;border:none;background:none}\n' +
    '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    '<div class="c">\n' +
    '<h1>Propolis Wallet</h1>\n' +
    '<p class="s" id="st">Enter your gift card PIN to open your wallet.</p>\n' +
    '<div class="p" style="display:none"><div id="pb" style="width:0%"></div></div>\n' +
    '<div class="pin-form" id="pf">\n' +
    '<input type="text" id="pin" maxlength="6" autocomplete="off" placeholder="PIN" autofocus>\n' +
    '<br><button id="go" disabled>Open Wallet</button>\n' +
    '</div>\n' +
    '<div id="err"></div>\n' +
    '</div>\n' +
    '<script>\n' +
    // -- Embedded constants --
    'var ENC_CREDS=' + JSON.stringify(p.encryptedCredentials) + ';\n' +
    'var ENDPOINTS=' + p.endpoints + ';\n' +
    'var PUBLISHER=' + JSON.stringify(p.publisher) + ';\n' +
    'var PERMLINK=' + JSON.stringify(p.permlink) + ';\n' +
    'var VERSION_HASH=' + JSON.stringify(p.versionHash) + ';\n' +
    'var MANIFEST=' + p.manifestEntries + ';\n' +
    '\n' +
    // -- PIN form logic --
    'var pinEl=document.getElementById("pin");\n' +
    'var goBtn=document.getElementById("go");\n' +
    'var stEl=document.getElementById("st");\n' +
    'var pbEl=document.getElementById("pb");\n' +
    'var errEl=document.getElementById("err");\n' +
    'var pfEl=document.getElementById("pf");\n' +
    '\n' +
    'pinEl.addEventListener("input",function(){\n' +
    '  pinEl.value=pinEl.value.toUpperCase().replace(/[^A-Z0-9]/g,"");\n' +
    '  goBtn.disabled=pinEl.value.length<6;\n' +
    '});\n' +
    'pinEl.addEventListener("keydown",function(e){\n' +
    '  if(e.key==="Enter"&&pinEl.value.length===6)start();\n' +
    '});\n' +
    'goBtn.addEventListener("click",start);\n' +
    '\n' +
    'function progress(pct,msg){\n' +
    '  pbEl.parentElement.style.display="";\n' +
    '  pbEl.style.width=pct+"%";\n' +
    '  if(msg)stEl.textContent=msg;\n' +
    '}\n' +
    '\n' +
    'function showError(msg){\n' +
    '  errEl.innerHTML=\'<p class="e">\'+msg+\'</p><button class="retry" onclick="location.reload()">Try again</button>\';\n' +
    '}\n' +
    '\n' +
    // -- Crypto helpers --
    'function b64urlDecode(s){\n' +
    '  var b=s.replace(/-/g,"+").replace(/_/g,"/");\n' +
    '  while(b.length%4)b+="=";\n' +
    '  var bin=atob(b);\n' +
    '  var a=new Uint8Array(bin.length);\n' +
    '  for(var i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);\n' +
    '  return a;\n' +
    '}\n' +
    '\n' +
    'async function decryptPin(blob,pin){\n' +
    '  var packed=b64urlDecode(blob);\n' +
    '  var salt=packed.slice(0,16),iv=packed.slice(16,28),tag=packed.slice(28,44),ct=packed.slice(44);\n' +
    '  var km=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveKey"]);\n' +
    '  var key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:salt,iterations:100000,hash:"SHA-256"},km,{name:"AES-GCM",length:256},false,["decrypt"]);\n' +
    '  var data=new Uint8Array(ct.length+16);data.set(ct,0);data.set(tag,ct.length);\n' +
    '  var dec=await crypto.subtle.decrypt({name:"AES-GCM",iv:iv,tagLength:128},key,data);\n' +
    '  return JSON.parse(new TextDecoder().decode(dec));\n' +
    '}\n' +
    '\n' +
    'async function sha256hex(text){\n' +
    '  var d=new TextEncoder().encode(text);\n' +
    '  var h=await crypto.subtle.digest("SHA-256",d);\n' +
    '  return Array.from(new Uint8Array(h)).map(function(b){return b.toString(16).padStart(2,"0")}).join("");\n' +
    '}\n' +
    '\n' +
    // -- RPC with failover --
    'async function rpc(method,params){\n' +
    '  for(var i=0;i<ENDPOINTS.length;i++){\n' +
    '    try{\n' +
    '      var r=await fetch(ENDPOINTS[i],{method:"POST",headers:{"Content-Type":"application/json"},\n' +
    '        body:JSON.stringify({jsonrpc:"2.0",method:method,params:params,id:1})});\n' +
    '      var d=await r.json();\n' +
    '      if(d.error)continue;\n' +
    '      return d.result;\n' +
    '    }catch(e){continue;}\n' +
    '  }\n' +
    '  throw new Error("All endpoints failed");\n' +
    '}\n' +
    '\n' +
    // -- Fetch and verify wallet --
    'async function fetchWallet(){\n' +
    '  progress(5,"Fetching wallet data...");\n' +
    '  var disc=await rpc("bridge.get_discussion",{author:PUBLISHER,permlink:PERMLINK});\n' +
    '  if(!disc)throw new Error("Post not found");\n' +
    '  var comments={};\n' +
    '  for(var key in disc){\n' +
    '    var post=disc[key];\n' +
    '    if(post.author===PUBLISHER&&post.parent_author===PUBLISHER)comments[post.permlink]=post.body;\n' +
    '  }\n' +
    '  var chunks=[];\n' +
    '  for(var i=0;i<MANIFEST.length;i++){\n' +
    '    var entry=MANIFEST[i];\n' +
    '    var body=comments[entry.permlink];\n' +
    '    if(!body)throw new Error("Missing chunk: "+entry.permlink);\n' +
    '    var m=body.match(/```\\n([\\s\\S]*?)\\n```/);\n' +
    '    var content=m?m[1]:body.replace(/^```\\n?/,"").replace(/\\n?```$/,"");\n' +
    '    var h=await sha256hex(content);\n' +
    '    if(h!==entry.hash)throw new Error("Hash mismatch: "+entry.permlink);\n' +
    '    chunks.push(content);\n' +
    '    progress(10+Math.round((i+1)/MANIFEST.length*70),"Verifying chunk "+(i+1)+"/"+MANIFEST.length+"...");\n' +
    '  }\n' +
    '  progress(85,"Verifying assembly...");\n' +
    '  var assembled=chunks.join("");\n' +
    '  var fh=await sha256hex(assembled);\n' +
    '  if(fh!==VERSION_HASH)throw new Error("Full hash mismatch");\n' +
    '  progress(95,"Verified!");\n' +
    '  return assembled;\n' +
    '}\n' +
    '\n' +
    // -- Load wallet into page --
    'function loadWallet(html,creds){\n' +
    '  try{localStorage.setItem("propolis_manual_endpoints",JSON.stringify(ENDPOINTS));}catch(e){}\n' +
    '  try{localStorage.setItem("haa_keys",JSON.stringify({account:creds.account,activeKeyWif:creds.active,memoKeyWif:creds.memo}));}catch(e){}\n' +
    '  try{localStorage.setItem("haa_account",creds.account);}catch(e){}\n' +
    '  try{localStorage.setItem("haa_activeKey",creds.active);}catch(e){}\n' +
    '  try{localStorage.setItem("haa_memoKey",creds.memo);}catch(e){}\n' +
    '  try{localStorage.setItem("propolis_bootstrap_memo_key",creds.memo);}catch(e){}\n' +
    '  document.open();\n' +
    '  document.write(html);\n' +
    '  document.close();\n' +
    '}\n' +
    '\n' +
    // -- Main flow --
    'async function start(){\n' +
    '  var pin=pinEl.value;\n' +
    '  if(pin.length!==6)return;\n' +
    '  pfEl.style.display="none";\n' +
    '  errEl.innerHTML="";\n' +
    '  try{\n' +
    '    progress(2,"Decrypting credentials...");\n' +
    '    var creds=await decryptPin(ENC_CREDS,pin);\n' +
    '    var html=await fetchWallet();\n' +
    '    progress(100,"Loading wallet...");\n' +
    '    setTimeout(function(){loadWallet(html,creds)},500);\n' +
    '  }catch(e){\n' +
    '    pfEl.style.display="";\n' +
    '    pbEl.parentElement.style.display="none";\n' +
    '    if(e.name==="OperationError"){\n' +
    '      showError("Wrong PIN. Check your gift card and try again.");\n' +
    '    }else{\n' +
    '      showError("Error: "+e.message);\n' +
    '    }\n' +
    '  }\n' +
    '}\n' +
    '</script>\n' +
    '</body>\n' +
    '</html>';
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Clean up after a short delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}
