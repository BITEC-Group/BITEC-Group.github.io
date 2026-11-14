/* Tableau de bord de la console : tous les composants sont cliquables et ouvrent la page ou la section détaillée.
   Chargé après le script principal ; enveloppe vDash() sans modifier son rendu. Les cibles inaccessibles au profil connecté restent inertes. */
(function(){
  const st=document.createElement('style');
  st.textContent='.clk{cursor:pointer;position:relative;transition:box-shadow .15s,transform .15s}.clk:hover{box-shadow:0 5px 16px rgba(0,0,0,.2);transform:translateY(-1px)}.clk:focus-visible{outline:3px solid #007FFF;outline-offset:2px}'+
    '.card.kpi.clk::after{content:"›";position:absolute;right:12px;top:8px;font-size:22px;color:#5B6B62}tr.clk:hover{background:#EEF6F1}.legend .clk:hover,.dashbar.clk:hover{background:#EEF6F1;border-radius:6px}';
  document.head.appendChild(st);
  const allowed=m=>typeof ROLES!=='undefined'&&ROLES[ROLE]&&ROLES[ROLE].m.includes(m);
  const reg=(o={})=>{REGF.q='';REGF.st=o.st||'';REGF.sts=o.sts||null;REGF.prov=o.prov||'';navTo('reg')};
  const MAP={ // module de repli si le profil n'a pas accès à la cible
    tarifs:()=>allowed('tarifs')?navTo('tarifs'):allowed('reg')?reg():null};
  function make(el,label,fn,mod){
    if(!el)return;if(mod&&!allowed(mod))return;
    el.classList.add('clk');el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label','Ouvrir le détail : '+label);el.title='Ouvrir le détail';
    el.onclick=ev=>{if(ev.target.closest('a'))ev.preventDefault();fn()};
    el.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();fn()}}}
  function decorate(v){
    // 1. indicateurs (8 cartes) : même ordre que dans vDash
    const kp=[...v.querySelectorAll('.grid.g4 > .card.kpi')];
    const T=[
      ['Officines et pharmacies enregistrées',()=>reg({sts:['autorisee','renouvellement','expiree','en_attente']}),'reg'],
      ['Officines identifiées (carte valide ou à renouveler)',()=>reg({sts:['autorisee','renouvellement']}),'reg'],
      ['Officines à régulariser',()=>reg({sts:['expiree','en_attente']}),'reg'],
      ['Officines non autorisées signalées',()=>reg({st:'clandestine'}),'reg'],
      ['Recettes des cartes annuelles (barèmes)',()=>allowed('tarifs')?navTo('tarifs'):reg(),'reg'],
      ['Prescriptions électroniques',()=>navTo('rx'),'rx'],
      ['Déclarations d’approvisionnement',()=>navTo('supply'),'supply'],
      ['Conflits de distance d’implantation (carte)',()=>navTo('map'),'map']];
    kp.forEach((el,i)=>{const t=T[i];if(t)make(el,t[0],t[1],t[2])});
    // 2. barres par province
    const cards=[...v.querySelectorAll('.grid.g2 > .card')];
    if(cards[0])cards[0].querySelectorAll(':scope > div[style*="display:flex"]').forEach(row=>{
      const name=row.firstElementChild&&row.firstElementChild.textContent.trim();row.classList.add('dashbar');make(row,'Officines de la province '+name,()=>reg({prov:name}),'reg')});
    // 3. diagramme des statuts : segments et légende
    if(cards[1]){const keys=Object.keys(statLbl);
      cards[1].querySelectorAll('svg circle').forEach((c,i)=>{if(keys[i])make(c,'Officines : '+statLbl[keys[i]][0],()=>reg({st:keys[i]}),'reg')});
      cards[1].querySelectorAll('.legend > div').forEach((d,i)=>{if(keys[i])make(d,'Officines : '+statLbl[keys[i]][0],()=>reg({st:keys[i]}),'reg')})}
    // 4. alertes : toute la ligne ouvre le module concerné
    if(cards[2])cards[2].querySelectorAll('tr').forEach(tr=>{const a=tr.querySelector('a[href^="#"]');if(a){const m=a.getAttribute('href').slice(1);make(tr,tr.textContent.trim().slice(0,80),()=>navTo(m),m)}});
    // 5. journal d'activité : la ligne ouvre le module correspondant à l'action
    if(cards[3])cards[3].querySelectorAll('tr').forEach(tr=>{const txt=(tr.children[1]||tr).textContent;
      const m=/prescri|ordonnance|d[ée]livr/i.test(txt)?'rx':/\bPV\b|encaiss|proc[èe]s/i.test(txt)?'insp':/approvision|d[ée]claration/i.test(txt)?'supply':/dossier|AMM|titre/i.test(txt)?'titles':/signal/i.test(txt)?'signalements':/carte|officine/i.test(txt)?'reg':null;
      if(m)make(tr,txt.slice(0,80),()=>navTo(m),m)});
    // 6. titres des cartes : accès direct à la section
    const heads=[[cards[0],'reg'],[cards[1],'reg'],[cards[2],'titles'],[cards[3],'reports']];
    heads.forEach(([c,m])=>{const h=c&&c.querySelector('h3');if(h&&allowed(m)){h.style.cursor='pointer';h.title='Ouvrir la section détaillée';h.onclick=()=>m==='reg'?reg():navTo(m)}})}
  // Accueil : les 4 indicateurs sont cliquables
  function decorateHome(v){
    const k=[...v.querySelectorAll('.grid.g4 > .card.kpi')];
    const T=[['Officines et pharmacies enregistrées',()=>reg({sts:['autorisee','renouvellement','expiree','en_attente']}),'reg'],['Titres à renouveler ou expirés',()=>reg({sts:['renouvellement','expiree']}),'reg'],['Officines non autorisées signalées',()=>reg({st:'clandestine'}),'reg'],['Dossiers en cours',()=>navTo('titles'),'titles']];
    k.forEach((el,i)=>{const x=T[i];if(x)make(el,x[0],x[1],x[2])})}
  const origHome=vHome;
  vHome=function(v){origHome(v);try{decorateHome(v)}catch(e){console.warn('accueil cliquable : '+e.message)}};
  const orig=vDash;
  vDash=function(v){orig(v);try{decorate(v)}catch(e){console.warn('dashboard cliquable : '+e.message)}};
})();
