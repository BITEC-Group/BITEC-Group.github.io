/* Configuration du frontend. Si l'API est hébergée sur une autre adresse (frontend séparé), renseignez-la ici,
   par exemple : window.API_BASE='https://api.exemple.org';  (le serveur doit alors définir CORS_ORIGIN=<adresse du frontend>). */
/* Hébergement GitHub Pages : adresse de l'API lue dans api-base.json (mise à jour sans toucher au code). */
try{if(!window.API_BASE){const x=new XMLHttpRequest();x.open('GET','/api-base.json?t='+Date.now(),false);x.send();if(x.status===200)window.API_BASE=JSON.parse(x.responseText).api||''}}catch(e){}
window.API_BASE=window.API_BASE||'';

/* Fond de carte SANS CLÉ : OpenFreeMap (tuiles vectorielles OpenMapTiles / données OpenStreetMap, gratuit, sans compte ni clé API, sans exigence de Referer),
   rendu net à tous les zooms via MapLibre GL. Si WebGL est indisponible, repli sur le fond raster Esri (également sans clé).
   Autre fournisseur : window.TILE_STYLE='https://…/style.json' (vectoriel) ou window.TILE_URL='https://…/{z}/{x}/{y}.png' (raster), avant ce fichier. */
/* Masque tous les calques de symboles du fond (noms de lieux, icônes, numéros, repères) : il ne reste que le relief, l'eau, les routes et les limites. */
function clean(layer){
  layer.on('add',()=>{try{const g=layer.getMaplibreMap();const hide=()=>{try{((g.getStyle()||{}).layers||[]).forEach(l=>{if(l.type==='symbol'&&(g.getLayoutProperty(l.id,'visibility')!=='none'))g.setLayoutProperty(l.id,'visibility','none')})}catch{}};g.on('styledata',hide);g.on('load',hide);hide()}catch{}});
  return layer}
window.epTileLayer=function(opt){
  const webgl=(()=>{try{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}})();
  if(!window.TILE_URL&&webgl&&window.maplibregl&&L.maplibreGL)
    return (opt&&opt.labels?x=>x:clean)(L.maplibreGL({style:window.TILE_STYLE||'https://tiles.openfreemap.org/styles/liberty',attribution:'<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Données <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>'}));
  return L.tileLayer(window.TILE_URL||'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,referrerPolicy:'origin',crossOrigin:true,
    attribution:window.TILE_ATTRIB||'Fond de carte © Esri, HERE, Garmin, © OpenStreetMap contributors'});
};
