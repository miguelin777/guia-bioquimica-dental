(function(){
'use strict';
/* ================= utilidades ================= */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAY=864e5, NOW=()=>Date.now();
const pad3=n=>String(n).padStart(3,'0');
const figSrc=n=>'fig/p'+pad3(n)+'.jpg';
const pct=x=>Math.round((x||0)*100)+'%';
const today=()=>new Date().toLocaleDateString('en-CA');
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function md(s,cloze){
  let h=esc(s);
  h=h.replace(/\*\*(.+?)\*\*/g,(m,a)=>cloze?'<strong class="cz" tabindex="0" title="Toca para mostrar">'+a+'</strong>':'<strong>'+a+'</strong>');
  h=h.replace(/(^|[\s(¿¡"“])\*(?!\s)([^*]+?)\*(?=[\s.,;:)?!"”]|$)/g,'$1<em>$2</em>');
  return h.replace(/\n/g,'<br>');
}
const plain=s=>String(s||'').replace(/\*\*/g,'').replace(/\*/g,'');
const SUP={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':' ','⁻':' '};
function canon(s){
  s=String(s||'').toLowerCase()
    .replace(/[₀-₉]/g,d=>String(d.charCodeAt(0)-8320))
    .replace(/[⁰¹²³⁴-⁹⁺⁻]/g,d=>SUP[d]||' ')
    .replace(/β/g,'beta').replace(/α/g,'alfa').replace(/γ/g,'gamma').replace(/δ/g,'delta').replace(/ω/g,'omega').replace(/alpha/g,'alfa');
  s=s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  return s.replace(/^(el|la|los|las|un|una|unos|unas|al|del|de) /,'');
}
const strip=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function lev(a,b){if(a===b)return 0;const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let p=Array.from({length:n+1},(_,i)=>i);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c;}return p[n];}
/* Vocabulario del curso: si lo escrito es OTRA palabra real (reversible/irreversible, lactosa/lactasa),
   no se perdona como error de dedo. */
let VOC=null;
function vocab(){
  if(VOC)return VOC;VOC=new Set();
  const add=s=>canon(s).split(' ').forEach(w=>{if(w.length>=4)VOC.add(w);});
  Object.values(S.sec).forEach(s=>add(s.titulo+' '+s.txt));
  S.temas.forEach(t=>{(t.glosario||[]).forEach(g=>add(g.termino+' '+g.definicion));t.tarjetas.forEach(c=>add(c.frente+' '+c.reverso));t.preguntas.forEach(q=>add(q.enunciado+' '+(q.opciones||[]).join(' ')+' '+(q.respuestas||[]).join(' ')));});
  return VOC;
}
function matchFill(resp,answers){
  const r=canon(resp); if(!r) return 0;
  for(const a of answers) if(r===canon(a)) return 2;
  const rw=r.split(' ');
  for(const a of answers){
    const c=canon(a);if(c.length<5||lev(r,c)>(c.length>=11?2:1))continue;
    if(r.slice(0,2)!==c.slice(0,2))continue;
    const cw=c.split(' ');
    // cada palabra distinta de la respuesta no debe ser otra palabra real del material
    if(rw.length===cw.length&&rw.some((w,i)=>w!==cw[i]&&vocab().has(w)))continue;
    return 1;
  }
  return 0;
}
function fmtDur(ms){const m=Math.round(ms/60000);return m<1?'menos de 1 min':m+' min';}
function fmtInt(days){if(days<1/24)return '<1 h';if(days<1)return Math.round(days*24)+' h';if(days<45)return Math.round(days)+' d';return Math.round(days/30)+' mes';}
function fmtDate(t){return new Date(t).toLocaleDateString('es-MX',{day:'numeric',month:'short'});}
let toastT=null;
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true;},2600);}
function pagesTxt(p){
  if(!Array.isArray(p)||!p.length) return '';
  const pairs=[];for(let i=0;i<p.length;i+=2){const a=p[i],b=p[i+1]==null?p[i]:p[i+1];pairs.push(a===b?String(a):a+'–'+b);}
  const one=pairs.length===1&&!pairs[0].includes('–');
  return (one?'pág. ':'págs. ')+pairs.join(', ');
}

/* ================= estado ================= */
const S={temas:[],byId:{},sec:{},q:{},c:{},secQ:{},secC:{},figs:{},route:{v:'inicio'},setup:{},active:{},qz:{},
  sample:null,chat:{},fy:{},gq:{},searchQ:'',ix:null,exSetup:null,glQ:'',pendingSec:null,lastQz:null,io:null,confirmReset:false,
  rutas:[],rutaById:{},ru:{},fresh:true,freshTab:false};
const LS='bq-dental-guia-v1';
const QI=[0,1,3,7,16];          // días entre repasos de preguntas según caja
const CI=[0,1,2,4,8,16,32];     // días entre repasos de tarjetas según caja
const NEW_CARDS_DAY=20;
function emptyP(){return {v:1,u:0,q:{},c:{},r:{},e:{},d:{},x:[],fecha:null,cz:false};}
function loadLocal(){try{const s=localStorage.getItem(LS);if(s)return Object.assign(emptyP(),JSON.parse(s));}catch(e){}return emptyP();}
let P=loadLocal();
function saveLocal(){try{localStorage.setItem(LS,JSON.stringify(P));}catch(e){}}
function touch(){P.u=NOW();saveLocal();scheduleRemote();}
function dayRec(k){k=k||today();return P.d[k]||(P.d[k]={q:0,k:0,c:0,nc:0});}
function mergeP(a,b){
  const o=emptyP();
  for(const k of ['q','c']){o[k]=Object.assign({},a[k]);for(const id in (b[k]||{})){const x=b[k][id];if(!o[k][id]||(x.t||0)>(o[k][id].t||0))o[k][id]=x;}}
  for(const k of ['r','e']){o[k]=Object.assign({},a[k]);for(const id in (b[k]||{})){const x=b[k][id]||0;if(Math.abs(x)>Math.abs(o[k][id]||0))o[k][id]=x;}}
  o.d=Object.assign({},a.d);for(const day in (b.d||{})){const x=b.d[day],y=o.d[day]||{};o.d[day]={q:Math.max(x.q||0,y.q||0),k:Math.max(x.k||0,y.k||0),c:Math.max(x.c||0,y.c||0),nc:Math.max(x.nc||0,y.nc||0)};}
  const seen={};o.x=[...(a.x||[]),...(b.x||[])].filter(e=>{if(seen[e.t])return false;seen[e.t]=1;return true;}).sort((m,n)=>m.t-n.t).slice(-60);
  const newer=(b.u||0)>(a.u||0)?b:a;o.fecha=newer.fecha||null;o.cz=!!newer.cz;o.u=Math.max(a.u||0,b.u||0);
  return o;
}

/* ---- sincronización con la cuenta (capability db) ---- */
const Sync={ref:null,on:false,busy:false,dirty:false,timer:null};
function syncBadge(){const el=$('#sync');if(!el)return;el.classList.toggle('on',Sync.on);el.querySelector('span').textContent=Sync.on?'Sincronizado con tu cuenta':'Guardado en este navegador';}
function scheduleRemote(){if(!Sync.ref)return;clearTimeout(Sync.timer);Sync.timer=setTimeout(flushRemote,2500);}
async function flushRemote(){
  if(!Sync.ref)return; if(Sync.busy){Sync.dirty=true;return;}
  Sync.busy=true;
  try{await Sync.ref.set({p:JSON.stringify(P),u:P.u});Sync.on=true;}
  catch(e){if(e&&e.code==='invalid_argument'){Sync.ref=null;Sync.on=false;}}
  Sync.busy=false;syncBadge();
  if(Sync.dirty){Sync.dirty=false;scheduleRemote();}
}
async function pullRemote(){
  if(!Sync.ref)return;
  try{const snap=await Sync.ref.get();if(snap.exists){const d=snap.data();const r=typeof d.p==='string'?JSON.parse(d.p):null;if(r&&(r.u||0)!==(P.u||0)){P=mergeP(P,r);saveLocal();softRefresh();}}Sync.on=true;}catch(e){}
  syncBadge();
}
async function initCaps(){
  const C=window.claude; if(!C||typeof C.use!=='function') return;
  C.use('sample').then(s=>{if(s){S.sample=s;softRefresh();}}).catch(()=>{});
  try{
    const [db,user]=await Promise.all([C.use('db'),C.use('user')]);
    if(!db||!user)return; const uid=await user.id(); if(!uid)return;
    Sync.ref=db.doc('data/users/'+uid+'/progreso');
    await pullRemote(); scheduleRemote();
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){clearTimeout(Sync.timer);flushRemote();}else pullRemote();});
  }catch(e){Sync.ref=null;}
}

/* ================= contenido ================= */
function blocksText(bl){
  return (bl||[]).map(b=>{
    switch(b.tipo){
      case 'lista': return (b.items||[]).map(x=>'- '+plain(x)).join('\n');
      case 'tabla': return [(b.columnas||[]).join(' | '),...(b.filas||[]).map(r=>r.map(plain).join(' | '))].join('\n');
      case 'pasos': return (b.titulo?plain(b.titulo)+':\n':'')+(b.items||[]).map((x,i)=>(i+1)+'. '+plain(String(x.nombre||'').replace(/^\s*\d+\s*[.)-]\s*/,''))+(x.detalle?': '+plain(x.detalle):'')).join('\n');
      case 'figura': return 'Figura (pág. '+b.pagina+'): '+plain(b.pie);
      case 'clave': return 'CLAVE: '+plain(b.md);
      case 'truco': return 'TRUCO: '+plain(b.md);
      case 'clinica': return 'CLÍNICA: '+plain(b.md);
      default: return plain(b.md||'');
    }
  }).join('\n');
}
function indexData(data){
  S.figs=data.figs||{};
  S.temas=data.temas;
  S.temas.forEach((t,i)=>{
    t.num=i+1; S.byId[t.id]=t;
    t.secciones.forEach(s=>{s.tema=t.id;S.sec[s.id]=s;s.txt=blocksText(s.bloques);S.secQ[s.id]=[];S.secC[s.id]=[];});
    t.preguntas.forEach(q=>{q.tema=t.id;S.q[q.id]=q;if(S.secQ[q.seccion])S.secQ[q.seccion].push(q);});
    t.tarjetas.forEach(c=>{c.tema=t.id;S.c[c.id]=c;if(S.secC[c.seccion])S.secC[c.seccion].push(c);});
  });
  S.rutas=(data.rutas||[]).filter(r=>S.byId[r.tema]&&S.sec[r.seccion]&&Array.isArray(r.pasos)&&r.pasos.length>=2);
  S.rutas.forEach(r=>{S.rutaById[r.id]=r;});
}
const short=id=>{const t=S.byId[id];return t?(t.corto||t.titulo):id;};
/* Cada tema lleva el color de la tinción de laboratorio que lo revela */
const TCOL={
  betaox:['#DD5A1C','Sudán III · tiñe lípidos'],
  carbohidratos:['#A61E73','PAS · tiñe glucógeno'],
  proteinas:['#2B4FD1','Azul de Coomassie · proteínas'],
  enzimas:['#6A3FC8','NBT-formazán · actividad enzimática'],
  urea:['#D3294F','Rojo fenol · prueba de ureasa'],
  respiracion:['#2E8B3E','Verde Jano B · mitocondrias'],
  nucleicos:['#0B7F8A','Verde de metilo · ADN'],
  saliva:['#E0457B','Eritrosina · revela la placa'],
  digestion:['#A8641A','Lugol · almidón'],
  vitaminas:['#B07D00','Riboflavina · fluorescencia amarilla'],
  dentarios:['#C2362B','Rojo de alizarina · calcio'],
};
const tcol=id=>(TCOL[id]||['#C2185B',''])[0];
const tcs=id=>`style="--tc:${tcol(id)}"`;
const stainHTML=id=>TCOL[id]?`<span class="stain"><i></i>${esc(TCOL[id][1])}</span>`:'';
const allQ=()=>S.temas.flatMap(t=>t.preguntas);
const allC=()=>S.temas.flatMap(t=>t.tarjetas);

/* ================= aprendizaje espaciado ================= */
function recordQ(q,ok){
  if(!S.q[q.id])return;
  const st=P.q[q.id]||{b:0,n:0,k:0};
  const b=ok?Math.min((st.b||0)+1,4):0;
  P.q[q.id]={b,n:(st.n||0)+1,k:(st.k||0)+(ok?1:0),l:ok?1:0,t:NOW()};
  const d=dayRec();d.q++;if(ok)d.k++;
  touch();
}
const isFailed=q=>{const s=P.q[q.id];return !!s&&s.l===0;};
const isDueQ=q=>{const s=P.q[q.id];if(!s)return false;if(s.l===0)return true;return NOW()-s.t>=QI[Math.min(s.b,4)]*DAY;};
function rateCard(id,r){
  const st=P.c[id]||{b:0,n:0};let b=st.b||0,due;const now=NOW();
  if(r===0){b=0;due=now+60e3;}
  else if(r===1){b=Math.max(1,b);due=now+CI[b]*0.5*DAY;}
  else if(r===2){b=Math.min(b+1,6);due=now+CI[b]*DAY;}
  else {b=Math.min(b+2,6);due=now+CI[b]*1.25*DAY;}
  const d=dayRec();d.c++;if(!P.c[id])d.nc++;
  P.c[id]={b,due,n:(st.n||0)+1,t:now};touch();
}
function nextLabel(id,r){const b=(P.c[id]||{}).b||0;if(r===0)return '1 min';if(r===1)return fmtInt(CI[Math.max(1,b)]*0.5);if(r===2)return fmtInt(CI[Math.min(b+1,6)]);return fmtInt(CI[Math.min(b+2,6)]*1.25);}
const isDueC=c=>{const s=P.c[c.id];return !!s&&s.due<=NOW();};
function temaStats(t){
  let qm=0,seen=0,failed=0,att=0,okc=0;
  t.preguntas.forEach(q=>{const s=P.q[q.id];if(s){seen++;qm+=Math.min(s.b,3)/3;if(s.l===0)failed++;att+=s.n;okc+=s.k;}});
  let cm=0,cseen=0,dueC=0;
  t.tarjetas.forEach(c=>{const s=P.c[c.id];if(s){cseen++;cm+=Math.min(s.b,4)/4;if(s.due<=NOW())dueC++;}});
  const read=t.secciones.filter(s=>P.r[s.id]>0).length;
  const Q=t.preguntas.length?qm/t.preguntas.length:0,C=t.tarjetas.length?cm/t.tarjetas.length:0,R=t.secciones.length?read/t.secciones.length:0;
  return {Q,C,R,dom:.55*Q+.3*C+.15*R,seen,failed,cseen,dueC,read,att,okc,acc:att?okc/att:null};
}
function stateOf(st){
  if(!st.seen&&!st.cseen&&!st.read) return ['Sin empezar',''];
  if(st.dom>=.85) return ['Dominado','st-done'];
  if(st.failed>=3&&st.failed/Math.max(st.seen,1)>.3) return ['Hay que repasar','st-weak'];
  return ['En progreso','st-prog'];
}
function globalStats(){
  const ts=S.temas.map(temaStats);const nQ=allQ().length,nC=allC().length;
  let qm=0,cm=0;S.temas.forEach((t,i)=>{qm+=ts[i].Q*t.preguntas.length;cm+=ts[i].C*t.tarjetas.length;});
  const nS=Object.keys(S.sec).length,read=Object.keys(S.sec).filter(id=>P.r[id]>0).length;
  const dom=.55*(qm/Math.max(nQ,1))+.3*(cm/Math.max(nC,1))+.15*(read/Math.max(nS,1));
  let att=0,ok=0;for(const id in P.q){att+=P.q[id].n||0;ok+=P.q[id].k||0;}
  return {dom,att,ok,acc:att?ok/att:null,streak:streak(),cards:Object.keys(P.c).length};
}
function streak(){let n=0;const d=new Date();for(let i=0;i<400;i++){const k=d.toLocaleDateString('en-CA');const r=P.d[k];if(r&&(r.q||r.c)){n++;}else if(i>0)break;d.setDate(d.getDate()-1);}return n;}
function pickSmart(pool,n){
  const prio=q=>{const s=P.q[q.id];if(!s)return 2;if(s.l===0)return 3+Math.min((s.n-s.k),3)*.3;if(isDueQ(q))return 1.5;return .3+(3-Math.min(s.b,3))*.2;};
  return pool.map(q=>({q,w:prio(q)*(.6+Math.random()*.8)})).sort((a,b)=>b.w-a.w).map(x=>x.q).slice(0,n||pool.length);
}
function interleave(list){const by={};list.forEach(q=>{(by[q.tema]=by[q.tema]||[]).push(q);});const keys=shuffle(Object.keys(by));const out=[];let more=true;while(more){more=false;for(const k of keys){const x=by[k].shift();if(x){out.push(x);more=true;}}}return out;}

/* ================= íconos y piezas ================= */
let HX=0;
function hex(p,label){
  p=Math.max(0,Math.min(1,p||0));const id='hx'+(++HX);const y=(96-92*p).toFixed(1);
  const pts='50,4 90,27 90,73 50,96 10,73 10,27';
  return `<svg class="hex" viewBox="0 0 100 100" role="img" aria-label="${esc(label||'Dominio')}: ${pct(p)}"><defs><clipPath id="${id}"><polygon points="${pts}"/></clipPath></defs><polygon class="hx-bg" points="${pts}"/><g clip-path="url(#${id})"><g class="${S.fresh?'hx-anim':''}" style="--d:${(92*p).toFixed(1)}px"><rect class="hx-fill" x="0" y="${y}" width="100" height="100"/>${p>0&&p<1?`<line class="hx-top" x1="0" x2="100" y1="${y}" y2="${y}"/>`:''}</g></g><polygon class="hx-line ${p>=.85?'on':''}" points="${pts}"/><text x="50" y="57" text-anchor="middle">${Math.round(p*100)}%</text></svg>`;
}
const barA=()=>S.fresh?' anim':'';
function ring(p,label){const C=2*Math.PI*45;return `<svg class="ring" viewBox="0 0 110 110" role="img" aria-label="${esc(label)}"><circle class="r-bg" cx="55" cy="55" r="45"/><circle class="r-fg" cx="55" cy="55" r="45" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-off="${(C*(1-p)).toFixed(1)}"/><text x="55" y="63" text-anchor="middle">${Math.round(p*100)}%</text></svg>`;}
const ICON_OK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>';
const ICON_BAD='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9 9l6 6M15 9l-6 6"/></svg>';

/* ---------- efectos: confeti, conteo, celosía del encabezado ---------- */
const COARSE=matchMedia('(pointer:coarse)').matches;
const RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function confetti(colors){
  if(RM())return;
  const cv=document.createElement('canvas');cv.className='fx-cv';document.body.appendChild(cv);
  const dpr=Math.min(2,devicePixelRatio||1),W=innerWidth,H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;
  const x=cv.getContext('2d');x.scale(dpr,dpr);
  const cols=colors&&colors.length?colors:['#C2185B','#FFE873','#0B7A72','#2B4FD1','#DD5A1C'];
  const ps=Array.from({length:140},(_,i)=>({x:W/2+(Math.random()-.5)*W*.3,y:H*.35,vx:(Math.random()-.5)*14,vy:-Math.random()*13-4,r:4+Math.random()*5,c:cols[i%cols.length],a:Math.random()*6,va:(Math.random()-.5)*.3,hex:Math.random()<.4}));
  const t0=performance.now();let raf;
  const step=t=>{const e=t-t0;x.clearRect(0,0,W,H);ps.forEach(p=>{p.vy+=.38;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.a+=p.va;x.save();x.translate(p.x,p.y);x.rotate(p.a);x.globalAlpha=Math.max(0,1-e/2200);x.fillStyle=p.c;if(p.hex){x.beginPath();for(let k=0;k<6;k++){const an=Math.PI/3*k;x.lineTo(Math.cos(an)*p.r,Math.sin(an)*p.r);}x.fill();}else x.fillRect(-p.r/2,-p.r/4,p.r,p.r/2);x.restore();});
    if(e<2300)raf=requestAnimationFrame(step);else cv.remove();};
  raf=requestAnimationFrame(step);setTimeout(()=>cv.remove(),3000);
}
function countUp(root){
  if(RM())return;
  $$('[data-count]',root).forEach(el=>{
    const end=+el.dataset.count,suf=el.dataset.suf||'';if(!end)return;
    const t0=performance.now();
    const f=t=>{const k=Math.min(1,(t-t0)/900),v=Math.round(end*(1-Math.pow(1-k,3)));el.textContent=v+suf;if(k<1)requestAnimationFrame(f);};
    requestAnimationFrame(t=>{el.textContent='0'+suf;f(t);});
  });
}
function animateRings(root){$$('.r-fg[data-off]',root).forEach(c=>{const off=c.dataset.off;if(RM()){c.style.strokeDashoffset=off;return;}requestAnimationFrame(()=>requestAnimationFrame(()=>{c.style.strokeDashoffset=off;}));setTimeout(()=>{c.style.strokeDashoffset=off;},400);});}
let heroRAF=null;
function initHero(){
  const cv=$('.hero-cv');if(!cv)return;cancelAnimationFrame(heroRAF);
  const host=cv.parentElement,dpr=Math.min(2,devicePixelRatio||1);
  let W,H,cells=[],mx=-999,my=-999;const R=26,hw=Math.sqrt(3)*R;
  const size=()=>{W=host.clientWidth;H=host.clientHeight;cv.width=W*dpr;cv.height=H*dpr;cells=[];
    for(let r=-1;r*R*1.5<H+R*2;r++)for(let c=-1;c*hw<W+hw*2;c++){cells.push({x:c*hw+(r%2?hw/2:0),y:r*R*1.5,v:0,t:Math.random()<.16?Math.random():0,s:.004+Math.random()*.01});}};
  size();
  const x=cv.getContext('2d');
  const tint=[194,24,91];
  const draw=()=>{
    x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
    cells.forEach(c=>{
      const d=Math.hypot(c.x-mx,c.y-my);const near=Math.max(0,1-d/170);
      if(c.t>0&&!RM()){c.v+=c.s;if(c.v>1){c.v=0;c.t=Math.random()<.5?Math.random():0;}}
      else if(Math.random()<.0008)c.t=1;
      const a=Math.max(near*.22,(c.t?Math.sin(c.v*Math.PI)*.16:0));
      x.beginPath();for(let k=0;k<6;k++){const an=Math.PI/3*k+Math.PI/6;x.lineTo(c.x+Math.cos(an)*(R-2),c.y+Math.sin(an)*(R-2));}x.closePath();
      if(a>.005){x.fillStyle=`rgba(${tint},${a})`;x.fill();}
      x.strokeStyle=`rgba(18,26,44,${.055+near*.12})`;x.lineWidth=1;x.stroke();
    });
    // la parte izquierda se aclara para que el texto se lea bien
    const g=x.createLinearGradient(0,0,W,0);g.addColorStop(0,'rgba(245,246,249,.94)');g.addColorStop(.5,'rgba(245,246,249,.55)');g.addColorStop(1,'rgba(245,246,249,0)');x.fillStyle=g;x.fillRect(0,0,W,H);
  };
  draw();
  if(RM())return;
  host.addEventListener('pointermove',e=>{const r=host.getBoundingClientRect();mx=e.clientX-r.left;my=e.clientY-r.top;});
  host.addEventListener('pointerleave',()=>{mx=my=-999;});
  let last=0;
  const loop=t=>{if(!cv.isConnected)return;if(t-last>40){if(host.clientWidth!==W||host.clientHeight!==H)size();draw();last=t;}heroRAF=requestAnimationFrame(loop);};
  heroRAF=requestAnimationFrame(loop);
}
const dots=n=>`<span class="diff" title="Dificultad ${n||1} de 3">${[1,2,3].map(i=>`<i class="${i<=(n||1)?'on':''}"></i>`).join('')}</span>`;
const TYPE={opcion:'Opción múltiple',vf:'Verdadero o falso',completar:'Completa',ordenar:'Ordena',relacionar:'Relaciona'};
function figImg(n,alt){const d=S.figs[n];return `<img src="${figSrc(n)}" alt="${esc(alt||('Página '+n+' de tus apuntes'))}" loading="lazy"${d?` width="${d[0]}" height="${d[1]}"`:''}>`;}
function answerHTML(q){
  switch(q.tipo){
    case 'opcion': return md(q.opciones[q.correcta]);
    case 'vf': return q.correcta?'Verdadero':'Falso';
    case 'completar': return q.respuestas.map(esc).join(' <span class="muted">o</span> ');
    case 'ordenar': return '<ol>'+q.items.map(x=>'<li>'+md(x)+'</li>').join('')+'</ol>';
    case 'relacionar': return '<ul>'+q.pares.map(p=>'<li>'+md(p[0])+' → '+md(p[1])+'</li>').join('')+'</ul>';
  }return '';
}
function respHTML(q,s){
  if(!s||s.skipped) return '<i>No respondida</i>';
  switch(q.tipo){
    case 'opcion': return s.resp==null?'<i>No respondida</i>':md(q.opciones[s.resp]);
    case 'vf': return s.resp==null?'<i>No respondida</i>':(s.resp?'Verdadero':'Falso');
    case 'completar': return s.resp?esc(s.resp):'<i>Vacía</i>';
    case 'ordenar': return s.placed.length?s.placed.map(i=>plain(q.items[i])).map(esc).join(' → '):'<i>Sin ordenar</i>';
    case 'relacionar': {const ok=q.pares.filter((_,i)=>s.pairs[i]===i).length;return ok+' de '+q.pares.length+' parejas bien';}
  }return '';
}
const hasResp=s=>!!s&&((s.resp!==null&&s.resp!==undefined&&s.resp!=='')||s.placed.length>0||Object.keys(s.pairs).length>0);
function grade(q,s){
  switch(q.tipo){
    case 'opcion': case 'vf': return s.resp===q.correcta?2:0;
    case 'completar': return matchFill(s.resp,q.respuestas);
    case 'ordenar': return s.placed.length===q.items.length&&s.placed.every((v,i)=>v===i)?2:0;
    case 'relacionar': return q.pares.every((_,i)=>s.pairs[i]===i)?2:0;
  }return 0;
}
function aiErr(e){
  const c=e&&e.code;
  if(c==='not_granted'||c==='sampling_disabled'||c==='not_declared'||c==='capability_disabled'||c==='capability_removed'){S.sample=null;return 'El tutor con IA no está disponible en esta vista.';}
  if(c==='rate_limited') return 'Hiciste muchas consultas seguidas. Espera un momento y vuelve a intentar.';
  if(c==='session_expired') return 'Tu sesión de Claude expiró. Vuelve a iniciar sesión e intenta de nuevo.';
  if(c==='invalid_json') return 'La respuesta llegó incompleta. Intenta de nuevo.';
  if(c==='cancelled') return '';
  return 'No se pudo conectar con el tutor. Intenta de nuevo.';
}
const OKM=['¡Correcto!','¡Eso es!','Bien hecho','Exacto','¡Muy bien!'];

/* ================= motor de preguntas ================= */
let UID=0;
class Quiz{
  constructor(items,o){
    this.id='q'+(++UID);S.qz[this.id]=this;
    this.o=Object.assign({mode:'practica',track:true},o);
    this.qs=items.map(x=>typeof x==='string'?S.q[x]:x).filter(Boolean);
    this.i=0;this.st={};this.done=false;this.t0=NOW();this.el=null;this.confirm=null;
    if(this.exam&&this.o.limit){this.deadline=this.t0+this.o.limit*1000;this.tick=setInterval(()=>this.onTick(),1000);}
  }
  get exam(){return this.o.mode==='examen';}
  get mini(){return this.o.mode==='mini';}
  get cur(){return this.qs[this.i];}
  s(q){
    q=q||this.cur;let s=this.st[q.id];if(s)return s;
    s={resp:null,checked:false,ok:false,casi:false,placed:[],pairs:{},sel:null,hint:false,ai:null,flag:false,skipped:false,msg:''};
    if(q.tipo==='opcion')s.order=shuffle(q.opciones.map((_,i)=>i));
    if(q.tipo==='ordenar'){let p,g=0;do{p=shuffle(q.items.map((_,i)=>i));g++;}while(q.items.length>1&&g<20&&p.every((v,i)=>v===i));s.pool=p;}
    if(q.tipo==='relacionar'){let p,g=0;do{p=shuffle(q.pares.map((_,i)=>i));g++;}while(q.pares.length>1&&g<20&&p.every((v,i)=>v===i));s.right=p;}
    return this.st[q.id]=s;
  }
  okCount(){return this.qs.filter(q=>this.st[q.id]&&this.st[q.id].checked&&this.st[q.id].ok).length;}
  timeLeft(){return Math.max(0,this.deadline-NOW());}
  timeText(){const t=Math.ceil(this.timeLeft()/1000);return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');}
  onTick(){
    if(this.done){clearInterval(this.tick);return;}
    const el=this.el&&this.el.querySelector('[data-timer]');
    if(el){el.textContent=this.timeText();el.classList.toggle('low',this.timeLeft()<60000);}
    if(this.timeLeft()<=0){this.finish(true);}
  }
  render(){
    if(!this.el||!this.el.isConnected)return;
    this.el.innerHTML=this.done?this.resultsHTML():this.qHTML();
    if(this.done){animateRings(this.el);countUp(this.el);}
    else{this.shownId=this.cur.id;const s=this.st[this.cur.id];if(s)s.anim=false;}
  }
  qHTML(){
    const q=this.cur,s=this.s(q),ex=this.exam,chk=!ex&&s.checked,n=this.qs.length;
    const prog=ex?this.qs.filter(x=>hasResp(this.st[x.id])).length/n:(this.i+(chk?1:0))/n;
    const st=this.streak||0;
    return `<div class="qz ${this.mini?'qz-mini':''}" data-qz="${this.id}" ${tcs(q.tema)}>
      <div class="qz-top">
        <div class="qz-prog"><span class="mono">${this.i+1} de ${n}</span><div class="bar ${ex?'teal':'tcb'}"><i style="width:${prog*100}%"></i></div></div>
        ${ex&&this.deadline?`<span class="mono qz-timer ${this.timeLeft()<60000?'low':''}" data-timer title="Tiempo restante">${this.timeText()}</span>`:''}
        ${!ex?`<span class="streak-n ${st>=3?'hot':''}" title="Aciertos seguidos">${st>=3?'Racha ':''}${st>=3?st:this.okCount()+' bien'}</span>`:''}
        <button class="linkbtn" data-action="qz-exit">${this.mini?'Cerrar':'Salir'}</button>
      </div>
      ${this.confirm?this.confirmHTML():''}
      ${ex?`<div class="palette" aria-label="Ir a la pregunta">${this.qs.map((x,j)=>{const t=this.st[x.id];return `<button data-action="qz-goto" data-i="${j}" class="${j===this.i?'cur':''} ${hasResp(t)?'ans':''} ${t&&t.flag?'flg':''}" aria-label="Pregunta ${j+1}${hasResp(t)?', respondida':''}">${j+1}</button>`;}).join('')}</div>`:''}
      <article class="q-card ${this.shownId!==q.id?'enter':''} ${s.anim?'anim':''}">
        <div class="q-meta">
          <span class="chip">${TYPE[q.tipo]||''}</span>
          ${this.o.multi?`<span class="chip tc">${esc(short(q.tema))}</span>`:''}
          ${q.caso?'<span class="chip st-prog">Caso clínico</span>':''}
          ${q.ia?'<span class="chip st-ia">Creada con IA</span>':''}
          ${dots(q.dificultad)}
          ${q.pagina?`<span class="pg">pág. ${q.pagina}</span>`:''}
        </div>
        ${q.figura?`<button class="fig-btn q-fig" data-action="zoom" data-src="${figSrc(q.figura)}" data-cap="Página ${q.figura} de tus apuntes">${figImg(q.figura)}</button>`:''}
        <h3 class="q-stem">${this.stem(q,s,chk)}</h3>
        ${this.body(q,s,chk)}
        ${chk?this.fb(q,s):''}
        <div class="q-actions">${this.actions(q,s,chk)}</div>
      </article>
    </div>`;
  }
  stem(q,s,chk){
    let h=md(q.enunciado);
    if(q.tipo==='completar'){
      const fill=chk?esc(q.respuestas[0]):(s.resp?esc(s.resp):'&nbsp;');
      h=/_{3,}/.test(h)?h.replace(/_{3,}/,`<span class="blank">${fill}</span>`):h+` <span class="blank">${fill}</span>`;
    }
    return h;
  }
  body(q,s,chk){
    const dis=chk?'disabled':'';
    switch(q.tipo){
      case 'opcion': return `<div class="opts">${s.order.map((oi,pos)=>{let c='';if(chk)c=oi===q.correcta?'is-ok':(oi===s.resp?'is-bad':'is-dim');else if(s.resp===oi)c='is-sel';
        return `<button class="opt ${c}" data-action="qz-opt" data-v="${oi}" ${dis}><span class="opt-k">${'ABCDEF'[pos]}</span><span>${md(q.opciones[oi])}</span></button>`;}).join('')}</div>`;
      case 'vf': return `<div class="opts vf">${[[true,'Verdadero','V'],[false,'Falso','F']].map(([v,l,k])=>{let c='';if(chk)c=v===q.correcta?'is-ok':(v===s.resp?'is-bad':'is-dim');else if(s.resp===v)c='is-sel';
        return `<button class="opt ${c}" data-action="qz-opt" data-v="${v?1:0}" ${dis}><span class="opt-k">${k}</span><span>${l}</span></button>`;}).join('')}</div>`;
      case 'completar': return `<div class="fill"><label class="vh" for="in-${this.id}">Tu respuesta</label>
        <input id="in-${this.id}" data-fill class="inp ${chk?(s.ok?'is-ok':'is-bad'):''}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="Escribe la palabra que falta" value="${esc(s.resp||'')}" ${dis}>
        ${q.pista&&!chk&&!this.exam?(s.hint?`<p class="hint">Pista: ${md(q.pista)}</p>`:`<button class="linkbtn" data-action="qz-hint">Ver pista</button>`):''}</div>`;
      case 'ordenar': {const rest=s.pool.filter(i=>!s.placed.includes(i));
        return `<div class="ord"><div><p class="ord-lab">Tu orden${!chk&&s.placed.length?' · toca un paso para quitarlo':''}</p><ol class="ord-placed">${s.placed.map((ii,pos)=>`<li><button class="ord-item ${chk?(ii===pos?'is-ok':'is-bad'):''}" data-action="qz-unplace" data-v="${ii}" ${dis}><span class="ord-n">${pos+1}</span><span>${md(q.items[ii])}</span></button></li>`).join('')}${rest.map(()=>'<li class="ord-slot" aria-hidden="true"></li>').join('')}</ol></div>
        ${rest.length&&!chk?`<div><p class="ord-lab">Toca los pasos en orden</p><div class="ord-pool">${rest.map(ii=>`<button class="ord-chip" data-action="qz-place" data-v="${ii}">${md(q.items[ii])}</button>`).join('')}</div></div>`:''}</div>`;}
      case 'relacionar': {const byR={};for(const l in s.pairs)byR[s.pairs[l]]=+l;
        return `<div class="rel"><div class="rel-col"><p class="ord-lab">Columna A</p>${q.pares.map((p,i)=>{const pd=s.pairs[i]!==undefined;const c=chk?(s.pairs[i]===i?'is-ok':'is-bad'):(s.sel===i?'is-sel':(pd?'is-paired':''));
          return `<button class="rel-it ${c}" data-action="qz-left" data-v="${i}" ${dis}><span class="rel-b">${i+1}</span><span>${md(p[0])}</span></button>`;}).join('')}</div>
          <div class="rel-col"><p class="ord-lab">Columna B</p>${s.right.map(ri=>{const l=byR[ri];const c=chk?(l===ri?'is-ok':'is-bad'):(l!==undefined?'is-paired':'');
          return `<button class="rel-it ${c}" data-action="qz-right" data-v="${ri}" ${dis}><span class="rel-b">${l!==undefined?l+1:'·'}</span><span>${md(q.pares[ri][1])}</span></button>`;}).join('')}</div></div>
          ${chk?'':`<p class="ord-help">Toca un elemento de la columna A y después su pareja en la B. El número muestra con quién lo uniste.</p>`}`;}
    }return '';
  }
  fb(q,s){
    const showAns=(!s.ok||s.casi)&&q.tipo!=='opcion'&&q.tipo!=='vf';
    const sec=q.seccion&&S.sec[q.seccion];
    return `<div class="fb ${s.ok?'fb-ok':'fb-bad'}" role="status">
      <p class="fb-h">${s.ok?ICON_OK:ICON_BAD}${s.ok?(s.casi?'Correcto, pero cuida la ortografía':s.msg):(s.skipped?'Esta es la respuesta':'No exactamente')}</p>
      ${showAns?`<div class="fb-ans"><span class="lab-ok">Respuesta correcta:</span> ${answerHTML(q)}</div>`:''}
      ${q.explicacion?`<p>${md(q.explicacion)}</p>`:''}
      <div class="fb-links">
        ${sec?`<button class="linkbtn" data-action="go-sec" data-sec="${q.seccion}">Repasar «${esc(sec.titulo)}»${q.pagina?' · pág. '+q.pagina:''}</button>`:''}
        ${S.sample&&s.ai==null?`<button class="linkbtn" data-action="qz-ai">Explícamelo de otra forma</button>`:''}
      </div>
      ${s.ai!=null?`<div class="ai-out" data-ai>${s.ai===''?'<span class="thinking">El tutor está pensando…</span>':md(s.ai)}</div>`:''}
    </div>`;
  }
  ready(q,s){if(q.tipo==='ordenar')return s.placed.length===q.items.length;if(q.tipo==='relacionar')return Object.keys(s.pairs).length===q.pares.length;return true;}
  actions(q,s,chk){
    const last=this.i===this.qs.length-1;
    if(this.exam) return `<button class="btn btn-ghost btn-sm" data-action="qz-prev" ${this.i===0?'disabled':''}>← Anterior</button>
      <button class="btn btn-ghost btn-sm" data-action="qz-flag">${s.flag?'Quitar marca':'Marcar para revisar'}</button><span class="spacer"></span>
      ${last?`<button class="btn btn-sm" data-action="qz-finish">Terminar examen</button>`:`<button class="btn btn-sm" data-action="qz-next">Siguiente →</button>`}`;
    if(chk) return `<span class="kbd">Enter para seguir</span><button class="btn" data-action="qz-next">${last?'Ver resultado':'Siguiente →'}</button>`;
    const needs=['completar','ordenar','relacionar'].includes(q.tipo);
    return `<button class="btn btn-ghost btn-sm" data-action="qz-skip">No lo sé</button>${needs?`<button class="btn" data-action="qz-check" ${this.ready(q,s)?'':'disabled'}>Comprobar</button>`:''}`;
  }
  confirmHTML(){
    const un=this.qs.filter(x=>!hasResp(this.st[x.id])).length;
    const fin=this.confirm==='finish';
    return `<div class="confirm" role="alertdialog"><p><b>${fin?`Te faltan ${un} pregunta${un===1?'':'s'} sin responder.`:'¿Salir del simulacro?'}</b> ${fin?'Si terminas ahora cuentan como incorrectas.':'Se pierden las respuestas de este intento.'}</p>
      <div class="row"><button class="btn btn-sm" data-action="qz-yes">${fin?'Terminar y calificar':'Salir sin calificar'}</button><button class="btn btn-ghost btn-sm" data-action="qz-no">Seguir contestando</button></div></div>`;
  }
  answer(v){
    const q=this.cur,s=this.s(q);if(s.checked&&!this.exam)return;
    s.resp=v;
    if(this.exam){this.render();return;}
    this.check();
  }
  check(){
    const q=this.cur,s=this.s(q);if(s.checked)return;
    if(q.tipo==='completar'){const inp=this.el&&this.el.querySelector('[data-fill]');if(inp)s.resp=inp.value;if(!canon(s.resp)){s.skipped=true;}}
    const g=s.skipped?0:grade(q,s);s.ok=g>0;s.casi=g===1;s.checked=true;s.anim=true;s.msg=OKM[Math.floor(Math.random()*OKM.length)];
    this.streak=s.ok?(this.streak||0)+1:0;
    if(s.ok&&this.streak>0&&this.streak%5===0)s.msg='¡'+this.streak+' seguidas!';
    if(this.o.track)recordQ(q,s.ok);
    this.render();
    const nb=this.el&&this.el.querySelector('[data-action="qz-next"]');if(nb&&q.tipo==='completar')nb.focus({preventScroll:true});
  }
  skip(){const s=this.s();s.skipped=true;s.resp=null;this.check();}
  next(){if(this.i<this.qs.length-1){this.i++;this.render();this.top();}else if(this.exam){this.askFinish();}else this.finish();}
  prev(){if(this.i>0){this.i--;this.render();this.top();}}
  go(j){this.i=Math.max(0,Math.min(this.qs.length-1,j));this.render();}
  top(){if(!this.el)return;const r=this.el.getBoundingClientRect();if(r.top<70)this.el.scrollIntoView({block:'start'});const inp=this.el.querySelector('[data-fill]');if(inp&&!inp.disabled&&matchMedia('(pointer:fine)').matches)inp.focus({preventScroll:true});}
  askFinish(){const un=this.qs.filter(x=>!hasResp(this.st[x.id])).length;if(un>0){this.confirm='finish';this.render();this.el.scrollIntoView({block:'start'});}else this.finish();}
  finish(timeUp){
    if(this.done)return;
    clearInterval(this.tick);
    if(this.exam){this.qs.forEach(q=>{const s=this.s(q);if(q.tipo==='completar'&&s.resp==null)s.resp='';const g=hasResp(s)?grade(q,s):0;s.ok=g>0;s.casi=g===1;s.checked=true;if(this.o.track)recordQ(q,s.ok);});}
    this.done=true;this.timeUp=!!timeUp;this.dur=NOW()-this.t0;this.confirm=null;
    if(this.exam){const k=this.qs.filter(q=>this.st[q.id].ok).length;P.x.push({t:NOW(),n:this.qs.length,k,temas:[...new Set(this.qs.map(q=>q.tema))],dur:this.dur});touch();}
    if(this.mini&&this.o.sec){P.r[this.o.sec]=NOW();touch();markReadUI(this.o.sec);}
    this.render();if(this.el)this.el.scrollIntoView({block:'start'});
    const k=this.qs.filter(q=>this.st[q.id]&&this.st[q.id].ok).length,n=this.qs.length;
    if((this.mini&&k===n)||(!this.mini&&n>=5&&k/n>=.9))confetti([...new Set(this.qs.map(q=>tcol(q.tema)))].concat(['#FFE873']));
  }
  resultsHTML(){
    const n=this.qs.length,ok=this.qs.filter(q=>this.st[q.id]&&this.st[q.id].ok),k=ok.length,wrong=this.qs.filter(q=>!(this.st[q.id]&&this.st[q.id].ok));
    if(this.mini) return `<div class="qz" data-qz="${this.id}"><div class="mini-res"><p class="fb-h">${k===n?ICON_OK:''}${k} de ${n} correctas</p>
      <p class="muted">${k===n?'Esta sección ya la tienes. Quedó marcada como leída.':'La sección quedó marcada como leída y lo que fallaste irá a tu repaso. Revísalo aquí:'}</p>
      ${wrong.length?`<div class="res-list">${wrong.map(q=>reviewItem(q,this.st[q.id])).join('')}</div>`:''}
      <div class="row"><button class="btn btn-sm btn-soft" data-action="qz-again">Otra ronda</button><button class="btn btn-ghost btn-sm" data-action="qz-exit">Cerrar</button></div></div></div>`;
    const by={};this.qs.forEach(q=>{const b=by[q.tema]||(by[q.tema]={n:0,k:0});b.n++;if(this.st[q.id]&&this.st[q.id].ok)b.k++;});
    const temas=Object.keys(by).sort((a,b)=>by[a].k/by[a].n-by[b].k/by[b].n);
    const r=k/n,nota=r*10;
    const verdict=r>=.9?'Excelente. Este material ya lo dominas; mantenlo con el repaso diario.':r>=.75?'Bien. Corrige los fallos de abajo y vuelve a intentarlo para subir a 9.':r>=.6?'Aprobado, pero justo. Lee las secciones de las preguntas que fallaste y repite.':'Todavía no. Empieza por leer en la guía las secciones que fallaste y después vuelve a practicar.';
    const one=temas.length===1?temas[0]:null;
    return `<div class="qz res" data-qz="${this.id}" ${one?tcs(one):''}>
      <div class="panel res-score">
        ${ring(r,'Porcentaje de aciertos')}
        <div><p class="eyebrow">${this.exam?'Calificación':'Resultado'}</p><p class="big">${this.exam?nota.toFixed(1):`<span data-count="${k}">${k}</span>/${n}`}${this.exam?'<small> / 10</small>':''}</p></div>
        <div class="res-txt"><p><b>${k} de ${n} correctas</b> (${pct(r)}) · ${fmtDur(this.dur)}${this.timeUp?' · se acabó el tiempo':''}</p><p class="muted">${verdict}</p></div>
      </div>
      ${temas.length>1?`<div class="panel"><h3 class="h3">Por tema</h3><div class="by">${temas.map(id=>{const b=by[id];return `<div class="by-row" ${tcs(id)}><a href="#t-${id}"><span class="tdot"></span>${esc(short(id))}</a><div class="bar anim ${b.k/b.n>=.75?'ok':'tcb'}"><i style="width:${b.k/b.n*100}%"></i></div><span class="mono">${b.k}/${b.n}</span></div>`;}).join('')}</div></div>`:''}
      ${wrong.length?`<div><h3 class="h3">Para repasar (${wrong.length})</h3><div class="res-list">${wrong.map(q=>reviewItem(q,this.st[q.id])).join('')}</div></div>`:'<p class="muted">Sin errores en esta ronda.</p>'}
      <div class="row">${wrong.length?`<button class="btn" data-action="qz-retry">Repetir solo las falladas (${wrong.length})</button>`:''}<button class="btn btn-ghost" data-action="qz-exit">Terminar</button></div>
    </div>`;
  }
  async explain(){
    const q=this.cur,s=this.s(q);if(!S.sample||s.aiBusy)return;
    s.ai='';s.aiBusy=true;this.render();
    const sec=S.sec[q.seccion];
    const opts=q.tipo==='opcion'?'\nOpciones: '+q.opciones.map((o,i)=>'ABCD'[i]+') '+plain(o)).join(' | '):'';
    const prompt=`Eres tutor de bioquímica para estudiantes de odontología en México. Explica en español, claro y breve (máximo 170 palabras), por qué la respuesta correcta es la correcta${s.ok?'':' y en qué se equivocó el alumno'}. Usa una analogía sencilla y termina con un truco corto para recordarlo. Usa **negritas** solo para 2 o 3 términos clave. Básate en este material del curso:
--- MATERIAL ---
${sec?sec.titulo+'\n'+sec.txt.slice(0,6000):''}
--- PREGUNTA (${TYPE[q.tipo]}) ---
${plain(q.enunciado)}${opts}
Respuesta correcta: ${plain(answerHTML(q).replace(/<[^>]+>/g,' '))}
Respuesta del alumno: ${plain(respHTML(q,s).replace(/<[^>]+>/g,' '))}
Explicación que ya vio: ${plain(q.explicacion||'')}`;
    try{
      const r=await S.sample(prompt,{modelTier:'quick',onText:({text})=>{s.ai=text;const el=this.el&&this.cur===q&&this.el.querySelector('[data-ai]');if(el)el.innerHTML=md(text);}});
      s.ai=r.text;
    }catch(e){s.ai=(e&&e.text?e.text+'\n\n':'')+aiErr(e);}
    s.aiBusy=false;if(this.cur===q)this.render();
  }
  destroy(){clearInterval(this.tick);delete S.qz[this.id];if(this.o.key&&S.active[this.o.key]===this)delete S.active[this.o.key];}
}
function reviewItem(q,s){
  const sec=q.seccion&&S.sec[q.seccion];
  return `<details class="item"><summary>${md(q.enunciado)}</summary><div class="item-b">
    ${s?`<p><span class="lab-bad">Tu respuesta:</span> ${respHTML(q,s)}</p>`:''}
    <div><span class="lab-ok">Correcta:</span> ${answerHTML(q)}</div>
    ${q.explicacion?`<p>${md(q.explicacion)}</p>`:''}
    ${sec?`<p><button class="linkbtn" data-action="go-sec" data-sec="${q.seccion}">Repasar «${esc(sec.titulo)}»${q.pagina?' · pág. '+q.pagina:''}</button></p>`:''}
  </div></details>`;
}

/* ================= tarjetas ================= */
class Flash{
  constructor(ids,o){this.id='f'+(++UID);S.qz[this.id]=this;this.o=o||{};this.queue=ids.slice();this.total=ids.length;this.doneN=0;this.flipped=false;this.stats=[0,0,0,0];this.hard=[];this.el=null;this.finished=false;this.isFlash=true;}
  get cur(){return S.c[this.queue[0]];}
  render(){
    if(!this.el||!this.el.isConnected)return;
    if(this.finished||!this.queue.length){this.finished=true;this.el.innerHTML=this.endHTML();return;}
    const c=this.cur,st=P.c[c.id],sec=S.sec[c.seccion];
    this.el.innerHTML=`<div class="flash-wrap" data-qz="${this.id}" ${tcs(c.tema)}>
      <div class="qz-top"><div class="qz-prog"><span class="mono">${this.doneN} de ${this.total}</span><div class="bar tcb"><i style="width:${this.doneN/this.total*100}%"></i></div></div><button class="linkbtn" data-action="fc-exit">Salir</button></div>
      <div class="q-meta">${this.o.multi?`<span class="chip tc">${esc(short(c.tema))}</span>`:''}${!st?'<span class="chip st-prog">Nueva</span>':`<span class="chip">Vista ${st.n} ${st.n===1?'vez':'veces'}</span>`}</div>
      <div class="flash ${this.flipped?'is-flipped':''}" role="button" tabindex="0" data-action="fc-flip" data-swipe aria-label="${this.flipped?'Ver la pregunta':'Voltear para ver la respuesta'}">
        <span class="swipe-tag l">Otra vez</span><span class="swipe-tag r">Bien</span>
        <div class="flash-inner">
          <div class="flash-face front" ${this.flipped?'aria-hidden="true"':''}><span class="fl-lab">Pregunta</span><div class="fx">${md(c.frente)}</div><span class="fl-hint">Piénsalo y luego toca para voltear${COARSE?'':' · barra espaciadora'}</span></div>
          <div class="flash-face back" ${this.flipped?'':'aria-hidden="true"'}><span class="fl-lab">Respuesta</span><div class="fx">${md(c.reverso)}</div>${sec?`<span class="fl-hint">${esc(sec.titulo)}</span>`:''}</div>
        </div>
      </div>
      <div class="rate" ${this.flipped?'':'hidden'} aria-label="¿Qué tan bien lo sabías?">${['Otra vez','Difícil','Bien','Fácil'].map((l,r)=>`<button class="r${r}" data-action="fc-rate" data-v="${r}">${l}<small>${nextLabel(c.id,r)}</small></button>`).join('')}</div>
      <p class="muted" style="text-align:center;font-size:13.5px">${this.flipped?(COARSE?'Desliza la tarjeta: ← otra vez · bien →':'Desliza la tarjeta: ← otra vez · bien →  ·  o usa las teclas 1 a 4'):'Responde mentalmente antes de voltear: así se graba mejor.'}</p>
    </div>`;
  }
  flip(){this.flipped=!this.flipped;this.render();}
  rate(r){
    const c=this.cur;if(!c||!this.flipped)return;
    rateCard(c.id,r);this.stats[r]++;
    const id=this.queue.shift();
    if(r===0){this.queue.splice(Math.min(3,this.queue.length),0,id);}else this.doneN++;
    if(r<=1&&!this.hard.includes(id))this.hard.push(id);
    this.flipped=false;this.render();
  }
  endHTML(){
    const [a,h,g,e]=this.stats;
    const due=allC().filter(c=>P.c[c.id]).map(c=>P.c[c.id].due).filter(d=>d>NOW()).sort((x,y)=>x-y)[0];
    return `<div class="flash-wrap" data-qz="${this.id}"><div class="panel res-score">
      <div><p class="eyebrow">Sesión terminada</p><p class="big">${this.total}</p><p class="muted">tarjetas</p></div>
      <div class="res-txt"><p><b>${e} fáciles · ${g} bien · ${h} difíciles · ${a} otra vez</b></p><p class="muted">Cada tarjeta volverá justo antes de que la olvides.${due?' La próxima toca '+(due-NOW()<DAY?'hoy mismo':'el '+fmtDate(due))+'.':''}</p></div></div>
      <div class="row">${this.hard.length?`<button class="btn btn-soft" data-action="fc-hard">Repasar otra vez las difíciles (${this.hard.length})</button>`:''}<button class="btn btn-ghost" data-action="fc-exit">Terminar</button></div></div>`;
  }
  destroy(){delete S.qz[this.id];if(this.o.key&&S.active[this.o.key]===this)delete S.active[this.o.key];}
}
function cardsDeck(cards,mode){
  if(mode==='todas')return cards.map(c=>c.id);
  const due=cards.filter(isDueC).sort((a,b)=>P.c[a.id].due-P.c[b.id].due);
  const left=Math.max(0,NEW_CARDS_DAY-dayRec().nc);
  let fresh=cards.filter(c=>!P.c[c.id]);
  if(mode==='global'){
    // nuevas: primero de los temas que ya empezaste (leídos o practicados), repartidas por turnos
    const started=S.temas.filter(t=>t.secciones.some(s=>P.r[s.id]>0)||t.preguntas.some(q=>P.q[q.id])||t.tarjetas.some(c=>P.c[c.id])).map(t=>t.id);
    const order=started.length?started:S.temas.slice(0,2).map(t=>t.id);
    const by={};fresh.forEach(c=>{(by[c.tema]=by[c.tema]||[]).push(c);});
    const out=[];let more=true;while(more&&out.length<left){more=false;for(const id of order){const x=(by[id]||[]).shift();if(x&&out.length<left){out.push(x);more=true;}}}
    fresh=out;
  }else fresh=fresh.slice(0,Math.max(left,12));
  return [...due,...fresh].map(c=>c.id);
}

/* ================= vistas ================= */
function navCurrent(){const v=S.route.v;$$('[data-nav]').forEach(a=>{if(a.dataset.nav===v)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
function host(key){return `<div data-host="${key}"></div>`;}
function examDays(){if(!P.fecha)return null;const t=new Date(P.fecha+'T08:00:00');return Math.ceil((t-NOW())/DAY);}

function viewHome(){
  const g=globalStats();
  const dueC=allC().filter(isDueC).length,dueQ=allQ().filter(isDueQ).length;
  const newLeft=Math.min(allC().filter(c=>!P.c[c.id]).length,Math.max(0,NEW_CARDS_DAY-dayRec().nc));
  const days=examDays();
  let pend=0;allQ().forEach(q=>{const s=P.q[q.id];if(!s||s.b<2)pend++;});allC().forEach(c=>{const s=P.c[c.id];if(!s||s.b<3)pend++;});
  const weak=weakSections();
  const tot={q:allQ().length,c:allC().length};
  const last=P.last&&S.byId[P.last.id]?S.byId[P.last.id]:null;
  const lastSt=last?temaStats(last):null;
  const TABN={aprende:'leyendo',tarjetas:'con las tarjetas',practicar:'practicando',esencial:'en lo esencial',glosario:'en el glosario',tutor:'con el tutor'};
  return `<section class="hero">
    <canvas class="hero-cv" aria-hidden="true"></canvas>
    <div class="hero-in">
      <div class="hero-l">
        <p class="eyebrow">Bioquímica para odontología · 233 páginas de apuntes · ${S.temas.length} temas</p>
        <h1>${g.att?'¿Qué <em>repasamos</em> hoy?':'Domina bioquímica <em>sin desvelarte</em>'}</h1>
        <p class="lede">Lee cada tema resumido, ponte a prueba con <b>${tot.q}</b> preguntas y <b>${tot.c}</b> tarjetas, y deja que el repaso espaciado te traiga de vuelta justo lo que estás por olvidar.</p>
        <div class="row">
          <a class="btn" href="#repaso">Repaso de hoy <span class="pill">${dueC+dueQ+newLeft}</span></a>
          <a class="btn btn-ghost" href="#examen">Hacer un simulacro</a>
          ${g.att?'':`<a class="btn btn-ghost" href="#t-${S.temas[0].id}">Empezar por el tema 1</a>`}
        </div>
      </div>
      <div class="hero-r">
        <div class="panel" ${tcs('saliva')}>
          <div class="glob">${hex(g.dom,'Dominio global')}<div class="glob-t"><b>Dominio global</b><span class="muted">Sube cuando aciertas seguido, calificas tarjetas como sabidas y lees las secciones.</span></div></div>
          <div class="stats3">
            <div class="stat"><b data-count="${g.att}">${g.att}</b><span>respuestas</span></div>
            <div class="stat"><b ${g.acc!=null?`data-count="${Math.round(g.acc*100)}" data-suf="%"`:''}>${g.acc==null?'—':pct(g.acc)}</b><span>de acierto</span></div>
            <div class="stat"><b data-count="${g.streak}">${g.streak}</b><span>${g.streak===1?'día seguido':'días seguidos'}</span></div>
          </div>
        </div>
        <div class="panel countdown">
          ${days==null?`<b>¿Cuándo es tu examen?</b><p class="muted" style="font-size:14.5px">Con la fecha te digo cuánto repasar al día para llegar con todo dominado.</p>
            <div class="row"><label class="vh" for="fecha">Fecha del examen</label><input type="date" id="fecha" class="inp" value=""></div>`
          :days<0?`<b>Tu examen ya pasó</b><div class="row"><label class="vh" for="fecha">Nueva fecha</label><input type="date" id="fecha" class="inp" value="${esc(P.fecha)}"></div>`
          :`<p class="eyebrow" style="margin:0">Examen · ${new Date(P.fecha+'T08:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'})}</p>
            <p><span class="big-n">${days===0?'Hoy':days===1?'Mañana':days+' días'}</span>${days>1?' <span class="muted">para el examen</span>':''}</p>
            <p style="font-size:15px">${pend?`Te faltan <b>${pend}</b> por dominar: unos <b>${Math.ceil(pend/Math.max(days,1))} al día</b> entre tarjetas y preguntas.`:'Tienes todo dominado. Mantén el repaso diario.'}</p>
            <div class="row"><label class="vh" for="fecha">Cambiar fecha</label><input type="date" id="fecha" class="inp" value="${esc(P.fecha)}"></div>`}
        </div>
      </div>
    </div>
  </section>
  ${last?`<a class="resume" href="#t-${last.id}-${P.last.tab||'aprende'}" ${tcs(last.id)}>${hex(lastSt.dom,'Dominio')}<div><span>Continúa donde te quedaste · ${TABN[P.last.tab]||'leyendo'}</span><b>Tema ${last.num}. ${esc(last.titulo)}</b></div><span class="btn btn-tc btn-sm">Continuar</span></a>`:''}
  ${weak.length?`<section class="home-sec"><div class="sec-head"><h2>Donde más fallas</h2><a href="#errores">Ver todos mis errores →</a></div>
    <div class="weak stagger">${weak.map((w,i)=>{const s=S.sec[w.sid];return `<div class="weak-it" style="--i:${i}"><span class="pg">${esc(short(s.tema))} · ${pct(w.acc)} de acierto</span><b>${esc(s.titulo)}</b><div class="row"><button class="btn btn-sm btn-dark" data-action="practice-sec" data-sec="${w.sid}">Practicar</button><button class="linkbtn" data-action="go-sec" data-sec="${w.sid}">Releer</button></div></div>`;}).join('')}</div></section>`:''}
  <section class="home-sec">
    <div class="sec-head"><h2>Temas</h2><a href="#esencial">Repaso exprés: lo esencial de todo →</a></div>
    <div class="tema-grid stagger">${S.temas.map(temaCard).join('')}
      <a class="tema-card express" href="#esencial" style="--i:${S.temas.length}">
        <span class="tc-num">La noche antes del examen</span><h3>Repaso exprés de todo el curso</h3>
        <p class="desc">Los ${S.temas.reduce((s,t)=>s+(t.imprescindibles||[]).length,0)} puntos que sí o sí tienes que saber, de los ${S.temas.length} temas en una sola página. Márcalos cuando los puedas explicar sin mirar.</p>
        <span class="btn btn-sm" style="align-self:flex-start;margin-top:auto">Abrir lo esencial →</span>
      </a></div>
  </section>
  ${S.rutas.length?`<section class="home-sec"><div class="sec-head"><h2>Rutas animadas</h2><span class="muted">Míralas avanzar paso a paso o pon a prueba tu memoria.</span></div>
    <div class="ruta-strip stagger">${S.rutas.map((r,i)=>`<button class="ruta-link" data-action="go-ruta" data-ruta="${r.id}" ${tcs(r.tema).replace('"',`"--i:${i};`)}><span class="pg">${esc(short(r.tema))} · ${r.pasos.length} pasos</span><b>${esc(r.titulo)}</b><span class="ruta-dots">${r.pasos.slice(0,10).map(()=>'<i></i>').join('')}</span></button>`).join('')}</div></section>`:''}`;
}
function weakSections(){
  const out=[];
  for(const sid in S.secQ){let n=0,k=0;S.secQ[sid].forEach(q=>{const s=P.q[q.id];if(s){n+=s.n;k+=s.k;}});if(n>=3&&k/n<.75)out.push({sid,acc:k/n});}
  return out.sort((a,b)=>a.acc-b.acc).slice(0,4);
}
function temaCard(t,i){
  const st=temaStats(t),[lab,cls]=stateOf(st);
  return `<a class="tema-card" href="#t-${t.id}" style="--tc:${tcol(t.id)};--i:${i}">
    <div class="tc-head">${hex(st.dom,'Dominio de '+t.titulo)}<div style="min-width:0"><span class="tc-num">Tema ${t.num} · ${pagesTxt(t.paginas)}</span><h3>${esc(t.titulo)}</h3></div></div>
    <p class="desc">${esc(t.descripcion)}</p>
    ${stainHTML(t.id)}
    <div class="meters">
      <div class="meter"><span>Leído <b class="mono">${st.read}/${t.secciones.length}</b></span><div class="bar tcb${barA()}"><i style="width:${st.R*100}%"></i></div></div>
      <div class="meter"><span>Tarjetas <b class="mono">${pct(st.C)}</b></span><div class="bar tcb${barA()}"><i style="width:${st.C*100}%"></i></div></div>
      <div class="meter"><span>Preguntas <b class="mono">${pct(st.Q)}</b></span><div class="bar tcb${barA()}"><i style="width:${st.Q*100}%"></i></div></div>
    </div>
    <div class="tc-foot"><span class="chip ${cls}">${lab}</span><span class="pg">${t.preguntas.length} preguntas · ${t.tarjetas.length} tarjetas</span></div>
  </a>`;
}

const TABS=[['aprende','Aprende'],['tarjetas','Tarjetas'],['practicar','Practicar'],['esencial','Lo esencial'],['glosario','Glosario'],['tutor','Tutor IA']];
function viewTema(t,tab){
  const st=temaStats(t);
  const tabs=TABS.filter(([k])=>k!=='tutor'||S.sample);
  if(!tabs.some(([k])=>k===tab))tab='aprende';
  if(!P.last||P.last.id!==t.id||P.last.tab!==tab){P.last={id:t.id,tab};saveLocal();}
  const n={aprende:t.secciones.length,tarjetas:t.tarjetas.filter(isDueC).length+t.tarjetas.filter(c=>!P.c[c.id]).length,practicar:t.preguntas.length,esencial:(t.imprescindibles||[]).length,glosario:(t.glosario||[]).length};
  const i=S.temas.indexOf(t),pv=S.temas[i-1],nx=S.temas[i+1];
  const nr=(S.rutas||[]).filter(r=>r.tema===t.id).length;
  let body='';
  if(tab==='aprende')body=viewAprende(t);else if(tab==='tarjetas')body=viewTarjetas(t);else if(tab==='practicar')body=viewPracticar(t);
  else if(tab==='esencial')body=viewEsencial(t);else if(tab==='glosario')body=viewGlosario(t);else if(tab==='tutor')body=viewTutor(t);
  const [lab,cls]=stateOf(st);
  return `<div class="tema-page" ${tcs(t.id)}>
    <header class="t-band">${hex(st.dom,'Dominio del tema')}<div style="min-width:0">
      <div class="crumbs"><a href="#inicio">Inicio</a><span>/</span><span>Tema ${t.num} de ${S.temas.length}</span><span>·</span><span>${pagesTxt(t.paginas)} de tus apuntes</span></div>
      <h1>${esc(t.titulo)}</h1><p class="t-desc">${esc(t.descripcion)}</p>
      <div class="t-meta"><span class="chip ${cls}">${lab}</span><span class="chip tc">${t.secciones.length} secciones</span><span class="chip tc">${t.preguntas.length} preguntas</span><span class="chip tc">${t.tarjetas.length} tarjetas</span>${nr?`<span class="chip tc">${nr} ruta${nr>1?'s':''} animada${nr>1?'s':''}</span>`:''}${stainHTML(t.id)}</div>
    </div></header>
    <nav class="tabs" aria-label="Modos de estudio">${tabs.map(([k,l])=>`<a href="#t-${t.id}-${k}" ${k===tab?'aria-current="page"':''}>${l}${n[k]!=null?`<span class="n">${n[k]}</span>`:''}</a>`).join('')}</nav>
    <div class="${S.freshTab?'view':''}">${body}</div>
    <nav class="pn" aria-label="Otros temas">${pv?`<a href="#t-${pv.id}" ${tcs(pv.id)}><small>← Tema ${pv.num}</small><b>${esc(pv.titulo)}</b></a>`:''}${nx?`<a class="nx" href="#t-${nx.id}" ${tcs(nx.id)}><small>Tema ${nx.num} →</small><b>${esc(nx.titulo)}</b></a>`:''}</nav>
  </div>`;
}

function blockHTML(b){
  const ex=b.extra?'<span class="b-extra">Complemento · no viene en tus apuntes</span>':'';
  const C=P.cz;
  switch(b.tipo){
    case 'lista': return `${ex}<ul class="b-list">${(b.items||[]).map(x=>`<li>${md(x,C)}</li>`).join('')}</ul>`;
    case 'tabla': return `${ex}<div class="b-table"><table>${b.titulo?`<caption>${md(b.titulo)}</caption>`:''}<thead><tr>${(b.columnas||[]).map(c=>`<th>${md(c)}</th>`).join('')}</tr></thead><tbody>${(b.filas||[]).map(r=>`<tr>${r.map(c=>`<td>${md(c,C)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    case 'pasos': return `<div class="b-steps">${ex}${b.titulo?`<p class="b-steps-h">${md(b.titulo)}</p>`:''}<ol>${(b.items||[]).map((it,i)=>`<li><span class="st-n">${i+1}</span><div><b>${md(String(it.nombre||'').replace(/^\s*\d+\s*[.)-]\s*/,''),C)}</b>${it.detalle?`<p>${md(it.detalle,C)}</p>`:''}</div></li>`).join('')}</ol></div>`;
    case 'clave': return `<div class="b-key">${ex}<span class="b-lab">Clave de examen</span><p><span class="hl">${md(b.md,C)}</span></p></div>`;
    case 'truco': return `<div class="b-tip">${ex}<span class="b-lab">Para recordarlo</span><p>${md(b.md,C)}</p></div>`;
    case 'clinica': return `<div class="b-clin">${ex}<span class="b-lab">En la consulta</span><p>${md(b.md,C)}</p></div>`;
    case 'figura': return `<figure class="b-fig"><button class="fig-btn" data-action="zoom" data-src="${figSrc(b.pagina)}" data-cap="${esc(plain(b.pie))}" aria-label="Ampliar figura de la página ${b.pagina}">${figImg(b.pagina,plain(b.pie))}</button><figcaption><span>${md(b.pie)}</span><span class="pg">pág. ${b.pagina}</span></figcaption></figure>`;
    default: return b.md?`${ex}<p class="b-txt">${md(b.md,C)}</p>`:'';
  }
}
function secCheckInner(s){
  const key='mini:'+s.id;
  if(S.active[key])return host(key);
  const nq=(S.secQ[s.id]||[]).length,read=P.r[s.id]>0;
  return `<h3>Comprueba lo que leíste</h3><p class="muted">${nq?'Tres preguntas rápidas de esta sección. Las que falles se guardan para tu repaso.':'Esta sección no tiene preguntas propias; repásala con las tarjetas.'}</p>
    <div class="row">${nq?`<button class="btn btn-sm btn-soft" data-action="mini-start" data-sec="${s.id}">Ponerme a prueba</button>`:''}
    <button class="btn btn-sm btn-ghost" data-action="mark-read" data-sec="${s.id}" aria-pressed="${read}">${read?'Leída ✓':'Marcar como leída'}</button>
    ${nq>3?`<button class="linkbtn" data-action="practice-sec" data-sec="${s.id}">Practicar las ${nq} de la sección</button>`:''}</div>`;
}
function viewAprende(t){
  const read=t.secciones.filter(s=>P.r[s.id]>0).length;
  return `<div class="learn">
    <details class="toc" id="toc" open><summary>Secciones del tema · ${read} de ${t.secciones.length} leídas</summary>
      <ol>${t.secciones.map((s,i)=>`<li><a data-action="goto-sec" data-sec="${s.id}" class="${P.r[s.id]>0?'is-read':''}" data-toc="${s.id}"><span class="tn">${i+1}</span><span>${esc(s.titulo)}</span></a></li>`).join('')}</ol>
      <div class="toc-prog"><div class="bar tcb"><i id="toc-bar" style="width:${read/t.secciones.length*100}%"></i></div></div>
      <label class="toggle"><input type="checkbox" id="cz-toggle" ${P.cz?'checked':''}><span><b>Modo tapar</b>Oculta los términos en negritas para que intentes recordarlos. Tócalos para verlos.</span></label>
    </details>
    <div class="reading">${t.secciones.map((s,i)=>{
      const rs=(S.rutas||[]).filter(r=>r.seccion===s.id);
      const bl=(s.bloques||[]).map(blockHTML);
      if(rs.length)bl.splice(Math.min(1,bl.length),0,rs.map(rutaHTML).join(''));
      return `<section class="lsec" id="sec-${s.id}">
        <p class="eyebrow">Sección ${i+1} de ${t.secciones.length}${s.paginas?' · '+pagesTxt(s.paginas):''}</p>
        <h2>${esc(s.titulo)}</h2>
        ${bl.join('')}
        <div class="sec-check" data-check="${s.id}">${secCheckInner(s)}</div>
      </section>`;}).join('')}</div>
  </div>`;
}

/* ---------- rutas animadas ---------- */
const ZCOL=['#5B6478','#0B7A72','#A8641A','#2B4FD1','#6A3FC8'];
const zcol=(r,k)=>k===0?tcol(r.tema):ZCOL[(k-1)%ZCOL.length];
function rutaState(id){return S.ru[id]||(S.ru[id]={i:0,play:false,hide:false,shown:{}});}
function rutaHTML(r){
  const st=rutaState(r.id),n=r.pasos.length,cyc=r.forma==='ciclo';
  const zi={};(r.zonas||[]).forEach((z,k)=>{zi[z.id]=k;});
  let fig='';
  if(cyc){
    const W=640,H=400,cx=320,cy=200,rx=185,ry=148;
    const pt=a=>[cx+rx*Math.cos(a),cy+ry*Math.sin(a)];
    const pos=k=>{const a=-Math.PI/2+k*2*Math.PI/n;const [x,y]=pt(a);return [x,y,a];};
    let arcs='';
    if(r.zonas&&r.zonas.length>1){
      r.pasos.forEach((p,k)=>{const z=zi[p.zona];if(z==null)return;const a0=-Math.PI/2+(k-.5)*2*Math.PI/n,a1=a0+2*Math.PI/n;const [x0,y0]=pt(a0),[x1,y1]=pt(a1);
        arcs+=`<path class="trk-z0" style="stroke:color-mix(in srgb,${zcol(r,z)} 28%,white)" d="M${x0.toFixed(1)},${y0.toFixed(1)} A${rx},${ry} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}"/>`;});
    }
    const ring=`M${cx},${cy-ry} A${rx},${ry} 0 1 1 ${cx},${cy+ry} A${rx},${ry} 0 1 1 ${cx},${cy-ry}`;
    fig=`<div class="cyc"><svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><path class="trk" d="${ring}"/>${arcs}<path class="prog" d="${ring}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${(100*(1-st.i/n)).toFixed(2)}" data-c="100"/></svg>
      ${r.pasos.map((p,k)=>{const [x,y,a]=pos(k),c=Math.cos(a),s=Math.sin(a);
        let lab;
        if(c>.3)lab=`left:${(x+28)/W*100}%;top:${y/H*100}%;width:${Math.max(12,(W-x-34)/W*100)}%;transform:translateY(-50%);text-align:left`;
        else if(c<-.3)lab=`right:${(W-x+28)/W*100}%;top:${y/H*100}%;width:${Math.max(12,(x-34)/W*100)}%;transform:translateY(-50%);text-align:right`;
        else if(s<0)lab=`left:${x/W*100}%;top:${(y-26)/H*100}%;width:34%;transform:translate(-50%,-100%);text-align:center`;
        else lab=`left:${x/W*100}%;top:${(y+26)/H*100}%;width:34%;transform:translate(-50%,0);text-align:center`;
        return `<button class="node" data-action="ru-go" data-ruta="${r.id}" data-i="${k}" style="left:${x/W*100}%;top:${y/H*100}%" aria-label="Paso ${k+1}: ${esc(p.titulo)}">${k+1}</button><span class="nlab" data-nlab="${k}" style="${lab}">${esc(p.titulo)}</span>`;}).join('')}
      <div class="ctr"><span>${r.zonas&&r.zonas.length?'Ciclo':'Ciclo'}</span><b>${esc(r.centro||r.titulo.split(',')[0])}</b><span data-rcount>${st.i+1} / ${n}</span></div></div>`;
  }else{
    fig=`<div class="trackL" data-track>${r.pasos.map((p,k)=>`<button class="stepL" style="--zc:${r.zonas&&r.zonas.length>1?zcol(r,Math.max(0,r.zonas.findIndex(z=>z.id===p.zona))):'var(--ink-3)'}" data-action="ru-go" data-ruta="${r.id}" data-i="${k}"><span class="node">${k+1}</span><span data-lab>${esc(p.titulo)}</span>${p.zona&&r.zonas&&r.zonas.length>1?`<span class="z">${esc((r.zonas.find(z=>z.id===p.zona)||{}).nombre||'')}</span>`:''}</button>`).join('')}</div>`;
  }
  return `<div class="ruta ${cyc?'ciclo':'lineal'}" data-ruta="${r.id}" ${tcs(r.tema)} id="ruta-${r.id}">
    <div class="ruta-head"><div><p class="eyebrow">Ruta animada · ${n} pasos</p><h3>${esc(r.titulo)}</h3></div>
      <div class="ruta-ctrl"><button data-action="ru-play" data-ruta="${r.id}" aria-pressed="false"><svg viewBox="0 0 12 12"><path d="M2 1l9 5-9 5z"/></svg><span>Reproducir</span></button><button data-action="ru-hide" data-ruta="${r.id}" aria-pressed="${st.hide}">Modo recordar</button></div></div>
    ${r.zonas&&r.zonas.length>1?`<div class="ruta-zones">${r.zonas.map((z,k)=>`<span style="--zc:${zcol(r,k)}"><i></i>${esc(z.nombre)}</span>`).join('')}</div>`:''}
    <div class="ruta-body">${fig}<div class="ruta-det" data-det aria-live="polite"></div></div>
    <div class="ruta-nav"><button class="btn btn-ghost btn-sm" data-action="ru-prev" data-ruta="${r.id}">← Anterior</button><span class="mono" data-rpos></span><button class="btn btn-tc btn-sm" data-action="ru-next" data-ruta="${r.id}">Siguiente →</button></div>
    ${r.resumen?`<p class="ruta-res"><b>En resumen:</b> ${md(r.resumen)}</p>`:''}
  </div>`;
}
function rutaUpdate(id,anim){
  const r=S.rutaById[id];if(!r)return;const el=document.getElementById('ruta-'+id);if(!el)return;
  const st=rutaState(id),n=r.pasos.length,p=r.pasos[st.i];
  $$('.node',el).forEach((b,k)=>{b.classList.toggle('on',k===st.i);b.classList.toggle('done',k<st.i);});
  $$('[data-nlab]',el).forEach(l=>{const k=+l.dataset.nlab;l.classList.toggle('on',k===st.i);l.textContent=st.hide&&!st.shown[k]?'?':r.pasos[k].titulo;});
  $$('.stepL',el).forEach((b,k)=>{b.classList.toggle('on',k===st.i);b.classList.toggle('done',k<st.i);const l=b.querySelector('[data-lab]');if(l)l.textContent=st.hide&&!st.shown[k]?'?':p&&r.pasos[k].titulo;});
  const pr=el.querySelector('.prog');if(pr){const C=+pr.dataset.c;pr.style.strokeDashoffset=(C*(1-st.i/n)).toFixed(2);}
  const cnt=el.querySelector('[data-rcount]');if(cnt)cnt.textContent=(st.i+1)+' / '+n;
  const cb=el.querySelector('.ctr b');if(cb){if(!cb.dataset.def)cb.dataset.def=cb.textContent;cb.textContent=innerWidth<=620?(st.hide&&!st.shown[st.i]?'?':p.titulo):cb.dataset.def;}
  el.querySelector('[data-rpos]').textContent='Paso '+(st.i+1)+' de '+n;
  const pb=el.querySelector('[data-action="ru-play"]');pb.setAttribute('aria-pressed',st.play);pb.querySelector('span').textContent=st.play?'Pausar':'Reproducir';
  pb.querySelector('svg').innerHTML=st.play?'<path d="M2 1h3v10H2zM7 1h3v10H7z"/>':'<path d="M2 1l9 5-9 5z"/>';
  el.querySelector('[data-action="ru-hide"]').setAttribute('aria-pressed',st.hide);
  const hidden=st.hide&&!st.shown[st.i];
  const zn=p.zona&&r.zonas?(r.zonas.find(z=>z.id===p.zona)||{}).nombre:'';
  const det=el.querySelector('[data-det]');
  det.innerHTML=`<div class="${anim?'rd-anim':''}" style="display:flex;flex-direction:column;gap:10px">
    <div class="rd-top"><span class="chip tc">Paso ${st.i+1}</span>${zn?`<span class="chip">${esc(zn)}</span>`:''}${p.pagina?`<span class="pg">pág. ${p.pagina}</span>`:''}${p.extra?'<span class="b-extra" style="margin:0">Complemento</span>':''}</div>
    ${hidden?`<h4 class="hid">¿Cuál es este paso?</h4><button class="btn btn-sm btn-tc" data-action="ru-show" data-ruta="${id}" style="align-self:flex-start">Mostrar respuesta</button>`:`<h4>${md(p.titulo)}</h4>`}
    ${!hidden&&((p.entra&&p.entra.length)||(p.sale&&p.sale.length))?`<div class="rd-io">${p.entra&&p.entra.length?`<span class="lab">Entra</span><div>${p.entra.map(m=>`<span class="mol in">${esc(m)}</span>`).join('')}</div>`:''}${p.sale&&p.sale.length?`<span class="lab">Sale</span><div>${p.sale.map(m=>`<span class="mol out">${esc(m)}</span>`).join('')}</div>`:''}</div>`:''}
    ${hidden?'':(p.detalle?`<p>${md(p.detalle)}</p>`:'')}
    ${!hidden&&p.clave?`<p><span class="hl">${md(p.clave)}</span></p>`:''}
  </div>`;
  if(r.forma!=='ciclo'){const tr=el.querySelector('[data-track]'),b=$$('.stepL',el)[st.i];if(tr&&b){const L=tr.scrollLeft+(b.getBoundingClientRect().left-tr.getBoundingClientRect().left)-tr.clientWidth/2+b.clientWidth/2;tr.scrollTo({left:Math.max(0,L),behavior:RM()?'auto':'smooth'});}}
}
function rutaGo(id,i,anim){const r=S.rutaById[id];if(!r)return;const st=rutaState(id);const n=r.pasos.length;st.i=r.forma==='ciclo'?((i%n)+n)%n:Math.max(0,Math.min(n-1,i));rutaUpdate(id,anim!==false);}
function rutaPlay(id){
  const st=rutaState(id);st.play=!st.play;clearInterval(st.timer);
  if(st.play){const r=S.rutaById[id];if(r.forma!=='ciclo'&&st.i>=r.pasos.length-1)st.i=-1;
    const tick=()=>{const el=document.getElementById('ruta-'+id);if(!el){clearInterval(st.timer);st.play=false;return;}
      if(r.forma!=='ciclo'&&st.i>=r.pasos.length-1){clearInterval(st.timer);st.play=false;rutaUpdate(id,false);return;}
      rutaGo(id,st.i+1);};
    if(st.i<0)tick();st.timer=setInterval(tick,2600);}
  rutaUpdate(id,false);
}
function initRutas(root){$$('.ruta[data-ruta]',root).forEach(el=>{const st=rutaState(el.dataset.ruta);clearInterval(st.timer);st.play=false;rutaUpdate(el.dataset.ruta,false);});}

function markReadUI(sid){
  const a=$(`[data-toc="${sid}"]`);if(a)a.classList.toggle('is-read',P.r[sid]>0);
  const t=S.sec[sid]&&S.byId[S.sec[sid].tema];
  if(t){const read=t.secciones.filter(s=>P.r[s.id]>0).length;const sm=$('#toc summary');if(sm)sm.textContent='Secciones del tema · '+read+' de '+t.secciones.length+' leídas';const tb=$('#toc-bar');if(tb)tb.style.width=(read/t.secciones.length*100)+'%';}
  const b=$(`[data-check="${sid}"] [data-action="mark-read"]`);if(b){b.textContent=P.r[sid]>0?'Leída ✓':'Marcar como leída';b.setAttribute('aria-pressed',P.r[sid]>0);}
}

function viewTarjetas(t){
  const key='fc:'+t.id;
  if(S.active[key])return host(key);
  const due=t.tarjetas.filter(isDueC).length,fresh=t.tarjetas.filter(c=>!P.c[c.id]).length,known=t.tarjetas.filter(c=>P.c[c.id]&&P.c[c.id].b>=3).length;
  const su=S.setup['fc'+t.id]||(S.setup['fc'+t.id]={sec:''});
  return `<div class="setup">
    <div><h2 class="h2">Tarjetas de memoria</h2><p class="muted">Lee la pregunta, respóndela en tu cabeza y voltea. Si dices «Otra vez», la tarjeta regresa en un minuto; si dices «Fácil», en días. Así gastas tiempo solo en lo que no sabes.</p></div>
    <div class="setup-sum"><span class="chip st-weak">${due} pendientes</span><span class="chip">${fresh} nuevas</span><span class="chip st-done">${known} dominadas</span><span class="chip">${t.tarjetas.length} en total</span></div>
    <div class="field"><label for="fc-sec">Sección</label><select id="fc-sec" class="inp" data-t="${t.id}"><option value="">Todo el tema</option>${t.secciones.map(s=>`<option value="${s.id}" ${su.sec===s.id?'selected':''}>${esc(s.titulo)} (${(S.secC[s.id]||[]).length})</option>`).join('')}</select></div>
    <div class="row">
      <button class="btn" data-action="fc-start" data-tema="${t.id}" data-mode="pend">Repasar pendientes y nuevas</button>
      <button class="btn btn-ghost" data-action="fc-start" data-tema="${t.id}" data-mode="todas">Todas en orden</button>
      <button class="btn btn-ghost" data-action="fc-start" data-tema="${t.id}" data-mode="mezcla">Todas barajadas</button>
    </div>
  </div>`;
}

function seg(k,scope,opts,cur){return `<div class="seg" data-k="${k}" data-scope="${scope}">${opts.map(([v,l,c])=>`<button data-action="seg" data-v="${v}" aria-pressed="${String(cur)===String(v)}">${l}${c!=null?`<span class="mono">${c}</span>`:''}</button>`).join('')}</div>`;}
function practicePool(t,su){
  let qs=t.preguntas;
  if(su.sec)qs=qs.filter(q=>q.seccion===su.sec);
  if(su.tipo!=='todos')qs=qs.filter(q=>su.tipo==='orden'?(q.tipo==='ordenar'||q.tipo==='relacionar'):q.tipo===su.tipo);
  if(su.modo==='falladas')qs=qs.filter(isFailed);
  if(su.modo==='nuevas')qs=qs.filter(q=>!P.q[q.id]);
  return qs;
}
function viewPracticar(t){
  const key='pr:'+t.id;
  if(S.active[key])return host(key);
  const su=S.setup[t.id]||(S.setup[t.id]={modo:'inteligente',sec:'',tipo:'todos',n:'10'});
  const base=su.sec?t.preguntas.filter(q=>q.seccion===su.sec):t.preguntas;
  const failed=base.filter(isFailed).length,fresh=base.filter(q=>!P.q[q.id]).length,mast=base.filter(q=>P.q[q.id]&&P.q[q.id].b>=3).length;
  const cnt=tp=>base.filter(q=>tp==='orden'?(q.tipo==='ordenar'||q.tipo==='relacionar'):q.tipo===tp).length;
  const pool=practicePool(t,su);
  const take=su.n==='all'?pool.length:Math.min(+su.n,pool.length);
  return `<div class="setup">
    <div><h2 class="h2">Practicar</h2><p class="muted">Cada respuesta te dice al instante si acertaste y por qué. Las que falles regresan en tu repaso hasta que las contestes bien tres veces seguidas.</p></div>
    <div class="setup-sum"><span class="chip st-done">${mast} dominadas</span><span class="chip st-weak">${failed} por corregir</span><span class="chip">${fresh} sin ver</span></div>
    <div class="field"><span class="lab">Qué preguntas</span>${seg('modo',t.id,[['inteligente','Inteligente: falladas y nuevas primero'],['falladas','Solo las falladas',failed],['nuevas','Solo las nuevas',fresh],['todas','Todas']],su.modo)}</div>
    <div class="field"><label for="pr-sec">De qué sección</label><select id="pr-sec" class="inp" data-t="${t.id}"><option value="">Todo el tema (${t.preguntas.length})</option>${t.secciones.map(s=>`<option value="${s.id}" ${su.sec===s.id?'selected':''}>${esc(s.titulo)} (${(S.secQ[s.id]||[]).length})</option>`).join('')}</select></div>
    <div class="field"><span class="lab">Tipo</span>${seg('tipo',t.id,[['todos','Todos'],['opcion','Opción múltiple',cnt('opcion')],['vf','Verdadero o falso',cnt('vf')],['completar','Completar',cnt('completar')],['orden','Ordenar y relacionar',cnt('orden')]],su.tipo)}</div>
    <div class="field"><span class="lab">Cuántas</span>${seg('n',t.id,[['10','10'],['20','20'],['40','40'],['all','Todas']],su.n)}</div>
    <div class="row"><button class="btn" data-action="pr-start" data-tema="${t.id}" ${take?'':'disabled'}>${take?`Empezar ${take} pregunta${take===1?'':'s'}`:'No hay preguntas con ese filtro'}</button></div>
  </div>`;
}
function startPractice(t,su){
  const pool=practicePool(t,su);
  const n=su.n==='all'?pool.length:+su.n;
  const ids=(su.modo==='todas'?shuffle(pool).slice(0,n):pickSmart(pool,n)).map(q=>q.id);
  if(!ids.length){toast('No hay preguntas con ese filtro.');return;}
  const key='pr:'+t.id;if(S.active[key])S.active[key].destroy();
  S.active[key]=new Quiz(ids,{mode:'practica',key});S.lastQz=S.active[key];
}

function viewEsencial(t){
  const al=t.alertas||[];
  return `<div><h2 class="h2">Lo que sí o sí tienes que saber</h2><p class="muted" style="margin-bottom:16px">Márcalo cuando puedas explicarlo sin mirar. Si dudas en uno, búscalo en Aprende.</p>
    <ul class="ess">${(t.imprescindibles||[]).map((x,i)=>essItem(t.id+':'+i,x)).join('')}</ul>
    ${al.length?`<div class="warnbox"><h3>Ojo con los apuntes</h3><p>Puntos donde los apuntes son confusos o difieren de los libros. La guía enseña lo que dicen tus apuntes; aquí tienes la aclaración por si el profesor lo precisa.</p><ul>${al.map(a=>`<li>${a.pagina?`<span class="pg">pág. ${a.pagina}</span> `:''}${md(a.nota)}</li>`).join('')}</ul></div>`:''}
  </div>`;
}
function essItem(k,x){const on=P.e[k]>0;return `<li><button class="ess-it ${on?'on':''}" data-action="ess-toggle" data-k="${k}" aria-pressed="${on}"><span class="ess-box"></span><span>${md(x)}</span></button></li>`;}

function viewGlosario(t){
  const key='gl:'+t.id;
  const g=(t.glosario||[]).slice().sort((a,b)=>a.termino.localeCompare(b.termino,'es'));
  return `<div class="setup" style="max-width:none">
    <div class="row" style="justify-content:space-between"><div><h2 class="h2" style="margin:0">Glosario</h2><p class="muted">${g.length} términos del tema.</p></div>
    ${g.length>=4&&!S.active[key]?`<button class="btn btn-soft" data-action="gl-practice" data-tema="${t.id}">Practicar: relaciona término y definición</button>`:''}</div>
    ${S.active[key]?host(key):''}
    <div><label class="vh" for="gl-q">Filtrar glosario</label><input id="gl-q" class="inp" type="search" placeholder="Filtrar términos…" value="${esc(S.glQ)}" autocomplete="off"></div>
    <dl class="gl" id="gl-list">${g.map(x=>`<div class="gl-it" data-term="${esc(strip(x.termino+' '+x.definicion))}" ${S.glQ&&!strip(x.termino+' '+x.definicion).includes(strip(S.glQ).trim())?'hidden':''}><dt>${esc(x.termino)}</dt><dd>${md(x.definicion)}</dd></div>`).join('')}</dl>
  </div>`;
}

function temaContext(t,max){
  let s='Lo esencial:\n'+(t.imprescindibles||[]).map(x=>'- '+plain(x)).join('\n')+'\n\n';
  t.secciones.forEach(sec=>{s+='## '+sec.titulo+'\n'+sec.txt+'\n\n';});
  s+='Glosario:\n'+(t.glosario||[]).map(g=>g.termino+': '+plain(g.definicion)).join('\n');
  return s.slice(0,max);
}
function viewTutor(t){
  if(!S.sample)return `<div class="empty"><b>El tutor con IA no está disponible aquí</b><p class="muted">Funciona cuando abres la guía dentro de Claude con tu cuenta.</p></div>`;
  const ch=S.chat[t.id]||(S.chat[t.id]={turns:[],busy:false,draft:''});
  const fy=S.fy[t.id]||{},gq=S.gq[t.id]||{},gkey='gq:'+t.id;
  const secOpts=t.secciones.map(s=>`<option value="${s.id}">${esc(s.titulo)}</option>`).join('');
  const sugs=['Explícame este tema en 5 puntos sencillos','¿Qué es lo más probable que venga en el examen de este tema?','¿Qué es lo que más confunden los alumnos aquí?','Hazme una pregunta difícil y luego corrígeme','Dame una mnemotecnia para lo más difícil de memorizar'];
  return `<div class="tutor">
    <section class="panel"><h2 class="h3">Pregúntale a tu tutor</h2><p class="muted" style="margin-bottom:12px">Responde con base en tus apuntes de este tema. Pregunta lo que no entendiste, pídele ejemplos o que te examine.</p>
      <div class="chat-log" id="chat-log">${chatLog(ch)}</div>
      ${ch.turns.length?'':`<div class="sugs" style="margin:10px 0">${sugs.map(x=>`<button data-action="tu-sug" data-t="${t.id}">${esc(x)}</button>`).join('')}</div>`}
      <div class="chat-in" style="margin-top:10px"><label class="vh" for="chat-in">Tu pregunta</label><textarea id="chat-in" class="inp" data-t="${t.id}" placeholder="Escribe tu duda…" rows="2">${esc(ch.draft)}</textarea>
      ${ch.busy?`<button class="btn btn-ghost" data-action="tu-stop" data-t="${t.id}">Detener</button>`:`<button class="btn" data-action="tu-send" data-t="${t.id}">Enviar</button>`}</div>
    </section>
    <section class="panel"><h2 class="h3">Explícalo con tus palabras</h2><p class="muted" style="margin-bottom:12px">Si puedes explicarlo, lo entiendes. Escribe lo que sabes de una sección sin mirar y el tutor te califica contra tus apuntes: qué dijiste bien, qué te faltó y qué está mal.</p>
      <div class="field"><label for="fy-sec">Sección</label><select id="fy-sec" class="inp">${secOpts}</select></div>
      <div class="field" style="margin-top:10px"><label for="fy-text">Tu explicación</label><textarea id="fy-text" class="inp" rows="6" placeholder="Explica la sección como si se la enseñaras a un compañero…"></textarea></div>
      <div class="row" style="margin-top:10px"><button class="btn" data-action="fy-go" data-t="${t.id}" ${fy.busy?'disabled':''}>${fy.busy?'Calificando…':'Calificar mi explicación'}</button></div>
      <div id="fy-out" style="margin-top:14px">${fyHTML(fy)}</div>
    </section>
    <section class="panel"><h2 class="h3">Preguntas nuevas con IA</h2><p class="muted" style="margin-bottom:12px">¿Ya te sabes las de la guía? Pide 5 preguntas nuevas de una sección. No cuentan para tu progreso.</p>
      ${S.active[gkey]?host(gkey):`<div class="field"><label for="gq-sec">Sección</label><select id="gq-sec" class="inp">${secOpts}</select></div>
      <div class="row" style="margin-top:10px"><button class="btn btn-soft" data-action="gq-go" data-t="${t.id}" ${gq.busy?'disabled':''}>${gq.busy?'Creando preguntas… (puede tardar un minuto)':'Crear 5 preguntas'}</button>${gq.err?`<span class="muted">${esc(gq.err)}</span>`:''}</div>`}
    </section>
  </div>`;
}
function chatLog(ch){return ch.turns.map(m=>`<div class="msg ${m.role==='user'?'me':'ai'}">${m.role==='user'?esc(m.content):(m.content?md(m.content):'<span class="thinking">Pensando…</span>')}</div>`).join('');}
function fyHTML(fy){
  if(fy.err)return `<p class="muted">${esc(fy.err)}</p>`;
  const r=fy.res;if(!r)return '';
  const L=(t,a,c)=>Array.isArray(a)&&a.length?`<div><b class="${c}">${t}</b><ul>${a.slice(0,5).map(x=>`<li>${md(String(x))}</li>`).join('')}</ul></div>`:'';
  const n=Math.max(0,Math.min(10,Number(r.calificacion)||0));
  return `<div class="fy-res"><div class="fy-score"><span class="big" style="font-size:44px">${n.toFixed(1)}</span><span class="muted">/ 10</span></div>${r.resumen?`<p>${md(String(r.resumen))}</p>`:''}
    ${L('Lo que explicaste bien',r.bien,'lab-ok')}${L('Lo que te faltó',r.falta,'')}${L('Errores',r.errores,'lab-bad')}${r.consejo?`<p class="b-tip" style="margin:0"><span class="b-lab">Consejo</span>${md(String(r.consejo))}</p>`:''}</div>`;
}

function dueQuestions(){return interleave(pickSmart(allQ().filter(isDueQ)).sort((a,b)=>(isFailed(b)?1:0)-(isFailed(a)?1:0)));}
function viewRepaso(){
  if(S.active.rep)return host('rep');
  const dueC=allC().filter(isDueC).length,newAvail=allC().filter(c=>!P.c[c.id]).length,newLeft=Math.min(newAvail,Math.max(0,NEW_CARDS_DAY-dayRec().nc));
  const dueQ=allQ().filter(isDueQ).length,failed=allQ().filter(isFailed).length;
  const d=dayRec();
  return `<header class="page-head"><p class="eyebrow">Repaso espaciado · ${new Date().toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'})}</p><h1>Repaso de hoy</h1>
    <p class="lede">Lo que te toca hoy según lo que ya estudiaste: tarjetas que estás por olvidar, preguntas que fallaste y material nuevo en dosis pequeñas. Veinte minutos diarios rinden más que una desvelada.</p>
    ${d.q||d.c?`<p class="muted">Hoy llevas <b>${d.q}</b> preguntas (${d.q?pct(d.k/d.q):'—'} bien) y <b>${d.c}</b> tarjetas.</p>`:''}</header>
  <div class="cards3">
    <div class="panel rep-card"><p class="eyebrow">Tarjetas</p><p class="big">${dueC+newLeft}</p><p>${dueC} por repasar y ${newLeft} nuevas (máximo ${NEW_CARDS_DAY} nuevas al día para no saturarte).</p><button class="btn" data-action="rep-cards" ${dueC+newLeft?'':'disabled'}>Repasar tarjetas</button></div>
    <div class="panel rep-card"><p class="eyebrow">Preguntas</p><p class="big">${dueQ}</p><p>${failed} falladas que esperan revancha y ${dueQ-failed} que toca volver a contestar para que no se olviden.</p><button class="btn" data-action="rep-qs" ${dueQ?'':'disabled'}>Contestar ${Math.min(dueQ,25)}</button></div>
    <div class="panel rep-card"><p class="eyebrow">Mezcla de todos los temas</p><p class="big">20</p><p>Preguntas intercaladas de todos los temas, priorizando lo que no has visto y lo que fallas. Mezclar temas ayuda a recordar mejor en el examen.</p><button class="btn btn-soft" data-action="rep-mix">Empezar mezcla</button></div>
  </div>
  <h2 class="h2">Por tema</h2>
  <div class="tbl"><table><thead><tr><th>Tema</th><th>Tarjetas pendientes</th><th>Preguntas por repasar</th><th>Dominio</th></tr></thead><tbody>
  ${S.temas.map(t=>{const st=temaStats(t);const dq=t.preguntas.filter(isDueQ).length;return `<tr ${tcs(t.id)}><td><a href="#t-${t.id}"><span class="tdot"></span>${t.num}. ${esc(t.titulo)}</a></td><td>${st.dueC?`<a href="#t-${t.id}-tarjetas">${st.dueC}</a>`:'0'}</td><td>${dq?`<a href="#t-${t.id}-practicar">${dq}</a>`:'0'}</td><td><div class="cellbar"><div class="bar tcb anim"><i style="width:${st.dom*100}%"></i></div><span class="mono">${pct(st.dom)}</span></div></td></tr>`;}).join('')}
  </tbody></table></div>`;
}

function viewErrores(){
  if(S.active.err)return host('err');
  const wrong=allQ().filter(isFailed);
  const tough=allQ().filter(q=>{const s=P.q[q.id];return s&&s.l===1&&s.n-s.k>=2;});
  const head=`<header class="page-head"><p class="eyebrow">Aprender de los errores</p><h1>Mis errores</h1><p class="lede">Cada pregunta que fallas cae aquí con su explicación y se queda hasta que la contestes bien. Corregir errores es la forma más rápida de subir tu calificación.</p></header>`;
  if(!wrong.length&&!tough.length)return head+`<div class="empty"><b>No tienes errores pendientes</b><p class="muted">Cuando falles una pregunta aparecerá aquí con la respuesta correcta y la explicación.</p><a class="btn" href="#repaso">Ir al repaso de hoy</a></div>`;
  const by={};wrong.forEach(q=>{(by[q.tema]=by[q.tema]||[]).push(q);});
  return head+`${wrong.length?`<div class="row" style="margin-bottom:28px"><button class="btn" data-action="err-go">Corregir todos (${Math.min(wrong.length,30)}${wrong.length>30?' de '+wrong.length:''})</button></div>`:''}
    ${S.temas.filter(t=>by[t.id]).map(t=>`<section class="err-group" ${tcs(t.id)}><div class="sec-head"><h2><span class="tdot"></span>${t.num}. ${esc(t.titulo)} <span class="pg">${by[t.id].length}</span></h2><button class="btn btn-sm btn-soft" data-action="err-go" data-tema="${t.id}">Corregir estas</button></div>
      <div class="res-list">${by[t.id].map(q=>reviewItem(q,null)).join('')}</div></section>`).join('')}
    ${tough.length?`<section class="err-group"><div class="sec-head"><h2>Ya corregidas, pero te costaron <span class="pg">${tough.length}</span></h2></div><p class="muted" style="margin-bottom:10px">Las fallaste dos veces o más antes de acertar. Dales una vuelta antes del examen.</p><div class="res-list">${tough.map(q=>reviewItem(q,null)).join('')}</div></section>`:''}`;
}

function viewExamen(){
  if(S.active.ex)return host('ex');
  const es=S.exSetup||(S.exSetup={temas:S.temas.map(t=>t.id),n:'40',timer:true,dif:false});
  const pool=S.temas.filter(t=>es.temas.includes(t.id)).flatMap(t=>t.preguntas).filter(q=>!es.dif||(q.dificultad||1)>=2);
  const n=Math.min(+es.n,pool.length);
  const hist=(P.x||[]).slice(-8).reverse();
  return `<header class="page-head"><p class="eyebrow">Como el examen real</p><h1>Simulacro de examen</h1><p class="lede">Preguntas de los temas que elijas, sin ver respuestas hasta el final y con reloj. Al terminar te doy tu calificación sobre 10, el resultado por tema y la explicación de cada fallo.</p></header>
  <div class="setup" style="max-width:860px">
    <div class="field"><span class="lab">Temas que entran (${es.temas.length} de ${S.temas.length})</span>
      <div class="chips-sel">${S.temas.map(t=>`<button data-action="ex-tema" data-id="${t.id}" ${tcs(t.id)} aria-pressed="${es.temas.includes(t.id)}"><i></i>${t.num}. ${esc(short(t.id))}<span class="pg">${t.preguntas.length}</span></button>`).join('')}</div>
      <div class="row"><button class="linkbtn" data-action="ex-all">Todos</button><button class="linkbtn" data-action="ex-none">Ninguno</button></div></div>
    <div class="field"><span class="lab">Número de preguntas</span>${seg('n','ex',[['20','20'],['40','40'],['60','60'],['100','100']],es.n)}</div>
    <label class="switch"><input type="checkbox" id="ex-timer" ${es.timer?'checked':''}> Con reloj: 75 segundos por pregunta (${Math.round(n*75/60)} min en total)</label>
    <label class="switch"><input type="checkbox" id="ex-dif" ${es.dif?'checked':''}> Solo preguntas de dificultad media y alta</label>
    <div class="row"><button class="btn" data-action="ex-start" ${n?'':'disabled'}>${n?`Empezar examen de ${n} preguntas`:'Elige al menos un tema'}</button></div>
  </div>
  ${hist.length?`<section style="margin-top:36px"><h2 class="h2">Tus simulacros</h2><div class="panel hist">${hist.map(x=>`<div class="hist-row"><span class="mono">${fmtDate(x.t)}</span><b class="mono">${(x.k/x.n*10).toFixed(1)}</b><span class="muted">${x.k}/${x.n} · ${x.temas.length===S.temas.length?'todos los temas':x.temas.map(short).join(', ')}</span></div>`).join('')}</div></section>`:''}`;
}
function pickExam(es){
  const n=+es.n;const pools=S.temas.filter(t=>es.temas.includes(t.id)).map(t=>shuffle(t.preguntas.filter(q=>!es.dif||(q.dificultad||1)>=2))).filter(p=>p.length);
  const total=pools.reduce((a,p)=>a+p.length,0);if(!total)return [];
  const want=Math.min(n,total);const alloc=pools.map(p=>Math.max(1,Math.round(want*p.length/total)));
  let sum=alloc.reduce((a,b)=>a+b,0);let i=0;
  while(sum>want){const j=alloc.indexOf(Math.max(...alloc));alloc[j]--;sum--;}
  while(sum<want&&i<1000){const j=i%pools.length;if(alloc[j]<pools[j].length){alloc[j]++;sum++;}i++;}
  return shuffle(pools.flatMap((p,j)=>p.slice(0,Math.min(alloc[j],p.length)))).map(q=>q.id);
}

function buildIndex(){
  const ix=[];
  S.temas.forEach(t=>{
    t.secciones.forEach(s=>ix.push({k:'Sección',t:t.id,sec:s.id,title:s.titulo,text:s.txt}));
    (t.glosario||[]).forEach(g=>ix.push({k:'Glosario',t:t.id,title:g.termino,text:plain(g.definicion),gl:1}));
    t.tarjetas.forEach(c=>ix.push({k:'Tarjeta',t:t.id,sec:c.seccion,title:plain(c.frente),text:plain(c.reverso)}));
    (t.imprescindibles||[]).forEach(x=>ix.push({k:'Lo esencial',t:t.id,title:plain(x),text:'',ess:1}));
  });
  ix.forEach(e=>{e.h=canon(e.title+' '+e.text);e.ht=canon(e.title);});
  return ix;
}
function snippet(text,terms){
  const st=strip(text);let at=-1;
  for(const w of terms){const i=st.indexOf(w);if(i>=0&&(at<0||i<at))at=i;}
  let a=Math.max(0,at-70),b=Math.min(text.length,(at<0?0:at)+150);
  if(a>0){const sp=text.indexOf(' ',a);if(sp>=0&&sp<at)a=sp+1;}
  let s=text.slice(a,b),ss=strip(s),out='',last=0;
  const marks=[];terms.forEach(w=>{if(w.length<2)return;let i=ss.indexOf(w);while(i>=0){marks.push([i,i+w.length]);i=ss.indexOf(w,i+w.length);}});
  marks.sort((x,y)=>x[0]-y[0]);
  marks.forEach(([x,y])=>{if(x<last)return;out+=esc(s.slice(last,x))+'<mark>'+esc(s.slice(x,y))+'</mark>';last=y;});
  out+=esc(s.slice(last));
  return (a>0?'…':'')+out+(b<text.length?'…':'');
}
function searchResults(q){
  if(!S.ix)S.ix=buildIndex();
  const terms=canon(q).split(' ').filter(w=>w.length>=2);
  if(!terms.length){
    const pool=shuffle(S.temas.flatMap(t=>(t.glosario||[]).map(g=>g.termino))).slice(0,14);
    return `<p class="muted" style="margin:6px 0 10px">Prueba con un término:</p><div class="sugs">${pool.map(x=>`<button data-action="search-sug" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
  }
  const rawTerms=strip(q).split(/[^a-z0-9ñ]+/).filter(w=>w.length>=2);
  const res=S.ix.filter(e=>terms.every(w=>e.h.includes(w))).map(e=>({e,score:(terms.every(w=>e.ht.includes(w))?3:0)+(e.gl?2:0)+(e.k==='Sección'?1:0)})).sort((a,b)=>b.score-a.score).slice(0,60);
  if(!res.length)return `<div class="empty"><b>Sin resultados para «${esc(q)}»</b><p class="muted">Revisa la ortografía o prueba con una palabra más corta.</p></div>`;
  const by={};res.forEach(r=>{(by[r.e.t]=by[r.e.t]||[]).push(r.e);});
  return `<p class="muted">${res.length} resultado${res.length===1?'':'s'}</p>`+S.temas.filter(t=>by[t.id]).map(t=>`<p class="sr-group" ${tcs(t.id)}><span class="tdot"></span>${t.num}. ${esc(t.titulo)}</p><div ${tcs(t.id)}>${by[t.id].map(e=>{
    const act=e.sec?`data-action="go-sec" data-sec="${e.sec}"`:`data-action="go-tab" data-tema="${e.t}" data-tab="${e.gl?'glosario':'esencial'}"`;
    return `<button class="sr" ${act}><span class="pg">${e.k}</span><b>${e.k==='Sección'?esc(e.title):snippet(e.title,rawTerms)}</b>${e.text?`<span>${snippet(e.text,rawTerms)}</span>`:''}</button>`;}).join('')}</div>`).join('');
}
function viewBuscar(){
  return `<header class="page-head"><p class="eyebrow">Toda la guía</p><h1>Buscar</h1></header>
  <div class="search-box"><label class="vh" for="q-search">Buscar en la guía</label><input id="q-search" class="inp" type="search" placeholder="Busca: carnitina, escorbuto…" value="${esc(S.searchQ)}" autocomplete="off"></div>
  <div id="search-res">${searchResults(S.searchQ)}</div>`;
}

function viewEsencialGlobal(){
  const tot=S.temas.reduce((a,t)=>a+(t.imprescindibles||[]).length,0);
  const known=Object.keys(P.e).filter(k=>P.e[k]>0&&S.byId[k.split(':')[0]]).length;
  return `<header class="page-head"><p class="eyebrow" data-esscount>Repaso exprés · ${known} de ${tot} marcados</p><h1>Lo esencial de todo el curso</h1><p class="lede">Lo que sí o sí tienes que saber de cada tema en una sola página. Ideal para la noche antes del examen: marca lo que ya puedes explicar sin mirar.</p></header>
  ${S.temas.map(t=>`<section class="ess-group" ${tcs(t.id)}><h2><span class="tdot"></span><a href="#t-${t.id}">${t.num}. ${esc(t.titulo)}</a> <span class="pg">${pagesTxt(t.paginas)}</span></h2><ul class="ess">${(t.imprescindibles||[]).map((x,i)=>essItem(t.id+':'+i,x)).join('')}</ul></section>`).join('')}`;
}

function viewProgreso(){
  const g=globalStats();const days=Object.keys(P.d).filter(k=>P.d[k].q||P.d[k].c).length;
  const cells=[];const d0=new Date();d0.setDate(d0.getDate()-83-((d0.getDay()+6)%7)+6);
  const start=new Date();start.setDate(start.getDate()-83);while(start.getDay()!==1)start.setDate(start.getDate()-1);
  const c=new Date(start);const end=new Date();
  while(c<=end){const k=c.toLocaleDateString('en-CA');const r=P.d[k];const v=r?(r.q||0)+(r.c||0):0;const l=v===0?'':v<10?'l1':v<30?'l2':v<60?'l3':'l4';cells.push(`<i class="${l}" title="${k}: ${v} actividades"></i>`);c.setDate(c.getDate()+1);}
  return `<header class="page-head"><p class="eyebrow">Tu avance</p><h1>Progreso</h1></header>
  <div class="prog-grid">
    <div class="panel"><b>${pct(g.dom)}</b><span>dominio global</span></div>
    <div class="panel"><b>${g.att}</b><span>respuestas totales</span></div>
    <div class="panel"><b>${g.acc==null?'—':pct(g.acc)}</b><span>de acierto</span></div>
    <div class="panel"><b>${g.cards}</b><span>tarjetas estudiadas</span></div>
    <div class="panel"><b>${g.streak}</b><span>racha de días</span></div>
    <div class="panel"><b>${days}</b><span>días de estudio</span></div>
  </div>
  <h2 class="h2">Por tema</h2>
  <div class="tbl"><table><thead><tr><th>Tema</th><th>Leído</th><th>Tarjetas</th><th>Preguntas</th><th>Acierto</th><th>Dominio</th></tr></thead><tbody>
  ${S.temas.map(t=>{const st=temaStats(t);return `<tr ${tcs(t.id)}><td><a href="#t-${t.id}"><span class="tdot"></span>${t.num}. ${esc(t.titulo)}</a></td><td class="mono">${st.read}/${t.secciones.length}</td><td class="mono">${pct(st.C)}</td><td class="mono">${pct(st.Q)}</td><td class="mono">${st.acc==null?'—':pct(st.acc)}</td><td><div class="cellbar"><div class="bar tcb anim"><i style="width:${st.dom*100}%"></i></div><span class="mono">${pct(st.dom)}</span></div></td></tr>`;}).join('')}
  </tbody></table></div>
  <div class="two">
    <section class="panel"><h2 class="h3">Últimas 12 semanas</h2><div class="heat" aria-label="Actividad diaria">${cells.join('')}</div><p class="muted" style="font-size:13.5px;margin-top:8px">Cada cuadro es un día; más intenso, más preguntas y tarjetas.</p></section>
    <section class="panel"><h2 class="h3">Simulacros</h2>${(P.x||[]).length?`<div class="hist">${P.x.slice(-6).reverse().map(x=>`<div class="hist-row"><span class="mono">${fmtDate(x.t)}</span><b class="mono">${(x.k/x.n*10).toFixed(1)}</b><span class="muted">${x.k}/${x.n} preguntas</span></div>`).join('')}</div>`:`<p class="muted">Aún no haces ninguno. <a href="#examen">Haz el primero</a>.</p>`}</section>
  </div>
  <div class="two">
    <section class="panel"><h2 class="h3">Dónde se guarda</h2><p class="muted" style="margin-bottom:12px">${Sync.on?'Tu avance se sincroniza con tu cuenta de Claude: ábrelo en el celular o en la compu y sigues donde te quedaste.':'Tu avance se guarda en este navegador. Si cambias de dispositivo, copia tu progreso aquí y pégalo en el otro.'}</p>
      <div class="field"><label for="fecha">Fecha del examen</label><input type="date" id="fecha" class="inp" value="${esc(P.fecha||'')}"></div></section>
    <section class="panel io"><h2 class="h3">Copiar o pasar tu progreso</h2>
      <div class="row" style="margin-bottom:10px"><button class="btn btn-sm btn-ghost" data-action="exp">Copiar mi progreso</button><button class="btn btn-sm btn-ghost" data-action="imp">Pegar progreso</button></div>
      <label class="vh" for="io-text">Progreso en texto</label><textarea id="io-text" class="inp" placeholder="Aquí aparece tu progreso copiado, o pega el de otro dispositivo y toca «Pegar progreso»."></textarea>
      <div style="margin-top:14px">${S.confirmReset?`<div class="confirm"><p><b>¿Borrar todo tu progreso?</b> Se pierden respuestas, tarjetas y simulacros. No se puede deshacer.</p><div class="row"><button class="btn btn-sm" data-action="reset-yes">Sí, borrar todo</button><button class="btn btn-sm btn-ghost" data-action="reset-no">Cancelar</button></div></div>`:`<button class="linkbtn" data-action="reset-ask">Borrar mi progreso</button>`}</div>
    </section>
  </div>`;
}

/* ================= router ================= */
function parseHash(){
  const h=decodeURIComponent(location.hash.slice(1));
  if(h.startsWith('t-')){const m=h.slice(2).match(/^([a-z0-9]+)(?:-([a-z]+))?$/);if(m&&S.byId[m[1]])return {v:'tema',id:m[1],tab:m[2]||'aprende'};}
  if(['repaso','examen','errores','buscar','progreso','esencial'].includes(h))return {v:h};
  return {v:'inicio'};
}
function render(){
  const r=S.route,main=$('#main');
  let html;
  switch(r.v){
    case 'tema':html=viewTema(S.byId[r.id],r.tab);break;
    case 'repaso':html=viewRepaso();break;
    case 'examen':html=viewExamen();break;
    case 'errores':html=viewErrores();break;
    case 'buscar':html=viewBuscar();break;
    case 'progreso':html=viewProgreso();break;
    case 'esencial':html=viewEsencialGlobal();break;
    default:html=viewHome();
  }
  main.innerHTML=r.v==='tema'?html:`<div class="${S.fresh?'view':''}">${html}</div>`;
  $$('[data-host]',main).forEach(h=>{const a=S.active[h.dataset.host];if(a){a.el=h;a.render();}});
  navCurrent();
  const toc=$('#toc');if(toc&&matchMedia('(max-width:980px)').matches)toc.open=false;
  if(S.fresh)countUp(main);
  animateRings(main);initHero();initRutas(main);
  S.fresh=false;S.freshTab=false;
  if(S.pendingSec){const sid=S.pendingSec;S.pendingSec=null;requestAnimationFrame(()=>scrollToSec(sid));setTimeout(()=>scrollToSec(sid,true),60);}
  else if(S.pendingRuta){const id=S.pendingRuta;S.pendingRuta=null;const go2=()=>{const el=document.getElementById('ruta-'+id);if(el)el.scrollIntoView({block:el.offsetHeight>innerHeight-140?'start':'center'});};requestAnimationFrame(go2);setTimeout(go2,80);}
  tocHere();
  const at=$('.tabs [aria-current]');
  if(at){const fix=()=>{const nv=at.parentElement;if(!nv.isConnected)return;const d=at.getBoundingClientRect().left-nv.getBoundingClientRect().left;nv.scrollLeft+=d-(nv.clientWidth-at.offsetWidth)/2;};fix();setTimeout(fix,60);}
}
function tocHere(){
  const links=$$('[data-toc]');if(!links.length)return;
  let cur=null;for(const a of links){const s=document.getElementById('sec-'+a.dataset.toc);if(s&&s.getBoundingClientRect().top<200)cur=a;}
  links.forEach(a=>a.classList.toggle('is-here',a===cur));
}
let tocT=0;addEventListener('scroll',()=>{const t=Date.now();if(t-tocT>120){tocT=t;tocHere();}},{passive:true});
function scrollToSec(sid,quiet){const el=$('#sec-'+sid);if(!el)return;el.scrollIntoView({block:'start'});if(!quiet){el.classList.add('flash-hl');setTimeout(()=>el.classList.remove('flash-hl'),1800);}}
function softRefresh(){
  // re-render only when no in-progress interaction would be disturbed
  const busy=Object.values(S.active).some(a=>a.el&&a.el.isConnected);
  const typing=document.activeElement&&document.activeElement.matches('input,textarea,select');
  if(!busy&&!typing&&S.temas.length){const y=scrollY;render();scrollTo(0,y);}
  syncBadge();
}
function go(hash){if(location.hash==='#'+hash){S.route=parseHash();render();}else location.hash=hash;}
window.addEventListener('hashchange',()=>{
  const prev=S.route;S.route=parseHash();
  const same=prev.v===S.route.v&&prev.id===S.route.id;
  S.fresh=!same;S.freshTab=same&&prev.tab!==S.route.tab;
  const pend=S.pendingSec||S.pendingRuta;
  render();
  if(!pend&&!(same&&prev.tab===S.route.tab)){
    if(same&&S.route.v==='tema'){const b=$('.t-band');const y=b?b.offsetTop+b.offsetHeight-8:0;if(scrollY>y)window.scrollTo(0,y);}
    else window.scrollTo(0,0);
  }
  if(S.route.v==='buscar'&&matchMedia('(pointer:fine)').matches){const i=$('#q-search');if(i)i.focus();}
});

/* ================= acciones ================= */
function qzOf(el){const h=el&&el.closest&&el.closest('[data-qz]');return h?S.qz[h.dataset.qz]:null;}
function mountActive(key,inst){if(S.active[key]&&S.active[key]!==inst)S.active[key].destroy();inst.o.key=key;S.active[key]=inst;S.lastQz=inst;}
function goSec(sid){const s=S.sec[sid];if(!s)return;const h='t-'+s.tema+'-aprende';if(S.route.v==='tema'&&S.route.id===s.tema&&S.route.tab==='aprende'){scrollToSec(sid);return;}S.pendingSec=sid;go(h);}
const ACT={
  'go-ruta':a=>{const r=S.rutaById[a.dataset.ruta];if(!r)return;S.pendingRuta=r.id;go('t-'+r.tema+'-aprende');},
  'ru-go':a=>{const st=rutaState(a.dataset.ruta);if(st.play){st.play=false;clearInterval(st.timer);}rutaGo(a.dataset.ruta,+a.dataset.i);},
  'ru-next':a=>{const st=rutaState(a.dataset.ruta);if(st.play){st.play=false;clearInterval(st.timer);}rutaGo(a.dataset.ruta,st.i+1);},
  'ru-prev':a=>{const st=rutaState(a.dataset.ruta);if(st.play){st.play=false;clearInterval(st.timer);}rutaGo(a.dataset.ruta,st.i-1);},
  'ru-play':a=>rutaPlay(a.dataset.ruta),
  'ru-hide':a=>{const st=rutaState(a.dataset.ruta);st.hide=!st.hide;st.shown={};rutaUpdate(a.dataset.ruta,true);if(st.hide)toast('Modo recordar: intenta decir el nombre de cada paso antes de mostrarlo.');},
  'ru-show':a=>{const st=rutaState(a.dataset.ruta);st.shown[st.i]=true;rutaUpdate(a.dataset.ruta,true);},
  'zoom':a=>{const lb=$('#lightbox');lb.querySelector('img').src=a.dataset.src;lb.querySelector('img').alt=a.dataset.cap||'';lb.querySelector('p').textContent=a.dataset.cap||'';lb.hidden=false;},
  'lb-close':()=>{$('#lightbox').hidden=true;},
  'go-sec':a=>goSec(a.dataset.sec),
  'goto-sec':a=>{scrollToSec(a.dataset.sec);const toc=$('#toc');if(toc&&matchMedia('(max-width:980px)').matches)toc.open=false;},
  'go-tab':a=>go('t-'+a.dataset.tema+'-'+a.dataset.tab),
  'mark-read':a=>{const sid=a.dataset.sec;P.r[sid]=P.r[sid]>0?-NOW():NOW();touch();markReadUI(sid);},
  'mini-start':a=>{
    const sid=a.dataset.sec,box=$(`[data-check="${sid}"]`);
    const ids=pickSmart(S.secQ[sid]||[],3).map(q=>q.id);if(!ids.length)return;
    const z=new Quiz(ids,{mode:'mini',sec:sid});mountActive('mini:'+sid,z);
    box.innerHTML=host('mini:'+sid);z.el=box.firstElementChild;z.render();
  },
  'practice-sec':a=>{
    const s=S.sec[a.dataset.sec];if(!s)return;const t=S.byId[s.tema];
    S.setup[t.id]={modo:'inteligente',sec:s.id,tipo:'todos',n:'10'};startPractice(t,S.setup[t.id]);go('t-'+t.id+'-practicar');
  },
  'seg':a=>{
    const g=a.closest('.seg'),k=g.dataset.k,sc=g.dataset.scope,v=a.dataset.v;
    if(sc==='ex'){S.exSetup[k]=v;}else{S.setup[sc][k]=v;}
    const y=scrollY;render();scrollTo(0,y);
  },
  'pr-start':a=>{const t=S.byId[a.dataset.tema];startPractice(t,S.setup[t.id]);const y=$('.tabs').offsetTop-70;render();if(scrollY>y)scrollTo(0,y);},
  'fc-start':a=>{
    const t=S.byId[a.dataset.tema],su=S.setup['fc'+t.id]||{sec:''};
    let cards=su.sec?t.tarjetas.filter(c=>c.seccion===su.sec):t.tarjetas;
    let ids=a.dataset.mode==='pend'?cardsDeck(cards,'tema'):cardsDeck(cards,'todas');
    if(a.dataset.mode==='mezcla')ids=shuffle(ids);
    if(!ids.length){toast('No hay tarjetas pendientes aquí. Prueba «Todas».');return;}
    mountActive('fc:'+t.id,new Flash(ids,{}));render();
  },
  'fc-flip':(a,z)=>{if(!z)return;if(z.dragged){z.dragged=false;return;}z.flip();},
  'fc-rate':(a,z)=>{if(z)z.rate(+a.dataset.v);},
  'fc-hard':(a,z)=>{if(!z)return;const k=z.o.key;const f=new Flash(shuffle(z.hard),{multi:z.o.multi});mountActive(k,f);f.el=z.el;z.destroy();S.active[k]=f;f.render();},
  'fc-exit':(a,z)=>{if(z){z.destroy();}render();},
  'qz-opt':(a,z)=>{if(!z)return;const q=z.cur;z.answer(q.tipo==='vf'?a.dataset.v==='1':+a.dataset.v);},
  'qz-check':(a,z)=>{if(z)z.check();},
  'qz-skip':(a,z)=>{if(z)z.skip();},
  'qz-next':(a,z)=>{if(z)z.next();},
  'qz-prev':(a,z)=>{if(z)z.prev();},
  'qz-goto':(a,z)=>{if(z)z.go(+a.dataset.i);},
  'qz-flag':(a,z)=>{if(!z)return;const s=z.s();s.flag=!s.flag;z.render();},
  'qz-finish':(a,z)=>{if(z)z.askFinish();},
  'qz-yes':(a,z)=>{if(!z)return;if(z.confirm==='finish')z.finish();else{z.confirm=null;z.destroy();render();}},
  'qz-no':(a,z)=>{if(!z)return;z.confirm=null;z.render();},
  'qz-hint':(a,z)=>{if(!z)return;const inp=z.el.querySelector('[data-fill]');if(inp)z.s().resp=inp.value;z.s().hint=true;z.render();},
  'qz-ai':(a,z)=>{if(z)z.explain();},
  'qz-place':(a,z)=>{if(!z)return;const s=z.s();s.placed.push(+a.dataset.v);z.render();},
  'qz-unplace':(a,z)=>{if(!z)return;const s=z.s();s.placed=s.placed.filter(x=>x!==+a.dataset.v);z.render();},
  'qz-left':(a,z)=>{if(!z)return;const s=z.s(),i=+a.dataset.v;s.sel=s.sel===i?null:i;z.render();},
  'qz-right':(a,z)=>{if(!z)return;const s=z.s(),ri=+a.dataset.v;
    if(s.sel==null){const l=Object.keys(s.pairs).find(k=>s.pairs[k]===ri);if(l!=null){delete s.pairs[l];z.render();}else{const f=z.cur.pares.findIndex((_,i)=>s.pairs[i]===undefined);if(f>=0){s.pairs[f]=ri;z.render();}}return;}
    for(const k in s.pairs)if(s.pairs[k]===ri)delete s.pairs[k];s.pairs[s.sel]=ri;
    const nxt=z.cur.pares.findIndex((_,i)=>s.pairs[i]===undefined);s.sel=nxt>=0?nxt:null;z.render();},
  'qz-exit':(a,z)=>{
    if(!z)return;
    if(z.exam&&!z.done){z.confirm='exit';z.render();return;}
    const k=z.o.key;z.destroy();
    if(k&&k.startsWith('mini:')){const sid=k.slice(5),box=$(`[data-check="${sid}"]`);if(box)box.innerHTML=secCheckInner(S.sec[sid]);return;}
    if(k&&k.startsWith('gl:')){render();return;}
    render();
  },
  'qz-retry':(a,z)=>{
    if(!z)return;const wrong=z.qs.filter(q=>!(z.st[q.id]&&z.st[q.id].ok));const k=z.o.key;
    const n=new Quiz(wrong.map(q=>q.ia||q.gl?q:q.id),Object.assign({},z.o,{mode:z.exam?'practica':z.o.mode,limit:0}));
    n.el=z.el;z.destroy();mountActive(k,n);n.render();n.el.scrollIntoView({block:'start'});
  },
  'qz-again':(a,z)=>{
    if(!z)return;const sid=z.o.sec,k=z.o.key;const ids=pickSmart(S.secQ[sid]||[],3).map(q=>q.id);
    const n=new Quiz(ids,{mode:'mini',sec:sid});n.el=z.el;z.destroy();mountActive(k,n);n.render();
  },
  'ess-toggle':a=>{const k=a.dataset.k;P.e[k]=P.e[k]>0?-NOW():NOW();touch();const on=P.e[k]>0;$$(`[data-k="${k}"]`).forEach(b=>{b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);});
    const ey=$('[data-esscount]');if(ey){const tot=S.temas.reduce((s,t)=>s+(t.imprescindibles||[]).length,0);const kn=Object.keys(P.e).filter(x=>P.e[x]>0&&S.byId[x.split(':')[0]]).length;ey.textContent='Repaso exprés · '+kn+' de '+tot+' marcados';}},
  'gl-practice':a=>{
    const t=S.byId[a.dataset.tema];const g=shuffle((t.glosario||[]).filter(x=>x.termino&&x.definicion));
    const qs=[];for(let i=0;i+4<=g.length&&qs.length<5;i+=4){qs.push({id:'gl-'+t.id+'-'+i+'-'+NOW(),gl:true,tipo:'relacionar',tema:t.id,dificultad:1,enunciado:'Relaciona cada término con su definición',pares:g.slice(i,i+4).map(x=>[x.termino,plain(x.definicion)]),explicacion:'Repasa en el glosario las definiciones que no uniste bien.'});}
    mountActive('gl:'+t.id,new Quiz(qs,{mode:'practica',track:false}));render();
  },
  'rep-cards':()=>{const ids=cardsDeck(allC(),'global');if(!ids.length)return;mountActive('rep',new Flash(interleaveCards(ids),{multi:true}));render();scrollTo(0,0);},
  'rep-qs':()=>{const ids=dueQuestions().slice(0,25).map(q=>q.id);if(!ids.length)return;mountActive('rep',new Quiz(ids,{mode:'practica',multi:true}));render();scrollTo(0,0);},
  'rep-mix':()=>{const ids=interleave(pickSmart(allQ(),20)).map(q=>q.id);mountActive('rep',new Quiz(ids,{mode:'practica',multi:true}));render();scrollTo(0,0);},
  'err-go':a=>{let w=allQ().filter(isFailed);if(a.dataset.tema)w=w.filter(q=>q.tema===a.dataset.tema);const ids=interleave(shuffle(w)).slice(0,30).map(q=>q.id);if(!ids.length)return;mountActive('err',new Quiz(ids,{mode:'practica',multi:!a.dataset.tema}));render();scrollTo(0,0);},
  'ex-tema':a=>{const es=S.exSetup,id=a.dataset.id;es.temas=es.temas.includes(id)?es.temas.filter(x=>x!==id):[...es.temas,id];const y=scrollY;render();scrollTo(0,y);},
  'ex-all':()=>{S.exSetup.temas=S.temas.map(t=>t.id);const y=scrollY;render();scrollTo(0,y);},
  'ex-none':()=>{S.exSetup.temas=[];const y=scrollY;render();scrollTo(0,y);},
  'ex-start':()=>{const es=S.exSetup;const ids=pickExam(es);if(!ids.length)return;mountActive('ex',new Quiz(ids,{mode:'examen',multi:true,limit:es.timer?ids.length*75:0}));render();scrollTo(0,0);},
  'search-sug':a=>{S.searchQ=a.dataset.q;const i=$('#q-search');if(i)i.value=S.searchQ;$('#search-res').innerHTML=searchResults(S.searchQ);},
  'tu-sug':a=>chatSend(a.dataset.t,a.textContent),
  'tu-send':a=>{const ta=$('#chat-in');chatSend(a.dataset.t,ta?ta.value:'');},
  'tu-stop':a=>{const ch=S.chat[a.dataset.t];if(ch&&ch.ctl)ch.ctl.abort();},
  'fy-go':a=>feynman(a.dataset.t),
  'gq-go':a=>genQs(a.dataset.t),
  'exp':()=>{const s=JSON.stringify(P);const ta=$('#io-text');ta.value=s;const done=()=>toast('Progreso copiado. Pégalo en el otro dispositivo.');
    try{navigator.clipboard.writeText(s).then(done,()=>{ta.select();toast('Selecciona y copia el texto del cuadro.');});}catch(e){ta.select();toast('Selecciona y copia el texto del cuadro.');}},
  'imp':()=>{const ta=$('#io-text');try{const r=JSON.parse(ta.value);if(!r||typeof r!=='object'||!r.q)throw 0;P=mergeP(P,r);touch();toast('Progreso combinado con el de este dispositivo.');render();}catch(e){toast('Ese texto no es un progreso válido. Cópialo completo.');}},
  'reset-ask':()=>{S.confirmReset=true;const y=scrollY;render();scrollTo(0,y);},
  'reset-no':()=>{S.confirmReset=false;const y=scrollY;render();scrollTo(0,y);},
  'reset-yes':()=>{S.confirmReset=false;const keep={fecha:P.fecha};P=emptyP();P.fecha=keep.fecha;touch();Object.values(S.active).forEach(x=>x.destroy());toast('Progreso borrado.');render();},
};
function interleaveCards(ids){const by={};ids.forEach(id=>{const c=S.c[id];(by[c.tema]=by[c.tema]||[]).push(id);});const keys=Object.keys(by);const out=[];let more=true;while(more){more=false;for(const k of keys){const x=by[k].shift();if(x){out.push(x);more=true;}}}return out;}

document.addEventListener('click',e=>{
  const cz=e.target.closest('strong.cz');if(cz){cz.classList.toggle('shown');return;}
  const a=e.target.closest('[data-action]');if(!a)return;
  if(a.disabled)return;
  const z=qzOf(a);if(z)S.lastQz=z;
  const fn=ACT[a.dataset.action];if(fn){e.preventDefault();fn(a,z,e);}
});
/* deslizar tarjetas: izquierda = otra vez, derecha = bien */
let SW=null;
document.addEventListener('pointerdown',e=>{
  const card=e.target.closest&&e.target.closest('[data-swipe]');if(!card)return;
  const z=qzOf(card);if(!z||!z.isFlash||!z.flipped)return;
  SW={card,z,x:e.clientX,y:e.clientY,dx:0,id:e.pointerId,on:false};
});
document.addEventListener('pointermove',e=>{
  if(!SW||e.pointerId!==SW.id)return;
  const dx=e.clientX-SW.x,dy=e.clientY-SW.y;
  if(!SW.on){if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){SW.on=true;SW.card.classList.add('dragging');}else return;}
  SW.dx=dx;SW.card.style.transform=`translateX(${dx}px) rotate(${dx/22}deg)`;
  const l=SW.card.querySelector('.swipe-tag.l'),r=SW.card.querySelector('.swipe-tag.r');
  if(l)l.style.opacity=Math.min(1,Math.max(0,-dx/90));if(r)r.style.opacity=Math.min(1,Math.max(0,dx/90));
});
function swEnd(){
  if(!SW)return;const {card,z,dx,on}=SW;SW=null;
  card.classList.remove('dragging');
  if(!on){return;}
  z.dragged=true;setTimeout(()=>{z.dragged=false;},350);
  if(Math.abs(dx)>90){card.style.transform=`translateX(${dx>0?600:-600}px) rotate(${dx>0?18:-18}deg)`;setTimeout(()=>z.rate(dx>0?2:0),180);}
  else{card.style.transform='';$$('.swipe-tag',card).forEach(t=>t.style.opacity=0);}
}
document.addEventListener('pointerup',swEnd);document.addEventListener('pointercancel',swEnd);

document.addEventListener('input',e=>{
  const t=e.target;
  if(t.matches('[data-fill]')){const z=qzOf(t);if(z)z.s().resp=t.value;return;}
  if(t.id==='q-search'){S.searchQ=t.value;clearTimeout(S.sT);S.sT=setTimeout(()=>{$('#search-res').innerHTML=searchResults(S.searchQ);},120);return;}
  if(t.id==='gl-q'){S.glQ=t.value;const w=strip(t.value).trim();$$('#gl-list .gl-it').forEach(it=>{it.hidden=!!w&&!it.dataset.term.includes(w);});return;}
  if(t.id==='chat-in'){const ch=S.chat[t.dataset.t];if(ch)ch.draft=t.value;}
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='fecha'){P.fecha=t.value||null;touch();const y=scrollY;render();scrollTo(0,y);return;}
  if(t.id==='cz-toggle'){P.cz=t.checked;touch();const y=scrollY;render();scrollTo(0,y);toast(P.cz?'Modo tapar activado: toca los recuadros para ver la palabra.':'Modo tapar desactivado.');return;}
  if(t.id==='pr-sec'){S.setup[t.dataset.t].sec=t.value;const y=scrollY;render();scrollTo(0,y);return;}
  if(t.id==='fc-sec'){(S.setup['fc'+t.dataset.t]||(S.setup['fc'+t.dataset.t]={})).sec=t.value;return;}
  if(t.id==='ex-timer'){S.exSetup.timer=t.checked;const y=scrollY;render();scrollTo(0,y);return;}
  if(t.id==='ex-dif'){S.exSetup.dif=t.checked;const y=scrollY;render();scrollTo(0,y);return;}
});
document.addEventListener('keydown',e=>{
  const t=e.target;
  if(e.key==='Escape'&&!$('#lightbox').hidden){$('#lightbox').hidden=true;return;}
  if(!$('#lightbox').hidden)return;
  if(t.matches&&t.matches('strong.cz')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();t.classList.toggle('shown');return;}
  if(t.matches&&t.matches('[data-fill]')&&e.key==='Enter'){e.preventDefault();const z=qzOf(t);if(!z)return;if(z.exam){z.s().resp=t.value;z.next();}else if(!z.s().checked)z.check();else z.next();return;}
  if(t.id==='chat-in'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();chatSend(t.dataset.t,t.value);return;}
  if(t.matches&&t.matches('input,textarea,select'))return;
  if(t.getAttribute&&t.getAttribute('role')==='button'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();t.click();return;}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const z=S.lastQz;if(!z||!z.el||!z.el.isConnected||z.done||z.finished)return;
  if(z.isFlash){
    if(e.key===' '||e.key==='Enter'){e.preventDefault();z.flip();}
    else if(z.flipped&&/^[1-4]$/.test(e.key)){z.rate(+e.key-1);}
    return;
  }
  const q=z.cur,s=z.s(q);
  if(e.key==='Enter'){if(t.tagName==='BUTTON')return;e.preventDefault();if(z.exam)z.next();else if(s.checked)z.next();else if(['ordenar','relacionar'].includes(q.tipo)&&z.ready(q,s))z.check();return;}
  if(s.checked&&!z.exam)return;
  if(q.tipo==='opcion'){const m='1234abcd'.indexOf(e.key.toLowerCase());if(m>=0){const pos=m%4;if(pos<s.order.length)z.answer(s.order[pos]);}}
  else if(q.tipo==='vf'){const k=e.key.toLowerCase();if(k==='v'||k==='1')z.answer(true);else if(k==='f'||k==='2')z.answer(false);}
});

/* ================= tutor IA ================= */
async function chatSend(tid,text){
  const t=S.byId[tid],ch=S.chat[tid];if(!t||!ch||ch.busy||!S.sample)return;
  text=String(text||'').trim();if(!text)return;
  ch.turns.push({role:'user',content:text});ch.draft='';
  const ans={role:'assistant',content:''};ch.turns.push(ans);ch.busy=true;refreshTutor(tid);
  const rules=`Eres un tutor paciente de bioquímica para estudiantes de odontología en México. Responde en español, claro y concreto (unas 200 palabras salvo que te pidan más). Usa **negritas** para los términos clave y listas cortas cuando ayuden. Básate primero en el material del curso de abajo; si algo no viene en el material, dilo y responde con bioquímica estándar. Si el alumno te pide que lo examines, hazle una pregunta a la vez y espera su respuesta antes de corregir.\n\nMATERIAL DEL TEMA «${t.titulo}»:\n${temaContext(t,30000)}`;
  const turns=[{role:'user',content:rules},...ch.turns.filter(m=>m!==ans&&m.content).slice(-12).map(m=>({role:m.role,content:m.content}))];
  ch.ctl=new AbortController();
  try{const r=await S.sample(turns,{modelTier:'quick',cache:false,signal:ch.ctl.signal,onText:({text})=>{ans.content=text;const log=$('#chat-log');if(log&&S.route.v==='tema'&&S.route.id===tid){const last=log.lastElementChild;if(last)last.innerHTML=md(text);log.scrollTop=log.scrollHeight;}}});ans.content=r.text;}
  catch(e){ans.content=(e&&e.text?e.text+'\n\n':'')+(e&&e.code==='cancelled'?'(Detenido)':aiErr(e));}
  ch.busy=false;refreshTutor(tid);
}
function refreshTutor(tid){
  if(!(S.route.v==='tema'&&S.route.id===tid&&S.route.tab==='tutor'))return;
  const ch=S.chat[tid],log=$('#chat-log');
  if(log){log.innerHTML=chatLog(ch);log.scrollTop=log.scrollHeight;}
  const box=$('.chat-in');if(box){const ta=$('#chat-in');if(ta&&!ch.busy)ta.value=ch.draft;const old=box.querySelector('.btn');if(old)old.outerHTML=ch.busy?`<button class="btn btn-ghost" data-action="tu-stop" data-t="${tid}">Detener</button>`:`<button class="btn" data-action="tu-send" data-t="${tid}">Enviar</button>`;}
  const sugs=$('.tutor .sugs');if(sugs&&ch.turns.length)sugs.remove();
}
async function feynman(tid){
  const sid=$('#fy-sec').value,txt=$('#fy-text').value.trim(),sec=S.sec[sid];
  if(txt.length<40){toast('Escribe al menos un par de frases para poder calificarte.');return;}
  const F=S.fy[tid]={busy:true};const btn=$('[data-action="fy-go"]');if(btn){btn.disabled=true;btn.textContent='Calificando…';}$('#fy-out').innerHTML='<p class="thinking">El tutor está leyendo tu explicación… (puede tardar unos segundos)</p>';
  const prompt=`Eres profesor de bioquímica para odontología. Un alumno explicó con sus propias palabras la sección «${sec.titulo}». Evalúa su explicación SOLO contra este material del curso:
---
${sec.txt.slice(0,7000)}
---
Explicación del alumno:
"""${txt.slice(0,4000)}"""

Responde solo con JSON de esta forma: {"calificacion": número de 0 a 10 (puede llevar un decimal), "resumen": "una frase", "bien": ["algo que explicó correctamente"], "falta": ["concepto importante que no mencionó"], "errores": ["afirmación incorrecta y su corrección"], "consejo": "qué estudiar o cómo mejorar, una o dos frases"}. Máximo 4 elementos por lista; listas vacías si no aplica. En español, dirigiéndote al alumno de tú.`;
  try{const r=await S.sample.json(prompt,{modelTier:'default',cache:false});if(!r||typeof r!=='object')throw {code:'invalid_json'};F.res=r;}catch(e){F.err=aiErr(e)||'Se detuvo la calificación.';}
  F.busy=false;
  if(S.route.v==='tema'&&S.route.id===tid&&S.route.tab==='tutor'){$('#fy-out').innerHTML=fyHTML(F);const b=$('[data-action="fy-go"]');if(b){b.disabled=false;b.textContent='Calificar mi explicación';}}
}
async function genQs(tid){
  const sid=$('#gq-sec').value,sec=S.sec[sid];const G=S.gq[tid]={busy:true};
  const b=$('[data-action="gq-go"]');if(b){b.disabled=true;b.textContent='Creando preguntas… (puede tardar un minuto)';}
  const prompt=`Crea 5 preguntas NUEVAS de opción múltiple, nivel examen universitario de bioquímica para odontología, basadas SOLO en este material:
---
${sec.titulo}
${sec.txt.slice(0,7000)}
---
Reglas: 4 opciones por pregunta y una sola correcta; distractores plausibles del mismo tema; nunca «todas las anteriores» ni «ninguna»; que obliguen a entender, no solo a memorizar; varía la posición de la correcta. Español de México.
Responde solo con un arreglo JSON: [{"enunciado":"…","opciones":["…","…","…","…"],"correcta":0,"explicacion":"por qué es la correcta, 1 o 2 frases"}]`;
  try{
    const arr=await S.sample.json(prompt,{modelTier:'default',cache:false});
    const list=(Array.isArray(arr)?arr:(arr&&arr.preguntas)||[]).filter(x=>x&&typeof x.enunciado==='string'&&Array.isArray(x.opciones)&&x.opciones.length>=3&&Number.isInteger(+x.correcta)&&+x.correcta>=0&&+x.correcta<x.opciones.length);
    if(!list.length)throw {code:'invalid_json'};
    const qs=list.slice(0,6).map((x,i)=>({id:'ia-'+NOW()+'-'+i,ia:true,tipo:'opcion',tema:tid,seccion:sid,dificultad:2,enunciado:x.enunciado,opciones:x.opciones.map(String),correcta:+x.correcta,explicacion:String(x.explicacion||'')}));
    G.busy=false;mountActive('gq:'+tid,new Quiz(qs,{mode:'practica',track:false}));
  }catch(e){G.busy=false;G.err=aiErr(e)||'Se canceló.';}
  if(S.route.v==='tema'&&S.route.id===tid&&S.route.tab==='tutor'){const y=scrollY;render();scrollTo(0,y);}
}

/* ================= arranque ================= */
async function boot(){
  document.documentElement.lang='es';
  try{
    const res=await fetch('contenido.json');if(!res.ok)throw new Error(res.status);
    indexData(await res.json());
  }catch(e){
    $('#main').innerHTML='<div class="empty"><b>No se pudo cargar el contenido de la guía</b><p class="muted">Recarga la página. Si sigue sin cargar, revisa tu conexión.</p></div>';return;
  }
  S.route=parseHash();render();syncBadge();
  initCaps();
}
boot();
})();
