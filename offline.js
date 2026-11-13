/* E-Pharma — couche hors ligne (offline-first)
   - Lectures (GET) : réseau d'abord ; en cas d'échec ou de lenteur, dernière réponse en cache (IndexedDB).
   - Écritures (POST/PATCH/DELETE) : si le réseau est absent, l'opération est placée dans une file d'attente locale (outbox)
     puis rejouée automatiquement au retour de la connexion, avec un identifiant d'opération (x-op-id) qui rend le rejeu sans doublon côté serveur.
   - Les conflits (ex. stock insuffisant à la synchronisation) restent visibles dans la file avec le motif, pour correction ou abandon. */
(function(){
'use strict';
const DB_NAME='epharma-offline',TIMEOUT=9000;
let idb=null;const listeners=new Set();
const S={online:navigator.onLine,pending:0,failed:0,syncing:false,staleAt:null,lastSync:null};
const emit=()=>{listeners.forEach(f=>{try{f({...S})}catch{}});render()};
const uid=()=>'op-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);

function open(){return new Promise((res,rej)=>{if(idb)return res(idb);
  let r;try{r=indexedDB.open(DB_NAME,1)}catch(e){return rej(e)}
  r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('cache',{keyPath:'key'});const o=d.createObjectStore('outbox',{keyPath:'id',autoIncrement:true});o.createIndex('status','status')};
  r.onsuccess=()=>{idb=r.result;res(idb)};r.onerror=()=>rej(r.error)})}
const tx=async(store,mode,fn)=>{const d=await open();return new Promise((res,rej)=>{const t=d.transaction(store,mode),s=t.objectStore(store);const r=fn(s);t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error)})};
const cget=k=>tx('cache','readonly',s=>s.get(k)).catch(()=>null);
const cset=(k,v)=>tx('cache','readwrite',s=>s.put({key:k,value:v,ts:Date.now()})).catch(()=>{});
const outAll=()=>tx('outbox','readonly',s=>s.getAll()).then(r=>r||[]).catch(()=>[]);
const outAdd=o=>tx('outbox','readwrite',s=>s.add(o));
const outPut=o=>tx('outbox','readwrite',s=>s.put(o));
const outDel=id=>tx('outbox','readwrite',s=>s.delete(id));
async function refreshCounts(){const a=await outAll();S.pending=a.filter(x=>x.status==='pending').length;S.failed=a.filter(x=>x.status==='failed').length;emit()}

async function net(method,url,body,hdr,timeout=TIMEOUT){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
  try{const r=await fetch((window.API_BASE||'')+url,{method,headers:{'content-type':'application/json',...hdr},body:body===undefined||body===null?undefined:JSON.stringify(body),signal:c.signal});
    const j=await r.json().catch(()=>({}));return{ok:r.ok,status:r.status,json:j}}
  finally{clearTimeout(t)}}
const isNetErr=e=>e&&(e.name==='AbortError'||e instanceof TypeError);

/* api(method,url,body,{role,user,label,offline}) — renvoie le JSON ; pour une écriture mise en file : {queued:true,opId} */
async function api(method,url,body,o={}){
  const hdr={};try{const tk=localStorage.getItem('ep_token');if(tk)hdr.authorization='Bearer '+tk}catch{}if(o.role)hdr['x-role']=o.role;if(o.user)hdr['x-user']=o.user;if(o.uid)hdr['x-uid']=o.uid;
  const ckey=method+' '+url+'|'+(o.role||'')+'|'+(o.user||'')+'|'+(o.uid||'');
  if(method==='GET'){
    try{const r=await net('GET',url,null,hdr);S.online=true;
      if(!r.ok)throw Object.assign(new Error(r.json.error||('Erreur '+r.status)),{http:r.status});
      cset(ckey,r.json);S.staleAt=null;emit();return r.json}
    catch(e){if(!isNetErr(e))throw e;S.online=false;
      const c=await cget(ckey);if(c){S.staleAt=c.ts;emit();return c.value}
      emit();throw Object.assign(new Error('Hors ligne : données non disponibles sur cet appareil'),{offline:true})}}
  // Écritures
  const opId=o.opId||uid();hdr['x-op-id']=opId;
  if(!navigator.onLine&&!o.online){return queue(method,url,body,hdr,o.label,opId)}
  try{const r=await net(method,url,body,hdr);S.online=true;
    if(!r.ok)throw Object.assign(new Error(r.json.error||('Erreur '+r.status)),{http:r.status});emit();return r.json}
  catch(e){if(!isNetErr(e))throw e;S.online=false;
    if(o.offline){const x=await o.offline();if(x!==undefined){emit();return x}}   // ex. vérification d'ordonnance hors ligne
    if(o.noQueue){emit();throw Object.assign(new Error('Hors ligne : cette action nécessite une connexion'),{offline:true})}
    return queue(method,url,body,hdr,o.label,opId)}}
async function queue(method,url,body,hdr,label,opId){
  await outAdd({opId,method,url,body,hdr,label:label||(method+' '+url),ts:Date.now(),status:'pending',error:null});
  await refreshCounts();registerBgSync();return{queued:true,opId,message:'Enregistré hors ligne : sera synchronisé automatiquement dès le retour de la connexion.'}}

/* Synchronisation de la file (ordre chronologique) */
async function sync(){
  if(S.syncing||!navigator.onLine)return;S.syncing=true;emit();let done=0,stop=false;const results=[];
  try{const ops=(await outAll()).filter(x=>x.status==='pending').sort((a,b)=>a.id-b.id);
    for(const op of ops){if(stop)break;
      try{const r=await net(op.method,op.url,op.body,op.hdr);S.online=true;
        if(r.ok){await outDel(op.id);done++;results.push({url:op.url,method:op.method,label:op.label,json:r.json})}
        else if(r.status>=500){stop=true}
        else{op.status='failed';op.error=r.json.error||('Erreur '+r.status);await outPut(op)}}
      catch(e){if(isNetErr(e)){S.online=false;stop=true}else throw e}}
  }finally{S.syncing=false;if(done)S.lastSync=Date.now();await refreshCounts();
    if(done)window.dispatchEvent(new CustomEvent('ep-synced',{detail:{done,results}}))}}
async function retry(id){const a=(await outAll()).find(x=>x.id===id);if(a){a.status='pending';a.error=null;await outPut(a);await refreshCounts();sync()}}
async function discard(id){await outDel(id);await refreshCounts()}
function registerBgSync(){try{navigator.serviceWorker&&navigator.serviceWorker.ready.then(r=>r.sync&&r.sync.register('ep-sync')).catch(()=>{})}catch{}}

/* Connexion : événements + sondage régulier (réseaux instables) */
window.addEventListener('online',()=>{S.online=true;emit();sync()});
window.addEventListener('offline',()=>{S.online=false;emit()});
if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.type==='ep-sync')sync()});
setInterval(async()=>{if(!navigator.onLine)return;
  try{const r=await net('GET','/api/health',null,{},4000);if(r.ok){if(!S.online){S.online=true;emit()}if(S.pending)sync()}}catch{if(S.online){S.online=false;emit()}}},20000);

/* Pastille d'état (bas gauche) + panneau de la file */
let pill,panel;
function render(){
  if(!document.body)return;
  if(!pill){pill=document.createElement('button');pill.id='ep-pill';
    Object.assign(pill.style,{position:'fixed',left:'10px',bottom:'10px',zIndex:'4000',padding:'6px 12px',borderRadius:'99px',border:'1px solid #0003',font:'600 12px system-ui,sans-serif',cursor:'pointer',boxShadow:'0 2px 8px #0003'});
    pill.onclick=showPanel;document.body.appendChild(pill)}
  const off=!S.online,txt=(off?'Hors ligne':'En ligne')+(S.pending?' · '+S.pending+' en attente':'')+(S.failed?' · '+S.failed+' à revoir':'')+(S.syncing?' · synchronisation…':'')+(off&&S.staleAt?' · données du '+new Date(S.staleAt).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'');
  pill.textContent=(off?'○ ':'● ')+txt;
  pill.style.background=S.failed?'#CE1021':off?'#F7D618':S.pending?'#FFF3C4':'#DDF3E5';pill.style.color=S.failed?'#fff':off?'#5A4500':'#0A4F29';
  pill.style.bottom=(document.querySelector('.tabs')?'84px':'10px');
  if(panel&&panel.dataset.open)fillPanel()}
async function fillPanel(){
  const ops=(await outAll()).sort((a,b)=>a.id-b.id);
  panel.innerHTML='<div style="display:flex;align-items:center;margin-bottom:8px"><b style="flex:1">File de synchronisation</b><button id="ep-x" style="border:0;background:none;font-size:18px;cursor:pointer">✕</button></div>'+
   '<div style="font-size:12px;color:#5B6B62;margin-bottom:8px">'+(S.online?'Connexion disponible.':'Pas de connexion : vos actions sont enregistrées sur l’appareil.')+(S.lastSync?' Dernière synchronisation : '+new Date(S.lastSync).toLocaleTimeString('fr-FR'):'')+'</div>'+
   (ops.length?ops.map(o=>'<div style="border:1px solid #DCE4DF;border-left:4px solid '+(o.status==='failed'?'#CE1021':'#F7D618')+';border-radius:8px;padding:6px 8px;margin-bottom:6px;font-size:13px"><b>'+esc(o.label)+'</b><br><small>'+new Date(o.ts).toLocaleString('fr-FR')+' · '+(o.status==='failed'?'<span style="color:#CE1021">Refusée : '+esc(o.error)+'</span>':'en attente')+'</small>'+(o.status==='failed'?'<br><button data-r="'+o.id+'" style="margin-top:4px">Réessayer</button> <button data-d="'+o.id+'" style="margin-top:4px;background:#fff;color:#CE1021;border-color:#CE1021">Abandonner</button>':'')+'</div>').join(''):'<div style="font-size:13px">Aucune opération en attente.</div>')+
   '<div style="margin-top:8px"><button id="ep-sync" '+(S.online?'':'disabled')+'>Synchroniser maintenant</button></div>';
  panel.querySelector('#ep-x').onclick=()=>{panel.remove();panel=null};
  panel.querySelector('#ep-sync').onclick=()=>sync();
  panel.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>retry(+b.dataset.r));panel.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>discard(+b.dataset.d))}
function showPanel(){if(panel){panel.remove();panel=null;return}
  panel=document.createElement('div');panel.dataset.open='1';
  Object.assign(panel.style,{position:'fixed',left:'10px',bottom:'52px',zIndex:'4001',width:'min(380px,calc(100vw - 20px))',maxHeight:'60vh',overflow:'auto',background:'#fff',border:'1px solid #DCE4DF',borderRadius:'12px',padding:'12px',boxShadow:'0 6px 24px #0004',font:'14px system-ui,sans-serif'});
  document.body.appendChild(panel);fillPanel()}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

window.EP={api,sync,state:()=>({...S}),subscribe:f=>{listeners.add(f);return()=>listeners.delete(f)},isOnline:()=>S.online&&navigator.onLine,outbox:outAll,cacheGet:cget,cacheSet:cset};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{render();refreshCounts();sync()});else{render();refreshCounts();sync()}
})();
