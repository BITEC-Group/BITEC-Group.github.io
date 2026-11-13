/* E-Pharma — service worker : l'application se charge sans réseau (coquille + bibliothèques + fonds de carte déjà vus). Les données passent par offline.js (IndexedDB). */
const V='epharma-0.7.15',SHELL=['/','/index.html','/print.html','/pay.html','/offline.js','/update.js','/secure-doc.js','/imports-ui.js','/dash-click.js','/verifier-import.html','/autorisation-import.html','/rapport-retrocession.html','/secure-doc.css','/assets/acorep-logo.jpg','/assets/qrcode.min.js','/certificat.html','/titre.html','/verifier.html','/config.js','/prov.json','/m/','/m/index.html','/m/manifest.webmanifest','/m/icon.svg','/manifest.webmanifest'];
const LIBS=['https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css','https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js','https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js','https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'];
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(V);
  await Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})));await Promise.all(LIBS.map(u=>c.add(new Request(u,{mode:'no-cors'})).catch(()=>{})));self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==V)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(u.pathname.startsWith('/api/'))return;           // données : gérées par offline.js
  if(u.origin===location.origin){                                                  // pages : réseau d'abord, sinon cache
    e.respondWith(fetch(r).then(x=>{if(x.ok){const cp=x.clone();caches.open(V).then(c=>c.put(r,cp))}return x}).catch(async()=>(await caches.match(r,{ignoreSearch:true}))||(u.pathname.startsWith('/m')?caches.match('/m/'):caches.match('/'))));return}
  e.respondWith(caches.match(r).then(h=>h||fetch(r).then(x=>{const cp=x.clone();caches.open(V).then(c=>c.put(r,cp));return x}).catch(()=>h)));   // bibliothèques et tuiles : cache d'abord
});
self.addEventListener('sync',e=>{if(e.tag==='ep-sync')e.waitUntil(self.clients.matchAll().then(cs=>cs.forEach(c=>c.postMessage({type:'ep-sync'}))))});
