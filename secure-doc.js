/* E-Pharma — couche de sécurité des documents imprimables (certificat, titre, PV, ordonnance).
   Équivalents numériques des protections observées sur les certificats ACOREP (échantillons « anti-counterfeiting ») :
   - guillochis + rosette en fond (impression fine, difficile à reproduire proprement) ;
   - motif « COPIE » révélé à la photocopie / au scan (trame de lignes à deux orientations, quasi invisible à l'impression d'origine) ;
   - micro-texte répété sur le cadre (illisible à l'œil, brouillé à la copie) ;
   - cachet rouge circulaire numéroté ;
   - emplacement réservé à l'étiquette hologramme sérialisée (à poser à l'impression) ;
   - numéro de document + code de contrôle à saisir sur /verifier.html si le QR n'est pas lisible ;
   - QR code signé (état réel lu sur le serveur).
   Limite : l'effet « COPIE » et le micro-texte dépendent de la résolution de l'imprimante (600 dpi ou plus recommandé) ; l'hologramme, l'encre OVI/UV
   et le papier sécurisé sont des éléments physiques à commander auprès de l'imprimeur de sécurité. */
window.EPSec=(function(){
  const GREEN='#0E6B38',RED='#C8102E',GOLD='#B8941F',BLUE='#007FFF';
  const f=n=>n.toFixed(2);
  function guilloche(w,h){
    let p='';
    for(let k=0;k<30;k++){const amp=2.6+(k%6)*.55,ph=k*.33,y0=h*(k/30);let d='M0 '+f(y0);
      for(let x=0;x<=w;x+=1.6)d+=' L'+f(x)+' '+f(y0+amp*Math.sin(x/9+ph)+amp*.6*Math.sin(x/4.1-ph*2));p+='<path d="'+d+'"/>'}
    // rosette centrale (épicycloïde) en deux couleurs
    const ros=(cx,cy,R,r,d,col,op)=>{let s='M';for(let t=0;t<=Math.PI*2*r/ (gcd(R,r)||1)+.01;t+=.03){const x=cx+(R-r)*Math.cos(t)+d*Math.cos((R-r)/r*t),y=cy+(R-r)*Math.sin(t)-d*Math.sin((R-r)/r*t);s+=(s==='M'?'':' L')+f(x)+' '+f(y)}
      return '<path d="'+s+'" fill="none" stroke="'+col+'" stroke-width=".16" opacity="'+op+'"/>'};
    const gcd=(a,b)=>b?gcd(b,a%b):a;
    const cx=w/2,cy=h/2;
    return '<svg class="sec-guil" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="'+GREEN+'" stroke-width=".16" opacity=".13">'+p+'</g>'+
      ros(cx,cy,46,17,24,GREEN,.2)+ros(cx,cy,40,13,20,GOLD,.22)+ros(cx,cy,34,11,17,BLUE,.14)+'</svg>'}
  function voidLayer(w,h,word){
    word=word||'COPIE';let t='';
    for(let y=14;y<h;y+=30)for(let x=(Math.round(y/30)%2?8:-10);x<w;x+=68)t+='<text x="'+x+'" y="'+y+'" transform="rotate(-18 '+x+' '+y+')">'+word+'</text>';
    return '<svg class="sec-void" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" aria-hidden="true"><defs>'+
      '<pattern id="pvA" width=".5" height=".5" patternUnits="userSpaceOnUse"><rect width=".5" height=".17" fill="'+GREEN+'"/></pattern>'+
      '<pattern id="pvB" width=".5" height=".5" patternUnits="userSpaceOnUse"><rect width=".17" height=".5" fill="'+GREEN+'"/></pattern></defs>'+
      '<rect width="'+w+'" height="'+h+'" fill="url(#pvA)" opacity=".07"/><g fill="url(#pvB)" opacity=".07" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="13">'+t+'</g></svg>'}
  function micro(text,n){text=text||'E-PHARMA · ACOREP · DOCUMENT AUTHENTIFIÉ · ';return Array(n||60).fill(text).join('')}
  function microBorder(){const s=micro();return '<div class="mt mt-t">'+s+'</div><div class="mt mt-b">'+s+'</div><div class="mt mt-l">'+s+'</div><div class="mt mt-r">'+s+'</div>'}
  function seal(serial,label){
    const id='sealp'+Math.random().toString(36).slice(2,7);serial=serial||'';
    return '<svg class="sec-seal" viewBox="0 0 120 120" aria-label="Cachet"><defs><path id="'+id+'" d="M60 60 m-47 0 a47 47 0 1 1 94 0 a47 47 0 1 1 -94 0"/></defs>'+
      '<g fill="none" stroke="'+RED+'" stroke-width="2.2"><circle cx="60" cy="60" r="57"/><circle cx="60" cy="60" r="38" stroke-width="1.2"/><circle cx="60" cy="60" r="29" stroke-width=".8" stroke-dasharray="1.5 2"/></g>'+
      '<text font-size="7.4" font-weight="700" fill="'+RED+'" font-family="Arial,sans-serif"><textPath href="#'+id+'" startOffset="0" textLength="288" lengthAdjust="spacingAndGlyphs">AUTORITÉ CONGOLAISE DE RÉGLEMENTATION PHARMACEUTIQUE · ACOREP ·</textPath></text>'+
      '<text x="60" y="56" text-anchor="middle" font-size="13" font-weight="900" fill="'+RED+'" font-family="Arial,sans-serif">ACOREP</text>'+
      '<text x="60" y="68" text-anchor="middle" font-size="6.2" font-weight="700" fill="'+RED+'" font-family="Arial,sans-serif">'+(label||'ENREGISTRÉ')+'</text>'+
      '<text x="60" y="78" text-anchor="middle" font-size="5" fill="'+RED+'" font-family="ui-monospace,Consolas,monospace">'+serial+'</text></svg>'}
  function holo(serial){return '<div class="sec-holo"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="none" stroke="#6B7A72" stroke-width="1.4" stroke-dasharray="4 3"/><circle cx="50" cy="50" r="38" fill="none" stroke="#B8C4BD" stroke-width=".8"/>'+
      '<text x="50" y="44" text-anchor="middle" font-size="8.5" fill="#6B7A72" font-family="Arial,sans-serif" font-weight="700">HOLOGRAMME</text><text x="50" y="55" text-anchor="middle" font-size="7.5" fill="#6B7A72" font-family="Arial,sans-serif">sécurisé ACOREP</text>'+
      '<text x="50" y="67" text-anchor="middle" font-size="6.4" fill="#6B7A72" font-family="ui-monospace,Consolas,monospace">'+(serial||'')+'</text></svg></div>'}
  /* Applique les couches de fond à une feuille (élément positionné) : guillochis, trame « COPIE » et micro-texte du cadre. */
  function layers(sheet,wmm,hmm,opts){opts=opts||{};
    const wrap=document.createElement('div');wrap.className='sec-layers';wrap.innerHTML=guilloche(wmm,hmm)+voidLayer(wmm,hmm,opts.word)+(opts.noMicro?'':microBorder());
    sheet.insertBefore(wrap,sheet.firstChild);return wrap}
  const ctrl=c=>String(c||'').toUpperCase().replace(/(.{5})(.{5})/,'$1-$2');
  return{guilloche,voidLayer,microBorder,seal,holo,layers,ctrl}
})();
