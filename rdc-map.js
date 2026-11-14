/* Carte d'ensemble de la RDC (console et mobile) : sans fond de carte, sans inscriptions permanentes.
   Seuls les contours des provinces et les établissements (pharmacies, officines, dépôts pharmaceutiques, importateurs) sont tracés.
   En zoomant (zoom >= STREET_Z) le fond de rues avec leurs noms apparaît automatiquement, en reculant il disparaît. */
(function(){
  const STREET_Z=11.5,BOUNDS=[[-13.6,12.1],[5.5,31.4]];
  const CATS={pharmacie:['Pharmacies','#0E8A45'],officine:['Officines','#00A6A6'],depot:['Dépôts pharmaceutiques','#F28C00'],importateur:['Importateurs et grossistes','#6A4CC9'],illegale:['Non autorisées signalées','#222222']};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const catOf=(nom,statut)=>statut==='clandestine'?'illegale':/d[ée]p[oô]t/i.test(nom||'')?'depot':/^officine/i.test(nom||'')?'officine':'pharmacie';
  const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
  /* Les importateurs n'ont pas de coordonnées : position indicative autour du chef-lieu de leur province (décalage stable par identifiant). */
  const jitter=(id,c,r)=>{const h=hash(id),a=(h%3600)/3600*2*Math.PI,d=(r||.1)*Math.sqrt(((h>>>8)%1000)/1000);return[c[0]+d*Math.sin(a),c[1]+d*Math.cos(a)/Math.max(.3,Math.cos(c[0]*Math.PI/180))]};
  function pointsFrom(o){
    const P=[];(o.officines||[]).forEach(x=>{if(x.lat==null||x.lon==null)return;P.push({id:x.id,nom:x.nom,cat:catOf(x.nom,x.statut),lat:x.lat,lon:x.lon,prov:x.prov,entite:x.entite||x.ville||'',statut:x.statut||'autorisee'})});
    (o.entites||[]).forEach(e=>{const c=(o.provCenter||{})[e.prov];if(!c)return;const p=jitter(e.id,c,.12);P.push({id:e.id,nom:e.nom,cat:'importateur',lat:p[0],lon:p[1],prov:e.prov,entite:e.ville||e.prov,approx:true})});
    return P}
  let css=false;
  function addCss(){if(css)return;css=true;const s=document.createElement('style');
    s.textContent='.rdcLeg{background:#fffffff2;border-radius:10px;padding:4px 7px;font:11px system-ui,sans-serif;box-shadow:0 1px 6px #0003;max-width:200px}.rdcLeg div{display:flex;align-items:center;gap:5px;padding:1px 0;cursor:pointer;user-select:none}.rdcLeg div.off{opacity:.35;text-decoration:line-through}.rdcLeg i{width:11px;height:11px;border-radius:50%;flex:none;border:1px solid #fff;box-shadow:0 0 0 1px #0003}.rdcLeg b{margin-left:auto;padding-left:6px}.rdcLeg p.rdcSum{margin:0 0 3px;padding-bottom:3px;border-bottom:1px solid #0002;font-weight:600;cursor:default}.rdcLeg p.rdcSum b{margin:0;padding:0}'+
    '.rdcHi{width:26px;height:26px;border-radius:50%;background:#0E8A45;color:#fff;border:3px solid #fff;box-shadow:0 1px 6px #0006;font:700 13px/20px system-ui,sans-serif;text-align:center}.rdcMe{width:18px;height:18px;border-radius:50%;background:#007FFF;border:3px solid #fff;box-shadow:0 0 0 2px #007FFF66,0 1px 6px #0006}.gtip2{font:12px system-ui,sans-serif}';
    document.head.appendChild(s)}
  function mount(el,o){
    addCss();el=typeof el==='string'?document.querySelector(el):el;
    const m=L.map(el,{zoomSnap:.25,minZoom:4,maxZoom:19,worldCopyJump:false});m.fitBounds(BOUNDS,{padding:[4,4]});
    el.style.background='#E8F1EB';m.attributionControl.setPrefix(false);
    let geo=null;
    if(o.geo)geo=L.geoJSON(o.geo,{style:{color:'#7FA08F',weight:1,fillColor:'#FFFFFF',fillOpacity:.8},onEachFeature:(f,l)=>{const n=(o.provName?o.provName(f.properties.name):f.properties.name);l.bindTooltip(esc(n),{sticky:true,className:'gtip2'})}}).addTo(m);
    m.createPane('pts');m.getPane('pts').style.zIndex=450;const rend=L.canvas({padding:.5,pane:'pts'}),groups={},counts={};
    Object.keys(CATS).forEach(k=>{groups[k]=L.layerGroup().addTo(m);counts[k]=0});
    const hid={};
    (o.points||[]).forEach(p=>{if(!groups[p.cat])return;counts[p.cat]++;
      const mk=L.circleMarker([p.lat,p.lon],{renderer:rend,radius:p.cat==='importateur'?3.5:4.5,color:'#fff',weight:.9,fillColor:CATS[p.cat][1],fillOpacity:.95});
      mk.bindPopup(()=>o.popup?o.popup(p):'<b>'+esc(p.nom)+'</b><br><small>'+esc(CATS[p.cat][0])+' · '+esc(p.entite||p.prov||'')+'</small>'+(p.approx?'<br><small>position indicative (chef-lieu)</small>':''));
      mk.on('click',()=>{if(o.onPick)o.onPick(p)});mk.addTo(groups[p.cat])});
    const leg=L.control({position:'bottomleft'});
    leg.onAdd=()=>{const d=L.DomUtil.create('div','rdcLeg');L.DomEvent.disableClickPropagation(d);
      d.innerHTML=(o.summary?'<p class="rdcSum">'+o.summary+'</p>':'')+Object.keys(CATS).filter(k=>counts[k]>0||k!=='illegale').map(k=>'<div data-k="'+k+'"><i style="background:'+CATS[k][1]+'"></i>'+CATS[k][0]+'<b>'+counts[k]+'</b></div>').join('');
      d.querySelectorAll('[data-k]').forEach(r=>r.onclick=()=>{const k=r.dataset.k;hid[k]=!hid[k];r.classList.toggle('off',hid[k]);hid[k]?m.removeLayer(groups[k]):groups[k].addTo(m)});return d};
    leg.addTo(m);
    /* fond de rues avec noms, seulement quand on zoome */
    let street=null;
    const sync=()=>{const z=m.getZoom(),near=z>=STREET_Z;
      if(near&&!street&&window.epTileLayer){street=epTileLayer({labels:true});street.addTo(m)}
      if(!near&&street){m.removeLayer(street);street=null}
      if(geo)geo.setStyle({fillOpacity:near?0:.8,opacity:near?.5:1})};
    m.on('zoomend',sync);
    if(o.onMapClick)m.on('click',o.onMapClick);
    let me=null,hi=null,zone=null,userFit=false;const hav=(a,b,c,d)=>{const t=x=>x*Math.PI/180,k=Math.sin(t(c-a)/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(t(d-b)/2)**2;return 12742000*Math.asin(Math.sqrt(k))};
    const api={map:m,counts,
      reset(){userFit=false;if(zone){m.removeLayer(zone);zone=null};m.fitBounds(BOUNDS,{padding:[4,4]})},
      setUser(u){if(me){m.removeLayer(me);me=null}if(u)me=L.marker([u.lat,u.lon],{icon:L.divIcon({className:'',html:'<div class="rdcMe"></div>',iconSize:[18,18],iconAnchor:[9,9]}),keyboard:false}).bindTooltip('Vous êtes ici').addTo(m)},
      /* met en évidence les pharmacies les plus proches (numérotées) et cadre la carte sur l'utilisateur et ces pharmacies */
      showNearest(u,list,fit){if(hi){m.removeLayer(hi);hi=null}api.setUser(u);hi=L.layerGroup().addTo(m);
        list.forEach((x,i)=>L.marker([x.lat,x.lon],{icon:L.divIcon({className:'',html:'<div class="rdcHi">'+(i+1)+'</div>',iconSize:[26,26],iconAnchor:[13,13]}),zIndexOffset:500})
          .bindPopup(()=>o.popup?o.popup(Object.assign({cat:'pharmacie'},x)):'<b>'+esc(x.nom)+'</b>').addTo(hi));
        if(fit!==false)api.zoomHere(u,list)},
      /* vue détaillée du secteur : périmètre autour de l'utilisateur couvrant les pharmacies les plus proches, avec le fond de rues */
      zoomZone(u,list,label){userFit=true;if(zone){m.removeLayer(zone);zone=null}
        const far=Math.max(500,...(list||[]).map(x=>x.distance!=null?x.distance:hav(u.lat,u.lon,x.lat,x.lon))),r=Math.ceil(far/250)*250+150;
        zone=L.circle([u.lat,u.lon],{radius:r,color:'#007FFF',weight:2,dashArray:'7 6',fillColor:'#007FFF',fillOpacity:.05,interactive:false}).addTo(m);
        if(label)zone.bindTooltip(label+' · rayon '+(r<1000?r+' m':(r/1000).toFixed(r%1000?2:0)+' km'),{permanent:true,direction:'top',className:'gtip2'});
        m.fitBounds(zone.getBounds(),{padding:[14,14],maxZoom:17})},
      zoomHere(u,list){userFit=true;const pts=[[u.lat,u.lon]].concat((list||[]).map(x=>[x.lat,x.lon]));
        if(pts.length>1)m.fitBounds(pts,{padding:[30,30],maxZoom:16});else m.setView(pts[0],15)},
      destroy(){m.remove()}};
    setTimeout(()=>{m.invalidateSize();if(!userFit)m.fitBounds(BOUNDS,{padding:[4,4]})},60);
    return api}
  window.RDCMap={CATS,catOf,jitter,pointsFrom,mount};
})();
