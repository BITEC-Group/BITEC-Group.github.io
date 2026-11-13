/* E-Pharma — mise à jour des versions web (console, mobile PWA, pages publiques).
   À chaque accès, au retour sur l'onglet et toutes les 30 min, la page compare sa version (injectée par le serveur) à celle du serveur
   (/api/public/version) et le service worker à sa dernière version. Dès qu'une nouvelle version existe : message + bouton « Mettre à jour »
   (vide les caches et recharge). Fonctionne sur tous les appareils, avec ou sans service worker. */
(function(){
  const CUR='0.7.10';
  const num=v=>String(v||'0').split('+')[0].split('.').map(x=>parseInt(x,10)||0);
  const newer=(a,b)=>{const x=num(a),y=num(b);for(let i=0;i<3;i++){const d=(x[i]||0)-(y[i]||0);if(d)return d>0}return false};
  let banner=null,latest=null,dismissed=null,reloading=false;
  async function apply(){
    if(reloading)return;reloading=true;
    try{if('serviceWorker' in navigator){const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.update().catch(()=>{})))}
        if(window.caches){for(const k of await caches.keys())await caches.delete(k)}}catch{}
    location.reload()}
  function show(v,notes,required){
    if(banner)banner.remove();banner=document.createElement('div');banner.id='ep-update';
    banner.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#0A4F29;color:#fff;padding:10px 14px;display:flex;gap:10px;align-items:center;justify-content:center;font:14px system-ui,sans-serif;flex-wrap:wrap;box-shadow:0 -2px 10px rgba(0,0,0,.3)';
    const s=document.createElement('span');s.textContent='Nouvelle version '+v+' d’E-Pharma disponible'+(CUR.indexOf('__')===0?'':' (vous avez la '+CUR+')')+'.'+(notes?' '+notes:'');banner.append(s);
    const b=document.createElement('button');b.textContent='Mettre à jour';b.style.cssText='background:#F7D618;color:#14231B;border:0;border-radius:8px;padding:7px 14px;font:inherit;font-weight:600;cursor:pointer';b.onclick=apply;banner.append(b);
    if(!required){const l=document.createElement('button');l.textContent='Plus tard';l.style.cssText='background:transparent;color:#fff;border:1px solid #fff;border-radius:8px;padding:7px 12px;font:inherit;cursor:pointer';l.onclick=()=>{dismissed=v;banner.remove();banner=null};banner.append(l)}
    document.body.appendChild(banner)}
  async function check(){
    try{
      const base=window.API_BASE||'';const r=await fetch(base+'/api/public/version',{cache:'no-store'});if(!r.ok)return;const j=await r.json();latest=j.version;
      const known=CUR.indexOf('__')!==0;if(!known)return;
      const must=newer(j.min_version||'0.0.0',CUR),nw=newer(j.version,CUR);
      if(!nw&&!must){if(banner){banner.remove();banner=null}return}
      if(!must&&dismissed===j.version)return;
      show(j.version,j.notes||'',must);
    }catch{/* hors ligne : on réessaiera */}}
  function boot(){
    check();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
    window.addEventListener('online',check);setInterval(check,30*60*1000);
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{
        const upd=()=>reg.update().catch(()=>{});
        document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')upd()});setInterval(upd,30*60*1000);upd();
        // nouveau service worker installé : le message apparaît même si le numéro de version n'a pas été comparé
        reg.addEventListener('updatefound',()=>{const w=reg.installing;if(w)w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller&&!banner)show(latest||'récente','',false)})});
      }).catch(()=>{})}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
