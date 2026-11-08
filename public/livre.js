/* Chambre noire — le livre complet.
   Le son : de vrais enregistrements (Freesound, licences libres), un fichier MP3 par famille de sons (sons/*.mp3),
   chaque fichier étant une planche de segments [début, durée] décrite dans sons/meta.json ; aucun son n'est fabriqué. */
function creerSon(){
  const NOMS=['obturateur','pas','coups','portes','ventilation','interrupteur','gouttes','bain','papier','pince','rincage','feuilles','dehors'];
  const CLE_SON='chambre-noire-son';
  /* Volumes (0 à 1) : les réglages principaux */
  const VOL={ventilation:.16,dehors:.3,pas:.6,coup:.7,porte:.62,porteDouce:.5,interrupteur:.42,goutte:.18,bain:.55,egoutte:.13,
    obturateur:.55,papier:.5,pince:.42,rincage:.45,feuille:.3};
  let actif=true;try{actif=localStorage.getItem(CLE_SON)!=='0';}catch(_){}
  let ctx=null,hors=false,maitre=null,filtreLabo=null,charge=null,DON=null;
  const tampons={},bus={},cibles={labo:0,dehors:0},journal=[],erreurs=[],boucles=[],pioches={},fichiers={};
  let etouffe=null,prochGoutte=0,pasSon=null,nDev=0,dev=null,bainSons=[],attente=[];
  const hasard=(a,b)=>a+Math.random()*(b-a);
  /* Les fichiers sont demandés dès l'ouverture du livre : ils seront prêts au premier toucher */
  const meta=fetch('sons/meta.json').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(m=>{DON=m;return m;});
  meta.catch(e=>erreurs.push('meta : '+(e&&e.message||e)));
  NOMS.forEach(n=>{fichiers[n]=fetch('sons/'+n+'.mp3').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.arrayBuffer();});fichiers[n].catch(()=>{});});
  /* Tirer au sort sans jamais rejouer le même segment deux fois de suite */
  function pioche(nom){
    if(!DON||!DON[nom])return 0;
    const n=DON[nom].segs.length;let p=pioches[nom];
    if(!p||!p.reste.length){
      const r=[...Array(n).keys()];for(let i=n-1;i>0;i--){const j=Math.random()*(i+1)|0;[r[i],r[j]]=[r[j],r[i]];}
      const dernier=p?p.dernier:-1;if(r[0]===dernier&&n>1)r.push(r.shift());
      p=pioches[nom]={reste:r,dernier};
    }
    const i=p.reste.shift();p.dernier=i;return i;
  }
  function decoder(nom){
    return fichiers[nom].then(buf=>new Promise((ok,ko)=>{
      const fin=b=>{tampons[nom]=b;ok(b);};
      try{const p=ctx.decodeAudioData(buf,fin,ko);if(p&&p.then)p.then(fin,ko);}catch(e){ko(e);}
    }));
  }
  /* Une ambiance qui ne s'arrête pas : deux lectures qui se relaient en fondu enchaîné */
  function boucle(nom,dest,vol){
    const b=tampons[nom];if(!b)return;
    const g=ctx.createGain();g.gain.value=vol;g.connect(dest);
    const XF=4,deb=.15,L=b.duration-.3,monte=new Float32Array(32),baisse=new Float32Array(32);
    for(let i=0;i<32;i++){const u=i/31;monte[i]=Math.sin(u*Math.PI/2);baisse[i]=Math.cos(u*Math.PI/2);}
    const B={t:ctx.currentTime+.05,planifier(){
      const s=ctx.createBufferSource(),e=ctx.createGain(),t=B.t;
      s.buffer=b;e.gain.value=0;s.connect(e);e.connect(g);
      e.gain.setValueCurveAtTime(monte,t,XF);e.gain.setValueCurveAtTime(baisse,t+L-XF,XF);
      s.start(t,deb,L);s.stop(t+L+.05);B.t=t+L-XF;
    }};
    B.planifier();B.planifier();boucles.push(B);
  }
  function monter(c){
    ctx=c;
    const lim=ctx.createDynamicsCompressor();
    lim.threshold.value=-4;lim.knee.value=4;lim.ratio.value=12;lim.attack.value=.002;lim.release.value=.2;
    maitre=ctx.createGain();maitre.gain.value=actif?1:0;maitre.connect(lim);lim.connect(ctx.destination);
    /* Le labo passe par un filtre : derrière la porte fermée, on l'entend étouffé */
    bus.labo=ctx.createGain();bus.labo.gain.value=0;
    filtreLabo=ctx.createBiquadFilter();filtreLabo.type='lowpass';filtreLabo.frequency.value=18000;filtreLabo.Q.value=.5;
    bus.labo.connect(filtreLabo);filtreLabo.connect(maitre);
    bus.dehors=ctx.createGain();bus.dehors.gain.value=0;bus.dehors.connect(maitre);
    /* Décoder dans l'ordre où l'on en aura besoin */
    charge=meta.then(()=>NOMS.reduce((p,nom)=>p.then(()=>decoder(nom).then(()=>{
      if(nom==='ventilation')boucle('ventilation',bus.labo,VOL.ventilation);
      if(nom==='dehors')boucle('dehors',bus.dehors,VOL.dehors);
    },e=>{erreurs.push(nom+' : '+(e&&e.message||e));})),Promise.resolve()),()=>{});
    return charge;
  }
  const vivant=()=>!!ctx&&actif&&(hors||ctx.state==='running');
  function jouer(nom,i,o){
    if(!vivant())return null;
    const b=tampons[nom];if(!b||!DON||!DON[nom])return null;
    o=o||{};
    const sg=DON[nom].segs[i]||[0,b.duration],v=o.vitesse||1;
    const s=ctx.createBufferSource();s.buffer=b;if(v!==1)s.playbackRate.value=v;
    const g=ctx.createGain();g.gain.value=o.gain==null?1:o.gain;s.connect(g);
    let n=g;
    if(o.pan&&ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=o.pan;g.connect(p);n=p;}
    n.connect(o.bus?bus[o.bus]:maitre);
    const t=o.t!=null?o.t:ctx.currentTime;
    s.start(t,sg[0],sg[1]);
    journal.push(nom+':'+i);if(journal.length>300)journal.shift();
    return {s,g,t};
  }
  /* Un son demandé au tout premier toucher, avant que les fichiers soient prêts : on le joue dès qu'il l'est (pas plus tard que 0,7 s) */
  function jouerBientot(nom,i,o){
    if(tampons[nom]&&vivant())return jouer(nom,i,o);
    attente.push({nom,i,o,lim:performance.now()+700});return null;
  }
  function viderAttente(){
    if(!attente.length)return;
    const m=performance.now();
    attente=attente.filter(a=>{if(m>a.lim)return false;if(tampons[a.nom]&&vivant()){jouer(a.nom,a.i,a.o);return false;}return true;});
  }
  function eteindre(v,tc){
    if(!v||!ctx)return;
    const t=ctx.currentTime;
    try{if(v.t>t+.01){v.s.stop(t);return;}v.g.gain.setTargetAtTime(0,t,tc);v.s.stop(t+tc*8);}catch(_){}
  }
  function debloquer(){
    if(!actif||hors)return;
    if(!ctx){
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      /* iPhone : jouer même quand le bouton de sonnerie est sur silencieux */
      try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch(_){}
      let c=null;try{c=new AC({latencyHint:'interactive'});}catch(_){try{c=new AC();}catch(e){}}
      if(!c)return;
      monter(c);
    }
    if(ctx.state!=='running'&&!document.hidden){
      try{const p=ctx.resume();if(p&&p.catch)p.catch(()=>{});}catch(_){}
      try{const s=ctx.createBufferSource();s.buffer=ctx.createBuffer(1,1,ctx.sampleRate);s.connect(ctx.destination);s.start(0);}catch(_){}
    }
  }
  document.addEventListener('visibilitychange',()=>{
    if(!ctx||hors)return;
    try{if(document.hidden)ctx.suspend();else if(actif)ctx.resume();}catch(_){}
  });
  /* Un mouvement d'eau dans la cuvette ; on s'y habitue : chaque développement est un peu plus discret */
  function mouvement(k,retard){
    const hab=Math.max(.5,1-.08*dev.num);
    const v=jouer('bain',pioche('bain'),{t:ctx.currentTime+(retard||0),gain:VOL.bain*hab*(k?.65:1)*hasard(.85,1.1),vitesse:hasard(.94,1.04),pan:hasard(-.25,.25)});
    if(v){bainSons.push(v);if(bainSons.length>3)bainSons.shift();}
    dev.n++;dev.dernier=ctx.currentTime;
  }
  const api={
    debloquer,
    ecoute:vivant,
    actif:()=>actif,
    duree:(nom,i)=>DON&&DON[nom]?DON[nom].segs[i||0][1]:0,
    basculer(){
      actif=!actif;try{localStorage.setItem(CLE_SON,actif?'1':'0');}catch(_){}
      if(actif)debloquer();
      if(ctx){
        maitre.gain.setTargetAtTime(actif?1:0,ctx.currentTime,.12);
        if(!actif){api.calme();setTimeout(()=>{if(!actif&&ctx.state==='running'){try{ctx.suspend();}catch(_){}}},700);}
      }
      return actif;
    },
    /* Le labo et le dehors, de 0 à 1 ; tc règle la lenteur du fondu ; etf : le labo entendu derrière la porte */
    scene(l,d,tc,etf){
      if(!ctx)return;
      const t=ctx.currentTime;tc=tc||.6;etf=!!etf;
      if(cibles.labo!==l){cibles.labo=l;bus.labo.gain.setTargetAtTime(l,t,tc);}
      if(cibles.dehors!==d){cibles.dehors=d;bus.dehors.gain.setTargetAtTime(d,t,tc);}
      if(etouffe!==etf){etouffe=etf;filtreLabo.frequency.setTargetAtTime(etf?420:18000,t,etf?.05:.45);}
    },
    tick(){
      viderAttente();
      if(!vivant())return;
      const t=ctx.currentTime;
      boucles.forEach(B=>{if(B.t-t<8)B.planifier();});
      /* Les gouttes : rares, irrégulières, jamais la même deux fois de suite */
      if(cibles.labo>.5&&!etouffe){
        if(t>=prochGoutte){
          if(prochGoutte){
            jouer('gouttes',pioche('gouttes'),{t,gain:VOL.goutte*hasard(.45,1),vitesse:hasard(.92,1.08),pan:hasard(-.45,-.2),bus:'labo'});
            if(Math.random()<.2)jouer('gouttes',pioche('gouttes'),{t:t+hasard(.4,.9),gain:VOL.goutte*hasard(.3,.6),vitesse:hasard(.95,1.1),pan:-.35,bus:'labo'});
          }
          prochGoutte=t+hasard(6,17);
        }
      }else prochGoutte=0;
    },
    /* Le couloir : nos pas jusqu'à la porte */
    pas(){api.stopPas();if(!vivant())return;pasSon=jouer('pas',0,{t:ctx.currentTime+.25,gain:VOL.pas});},
    stopPas(){if(pasSon)eteindre(pasSon,.08);pasSon=null;},
    coup(){jouer('coups',pioche('coups'),{gain:VOL.coup*hasard(.88,1.05),vitesse:hasard(.97,1.03)});},
    /* La porte : on entre (ou, court, on rentre depuis la planche-contact) */
    porte(court){
      if(!vivant())return;
      const t=ctx.currentTime;
      if(court){jouer('portes',2,{t,gain:VOL.porteDouce});return;}
      jouer('portes',0,{t,gain:VOL.porte});
      jouer('pas',1,{t:t+3.3,gain:VOL.pas*.45});
      jouer('pas',2,{t:t+3.95,gain:VOL.pas*.4});
    },
    interrupteur(on){jouer('interrupteur',on?0:1,{gain:VOL.interrupteur,pan:.2});},
    /* Le sténopé : l'obturateur s'ouvre un quart de seconde */
    obturateur(){jouerBientot('obturateur',pioche('obturateur'),{gain:VOL.obturateur});},
    /* La sortie : on rince les tirages sous le robinet, la lampe s'éteint, la porte s'ouvre sur le jour.
       Renvoie le temps du rinçage, pour que l'image l'attende. */
    sortir(){
      if(!vivant()||!tampons.rincage)return 0;
      const t=ctx.currentTime,r=3.9;
      jouer('rincage',0,{t:t+.15,gain:VOL.rincage,pan:-.3});
      jouer('interrupteur',1,{t:t+r+.35,gain:VOL.interrupteur,pan:.2});
      jouer('portes',1,{t:t+r+1,gain:VOL.porte*.9});
      return r;
    },
    /* Le bain : souvent, on entend d'abord la feuille qu'on glisse ; puis un seul mouvement d'eau lent,
       parfois un second plus doux si l'on tient longtemps ; quand le doigt se lève, l'eau se calme. */
    developper(id,tenu){
      if(!vivant())return;
      const t=ctx.currentTime;
      if(!dev||dev.id!==id){dev={id,n:0,num:nDev++,appui:false,dernier:0,second:null,papier:false,egoutte:false};dev.second=dev.num<2||Math.random()<.3;}
      if(tenu&&!dev.appui){
        dev.appui=true;dev.tAppui=t;
        if(dev.n===0){
          const papier=dev.num<2||Math.random()<.5;
          if(papier){dev.papier=true;jouer('papier',pioche('papier'),{gain:VOL.papier*hasard(.8,1.1),pan:hasard(-.15,.15)});}
          mouvement(0,papier?hasard(.6,.85):.2);
        }else if(dev.n<3&&t-dev.dernier>3)mouvement(0,.2);
      }else if(tenu&&dev.n===1&&dev.second&&t-dev.tAppui>hasard(2.6,3.4)){mouvement(1);}
      else if(!tenu&&dev.appui){dev.appui=false;bainSons.forEach(v=>eteindre(v,.35));bainSons=[];}
    },
    /* Le tirage sort du bain : quelques gouttes retombent, une fois sur deux environ */
    finDev(){
      if(dev)dev.appui=false;
      if(!vivant()||Math.random()<.45)return;
      if(dev)dev.egoutte=true;
      let t=ctx.currentTime+hasard(.3,.6);
      const n=Math.random()<.5?2:3;
      for(let k=0;k<n;k++){jouer('gouttes',pioche('gouttes'),{t,gain:VOL.egoutte*hasard(.6,1),vitesse:hasard(1.05,1.25),pan:hasard(.05,.25)});t+=hasard(.12,.32);}
    },
    /* Le tirage fixé est suspendu pour sécher : une pince en bois, plus souvent quand on n'a pas entendu les gouttes */
    secher(){
      if(!vivant())return;
      if(Math.random()>(dev&&dev.egoutte?.35:.7))return;
      jouer('pince',pioche('pince'),{t:ctx.currentTime+hasard(.1,.4),gain:VOL.pince*hasard(.8,1.05),vitesse:hasard(.96,1.04),pan:hasard(.15,.35)});
    },
    /* La planche-contact : la feuille qu'on prend en main */
    feuille(){jouer('feuilles',pioche('feuilles'),{gain:VOL.feuille*hasard(.75,1.05),vitesse:hasard(.95,1.05)});},
    calme(){if(dev&&dev.appui){dev.appui=false;bainSons.forEach(v=>eteindre(v,.35));bainSons=[];}},
    /* Pour les essais : monter le son sur un contexte hors ligne */
    _hors(c){hors=true;actif=true;return monter(c).then(()=>api);},
    etat:()=>({etat:ctx?ctx.state:'aucun',decodes:Object.keys(tampons).length,erreurs:erreurs.slice(-5),labo:cibles.labo,dehors:cibles.dehors,etouffe,dev:dev&&{id:dev.id,n:dev.n,num:dev.num}}),
    journal
  };
  /* Un son qui échoue ne doit jamais bloquer le livre : chaque appel est protégé */
  Object.keys(api).forEach(k=>{const f=api[k];if(typeof f==='function'&&k!=='_hors')api[k]=function(){try{return f.apply(api,arguments);}catch(e){erreurs.push(k+' : '+(e&&e.message||e));if(erreurs.length>20)erreurs.shift();return null;}};});
  return api;
}

(()=>{
const $=id=>document.getElementById(id);
const stage=$('chambre'),lampe=$('lampe'),consigne=$('consigne');
const btnP=$('prec'),btnS=$('suiv'),revoir=$('revoir'),btnSon=$('son');
const visEl=$('visionneuse'),tirEl=$('tirage');
const reduit=matchMedia('(prefers-reduced-motion: reduce)').matches;
const NOIR=[18,18,18],LATENT=[176,44,32],OS=[233,229,220];
/* La lumière qu'on promène sur les dessins : rouge, inactinique, la seule permise dans un labo */
const LUMIERE=[238,122,98];
/* Essai « papier » (adresse terminée par ?papier) : les poèmes se développent comme sur un vrai papier photo */
const PAPIER=/[?&]papier\b/.test(location.search);
const FEUILLE_FAIBLE=[50,27,24],FEUILLE_LAMPE=[92,40,33],FEUILLE_JOUR=[226,220,208],ENCRE_LABO=[26,12,11],ENCRE_JOUR=[30,26,24];
if(PAPIER)document.documentElement.classList.add('papier');
/* Réglages du labo (secondes et proportions) */
const DEV_TEXTE=5.2,FIXAGE=2,DEV_DESSIN=5,LUEUR=1.3,SEUIL_DESSIN=.75,GAIN_DESSIN=.45,AMBIANCE=.3;
/* XVII : le silence avant le dernier vers (après le passage au blanc), puis sa lente apparition ; toucher l'écran ne relance plus l'attente */
const SILENCE_XVII=2,APPARITION_XVII=1.5;
/* Le seuil : l'œil s'habitue au noir (on devine des formes), la lampe rouge s'allume (SEUIL_LAMPE) et l'on voit le labo :
   la lampe, la corde à linge où sèchent les tirages du lecteur, les cuvettes sur la paillasse, l'agrandisseur.
   À SEUIL_APPROCHE on s'approche de la cuvette ; on y est à SEUIL_FIN (secondes) */
const SEUIL_LAMPE=reduit?1.2:3,SEUIL_APPROCHE=reduit?2:6.6,SEUIL_FIN=reduit?2.6:8;
/* Taille minimale des vers quand un poème doit se resserrer pour tenir sur l'écran (en pixels) */
const VERS_MIN=11.5;
const CLE='chambre-noire-tirages',CLE_POS='chambre-noire-position',CLE_CHOIX='chambre-noire-crayon';
/* La planche-contact : des bandes de six vues, comme une pellicule coupée */
const PAR_BANDE=6;
const SON=creerSon();window.__chambre={SON,creerSon,planches:()=>planches,cur:()=>cur,montrer:n=>montrer(n),ajusterPage:p=>ajusterPage(p)};
const SILENCE=[0,0];
const mix=(a,b,k)=>a.map((v,j)=>Math.round(v+(b[j]-v)*k));
const rgb=c=>'rgb('+c.join(',')+')';
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const lisse=t=>t*t*(3-2*t);
const vus={texte:false,dessin:false,suite:false};
const vis={ouverte:false,liste:[],i:0,nouvelles:[]};
/* Une seule toile de travail pour tous les dessins (la mémoire des téléphones est comptée) */
const TM=document.createElement('canvas'),TX=TM.getContext('2d');
let cur=0,holding=false,idle=0,ptr=null,planches=[];
const estTirage=P=>P.kind==='texte'||P.kind==='dessin';

/* Ce que le lecteur garde sur son téléphone : les tirages développés, et la planche où il s'est arrêté */
function lire(){try{return JSON.parse(localStorage.getItem(CLE)||'[]');}catch(_){return [];}}
function sauver(){try{localStorage.setItem(CLE,JSON.stringify(planches.filter(P=>estTirage(P)&&P.fixe).map(P=>P.id)));}catch(_){}}
function oublier(){try{localStorage.removeItem(CLE);localStorage.removeItem(CLE_POS);localStorage.removeItem(CLE_CHOIX);}catch(_){}}
function lireChoix(){try{return JSON.parse(localStorage.getItem(CLE_CHOIX)||'[]');}catch(_){return [];}}
function sauverChoix(l){try{localStorage.setItem(CLE_CHOIX,JSON.stringify(l));}catch(_){}}
function lirePos(){try{return localStorage.getItem(CLE_POS);}catch(_){return null;}}
function sauverPos(id){try{if(id)localStorage.setItem(CLE_POS,id);else localStorage.removeItem(CLE_POS);}catch(_){}}

/* Un poème trop long pour l'écran se resserre (marge du haut, puis taille des vers) */
function ajusterPage(page){
  if(!page||!page.clientHeight)return;
  page.style.removeProperty('--t-vers');page.classList.remove('serree','tres-serree');
  const v=page.querySelector('.v');if(!v)return;
  const deborde=()=>page.scrollHeight>page.clientHeight+1;
  if(!deborde())return;
  page.classList.add('serree');
  let t=parseFloat(getComputedStyle(v).fontSize);
  while(deborde()&&t>VERS_MIN){t=Math.max(VERS_MIN,t-.5);page.style.setProperty('--t-vers',t+'px');}
  /* Les très petits écrans : interligne plus serré, puis un demi-point de moins */
  if(deborde()){page.classList.add('tres-serree');while(deborde()&&t>VERS_MIN-1){t-=.5;page.style.setProperty('--t-vers',t+'px');}}
}
function ajuster(P){
  const page=P.el.querySelector('.page');if(!page)return;
  const cle=page.clientWidth+'x'+page.clientHeight;
  if(P.ajuste===cle)return;
  ajusterPage(page);P.ajuste=cle;
}

function peindreTexte(P){
  const b=lisse(P.blanc);
  if(PAPIER){
    /* Essai « papier » : une feuille dans la cuvette, rougie par la lampe ; le texte monte en sombre ;
       une fois fixé, on allume la lumière blanche pour regarder le tirage */
    const fond=mix(mix(FEUILLE_FAIBLE,FEUILLE_LAMPE,lisse(P.eclair||0)),FEUILLE_JOUR,b);
    P.el.style.setProperty('--feuille',rgb(fond));
    P.lignes.forEach((e,j)=>{const k=lisse(clamp((P.prog-.15-P.delais[j])/.55));e.style.color=rgb(mix(mix(fond,ENCRE_LABO,k),ENCRE_JOUR,b));});
    const f=lisse(P.fin);
    P.apres.forEach(e=>{e.style.color=rgb(mix(fond,ENCRE_JOUR,f));});
    return;
  }
  P.lignes.forEach((e,j)=>{const k=lisse(clamp((P.prog-.15-P.delais[j])/.55));e.style.color=rgb(mix(mix(NOIR,LATENT,k),OS,b));});
  const f=lisse(P.fin);
  P.apres.forEach(e=>{e.style.color=rgb(mix(NOIR,OS,f));});
}

/* Les dessins : chargés un peu avant qu'on y arrive */
function charger(P){
  if(!P||P.kind!=='dessin'||P.img)return;
  const im=new Image();P.img=im;im.decoding='async';
  im.onload=()=>{P.pret=true;grille(P);if(planches[cur]===P)taille(P);};
  im.onerror=()=>{if(P.img===im)P.img=null;};
  im.src=P.el.dataset.src;
}
function prevoir(n){for(let k=Math.max(0,n-1);k<=Math.min(planches.length-1,n+3);k++)charger(planches[k]);}

function grille(P){
  const GX=14,GY=Math.max(8,Math.round(14*P.img.height/P.img.width)),s=8;
  P.GX=GX;P.GY=GY;
  if(!P.expo||P.expo.length!==GX*GY)P.expo=new Float32Array(GX*GY);
  P.encre=new Uint8Array(GX*GY);
  const c=document.createElement('canvas');c.width=GX*s;c.height=GY*s;
  const x=c.getContext('2d');x.drawImage(P.img,0,0,c.width,c.height);
  let n=0;
  try{
    const d=x.getImageData(0,0,c.width,c.height).data;
    for(let gy=0;gy<GY;gy++)for(let gx=0;gx<GX;gx++){
      let ok=0;
      for(let yy=0;yy<s&&!ok;yy++)for(let xx=0;xx<s;xx++){if(d[((gy*s+yy)*c.width+gx*s+xx)*4+3]>60){ok=1;break;}}
      P.encre[gy*GX+gx]=ok;n+=ok;
    }
  }catch(e){P.encre.fill(1);n=GX*GY;}
  P.nEncre=Math.max(1,n);
}

function cadre(P){
  if(!P.pret||!P.w)return;
  const colW=Math.min(P.w,480),pad=Math.max(20,colW*.08),bw=colW-2*pad,bh=P.h*.8;
  const sc=Math.min(bw/P.img.width,bh/P.img.height);
  P.iw=P.img.width*sc;P.ih=P.img.height*sc;P.ix=(P.w-P.iw)/2;P.iy=(P.h-P.ih)/2-P.h*.02;
  P.r=clamp(Math.min(P.iw,P.ih)*.24,60,110);
  P.sale=true;
}

/* La toile du dessin affiché (à la finesse de l'écran) ; le masque de ce qui a été éclairé (au pixel CSS, il est flou de toute façon) */
function taille(P){
  const r=P.el.getBoundingClientRect(),w=Math.round(r.width),h=Math.round(r.height);
  if(!w||!h)return;
  const dpr=Math.min(2,window.devicePixelRatio||1,Math.sqrt(3.5e6/(w*h)));
  const W=Math.round(w*dpr),H=Math.round(h*dpr);
  if(P.cv.width!==W||P.cv.height!==H){P.cv.width=W;P.cv.height=H;}
  P.ctx.setTransform(dpr,0,0,dpr,0,0);
  if(TM.width!==W||TM.height!==H){TM.width=W;TM.height=H;}
  TX.setTransform(dpr,0,0,dpr,0,0);
  if(!P.fixe){
    if(!P.mk){P.mk=document.createElement('canvas');P.mk.width=P.mk.height=0;P.mx=P.mk.getContext('2d');}
    if(P.mk.width!==w||P.mk.height!==h){
      let ancien=null;
      if(P.mk.width>1&&P.mk.height>1){ancien=document.createElement('canvas');ancien.width=P.mk.width;ancien.height=P.mk.height;ancien.getContext('2d').drawImage(P.mk,0,0);}
      P.mk.width=w;P.mk.height=h;
      if(ancien)P.mx.drawImage(ancien,0,0,w,h);
      if(P.plein>=1){P.mx.fillStyle='#fff';P.mx.fillRect(0,0,w,h);}
    }
  }
  P.w=w;P.h=h;P.dpr=dpr;P.sale=true;
  cadre(P);
}
/* En quittant un dessin, on rend sa mémoire au téléphone (on garde le masque tant qu'il n'est pas fixé) */
function liberer(P){
  P.cv.width=P.cv.height=0;P.w=0;
  if(P.fixe&&P.mk){P.mk.width=P.mk.height=0;P.mk=null;P.mx=null;}
}

function tampon(P,x,y,a){
  if(!P.pret||!P.mk)return;
  const r=P.r,g=P.mx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,'rgba(255,255,255,'+a+')');g.addColorStop(1,'rgba(255,255,255,0)');
  P.mx.fillStyle=g;P.mx.fillRect(x-r,y-r,2*r,2*r);
  const cw=P.iw/P.GX,ch=P.ih/P.GY;let n=0;
  for(let gy=0;gy<P.GY;gy++)for(let gx=0;gx<P.GX;gx++){
    const k=gy*P.GX+gx;if(!P.encre[k])continue;
    const d=Math.hypot(P.ix+(gx+.5)*cw-x,P.iy+(gy+.5)*ch-y);
    if(d<r)P.expo[k]=Math.min(1,P.expo[k]+a*GAIN_DESSIN*(1-d/r));
    if(P.expo[k]>=.6)n++;
  }
  P.cov=n/P.nEncre;if(P.cov>.15)vus.dessin=true;
  P.sale=true;
}

function rendre(P){
  const {ctx,w,h}=P;
  if(!w)return;
  ctx.clearRect(0,0,w,h);
  if(!P.pret)return;
  const W=TM.width,H=TM.height;
  TX.globalCompositeOperation='source-over';TX.clearRect(0,0,w,h);
  TX.drawImage(P.img,P.ix,P.iy,P.iw,P.ih);
  if(!P.fixe&&P.mk){TX.globalCompositeOperation='destination-in';TX.drawImage(P.mk,0,0,w,h);}
  TX.globalCompositeOperation='source-atop';TX.fillStyle=rgb(mix(LATENT,OS,lisse(P.blanc)));TX.fillRect(0,0,w,h);
  TX.globalCompositeOperation='source-over';
  ctx.drawImage(TM,0,0,W,H,0,0,w,h);
  if(P.lueur>0&&!P.tout&&!P.fixe){
    const r=P.r,x=P.x,y=P.y;
    ctx.globalAlpha=lisse(P.lueur);
    let g=ctx.createRadialGradient(x,y,0,x,y,r*1.4);
    g.addColorStop(0,'rgba(196,48,34,.14)');g.addColorStop(1,'rgba(196,48,34,0)');
    ctx.fillStyle=g;ctx.fillRect(x-r*1.4,y-r*1.4,r*2.8,r*2.8);
    TX.clearRect(0,0,w,h);TX.drawImage(P.img,P.ix,P.iy,P.iw,P.ih);
    TX.globalCompositeOperation='destination-in';
    g=TX.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.5,'rgba(0,0,0,.85)');g.addColorStop(1,'rgba(0,0,0,0)');
    TX.fillStyle=g;TX.fillRect(0,0,w,h);
    TX.globalCompositeOperation='source-atop';TX.fillStyle=rgb(LUMIERE);TX.fillRect(0,0,w,h);
    TX.globalCompositeOperation='source-over';
    ctx.drawImage(TM,0,0,W,H,0,0,w,h);
    ctx.globalAlpha=1;
  }
}

/* Planche-contact et visionneuse.
   Une vraie planche : les bandes de pellicule tirées par contact sur le papier, les perforations, les numéros de vue
   et le nom du film sur le bord ; les vues pas encore développées restent noires ; le photographe entoure au crayon gras
   rouge les vues qu'il a regardées à l'agrandisseur. */
function nettoyer(n){n.querySelectorAll('[style]').forEach(e=>e.removeAttribute('style'));return n;}
/* Un trait de crayon gras, un peu de travers, différent pour chaque vue (mais toujours le même pour une vue donnée) */
function crayon(fig,j,anime){
  if(fig.querySelector('.crayon'))return;
  let g=j*9301+49297;const h=()=>((g=(g*233280+49297)%2147483647)/2147483647);
  const a=()=>(h()-.5)*5;
  const p=[[-6+a(),-5+a()],[106+a(),-4+a()],[107+a(),105+a()],[-5+a(),104+a()],[-7+a(),-3+a()],[8+a(),-6+a()]];
  const d='M'+p.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' L');
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('class','crayon'+(anime?' trace':''));svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  const pa=document.createElementNS(ns,'path');pa.setAttribute('d',d);pa.setAttribute('pathLength','1');svg.appendChild(pa);
  fig.appendChild(svg);
}
function construireGrille(){
  const g=$('grille');g.innerHTML='';
  const tirages=planches.filter(estTirage),choix=lireChoix();
  for(let s=0;s<tirages.length;s+=PAR_BANDE){
    const bande=document.createElement('div');bande.className='bande';
    const nom=document.createElement('span');nom.className='nom-film';nom.textContent='CHAMBRE NOIRE';nom.setAttribute('aria-hidden','true');bande.appendChild(nom);
    tirages.slice(s,s+PAR_BANDE).forEach((P,k)=>{
      const j=s+k;
      const fig=document.createElement('figure');fig.className='vue '+P.kind;fig.dataset.id=P.id;
      const b=document.createElement('button');b.type='button';
      if(P.fixe){
        b.classList.add('dev');b.setAttribute('aria-label','Agrandir la vue '+(j+1)+', '+P.el.getAttribute('aria-label'));
        if(P.kind==='texte'){const m=document.createElement('div');m.className='mini';const pg=nettoyer(P.el.querySelector('.page').cloneNode(true));pg.removeAttribute('style');pg.classList.remove('serree','tres-serree');m.appendChild(pg);b.appendChild(m);}
        else{const im=document.createElement('img');im.src=P.el.dataset.vignette;im.alt='';im.decoding='async';im.loading='lazy';b.appendChild(im);}
        b.addEventListener('click',()=>ouvrirVis(P));
      }else{
        b.setAttribute('aria-label','Vue '+(j+1)+', pas encore développée : rentrer dans la chambre noire pour la développer');
        const v=document.createElement('span');v.className='vierge';v.textContent='à développer';b.appendChild(v);
        b.addEventListener('click',()=>rentrer(planches.indexOf(P)));
      }
      fig.appendChild(b);
      const n=document.createElement('span');n.className='numero';n.setAttribute('aria-hidden','true');n.textContent=(j+1)+'  ▸'+(j+1)+'A';fig.appendChild(n);
      if(P.fixe&&choix.includes(P.id))crayon(fig,j,false);
      bande.appendChild(fig);
    });
    g.appendChild(bande);
  }
  requestAnimationFrame(echelle);
}
function echelle(){document.querySelectorAll('.vue .mini').forEach(m=>{m.style.transform='scale('+(m.parentElement.clientWidth/480)+')';});}
/* Regarder une vue à l'agrandisseur : elle sera entourée au crayon gras en revenant à la planche */
function marquer(P){const l=lireChoix();if(!l.includes(P.id)){l.push(P.id);sauverChoix(l);vis.nouvelles.push(P.id);}}
function ouvrirVis(P){
  vis.liste=planches.filter(Q=>estTirage(Q)&&Q.fixe);vis.i=Math.max(0,vis.liste.indexOf(P));vis.nouvelles=[];
  vis.ouverte=true;visEl.classList.add('ouverte');afficherVis();SON.feuille();
  try{$('vis-fermer').focus({preventScroll:true});}catch(_){}
}
function afficherVis(){
  const P=vis.liste[vis.i];tirEl.innerHTML='';marquer(P);
  visEl.classList.toggle('noire',P.kind==='dessin');
  if(P.kind==='texte'){const pg=nettoyer(P.el.querySelector('.page').cloneNode(true));tirEl.appendChild(pg);ajusterPage(pg);}
  else{const im=document.createElement('img');im.src=P.el.dataset.src;im.alt='Dessin de Nathan Sonnet';tirEl.appendChild(im);}
  $('vis-prec').style.visibility=vis.i>0?'visible':'hidden';
  $('vis-suiv').style.visibility=vis.i<vis.liste.length-1?'visible':'hidden';
}
function visNav(d){const n=vis.i+d;if(vis.ouverte&&n>=0&&n<vis.liste.length){vis.i=n;afficherVis();SON.feuille();}}
function fermerVis(){
  if(!vis.ouverte)return;vis.ouverte=false;visEl.classList.remove('ouverte');tirEl.innerHTML='';
  /* Le trait de crayon se trace sous nos yeux autour des vues qu'on vient de regarder */
  const tir=planches.filter(estTirage);
  (vis.nouvelles||[]).forEach((id,k)=>{const f=document.querySelector('#grille .vue[data-id="'+id+'"]');if(f)setTimeout(()=>crayon(f,tir.findIndex(Q=>Q.id===id),true),120+k*260);});
  vis.nouvelles=[];
}

/* Le petit cercle qui répond au coup frappé (utile aussi sans le son) */
function anneau(P,x,y){
  const a=document.createElement('span');a.className='anneau';a.style.left=x+'px';a.style.top=y+'px';
  P.el.appendChild(a);setTimeout(()=>a.remove(),1300);
}

/* Le grain de l'image, tiré une fois au hasard */
let GRAIN=null;
function grain(){
  if(GRAIN)return GRAIN;
  try{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),d=x.createImageData(128,128);
    for(let i=0;i<d.data.length;i+=4){const v=Math.random()*255|0;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}
    x.putImageData(d,0,0);GRAIN=c.toDataURL('image/png');}catch(_){GRAIN='';}
  return GRAIN;
}
/* Le labo vu depuis la porte, sous la lampe rouge. Sur la corde à linge sèchent les derniers tirages du lecteur
   (à la première visite : des bandes-test et des pinces qui attendent). */
function decor(P){
  const tir=planches.filter(Q=>estTirage(Q)&&Q.fixe).slice(-6);
  const X=[33,97,161,225,289,353],ligne=x=>250+160*((x+10)/410)*(1-(x+10)/410);
  const h=(k,n)=>Math.abs(Math.sin(k*91.7+n*12.3)*43758.5)%1;
  let corde='';
  X.forEach((x,k)=>{
    const y=ligne(x),Q=tir[k],a=((h(k,1)-.5)*5).toFixed(2),dur=(4.2+h(k,2)*2.6).toFixed(2),del=(-h(k,3)*4).toFixed(2);
    let feuille='';
    if(Q&&Q.kind==='texte'){
      let lignes='',yy=y+18;const n=Q.lignes?Math.min(14,Q.lignes.length):10;
      for(let i=0;i<n;i++){const w=16+h(k,i+5)*22;lignes+=`<rect x="${x-20}" y="${yy.toFixed(1)}" width="${w.toFixed(1)}" height="1.6" fill="#2a0c08" opacity=".75"/>`;yy+=i%4===3?8.4:5.6;}
      feuille=`<rect x="${x-28}" y="${y+5}" width="56" height="88" fill="url(#papier-rouge)"/>${lignes}`;
    }else if(Q){
      feuille=`<rect x="${x-28}" y="${y+5}" width="56" height="88" fill="#150706"/><image href="${Q.el.dataset.vignette}" x="${x-25}" y="${y+8}" width="50" height="82" preserveAspectRatio="xMidYMid meet" filter="url(#rougir)"/>`;
    }else if(k%2){
      let b='';for(let i=0;i<6;i++)b+=`<rect x="${x-12}" y="${(y+5+i*15).toFixed(1)}" width="24" height="15" fill="${['#93382a','#7c2e22','#64241b','#4c1b14','#34120d','#1f0a07'][i]}"/>`;
      feuille=b;
    }
    const pince=`<rect x="${x-3}" y="${y-9}" width="6" height="17" rx="1" fill="#3e1b13"/><rect x="${x-3}" y="${y-9}" width="2" height="17" fill="#6a2a1c" opacity=".7"/>`;
    corde+=`<g class="seche" style="transform-origin:${x}px ${y.toFixed(1)}px;animation-duration:${dur}s;animation-delay:${del}s"><g transform="rotate(${a} ${x} ${y.toFixed(1)})">${feuille}</g>${pince}</g>`;
  });
  const cuves=[0,1,2].map(k=>{
    const x=118+k*92,nom=['révélateur','arrêt','fixateur'][k];
    return `<polygon points="${x+4},652 ${x+84},652 ${x+89},694 ${x-1},694" fill="#1a0807" stroke="#5c1a12" stroke-width=".8"/>
      <polygon points="${x+9},656 ${x+79},656 ${x+82},689 ${x+6},689" fill="url(#liquide)"/>
      <path d="M${x+18} 662 Q${x+44} 659 ${x+70} 663" stroke="#ff6a4a" stroke-width="1.2" opacity=".28" fill="none"/>
      <text x="${x+44}" y="712" text-anchor="middle" font-family="Lora, Georgia, serif" font-style="italic" font-size="8.5" fill="#7a281c">${nom}</text>`;
  }).join('');
  P.decor.innerHTML=`<defs>
    <radialGradient id="halo" cx="195" cy="64" r="430" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c8281a" stop-opacity=".5"/><stop offset=".45" stop-color="#7a160e" stop-opacity=".22"/><stop offset="1" stop-color="#2a0705" stop-opacity="0"/></radialGradient>
    <radialGradient id="vitre" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#ff7a55"/><stop offset=".6" stop-color="#d8301c"/><stop offset="1" stop-color="#8a150c"/></radialGradient>
    <linearGradient id="papier-rouge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7402f"/><stop offset="1" stop-color="#6e2419"/></linearGradient>
    <linearGradient id="liquide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a1710"/><stop offset="1" stop-color="#1c0605"/></linearGradient>
    <linearGradient id="paillasse" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a1810"/><stop offset=".04" stop-color="#1e0907"/><stop offset="1" stop-color="#090404"/></linearGradient>
    <radialGradient id="ombre" cx=".5" cy=".42" r=".75"><stop offset=".55" stop-color="#0a0505" stop-opacity="0"/><stop offset="1" stop-color="#0a0505" stop-opacity=".95"/></radialGradient>
    <pattern id="grain" width="128" height="128" patternUnits="userSpaceOnUse"><image href="${grain()}" width="128" height="128"/></pattern>
    <filter id="rougir"><feColorMatrix type="matrix" values=".8 0 0 0 0  .25 0 0 0 0  .2 0 0 0 0  0 0 0 1 0"/></filter>
  </defs>
  <rect width="390" height="844" fill="#0b0606"/>
  <rect width="390" height="844" fill="url(#halo)"/>
  <!-- l'étagère et ses flacons -->
  <rect x="244" y="430" width="150" height="4" fill="#2c0d09"/>
  <rect x="266" y="380" width="22" height="50" rx="3" fill="#140605" stroke="#5c1a12" stroke-width=".6"/><rect x="272" y="368" width="10" height="14" fill="#140605" stroke="#5c1a12" stroke-width=".6"/><rect x="268" y="398" width="18" height="14" fill="#3a110c"/>
  <rect x="298" y="392" width="18" height="38" rx="3" fill="#140605" stroke="#5c1a12" stroke-width=".6"/><rect x="302" y="382" width="10" height="11" fill="#140605" stroke="#5c1a12" stroke-width=".6"/>
  <rect x="326" y="372" width="26" height="58" rx="4" fill="#140605" stroke="#5c1a12" stroke-width=".6"/><rect x="333" y="360" width="12" height="13" fill="#140605" stroke="#5c1a12" stroke-width=".6"/><rect x="328" y="394" width="22" height="16" fill="#3a110c"/>
  <!-- l'agrandisseur -->
  <rect x="40" y="330" width="8" height="300" fill="#120605" stroke="#4a120d" stroke-width=".6"/>
  <rect x="14" y="358" width="66" height="46" rx="3" fill="#170807" stroke="#5c1a12" stroke-width=".8"/>
  <rect x="24" y="404" width="46" height="26" fill="#0d0504"/><path d="M24 410H70M24 416H70M24 422H70" stroke="#3a100b" stroke-width=".8"/>
  <rect x="39" y="430" width="16" height="10" fill="#0a0303" stroke="#4a120d" stroke-width=".5"/>
  <rect x="10" y="628" width="104" height="10" fill="#1a0807" stroke="#4a120d" stroke-width=".6"/>
  <!-- la lampe inactinique -->
  <path d="M195 0V42" stroke="#2a0c08" stroke-width="1.5"/>
  <rect x="163" y="40" width="64" height="40" rx="4" fill="#1a0b08" stroke="#3a120d"/>
  <rect x="169" y="46" width="52" height="28" rx="2" fill="url(#vitre)"/>
  <!-- la corde à linge et les tirages qui sèchent -->
  <path d="M-10 250 Q195 330 400 250" stroke="#6a2218" stroke-width="1.2" fill="none"/>
  ${corde}
  <!-- la paillasse et les trois cuvettes -->
  <rect x="0" y="638" width="390" height="206" fill="url(#paillasse)"/>
  ${cuves}
  <path d="M136 666 L176 640 M141 668 L180 643" stroke="#2a0c08" stroke-width="2.2" stroke-linecap="round"/>
  <!-- le robinet, au-dessus des cuvettes ; une goutte tombe de temps en temps -->
  <path d="M378 470V560Q378 578 360 578H344" stroke="#2c0e09" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M375.5 470V560Q375.5 575.5 360 575.5H345" stroke="#7a2a1d" stroke-width="1.2" fill="none" opacity=".8"/>
  <ellipse class="goutte" cx="343" cy="584" rx="1.6" ry="2.4" fill="#ff6a4a" opacity=".55"/>
  <rect width="390" height="844" fill="url(#grain)" opacity=".09"/>
  <rect width="390" height="844" fill="url(#ombre)"/>`;
}

const types={
  entree:{
    init(P){P.couv=P.el.querySelector('.couv');P.point=P.el.querySelector('.point');P.r=0;P.ouvert=false;P.couv.style.clipPath='';P.point.classList.remove('eteint');},
    enter(){revoir.classList.toggle('visible',planches.some(Q=>estTirage(Q)&&Q.fixe));},
    down(P){if(!P.ouvert){P.ouvert=true;P.point.classList.add('eteint');SON.obturateur();}},
    tick(P,dt){
      if(P.ouvert&&P.r<1){
        P.r=Math.min(1,P.r+dt/(reduit?.25:2.6));
        P.couv.style.clipPath=P.r>=1?'none':'circle('+(lisse(P.r)*80).toFixed(2)+'% at 50% 50%)';
        if(P.r>=1)fixer(P);
      }
    },
    consigne(P){if(!P.ouvert)return 'Toucher le point de lumière';if(P.fixe&&!vus.suite)return 'Glisser vers la gauche pour entrer';return '';}
  },
  /* Le couloir : nos pas, deux coups frappés par le lecteur, la porte qui grince et se referme */
  porte:{
    init(P){P.t=0;P.coups=0;P.tCoup=0;P.tOuv=0;P.ouverte=false;P.parti=false;P.court=false;P.attente=6;P.el.classList.remove('dedans');},
    enter(P){
      P.t=0;P.coups=0;P.ouverte=false;P.parti=false;P.el.classList.remove('dedans');
      P.attente=SON.ecoute()?(SON.duree('pas',0)||5.6)+.5:1.2;SON.pas();
    },
    down(P,x,y){
      if(P.ouverte||P.coups>=2)return;
      if(!x&&!y){const r=stage.getBoundingClientRect();x=r.width/2;y=r.height/2;}
      SON.stopPas();
      P.coups++;P.tCoup=P.t;SON.coup();anneau(P,x,y);
      if(P.coups===2){P.court=!SON.ecoute();P.tOuv=P.t+(P.court?.6:1.4);}
    },
    tick(P,dt){
      P.t+=dt;
      if(P.coups===2&&!P.ouverte&&P.t>=P.tOuv){P.ouverte=true;if(!P.court)SON.porte();}
      if(P.ouverte){
        const u=P.t-P.tOuv;
        if(u>(P.court?.4:6.2))P.el.classList.add('dedans');
        if(u>=(P.court?1.4:6.9)&&!P.parti){P.parti=true;montrer(cur+1);}
      }
    },
    /* Derrière la porte, la ventilation du labo, étouffée ; elle s'ouvre avec la porte */
    son(P){
      if(!P.ouverte||P.court)return [.45,0,.8,true];
      const u=P.t-P.tOuv;
      return u<1.3?[.45,0,.8,true]:u<6.2?[.75,0,.6,false]:[1,0,.4,false];
    },
    consigne(P){
      if(P.ouverte)return '';
      if(P.coups===0&&P.t>P.attente)return 'Frapper deux coups à la porte';
      if(P.coups===1&&P.t-P.tCoup>3)return 'Encore un coup';
      return '';
    }
  },
  seuil:{
    init(P){P.t=0;P.parti=false;P.cible=null;P.clic=false;P.decor=P.el.querySelector('.labo');},
    enter(P,avant){P.t=0;P.parti=false;P.clic=false;decor(P);P.decor.style.opacity=0;P.decor.style.transform='';if(avant==='sortie')SON.porte(true);},
    down(P){P.t=Math.max(P.t,SEUIL_LAMPE-.1);},
    tick(P,dt){
      P.t+=dt;
      /* L'œil s'habitue : on devine des formes ; la lampe s'allume et montre le labo ; on s'approche de la cuvette */
      const avant=.07*lisse(clamp((P.t-.9)/(SEUIL_LAMPE-.9))),allume=lisse(clamp((P.t-SEUIL_LAMPE)/.35)),va=lisse(clamp((P.t-SEUIL_APPROCHE)/(SEUIL_FIN-SEUIL_APPROCHE)));
      P.decor.style.opacity=(Math.max(avant,allume)*(1-va)).toFixed(3);
      if(va>0&&!reduit)P.decor.style.transform='scale('+(1+.22*va).toFixed(4)+')';
      if(P.t>SEUIL_LAMPE&&!P.clic){P.clic=true;SON.interrupteur(true);}
      if(P.t>=SEUIL_FIN&&!P.parti){
        P.parti=true;const c=P.cible!=null?P.cible:cur+1;P.cible=null;montrer(c);
      }
    },
    lampe(P){return P.t>SEUIL_LAMPE?AMBIANCE:0;},
    son(){return [1,0,.8];},
    consigne(P){return P.t>.8&&P.t<SEUIL_LAMPE?'Laisser l’œil s’habituer au noir':'';}
  },
  texte:{
    init(P){
      P.lignes=[...P.el.querySelectorAll('.num,.v')].filter(e=>!e.closest('.apres'));
      P.apres=[...P.el.querySelectorAll('.apres .v')];
      P.delais=P.lignes.map((_,j)=>((j*7)%10)/10*.3);
      P.prog=0;P.dev=false;P.blanc=0;P.silence=0;P.fin=P.apres.length?0:1;P.eclair=0;
      peindreTexte(P);
    },
    restaurer(P){P.prog=1;P.dev=true;P.blanc=1;P.fin=1;P.fixe=true;peindreTexte(P);},
    enter(P){ajuster(P);},
    down(P){P.silence=0;},
    tick(P,dt){
      let sale=false;
      /* Essai « papier » : la feuille s'éclaire quand la lampe s'intensifie */
      if(PAPIER){const c=holding&&!P.dev?1:0;if(P.eclair!==c){P.eclair=c>P.eclair?Math.min(1,P.eclair+dt/1.2):Math.max(0,P.eclair-dt/1.2);sale=true;}}
      if(!P.dev){
        SON.developper(P.id,holding);
        if(holding){
          P.prog=Math.min(1,P.prog+dt/DEV_TEXTE);sale=true;
          if(P.prog>=1){P.dev=true;vus.texte=true;SON.finDev();}
        }
      }
      else if(P.blanc<1){P.blanc=Math.min(1,P.blanc+dt/FIXAGE);sale=true;}
      else if(P.fin<1){P.silence+=dt;if(P.silence>SILENCE_XVII){P.fin=Math.min(1,P.fin+dt/APPARITION_XVII);sale=true;}}
      if(P.dev&&P.blanc>=1&&P.fin>=1&&!P.fixe)fixer(P);
      if(sale)peindreTexte(P);
    },
    lampe(P){return holding&&!P.dev?1:AMBIANCE;},
    /* XVII : une fois le tirage développé, la ventilation se tait et le labo devient silencieux */
    son(P){return P.apres.length&&P.dev?[0,0,.6]:[1,0,.8];},
    consigne(P){
      if(P.fixe)return vus.suite?'':'Glisser vers la gauche pour continuer';
      if(P.dev||holding)return '';
      if(!vus.texte)return 'Garder le doigt sur la page pour développer le tirage';
      if(idle>6)return 'Garder le doigt sur la page';
      return '';
    }
  },
  dessin:{
    init(P){
      P.cv=P.el.querySelector('canvas');P.ctx=P.cv.getContext('2d');
      if(P.mk){P.mk.width=P.mk.height=0;}P.mk=null;P.mx=null;
      P.actif=false;P.clavier=false;P.cov=0;P.tout=false;P.plein=0;P.blanc=0;P.lueur=0;P.off=0;P.w=0;P.h=0;P.sale=true;
      if(P.expo)P.expo.fill(0);
    },
    restaurer(P){P.tout=true;P.plein=1;P.blanc=1;P.fixe=true;P.w=0;P.sale=true;},
    enter(P){charger(P);taille(P);},
    down(P,x,y,tactile){
      if(P.fixe||P.tout||!P.pret||!P.mk)return;
      P.off=tactile?P.r*.4:0;
      P.actif=true;P.lueur=1;P.x=x;P.y=y-P.off;tampon(P,P.x,P.y,.15);
    },
    move(P,x,y){
      if(P.fixe||!P.actif||!P.pret)return;
      y-=P.off;
      const dx=x-P.x,dy=y-P.y,d=Math.hypot(dx,dy),pas=Math.max(4,P.r/5),n=Math.ceil(d/pas);
      for(let s=1;s<=n;s++)tampon(P,P.x+dx*s/n,P.y+dy*s/n,.14);
      P.x=x;P.y=y;P.sale=true;
    },
    up(P){P.actif=false;P.sale=true;},
    tick(P,dt){
      if(!P.pret||!P.w)return;
      if(!P.fixe&&P.mk){
        if(P.actif){P.lueur=1;tampon(P,P.x,P.y,dt*.6);}
        else if(P.lueur>0){P.lueur=Math.max(0,P.lueur-dt/LUEUR);P.sale=true;}
        if(P.clavier){P.mx.globalAlpha=dt*.25;P.mx.fillStyle='#fff';P.mx.fillRect(0,0,P.w,P.h);P.mx.globalAlpha=1;P.cov+=dt*.08;P.sale=true;}
        if(!P.tout&&P.cov>=SEUIL_DESSIN){P.tout=true;P.actif=false;}
        if(P.tout){
          /* Le dessin est révélé à la lampe : ni papier ni bain, la chambre reste avec ses seuls bruits */
          if(P.plein<1){P.plein=Math.min(1,P.plein+dt/DEV_DESSIN);P.mx.globalAlpha=Math.min(1,dt*.7);P.mx.fillStyle='#fff';P.mx.fillRect(0,0,P.w,P.h);P.mx.globalAlpha=1;}
          else if(P.blanc<1){P.blanc=Math.min(1,P.blanc+dt/FIXAGE);}
          else fixer(P);
          P.sale=true;
        }
      }
      if(P.sale){rendre(P);P.sale=false;}
    },
    lampe(P){return !P.fixe&&P.actif&&!P.tout?.6:AMBIANCE;},
    son(){return [1,0,.8];},
    consigne(P){
      if(P.fixe)return vus.suite?'':'Glisser vers la gauche pour continuer';
      if(P.actif||P.tout||P.clavier)return '';
      if(!vus.dessin||idle>6)return 'Promener le doigt dans le noir';
      return '';
    }
  },
  sortie:{
    init(P){P.porte=P.el.querySelector('.porte');P.dehors=P.el.querySelector('.dehors');P.t=0;P.ouverte=false;P.direct=false;P.decal=0;},
    /* Avec le son, on rince d'abord les tirages (P.decal secondes) avant d'éteindre et d'ouvrir */
    enter(P){
      fermerVis();construireGrille();P.dehors.scrollTop=0;
      if(P.direct){P.direct=false;P.ouverte=true;P.porte.style.clipPath='none';P.dehors.classList.add('visible');}
      else{P.ouverte=false;P.t=0;P.porte.style.clipPath='inset(0 50% 0 50%)';P.dehors.classList.remove('visible');P.decal=SON.sortir()||0;}
    },
    tick(P,dt){
      if(P.ouverte)return;
      P.t+=dt;
      const a=clamp((P.t-P.decal-1.4)/(reduit?.3:2.6)),m=(50-50*lisse(a)).toFixed(2);
      P.porte.style.clipPath=a>=1?'none':'inset(0 '+m+'% 0 '+m+'%)';
      if(a>=1){P.ouverte=true;P.dehors.classList.add('visible');requestAnimationFrame(echelle);}
    },
    lampe(P){return !P.ouverte&&P.t<P.decal+.35?AMBIANCE:0;},
    son(P){return [0,P.ouverte||P.t>P.decal+1.8?1:0,.9];},
    glisse(P,dx){if(vis.ouverte)visNav(dx<0?1:-1);}
  }
};

/* Un poème fixé part sécher (pas les dessins, révélés à la lampe, ni XVII, qui reste dans son silence) */
function fixer(P){P.fixe=true;majNav();if(estTirage(P)){sauver();if(P.kind==='texte'&&!P.apres.length)SON.secher();}}
function majNav(){
  const P=planches[cur],cache=P.kind==='seuil'||P.kind==='sortie'||P.kind==='porte';
  btnS.classList.toggle('on',!cache&&P.fixe&&cur<planches.length-1);
  btnP.classList.toggle('on',!cache&&cur>0&&P.fixe);
  btnP.classList.toggle('faible',!cache&&cur>0&&!P.fixe);
}
function montrer(n){
  const A=planches[cur],avant=A.kind;A.el.classList.remove('active');types[A.kind].up&&types[A.kind].up(A);holding=false;
  SON.calme();
  if(A.kind==='dessin'&&n!==cur)liberer(A);
  cur=n;const P=planches[cur];P.el.classList.add('active');stage.dataset.kind=P.kind;
  prevoir(cur);
  /* La planche où l'on s'arrête est gardée ; sortir par la porte au bout du livre l'oublie */
  if(estTirage(P))sauverPos(P.id);else if(P.kind==='sortie'&&!P.direct)sauverPos(null);
  types[P.kind].enter&&types[P.kind].enter(P,avant);
  idle=0;majNav();
}
function suivant(){if(cur<planches.length-1&&planches[cur].fixe){vus.suite=true;montrer(cur+1);}}
function precedent(){let n=cur-1;while(n>0&&(planches[n].kind==='seuil'||planches[n].kind==='porte'))n--;if(n>=0)montrer(n);}
function rentrer(cible){
  const s=planches.findIndex(P=>P.kind==='seuil');
  if(cible==null){const a=planches.findIndex(P=>estTirage(P)&&!P.fixe);cible=a>=0?a:s+1;}
  planches[s].cible=cible;montrer(s);
}

/* Le son ne peut démarrer qu'après un geste du lecteur (règle des téléphones) */
['pointerdown','pointerup','touchend','click','keydown'].forEach(t=>addEventListener(t,()=>SON.debloquer(),{capture:true,passive:true}));
function majSon(){const a=SON.actif();btnSon.textContent=a?'avec le son':'sans le son';btnSon.setAttribute('aria-pressed',a?'true':'false');}
btnSon.addEventListener('click',()=>{SON.basculer();majSon();});
majSon();

/* Le doigt, la souris, le stylet */
function pos(cx,cy){const r=stage.getBoundingClientRect();return{x:cx-r.left,y:cy-r.top};}
function debut(id,cx,cy,tactile){
  if(ptr)return;
  const p=pos(cx,cy),P=planches[cur];
  ptr={id,x0:p.x,y0:p.y,dx:0,swipe:false};idle=0;holding=true;
  types[P.kind].down&&types[P.kind].down(P,p.x,p.y,tactile);
}
function bouger(id,cx,cy){
  if(!ptr||id!==ptr.id)return;
  const p=pos(cx,cy),P=planches[cur],dx=p.x-ptr.x0,dy=p.y-ptr.y0;
  ptr.dx=dx;
  if(!ptr.swipe&&(P.kind!=='dessin'||P.fixe)&&Math.abs(dx)>34&&Math.abs(dx)>Math.abs(dy)*1.3){
    ptr.swipe=true;holding=false;types[P.kind].up&&types[P.kind].up(P);
  }
  if(!ptr.swipe&&types[P.kind].move)types[P.kind].move(P,p.x,p.y);
}
function finir(id){
  if(!ptr||id!==ptr.id)return;
  const P=planches[cur],s=ptr.swipe,dx=ptr.dx;
  holding=false;ptr=null;idle=0;
  types[P.kind].up&&types[P.kind].up(P);
  if(s){
    if(types[P.kind].glisse)types[P.kind].glisse(P,dx);
    else if(dx<-50)suivant();else if(dx>50)precedent();
  }
}
stage.addEventListener('pointerdown',e=>{
  if(e.target.closest('button'))return;
  if(!e.target.closest('.dehors')){try{stage.setPointerCapture(e.pointerId);}catch(_){}}
  debut(e.pointerId,e.clientX,e.clientY,e.pointerType!=='mouse');
});
stage.addEventListener('pointermove',e=>bouger(e.pointerId,e.clientX,e.clientY));
stage.addEventListener('pointerup',e=>finir(e.pointerId));
stage.addEventListener('pointercancel',e=>finir(e.pointerId));
/* Empêcher le téléphone de prendre le geste pour un défilement (sauf sur la planche-contact) */
const bloquer=e=>{
  if(e.target.closest('button,.dehors'))return;
  if(e.cancelable)e.preventDefault();
};
stage.addEventListener('touchstart',bloquer,{passive:false});
stage.addEventListener('touchmove',bloquer,{passive:false});
stage.addEventListener('contextmenu',e=>e.preventDefault());

addEventListener('keydown',e=>{
  if(e.key==='Tab'||e.key.startsWith('Arrow'))document.documentElement.classList.add('clavier');
  if(vis.ouverte){
    if(e.key==='Escape'){fermerVis();return;}
    if(e.key==='ArrowRight'){e.preventDefault();visNav(1);return;}
    if(e.key==='ArrowLeft'){e.preventDefault();visNav(-1);return;}
    return;
  }
  if(e.key==='ArrowRight'){e.preventDefault();suivant();return;}
  if(e.key==='ArrowLeft'){e.preventDefault();precedent();return;}
  if((e.key===' '||e.key==='Enter')&&!(e.target instanceof HTMLButtonElement)){
    e.preventDefault();if(e.repeat)return;
    const P=planches[cur];holding=true;idle=0;
    if(P.kind==='dessin'){if(!P.fixe)P.clavier=true;}
    else types[P.kind].down&&types[P.kind].down(P,0,0,false);
  }
});
addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){holding=false;planches[cur].clavier=false;}});
btnS.addEventListener('click',suivant);
btnP.addEventListener('click',precedent);
revoir.addEventListener('click',()=>{const s=planches.length-1;planches[s].direct=true;montrer(s);});
$('rentrer').addEventListener('click',()=>rentrer());
$('effacer').addEventListener('click',()=>{
  oublier();
  planches.forEach(P=>{P.fixe=false;types[P.kind].init&&types[P.kind].init(P);});
  vus.texte=vus.dessin=vus.suite=false;
  montrer(0);
});
$('vis-fermer').addEventListener('click',fermerVis);
$('vis-prec').addEventListener('click',()=>visNav(-1));
$('vis-suiv').addEventListener('click',()=>visNav(1));
addEventListener('resize',()=>{
  const P=planches[cur];
  if(P.kind==='dessin')taille(P);
  if(P.kind==='texte'){P.ajuste=null;ajuster(P);}
  if(P.kind==='sortie')echelle();
  if(vis.ouverte)afficherVis();
});

planches=[...document.querySelectorAll('.planche')].map(el=>{
  const P={el,kind:el.dataset.kind,id:el.dataset.id||null,fixe:false};
  types[P.kind].init&&types[P.kind].init(P);
  return P;
});
const deja=lire(),repere=lirePos();
if(deja.length){vus.texte=vus.dessin=vus.suite=true;}
planches.forEach(P=>{if(P.id&&deja.includes(P.id)&&types[P.kind].restaurer)types[P.kind].restaurer(P);});
/* Le lecteur qui revient retrouve, passé la porte, la planche où il s'était arrêté */
{const s=planches.findIndex(P=>P.kind==='seuil'),i=repere?planches.findIndex(P=>P.id===repere):-1;if(i>s)planches[s].cible=i;}
types.entree.enter(planches[0]);
majNav();
/* Les polices arrivées, les poèmes longs se réajustent */
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{planches.forEach(P=>{P.ajuste=null;});const P=planches[cur];if(P.kind==='texte')ajuster(P);});

let tPrec=performance.now(),dernier=null,lampeV=-1;
function boucle(t){
  const dt=Math.min(.1,(t-tPrec)/1000);tPrec=t;
  const P=planches[cur],T=types[P.kind];
  if(!holding)idle+=dt;
  T.tick&&T.tick(P,dt);
  const Q=planches[cur],U=types[Q.kind];
  const l=U.lampe?U.lampe(Q):0;
  if(l!==lampeV){lampeV=l;lampe.style.opacity=l;}
  const s=U.son?U.son(Q):SILENCE;
  SON.scene(s[0],s[1],s[2],s[3]);SON.tick();
  const c=U.consigne?U.consigne(Q):'';
  if(c!==dernier){dernier=c;if(c){consigne.textContent=c;consigne.style.opacity=1;}else consigne.style.opacity=0;}
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
try{stage.focus({preventScroll:true});}catch(_){}

/* Le livre gardé sur le téléphone, pour le lire sans réseau */
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
  addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{});});
}
})();
