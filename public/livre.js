/* Chambre noire — le livre complet.
   Le son : de vrais enregistrements (Freesound, licences libres), un fichier MP3 par famille de sons (sons/*.mp3),
   chaque fichier étant une planche de segments [début, durée] décrite dans sons/meta.json ; aucun son n'est fabriqué. */
function creerSon(){
  const NOMS=['obturateur','pas','coups','portes','ventilation','interrupteur','gouttes','bain','papier','pince','rincage','feuilles','platine','craquement','sillon','batiment','pincettes'];
  const CLE_SON='chambre-noire-son';
  /* Volumes (0 à 1) : les réglages principaux */
  const VOL={ventilation:.035,pas:.6,coup:.7,porte:.62,porteDouce:.5,interrupteur:.42,goutte:.18,bain:.55,egoutte:.13,
    obturateur:.55,papier:.5,pince:.42,rincage:.45,feuille:.3,
    musique:.16,craquement:.2,sillon:.2,platine:.32,batiment:.2,pincettes:.32};
  let actif=true;try{actif=localStorage.getItem(CLE_SON)!=='0';}catch(_){}
  let ctx=null,hors=false,maitre=null,filtreLabo=null,charge=null,DON=null;
  const tampons={},bus={},cibles={labo:0,dehors:0},journal=[],erreurs=[],boucles=[],pioches={},fichiers={};
  let etouffe=null,prochGoutte=0,prochBat=0,pasSon=null,nDev=0,dev=null,bainSons=[],attente=[],etage=null;
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
    /* La vie du bâtiment, à travers les murs et le plafond */
    etage=ctx.createBiquadFilter();etage.type='lowpass';etage.frequency.value=1600;etage.Q.value=.3;etage.connect(bus.labo);bus.etage=etage;
    /* Décoder dans l'ordre où l'on en aura besoin */
    charge=meta.then(()=>NOMS.reduce((p,nom)=>p.then(()=>decoder(nom).then(()=>{
      if(nom==='ventilation')boucle('ventilation',bus.labo,VOL.ventilation);
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
  /* Le tourne-disque : un disque à deux faces (musique/disques.json), lu par un élément audio qui passe par le labo
     (un petit haut-parleur, les craquements du vinyle) ; à la fin de la face, l'aiguille tourne dans le dernier sillon. */
  const PL={disques:null,face:'a',piste:0,joue:false,arret:false,fin:false,el:null,g:null,silence:false,craq:null,sillon:null,charge:null,blobs:{},enCours:{},dispo:false,amorce:false,tPose:0,pose:false};
  /* Le bras met BRAS secondes à venir au-dessus du disque (transition de .labo .bras dans style.css) : l'aiguille se pose
     alors, on l'entend toucher le sillon, les craquements commencent, puis la musique (après le blanc du début du morceau) */
  const BRAS=1.75;
  /* Une fois l'aiguille posée, le sillon d'entrée craque un moment avant le morceau (ENTREE secondes, plus le blanc du début
     du fichier) ; entre deux morceaux, le blanc est plus court ; après une pause, la musique reprend presque aussitôt */
  const ENTREE=1.1,ENTRE_DEUX=.5,REPRISE=.25;
  try{const f=localStorage.getItem('chambre-noire-face');if(f)PL.face=f;}catch(_){}
  fetch('musique/disques.json').then(r=>r.ok?r.json():null).then(d=>{PL.disques=d;if(d&&!d[PL.face])PL.face=Object.keys(d)[0];if(d){plPrecharger(PL.face,PL.piste);plVerifier();}}).catch(()=>{});
  /* Les morceaux sont lus depuis la copie gardée sur le téléphone (ou le réseau), chargés à l'avance en entier :
     on peut ainsi les jouer tout de suite, au toucher, même sans réseau */
  function plFichier(face,piste){const d=PL.disques&&PL.disques[face];const p=d&&d.pistes[piste];return p?p.fichier:null;}
  function plPrecharger(face,piste){
    const f=plFichier(face,piste);
    if(!f||PL.blobs[f]||PL.enCours[f])return PL.enCours[f]||Promise.resolve(PL.blobs[f]);
    PL.enCours[f]=fetch(f).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.blob();}).then(b=>{
      PL.blobs[f]=URL.createObjectURL(b);
      /* On n'en garde que quelques-uns en mémoire */
      const cles=Object.keys(PL.blobs);
      while(cles.length>3){const k=cles.shift();if(PL.el&&PL.el.src===PL.blobs[k])continue;URL.revokeObjectURL(PL.blobs[k]);delete PL.blobs[k];}
      return PL.blobs[f];
    }).catch(()=>null).finally(()=>{delete PL.enCours[f];});
    return PL.enCours[f];
  }
  /* Le disque est-il là ? (le réseau, ou la copie gardée de la face posée sur le plateau) */
  function plVerifier(){
    const f=plFichier(PL.face,0);
    if(navigator.onLine||PL.blobs[f]){PL.dispo=true;return;}
    try{caches.match(f).then(m=>{PL.dispo=!!m;}).catch(()=>{PL.dispo=false;});}catch(_){PL.dispo=false;}
  }
  addEventListener('online',()=>plVerifier());addEventListener('offline',()=>plVerifier());
  function plChaine(){
    if(PL.el||!ctx)return;
    const el=new Audio();el.preload='auto';PL.el=el;
    try{
      const s=ctx.createMediaElementSource(el),hp=ctx.createBiquadFilter(),lp=ctx.createBiquadFilter(),g=ctx.createGain();
      hp.type='highpass';hp.frequency.value=110;lp.type='lowpass';lp.frequency.value=5200;lp.Q.value=.4;g.gain.value=VOL.musique;PL.g=g;
      s.connect(hp);hp.connect(lp);lp.connect(g);g.connect(bus.labo);
    }catch(e){erreurs.push('platine : '+(e&&e.message||e));}
    el.addEventListener('ended',()=>{
      if(PL.silence)return;
      const pistes=PL.disques[PL.face].pistes;
      if(PL.piste<pistes.length-1){PL.piste++;plCharger(true);}
      else{PL.fin=true;plBoucle('craq',false);if(PL.joue)plBoucle('sillon',true);}
    });
    el.addEventListener('error',()=>{if(PL.joue){erreurs.push('platine : piste illisible');}});
  }
  function plBoucle(nom,on){
    const cle=nom==='craq'?'craquement':'sillon';
    if(!on){if(PL[nom]){eteindre(PL[nom],.25);PL[nom]=null;}return;}
    if(PL[nom]||!tampons[cle])return;
    const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=tampons[cle];s.loop=true;s.loopStart=.05;s.loopEnd=tampons[cle].duration-.05;
    g.gain.value=VOL[cle];s.connect(g);g.connect(bus.labo);s.start(ctx.currentTime+.05);PL[nom]={s,g,t:ctx.currentTime+.05};
  }
  function plCharger(jouerTout){
    const f=plFichier(PL.face,PL.piste),cle=PL.face+PL.piste,u=PL.blobs[f];
    PL.charge=cle;
    if(u||navigator.onLine){PL.silence=false;PL.el.src=u||f;PL.el.currentTime=0;if(jouerTout)plJouer();}
    else plPrecharger(PL.face,PL.piste).then(v=>{if(PL.charge!==cle||!PL.joue)return;PL.silence=false;PL.el.src=v||f;PL.el.currentTime=0;if(jouerTout)plJouer();});
    /* Le morceau suivant est chargé pendant celui-ci */
    const n=PL.disques[PL.face].pistes.length;plPrecharger(PL.face,(PL.piste+1)%n);
  }
  function plJouer(){const pr=PL.el.play();if(pr&&pr.catch)pr.catch(e=>erreurs.push('platine : '+(e&&e.message||e)));}
  /* Le téléphone ne laisse jouer un son qu'au toucher. Au premier toucher, l'élément audio joue un court fichier vraiment
     silencieux (rien à entendre, quelle que soit la façon dont le téléphone le fait sonner) ; il pourra ensuite jouer seul
     le morceau, quand l'aiguille sera posée. Le morceau lui-même n'est chargé qu'à ce moment-là. */
  let muet=null;
  function silence(){
    if(muet)return muet;
    const n=1600,b=new ArrayBuffer(44+n),v=new DataView(b),w=(o,t)=>{for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i));};
    w(0,'RIFF');v.setUint32(4,36+n,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
    v.setUint32(24,8000,true);v.setUint32(28,8000,true);v.setUint16(32,1,true);v.setUint16(34,8,true);w(36,'data');v.setUint32(40,n,true);
    for(let i=0;i<n;i++)v.setUint8(44+i,128);
    return muet=URL.createObjectURL(new Blob([b],{type:'audio/wav'}));
  }
  function plAmorcer(){
    if(PL.amorce||!PL.el)return;
    PL.silence=true;PL.charge=null;PL.el.src=silence();
    const pr=PL.el.play();
    if(pr&&pr.then)pr.then(()=>{PL.amorce=true;},e=>erreurs.push('platine amorce : '+(e&&e.message||e)));else PL.amorce=true;
  }
  /* Poser l'aiguille dans `delai` secondes (le temps que le bras arrive), puis jouer depuis le début du morceau ou là où on l'avait relevée */
  function plPoser(delai,reprise,blanc){
    clearTimeout(PL.tPose);PL.pose=false;
    PL.tPose=setTimeout(()=>{
      if(!PL.joue)return;
      PL.pose=true;aiguille(true);
      if(PL.fin){plBoucle('sillon',true);return;}
      plBoucle('craq',true);
      /* l'aiguille court dans le sillon, puis le morceau */
      PL.tPose=setTimeout(()=>{
        if(!PL.joue)return;
        if(reprise&&!PL.silence)plJouer();
        else plCharger(true);
      },(blanc!=null?blanc:reprise?REPRISE:ENTREE)*1000);
    },delai*1000);
  }
  function aiguille(descend,auto){
    if(!vivant())return;
    if(descend)jouer('platine',pioche('platine')%2,{gain:VOL.platine,bus:'labo',pan:.25});
    else jouer('platine',2+(Math.random()<.5?0:1),{gain:VOL.platine*.8,bus:auto?null:'labo',pan:.25});
  }
  const platine={
    pret:()=>!!PL.disques,
    dispo:()=>{plVerifier();return !!PL.disques&&PL.dispo;},
    etat:()=>{const d=PL.disques&&PL.disques[PL.face];const p=d&&d.pistes[PL.piste];return {joue:PL.joue,arret:PL.arret,fin:PL.fin,face:PL.face,faceTitre:d?d.titre:'',piste:PL.piste,nPistes:d?d.pistes.length:0,titre:p?p.titre:'',auteur:p?p.auteur+(p.interprete?' ('+p.interprete+')':''):'',position:PL.el?Math.round(PL.el.currentTime*10)/10:0,lit:!!(PL.el&&!PL.el.paused)};},
    /* Jouer : poser l'aiguille ; après une pause, elle retrouve l'endroit du morceau où on l'avait relevée */
    lire(){
      if(!PL.disques||PL.joue||!vivant())return;
      plChaine();if(!PL.el)return;
      PL.joue=true;
      const reprise=PL.arret&&PL.charge===PL.face+PL.piste;
      plAmorcer();PL.arret=false;
      plPoser(BRAS,reprise);
    },
    /* Pause : relever l'aiguille (le morceau garde sa place) */
    pause(auto){
      if(!PL.joue)return;
      PL.joue=false;PL.arret=true;clearTimeout(PL.tPose);try{PL.el.pause();}catch(_){}
      plBoucle('craq',false);plBoucle('sillon',false);if(PL.pose)aiguille(false,auto);PL.pose=false;
    },
    /* Changer de morceau : le suivant sur la face (après le dernier, on revient au premier) */
    suivante(){
      if(!PL.disques||!vivant())return;
      plChaine();if(!PL.el)return;
      const n=PL.disques[PL.face].pistes.length;
      PL.piste=PL.fin?0:(PL.piste+1)%n;PL.fin=false;PL.arret=false;plBoucle('sillon',false);
      /* L'aiguille se relève, va au morceau suivant et se repose ; si le bras était au repos, il vient d'abord au-dessus du disque */
      const dessus=PL.joue;try{PL.el.pause();}catch(_){}plBoucle('craq',false);
      if(dessus&&PL.pose)aiguille(false);
      PL.joue=true;plAmorcer();plPoser(dessus?.7:BRAS,false,dessus?ENTRE_DEUX:ENTREE);
    },
    /* L'autre face : on retourne le disque et l'on pose l'aiguille au début */
    autreFace(){
      if(!PL.disques||!vivant())return;
      plChaine();if(!PL.el)return;
      const faces=Object.keys(PL.disques),f=faces[(faces.indexOf(PL.face)+1)%faces.length];
      if(PL.joue){PL.joue=false;clearTimeout(PL.tPose);try{PL.el.pause();}catch(_){}plBoucle('craq',false);plBoucle('sillon',false);if(PL.pose)aiguille(false);PL.pose=false;}
      PL.face=f;PL.piste=0;PL.fin=false;PL.arret=false;try{localStorage.setItem('chambre-noire-face',f);}catch(_){}
      jouer('feuilles',pioche('feuilles'),{t:ctx.currentTime+.3,gain:VOL.feuille,bus:'labo'});
      PL.joue=true;plAmorcer();plPoser(Math.max(BRAS,1.3),false);
    },
    /* L'onglet caché : le disque s'arrête de tourner avec lui */
    visible(on){if(PL.el&&PL.joue&&PL.pose&&!PL.fin){try{on?plJouer():PL.el.pause();}catch(_){}}}
  };
  document.addEventListener('visibilitychange',()=>platine.visible(!document.hidden));
  Object.keys(platine).forEach(k=>{const f=platine[k];platine[k]=function(){try{return f.apply(platine,arguments);}catch(e){erreurs.push('platine '+k+' : '+(e&&e.message||e));return null;}};});

  const api={
    platine,
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
      /* Très rarement, la vie du bâtiment : un plancher qui craque à l'étage, un radiateur, de l'eau dans un tuyau */
      if(cibles.labo>.5&&!etouffe&&tampons.batiment){
        if(t>=prochBat){
          if(prochBat){const i=pioche('batiment');jouer('batiment',i,{t,gain:VOL.batiment*hasard(.55,1)*(i===7?.7:1),vitesse:hasard(.95,1.05),pan:hasard(-.6,.6),bus:'etage'});}
          prochBat=t+hasard(50,130);
        }
      }else if(cibles.labo<=.5)prochBat=0;
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
    /* La sortie, en deux gestes du lecteur : il ouvre le robinet pour rincer les tirages (renvoie la durée du rinçage),
       puis il pousse la porte : la lampe s'éteint, la porte s'ouvre sur le jour. */
    rincer(){
      if(!vivant()||!tampons.rincage)return 0;
      jouer('rincage',0,{t:ctx.currentTime+.05,gain:VOL.rincage,pan:-.3});
      return 3.9;
    },
    pousser(){
      if(!vivant())return;
      const t=ctx.currentTime;
      jouer('interrupteur',1,{t:t+.05,gain:VOL.interrupteur,pan:.2});
      jouer('portes',1,{t:t+.6,gain:VOL.porte*.9});
    },
    /* Passer la porte : quatre pas jusqu'à la paillasse, le dernier plus doux (on s'arrête) */
    marcher(k,dernier){
      if(!vivant())return;
      jouer('pas',1+(k%2),{gain:VOL.pas*(dernier?.3:.42)*hasard(.9,1.05),vitesse:hasard(.96,1.04),pan:k%2?-.08:.08});
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
      if(Math.random()<.45)jouer('pincettes',pioche('pincettes'),{t:ctx.currentTime+.08,gain:VOL.pincettes*hasard(.7,1),vitesse:hasard(.94,1.06),pan:hasard(.05,.3)});
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
/* Les poèmes se développent comme sur un vrai papier photo : une feuille rougie par la lampe dans la cuvette,
   le texte qui monte en sombre, puis la lumière blanche, atténuée, une fois le tirage fixé (choix de Nathan, 9 novembre).
   L'ancienne version, en clair sur noir, reste visible avec ?negatif à la fin de l'adresse. */
const PAPIER=!/[?&]negatif\b/.test(location.search);
const FEUILLE_FAIBLE=[50,27,24],FEUILLE_LAMPE=[92,40,33],FEUILLE_JOUR=[196,188,174],ENCRE_LABO=[26,12,11],ENCRE_JOUR=[28,24,22];
if(PAPIER)document.documentElement.classList.add('papier');
/* Réglages du labo (secondes et proportions) */
const DEV_TEXTE=5.2,FIXAGE=2,DEV_DESSIN=5,LUEUR=1.3,SEUIL_DESSIN=.75,GAIN_DESSIN=.45,AMBIANCE=.3;
/* XVII : le silence avant le dernier vers (après le passage au blanc), puis sa lente apparition ; toucher l'écran ne relance plus l'attente */
const SILENCE_XVII=2,APPARITION_XVII=1.5;
/* Le seuil : l'œil s'habitue au noir (on devine des formes) ; le voyant de l'interrupteur apparaît (SEUIL_VOYANT) ;
   le lecteur allume lui-même la lampe rouge et voit le labo : la lampe, la corde à linge où sèchent ses tirages,
   les cuvettes sur la paillasse, l'agrandisseur. SEUIL_REGARD secondes après l'allumage, on s'approche de la cuvette,
   en SEUIL_APPROCHE secondes */
const SEUIL_VOYANT=reduit?.5:4.2,SEUIL_REGARD=reduit?1.2:3.4,SEUIL_APPROCHE=reduit?.6:3.2;
/* « Laisser l'œil s'habituer au noir » jusqu'à SEUIL_OEIL ; un temps de noir ; puis « Allumer la lampe » à SEUIL_ALLUMER */
const SEUIL_OEIL=reduit?2.2:5.6,SEUIL_ALLUMER=reduit?3.2:7;
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
const vus={texte:false,dessin:false,suite:false,agrandi:false,loupe:false};
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

/* Une seule taille de vers pour tout le livre, réglée sur l'écran : le vers de sonnet le plus long tient sur une ligne
   (quatrains et tercets restent intacts). Les autres poèmes prennent la même taille. */
let TAILLE={t:0,largeur:0};
function tailleCommune(){
  const r=document.documentElement;r.style.removeProperty('--t-vers');
  const m=document.createElement('div');m.className='page mesure';m.setAttribute('aria-hidden','true');
  m.style.cssText='position:absolute;left:0;top:0;width:100%;height:auto;visibility:hidden;pointer-events:none';
  document.querySelectorAll('.planche[data-kind="texte"] .page.sonnet .v').forEach(v=>m.appendChild(v.cloneNode(true)));
  stage.appendChild(m);
  const cs=getComputedStyle(m),largeur=m.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  const vs=m.querySelectorAll('.v');let t=vs.length?parseFloat(getComputedStyle(vs[0]).fontSize):0,plus=0;
  vs.forEach(v=>{const w=v.getBoundingClientRect().width;if(w>plus)plus=w;});
  m.remove();
  if(plus>largeur&&t){t=Math.floor(t*largeur/plus*.98*10)/10;r.style.setProperty('--t-vers',t+'px');}
  TAILLE={t,largeur};
}
/* En hauteur : un poème trop long pour l'écran se resserre (marge du haut, puis taille des vers) */
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
    /* Une feuille dans la cuvette, rougie par la lampe ; le texte monte en sombre ;
       une fois fixé, on allume la lumière blanche pour regarder le tirage */
    const fond=mix(mix(FEUILLE_FAIBLE,FEUILLE_LAMPE,lisse(P.eclair||0)),FEUILLE_JOUR,b);
    P.el.style.setProperty('--feuille',rgb(fond));
    /* le grain du papier vient avec l'image, puis tout entier à la lumière */
    P.el.style.setProperty('--grain-papier',(.35*lisse(clamp(P.prog))+.65*b).toFixed(3));
    P.el.classList.toggle('revele',P.prog>0||b>0);
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
   Une vraie planche 18×24 : sept bandes de six vues (les 42 tirages), posées à la main sur le papier et tirées par contact.
   Tout y est à l'échelle d'un film 35 mm (--mm : un millimètre de film à l'écran) : vues 24×36 aux coins arrondis,
   huit perforations par vue, numéros de vue et nom du film en tout petit sur le bord, quelques poussières.
   La pellicule vierge (les vues pas encore développées) reste du gris sombre du support ; le photographe entoure au
   crayon gras rouge les vues qu'il a regardées à l'agrandisseur ; on regarde la planche de près au compte-fils. */
function nettoyer(n){n.querySelectorAll('[style]').forEach(e=>e.removeAttribute('style'));return n;}
/* Un hasard qui retombe toujours de la même façon (bandes de travers, poussières, crayon) */
function hasard(n){let g=(n*9301+49297)%233280;return ()=>(g=(g*9301+49297)%233280)/233280;}
const NS='http://www.w3.org/2000/svg';
/* Un trait de crayon gras : un cadre tiré vite à main levée (côtés un peu bombés, coins arrondis, le trait déborde
   au départ et à l'arrivée), repassé ; la cire accroche mal le papier brillant (filtre #cire). Jamais le même d'une vue à l'autre. */
function trait(pts,k){
  let d='M'+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);
  for(let i=1;i<pts.length-1;i++){
    const [px,py]=pts[i-1],[vx,vy]=pts[i],[nx,ny]=pts[i+1];
    const l1=Math.hypot(px-vx,py-vy)||1,l2=Math.hypot(nx-vx,ny-vy)||1,k1=Math.min(k,l1/2),k2=Math.min(k,l2/2);
    d+=' L'+(vx+(px-vx)*k1/l1).toFixed(1)+' '+(vy+(py-vy)*k1/l1).toFixed(1)+' Q'+vx.toFixed(1)+' '+vy.toFixed(1)+' '+(vx+(nx-vx)*k2/l2).toFixed(1)+' '+(vy+(ny-vy)*k2/l2).toFixed(1);
  }
  const z=pts[pts.length-1];return d+' L'+z[0].toFixed(1)+' '+z[1].toFixed(1);
}
function crayon(fig,j,anime){
  if(fig.querySelector('.crayon'))return;
  const h=hasard(j*31+5),a=(k=1)=>(h()-.5)*k;
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('class','crayon'+(anime?' trace':''));svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  const g=document.createElementNS(NS,'g');g.setAttribute('filter','url(#cire)');svg.appendChild(g);
  const c=[[-15+a(6),-5+a(3)],[115+a(6),-4+a(3)],[114+a(6),105+a(3)],[-14+a(6),104+a(3)]];
  [[2.1,.58,0],[1.3,.78,1.6],[.7,.5,2.8]].forEach(([w,o,e],k)=>{
    const q=c.map(([x,y])=>[x+a(e*2),y+a(e)]);
    /* départ un peu avant le premier coin, retour qui le dépasse ; côtés bombés par un point milieu */
    const tour=[[q[0][0]-3+a(5),q[0][1]+6+a(4)],q[0]];
    for(let i=1;i<=4;i++){const A=q[i-1],B=q[i%4],dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy),b=a(3.2);
      tour.push([(A[0]+B[0])/2-dy/L*b,(A[1]+B[1])/2+dx/L*b*.7],i<4?B:[B[0]+a(3),B[1]-1.5+a(2)]);}
    tour.push([q[0][0]+18+a(10),q[0][1]+a(3)]);
    const pa=document.createElementNS(NS,'path');pa.setAttribute('d',trait(tour,7));pa.setAttribute('pathLength','1');
    pa.style.strokeWidth=w;pa.style.opacity=o;pa.style.animationDelay=(k*.09)+'s';g.appendChild(pa);
  });
  fig.appendChild(svg);
}
/* Les poussières sur le négatif sortent en points blancs sur le tirage, et un cheveu */
function poussieres(g){
  const h=hasard(17),svg=document.createElementNS(NS,'svg');
  svg.setAttribute('class','poussieres');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  for(let i=0;i<18;i++){const e=document.createElementNS(NS,'ellipse');e.setAttribute('cx',(h()*100).toFixed(2));e.setAttribute('cy',(h()*100).toFixed(2));
    const r=.1+h()*h()*.32;e.setAttribute('rx',r.toFixed(3));e.setAttribute('ry',(r*.92).toFixed(3));e.setAttribute('opacity',(.3+h()*.5).toFixed(2));svg.appendChild(e);}
  const x=8+h()*80,y=10+h()*75,pa=document.createElementNS(NS,'path');
  pa.setAttribute('d','M'+x.toFixed(1)+' '+y.toFixed(1)+' c 2 -1.5 3.5 1 5 -.4 s 2.2 -2.6 3.4 -1.2');pa.setAttribute('class','cheveu');svg.appendChild(pa);
  g.appendChild(svg);
}
function construireGrille(){
  const g=$('grille');g.innerHTML='';
  const tirages=planches.filter(estTirage),choix=lireChoix(),h=hasard(7);
  for(let s=0;s<tirages.length;s+=PAR_BANDE){
    const bande=document.createElement('div');bande.className='bande';
    /* posées à la main sous la vitre : jamais tout à fait droites ni alignées */
    bande.style.transform='translateY('+((h()-.5)*.9).toFixed(2)+'%) rotate('+((h()-.5)*.5).toFixed(2)+'deg)';
    tirages.slice(s,s+PAR_BANDE).forEach((P,k)=>{
      const j=s+k;
      const fig=document.createElement('figure');fig.className='vue '+P.kind+(P.fixe?' dev':'');fig.dataset.id=P.id;
      const b=document.createElement('button');b.type='button';
      const im=document.createElement('span');im.className='image';
      if(P.fixe){
        b.classList.add('dev');b.setAttribute('aria-label','Agrandir la vue '+(j+1)+', '+P.el.getAttribute('aria-label'));
        if(P.kind==='texte'){const m=document.createElement('div');m.className='mini';const pg=nettoyer(P.el.querySelector('.page').cloneNode(true));pg.removeAttribute('style');pg.classList.remove('serree','tres-serree');m.appendChild(pg);im.appendChild(m);}
        else{const i=document.createElement('img');i.src=P.el.dataset.vignette;i.alt='';i.decoding='async';im.appendChild(i);}
        b.addEventListener('click',()=>ouvrirVis(P));
      }else{
        b.setAttribute('aria-label','Vue '+(j+1)+', pas encore développée : rentrer dans la chambre noire pour la développer');
        b.addEventListener('click',()=>rentrer(planches.indexOf(P)));
      }
      b.appendChild(im);
      const n=document.createElement('span');n.className='numero';n.setAttribute('aria-hidden','true');n.textContent=(j+1)+'      ▸'+(j+1)+'A';b.appendChild(n);
      if(k===1||k===4){const f=document.createElement('span');f.className='nom-film';f.setAttribute('aria-hidden','true');f.textContent='CHAMBRE NOIRE   400';b.appendChild(f);}
      fig.appendChild(b);
      if(P.fixe&&choix.includes(P.id))crayon(fig,j,false);
      bande.appendChild(fig);
    });
    g.appendChild(bande);
  }
  poussieres(g);
  requestAnimationFrame(echelle);
}
function echelle(){
  const g=$('grille'),v=g&&g.querySelector('.vue');if(!v||!v.clientWidth)return;
  g.style.setProperty('--mm',(v.clientWidth/35).toFixed(3)+'px');
  g.querySelectorAll('.vue .mini').forEach(m=>{m.style.transform='scale('+(m.parentElement.clientWidth/480)+')';});
  if(TAILLE.t&&TAILLE.largeur)g.style.setProperty('--t-mini',(TAILLE.t*376/TAILLE.largeur).toFixed(2)+'px');
}
/* Le compte-fils : garder le doigt sur la planche pour la regarder de près ; il suit le doigt, au-dessus de lui */
const cf=$('compte-fils'),cfVue=cf.firstElementChild,LOUPE=3.4;
let cfT=0,cfActif=false,cfD=null,cfQuitte=-1e4;
function cfOuvrir(){
  const g=$('grille'),c=g.cloneNode(true);c.removeAttribute('id');c.style.width=g.offsetWidth+'px';
  c.querySelectorAll('button').forEach(b=>{b.tabIndex=-1;b.removeAttribute('aria-label');});
  c.querySelectorAll('.crayon.trace').forEach(e=>e.classList.remove('trace'));
  cfVue.replaceChildren(c);cfActif=true;vus.loupe=true;cf.classList.add('visible');
}
function cfPlacer(x,y){
  const r=$('grille').getBoundingClientRect(),S=cf.parentElement.getBoundingClientRect(),R=cf.offsetWidth/2;
  let cy=y-R-38;if(cy-R<S.top+6)cy=y+R+38;
  const cx=Math.min(Math.max(x,S.left+R+10),S.right-R-10);
  cf.style.left=(cx-S.left)+'px';cf.style.top=(cy-S.top)+'px';
  cfVue.style.transform='translate('+(R-(x-r.left)*LOUPE).toFixed(1)+'px,'+(R-(y-r.top)*LOUPE).toFixed(1)+'px) scale('+LOUPE+')';
}
function cfBouge(x,y){if(cfActif){cfPlacer(x,y);return;}if(Math.hypot(x-cfD.x,y-cfD.y)>8){clearTimeout(cfT);cfD=null;}}
function cfStop(){clearTimeout(cfT);cfD=null;if(cfActif){cfActif=false;cfQuitte=performance.now();cf.classList.remove('visible');}}
{
  const g=$('grille');
  g.addEventListener('pointerdown',e=>{
    if(e.button>0)return;clearTimeout(cfT);
    cfD={id:e.pointerId,x:e.clientX,y:e.clientY,doigt:e.pointerType!=='mouse'};
    cfT=setTimeout(()=>{if(!cfD)return;cfOuvrir();cfPlacer(cfD.x,cfD.y);},300);
  });
  addEventListener('pointermove',e=>{if(cfD&&e.pointerId===cfD.id)cfBouge(e.clientX,e.clientY);});
  g.addEventListener('touchmove',e=>{if(!cfD)return;if(cfActif&&e.cancelable)e.preventDefault();const t=e.touches[0];if(t)cfBouge(t.clientX,t.clientY);},{passive:false});
  addEventListener('pointerup',e=>{if(cfD&&e.pointerId===cfD.id)cfStop();});
  addEventListener('pointercancel',e=>{if(cfD&&e.pointerId===cfD.id&&!cfActif)cfStop();});
  addEventListener('touchend',e=>{if(cfD&&!e.touches.length)cfStop();});
  addEventListener('touchcancel',()=>{if(cfD)cfStop();});
  /* Après le compte-fils, lever le doigt n'agrandit pas la vue */
  g.addEventListener('click',e=>{if(cfActif||performance.now()-cfQuitte<450){e.stopPropagation();e.preventDefault();}},true);
}
/* Regarder une vue à l'agrandisseur : elle sera entourée au crayon gras en revenant à la planche */
function marquer(P){const l=lireChoix();if(!l.includes(P.id)){l.push(P.id);sauverChoix(l);vis.nouvelles.push(P.id);}}
function ouvrirVis(P){
  vis.liste=planches.filter(Q=>estTirage(Q)&&Q.fixe);vis.i=Math.max(0,vis.liste.indexOf(P));vis.nouvelles=[];
  vis.ouverte=true;vus.agrandi=true;visEl.classList.add('ouverte');afficherVis();SON.feuille();
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
  const pre=P.kind;
  P.decor.innerHTML=(`<defs>
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
  <!-- le tourne-disque, sur un petit meuble : la pochette posée contre le mur, le plateau, le disque, le bras -->
  <rect x="240" y="570" width="150" height="68" fill="#120605" stroke="#4a120d" stroke-width=".6"/>
  <path d="M315 574V634" stroke="#3a100b" stroke-width=".8"/><circle cx="308" cy="604" r="1.6" fill="#5c1a12"/><circle cx="322" cy="604" r="1.6" fill="#5c1a12"/>
  <g transform="rotate(-7 266 532)"><rect x="240" y="480" width="54" height="54" fill="#33100b" stroke="#6a2418" stroke-width=".6"/><circle cx="267" cy="507" r="17" fill="none" stroke="#7a2a1d" stroke-width="1"/><circle cx="267" cy="507" r="5" fill="#7a2a1d"/></g>
  <polygon points="252,533 382,533 388,560 246,560" fill="#2a0f0a" stroke="#6a2418" stroke-width=".8"/>
  <rect x="246" y="560" width="142" height="10" fill="#1a0807" stroke="#5c1a12" stroke-width=".6"/>
  <circle class="temoin" cx="256" cy="565" r="1.8" fill="#ffae5c"/>
  <ellipse cx="308" cy="547" rx="47" ry="11.5" fill="#1e0b08" stroke="#4a160f" stroke-width=".6"/>
  <g transform="translate(308 545.5) scale(1 .23)"><g class="disque">
    <circle r="44" fill="#080404"/>
    <circle r="38" fill="none" stroke="#24100c" stroke-width="1.4"/><circle r="31" fill="none" stroke="#24100c" stroke-width="1.4"/><circle r="24" fill="none" stroke="#24100c" stroke-width="1.4"/>
    <path d="M-40 -6 A40.5 40.5 0 0 1 -12 -38.5" stroke="#8a3a2c" stroke-width="3" fill="none" opacity=".55"/>
    <path d="M40 6 A40.5 40.5 0 0 1 12 38.5" stroke="#8a3a2c" stroke-width="3" fill="none" opacity=".35"/>
    <circle r="12.5" fill="#8a2a1d"/><rect x="3" y="-2" width="7" height="4" fill="#c56a50"/><circle r="1.6" fill="#d8a080"/>
  </g></g>
  <circle cx="371" cy="563" r="2.2" fill="#1a0807" stroke="#6a2418" stroke-width=".6"/>
  <g class="bras">
    <path d="M366 536L373 563" stroke="#b08070" stroke-width="1.6" stroke-linecap="round"/>
    <rect x="370.5" y="561" width="5" height="7" rx="1" fill="#d0a090" transform="rotate(-15 373 564)"/>
  </g>
  <circle cx="366" cy="536" r="4.5" fill="#2a0f0a" stroke="#8a4a3a" stroke-width=".8"/><circle cx="366" cy="536" r="1.5" fill="#b08070"/>
  <!-- la paillasse et les trois cuvettes -->
  <rect x="0" y="638" width="390" height="206" fill="url(#paillasse)"/>
  ${cuves}
  <path d="M136 666 L176 640 M141 668 L180 643" stroke="#2a0c08" stroke-width="2.2" stroke-linecap="round"/>
  <!-- le robinet, au-dessus de la première cuvette ; une goutte tombe de temps en temps -->
  <path d="M128 500V586Q128 600 142 600H156" stroke="#2c0e09" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M130.5 500V586Q130.5 597.5 142 597.5H155" stroke="#7a2a1d" stroke-width="1.2" fill="none" opacity=".8"/>
  <ellipse class="goutte" cx="157" cy="606" rx="1.6" ry="2.4" fill="#ff6a4a" opacity=".55"/>
  <!-- quand on rince les tirages, le robinet coule dans la première cuvette -->
  <g class="filet">
    <path d="M157 602.5C157.7 618 156.5 637 157.2 656.5" stroke="#c63e2a" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".7"/>
    <path class="filet-reflet" d="M156.4 603C157 618 155.9 637 156.6 655" stroke="#ff9f80" stroke-width=".8" stroke-dasharray="5 9" stroke-linecap="round" fill="none" opacity=".85"/>
    <ellipse class="filet-eclabousse" cx="157.2" cy="657.5" rx="9" ry="1.7" fill="none" stroke="#ff7a5a" stroke-width=".7" opacity=".55"/>
    <ellipse class="filet-eclabousse b" cx="157.2" cy="657.5" rx="6" ry="1.2" fill="none" stroke="#ff8a6a" stroke-width=".6" opacity=".5"/>
  </g>
  <rect width="390" height="844" fill="url(#grain)" opacity=".09"/>
  <rect width="390" height="844" fill="url(#ombre)"/>`).replace(/id="([a-z-]+)"/g,'id="'+pre+'-$1"').replace(/url\(#([a-z-]+)\)/g,'url(#'+pre+'-$1)');
}

/* La porte du labo, vue de l'intérieur sous la lampe rouge : une porte isoplane peinte en noir, joint d'étanchéité à la lumière
   sur le chambranle, béquille et cylindre, plaque de propreté, un tablier en caoutchouc pendu à une patère ; à droite,
   l'interrupteur de la lampe et son voyant. Derrière la porte, la pièce claire du labo, où attend la planche-contact.
   Coordonnées du dessin : 390 × 844 ; le battant (PO) tourne sur ses gonds, à gauche, sous une perspective de PO.f. */
const PO={x:92,y:168,l:206,h:574,f:700,ox:195,oy:470,fond:1100,banc:200};
/* Où l'on voit le chant du battant (côté serrure) quand il a tourné de th radians */
function chant(th){
  const k=PO.f/(PO.f+PO.l*Math.sin(th)),x=PO.x+PO.l*Math.cos(th);
  return{x:PO.ox+(x-PO.ox)*k,haut:PO.oy+(PO.y-PO.oy)*k,bas:PO.oy+(PO.y+PO.h-PO.oy)*k};
}
function porteLabo(P){
  const g=grain(),gr=id=>`<pattern id="${id}" width="128" height="128" patternUnits="userSpaceOnUse"><image href="${g}" width="128" height="128"/></pattern>`;
  /* La pièce claire, derrière la porte, dessinée en grand (on y entre) dans les coordonnées de la porte : le mur du fond,
     le sol et ses joints qui fuient vers l'œil, la paillasse où attend la planche-contact, l'armoire de séchage */
  const joints=[];for(let k=-14;k<=14;k++){const x=195+k*34,x2=195+(x-195)*(1300-470)/(590-470);joints.push(`M${x} 590L${x2.toFixed(1)} 1300`);}
  [598,609,624,646,678,724,792,890,1040,1260].forEach(y=>joints.push(`M-700 ${y}H1090`));
  P.sas.querySelector('.piece').innerHTML=`<defs>
    <linearGradient id="po-fond" x1="0" y1="100" x2="0" y2="590" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f4f0e8"/><stop offset=".6" stop-color="#e2dccf"/><stop offset="1" stop-color="#d2cbbd"/></linearGradient>
    <linearGradient id="po-sol-clair" x1="0" y1="590" x2="0" y2="1300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#b9b2a4"/><stop offset=".3" stop-color="#d9d2c4"/><stop offset="1" stop-color="#cfc8ba"/></linearGradient>
    <radialGradient id="po-plafonnier" cx="195" cy="150" r="300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect x="-700" y="100" width="1790" height="490" fill="url(#po-fond)"/>
  <rect x="-700" y="100" width="1790" height="400" fill="url(#po-plafonnier)"/>
  <rect x="-700" y="590" width="1790" height="710" fill="url(#po-sol-clair)"/>
  <path d="${joints.join('')}" stroke="#a49c8e" stroke-width=".7" opacity=".4" fill="none"/>
  <rect x="-700" y="584" width="1790" height="6" fill="#a39b8e"/>
  <!-- la paillasse, contre le mur du fond -->
  <rect x="-170" y="512" width="402" height="72" fill="#4a4742"/>
  <rect x="-170" y="505" width="404" height="7.5" fill="#5f5b55"/>
  <path d="M-170 512.5H232M-70 514V584M30 514V584M130 514V584" stroke="#2e2c29" stroke-width="1"/>
  <path d="M-80 524v14M20 524v14M120 524v14M220 524v14" stroke="#8a867e" stroke-width="1.6" stroke-linecap="round"/>
  <rect x="-120" y="497" width="34" height="8" fill="#6b6760"/><rect x="-80" y="499" width="30" height="6" fill="#77736b"/>
  <!-- l'armoire de séchage -->
  <rect x="300" y="318" width="112" height="266" fill="#d3ccbf" stroke="#aaa294" stroke-width="1"/>
  <path d="M356 320V582" stroke="#aaa294" stroke-width="1"/><path d="M349 436v24M363 436v24" stroke="#8d867a" stroke-width="2" stroke-linecap="round"/>
`;
  /* Le battant, côté labo */
  P.sas.querySelector('.battant svg').innerHTML=`<defs>
    <linearGradient id="po-peint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d140e"/><stop offset=".38" stop-color="#2a0d09"/><stop offset="1" stop-color="#130605"/></linearGradient>
    <radialGradient id="po-reflet" cx="96" cy="30" r="320" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8a2a1c" stop-opacity=".32"/><stop offset="1" stop-color="#8a2a1c" stop-opacity="0"/></radialGradient>
    <linearGradient id="po-inox" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3e1410"/><stop offset=".5" stop-color="#2a0c09"/><stop offset="1" stop-color="#170606"/></linearGradient>
    <linearGradient id="po-bords" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#030101" stop-opacity=".55"/><stop offset=".05" stop-color="#030101" stop-opacity="0"/><stop offset=".95" stop-color="#030101" stop-opacity="0"/><stop offset="1" stop-color="#030101" stop-opacity=".5"/></linearGradient>
    <linearGradient id="po-linteau" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030101" stop-opacity=".6"/><stop offset=".03" stop-color="#030101" stop-opacity="0"/></linearGradient>
    <linearGradient id="po-levier" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d07a60"/><stop offset=".42" stop-color="#7e2c1f"/><stop offset="1" stop-color="#260b08"/></linearGradient>
    <linearGradient id="po-tablier" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#140504"/><stop offset=".3" stop-color="#2c0c08"/><stop offset=".55" stop-color="#0e0403"/><stop offset=".8" stop-color="#240a07"/><stop offset="1" stop-color="#0c0303"/></linearGradient>
    ${gr('po-grain-b')}
  </defs>
  <rect width="206" height="574" fill="url(#po-peint)"/>
  <rect width="206" height="574" fill="url(#po-reflet)"/>
  <rect width="206" height="574" fill="url(#po-grain-b)" opacity=".05"/>
  <rect width="206" height="574" fill="url(#po-bords)"/><rect width="206" height="574" fill="url(#po-linteau)"/>
  <path d="M.5 0V574M205.5 0V574" stroke="#050202" stroke-width="1" opacity=".7"/>
  <!-- la patère et le tablier en caoutchouc -->
  <path d="M33 150Q37 119 54 118Q71 119 75 150" stroke="#0a0302" stroke-width="3.2" fill="none"/>
  <path d="M33 150Q37 120 54 119.5" stroke="#5a1a12" stroke-width=".7" fill="none" opacity=".6"/>
  <rect x="49" y="104" width="10" height="9" rx="2" fill="#2a0c08" stroke="#7a2a1d" stroke-width=".5"/>
  <path d="M54 110v7q0 5 5 5h2" stroke="#9a4434" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M31 149L77 149Q80 171 94 187Q99 262 92 362Q62 371 29 364Q16 272 21 189Q29 173 31 149Z" fill="url(#po-tablier)"/>
  <path d="M43 158Q38 252 45 358" stroke="#5a1a12" stroke-width="2.4" opacity=".45" fill="none"/>
  <path d="M67 160Q74 252 71 362" stroke="#4a160f" stroke-width="1.6" opacity=".5" fill="none"/>
  <path d="M23 196Q20 272 30 358" stroke="#7a2418" stroke-width="1" opacity=".45" fill="none"/>
  <path d="M21 191Q12 232 17 296M94 189Q103 229 97 286" stroke="#0a0302" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M29 364Q62 371 92 362" stroke="#5a1a12" stroke-width=".8" opacity=".5" fill="none"/>
  <!-- la plaque de propreté -->
  <rect x="6" y="502" width="194" height="66" fill="url(#po-inox)"/>
  <path d="M6 502.5H200" stroke="#8a3a2c" stroke-width=".7" opacity=".5"/><path d="M6 567.5H200" stroke="#050202" stroke-width="1" opacity=".6"/>
  <path d="M6 510H200M6 518H200M6 529H200M6 541H200M6 552H200M6 561H200" stroke="#5a1a12" stroke-width=".3" opacity=".5"/>
  <g fill="#6a2418"><circle cx="12" cy="508" r="1.3"/><circle cx="194" cy="508" r="1.3"/><circle cx="12" cy="562" r="1.3"/><circle cx="194" cy="562" r="1.3"/></g>
  <!-- la serrure : rosace, cylindre, béquille -->
  <rect x="172" y="282" width="15" height="56" rx="7.5" fill="#2c0d09" stroke="#8a3a2c" stroke-width=".7"/>
  <circle cx="179.5" cy="324" r="3.8" fill="#120504" stroke="#9a4434" stroke-width=".6"/><rect x="179" y="321.4" width="1.1" height="5.2" fill="#5a1a12"/>
  <path d="M178 306H142" stroke="#000" stroke-width="3" opacity=".3" stroke-linecap="round"/>
  <g class="po-poignee">
    <path d="M181 293.5H142Q135.5 293.5 135.5 298.5Q135.5 303 141 303H181Z" fill="url(#po-levier)"/>
    <circle cx="179.5" cy="298" r="6" fill="url(#po-levier)" stroke="#260b08" stroke-width=".5"/>
    <path d="M177 295H143" stroke="#f0b098" stroke-width=".8" opacity=".55" stroke-linecap="round"/>
  </g>`;
  /* Le mur du labo, le chambranle et son joint, le seuil, l'interrupteur ; puis la nuit quand la lampe s'éteint,
     et la lumière de la pièce claire qui entre par la porte */
  P.sas.querySelector('.mur').innerHTML=`<defs>
    <clipPath id="po-trou"><path clip-rule="evenodd" d="M-700 -400H1090V1244H-700Z M92 168V742H298V168Z"/></clipPath>
    <radialGradient id="po-halo" cx="195" cy="30" r="640" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#b8261a" stop-opacity=".44"/><stop offset=".45" stop-color="#6a140d" stop-opacity=".18"/><stop offset="1" stop-color="#2a0705" stop-opacity="0"/></radialGradient>
    <linearGradient id="po-sol" x1="0" y1="742" x2="0" y2="920" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1e0907"/><stop offset="1" stop-color="#070303"/></linearGradient>
    <radialGradient id="po-vignette" cx="195" cy="455" r="560" gradientUnits="userSpaceOnUse"><stop offset=".52" stop-color="#060202" stop-opacity="0"/><stop offset="1" stop-color="#060202" stop-opacity=".96"/></radialGradient>
    <linearGradient id="po-flaque-g" x1="0" y1="742" x2="0" y2="1010" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f6f0e4" stop-opacity=".55"/><stop offset=".45" stop-color="#f6f0e4" stop-opacity=".12"/><stop offset="1" stop-color="#f6f0e4" stop-opacity="0"/></linearGradient>
    <radialGradient id="po-lueur-g"><stop offset="0" stop-color="#fffaf0" stop-opacity=".55"/><stop offset=".5" stop-color="#fffaf0" stop-opacity=".12"/><stop offset="1" stop-color="#fffaf0" stop-opacity="0"/></radialGradient>
    <filter id="po-flou" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="po-flou-sol" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
    ${gr('po-grain-m')}
  </defs>
  <g clip-path="url(#po-trou)">
    <rect x="-700" y="-400" width="1790" height="1644" fill="#0e0606"/>
    <rect x="-700" y="-400" width="1790" height="1644" fill="url(#po-halo)"/>
    <rect x="-700" y="742" width="1790" height="502" fill="url(#po-sol)"/>
    <rect x="-700" y="727" width="1790" height="15" fill="#160706"/>
    <path d="M-700 727.5H1090" stroke="#4a160f" stroke-width=".8" opacity=".55"/>
    <!-- le chambranle -->
    <path d="M68 742V144H322V742H298V168H92V742Z" fill="#230c08"/>
    <path d="M68.5 742V144.5H321.5V742" stroke="#6a2418" stroke-width=".9" fill="none" opacity=".55"/>
    <path d="M74 742V150H316V742" stroke="#3a120d" stroke-width=".6" fill="none" opacity=".7"/>
    <path d="M68 144H322" stroke="#8a2a1c" stroke-width="1.2" opacity=".35"/>
    <!-- le joint noir qui arrête la lumière -->
    <path d="M89.5 742V165.5H300.5V742" stroke="#040101" stroke-width="5" fill="none"/>
    <!-- le seuil -->
    <rect x="86" y="740" width="218" height="7" fill="#2a0d09"/><path d="M86 740.5H304" stroke="#8a3a2c" stroke-width=".7" opacity=".5"/>
    <!-- l'interrupteur de la lampe -->
    <rect x="329" y="444" width="22" height="34" rx="3" fill="#1a0807" stroke="#5c1a12" stroke-width=".6"/>
    <rect x="336.5" y="454" width="7" height="15" rx="1.2" fill="#2a0d09" stroke="#7a2a1d" stroke-width=".5"/>
    <rect x="-700" y="-400" width="1790" height="1644" fill="url(#po-grain-m)" opacity=".08"/>
    <rect x="-700" y="-400" width="1790" height="1644" fill="url(#po-vignette)"/>
    <rect class="po-nuit" x="-700" y="-400" width="1790" height="1644" fill="#030101" opacity="0"/>
  </g>
  <g class="po-voyant" opacity="0"><circle cx="340" cy="449" r="7" fill="#ff7a32" opacity=".4" filter="url(#po-flou)"/><circle cx="340" cy="449" r="1.8" fill="#ffae5c"/></g>
  <polygon class="po-flaque" points="0,0" fill="url(#po-flaque-g)" filter="url(#po-flou-sol)" opacity="0"/>
  <path class="po-bord" d="M298.6 168V742" stroke="#fff4e2" stroke-width="1.6" opacity="0"/>
  <ellipse class="po-lueur" cx="250" cy="455" rx="230" ry="360" fill="url(#po-lueur-g)" opacity="0"/>`;
  /* La paillasse du milieu de la pièce, plus proche : la même résine sombre que sous la planche-contact ; la planche y est posée,
     avec la pince en bambou et le crayon gras. En fin de marche, elle remplit le bas de l'image : le fondu passe d'une paillasse à l'autre. */
  P.sas.querySelector('.banc').innerHTML=`<defs>
    <linearGradient id="po-resine" x1="0" y1="500" x2="0" y2="575" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#55524c"/><stop offset="1" stop-color="#4a4742"/></linearGradient>
    <radialGradient id="po-resine-reflet" cx="195" cy="520" r="120" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fffaf0" stop-opacity=".1"/><stop offset="1" stop-color="#fffaf0" stop-opacity="0"/></radialGradient>
    <linearGradient id="po-face" x1="0" y1="576" x2="0" y2="700" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3b3935"/><stop offset="1" stop-color="#2c2a27"/></linearGradient>
    <linearGradient id="po-ombre-sol" x1="0" y1="700" x2="0" y2="716" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#5c574e" stop-opacity=".7"/><stop offset="1" stop-color="#5c574e" stop-opacity="0"/></linearGradient>
  </defs>
  <rect x="34" y="700" width="322" height="16" fill="url(#po-ombre-sol)"/>
  <rect x="40" y="576" width="310" height="124" fill="url(#po-face)"/>
  <path d="M118 580V696M195 580V696M272 580V696" stroke="#24221f" stroke-width="1.2"/>
  <path d="M110 596v16M126 596v16M187 596v16M203 596v16M264 596v16M280 596v16" stroke="#77736b" stroke-width="1.6" stroke-linecap="round"/>
  <polygon points="78,500 312,500 350,576 40,576" fill="url(#po-resine)"/>
  <polygon points="78,500 312,500 350,576 40,576" fill="url(#po-resine-reflet)"/>
  <path d="M40 576.5H350" stroke="#77736b" stroke-width="1.2"/><path d="M78 500.5H312" stroke="#3a3834" stroke-width=".8"/>
  <!-- la planche-contact, à plat sur la paillasse -->
  <polygon points="153,512 239,512 249,557 141,557" fill="#0f0e0d"/>
  <path d="M165 514L156.6 555M177.3 514L170.9 555M189.7 514L185.3 555M202 514L199.7 555M214.3 514L214 555M226.7 514L228.4 555" stroke="#2c2a27" stroke-width=".7"/>
  <path d="M153 512H239" stroke="#3a3632" stroke-width=".6"/>
  <!-- la pince en bambou et le crayon gras rouge -->
  <path d="M262 509L296 526M264 507L299 523" stroke="#c9a46a" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M98 567L139 560" stroke="#b52c1c" stroke-width="3.2" stroke-linecap="round"/><path d="M98 567l-4 .8" stroke="#7a170e" stroke-width="2.6" stroke-linecap="round"/>`;
  P.vue=P.sas.querySelector('.vue');P.cadre=P.sas.querySelector('.cadre');P.battant=P.sas.querySelector('.battant');
  P.mur=P.sas.querySelector('.mur');P.piece=P.sas.querySelector('.piece');P.banc=P.sas.querySelector('.banc');
  P.jour=P.sas.querySelector('.jour');P.ombre=P.sas.querySelector('.ombre');P.blanc=P.sas.querySelector('.blanc');
  const q=c=>P.sas.querySelector('.'+c);
  P.po={poignee:q('po-poignee'),nuit:q('po-nuit'),voyant:q('po-voyant'),flaque:q('po-flaque'),bord:q('po-bord'),lueur:q('po-lueur')};P.voile=P.sas.querySelector('.voile');
}
/* La porte couvre l'écran comme l'image du labo, mais sans grandir au-delà de ce qu'il faut pour la voir en entier.
   Le mur et la pièce claire ne sont dessinés que sur la largeur visible : des calques plus grands coûteraient cher au téléphone. */
function echelleSas(P){
  const r=stage.getBoundingClientRect(),s=Math.min(Math.max(r.width/390,r.height/844),r.height/720);
  P.cadre.style.transform='scale('+s.toFixed(4)+')';
  const d=Math.ceil(Math.max(195,r.width/s/2)+24),x0=195-d;
  const placer=(el,y0,h)=>{el.setAttribute('viewBox',x0+' '+y0+' '+2*d+' '+h);
    Object.assign(el.style,{left:x0+'px',top:y0+'px',width:2*d+'px',height:h+'px',transformOrigin:(PO.ox-x0)+'px '+(PO.oy-y0)+'px'});};
  placer(P.mur,-24,892);placer(P.piece,100,1220);placer(P.banc,380,700);
}
/* L'état de la porte : th (degrés), poignee (0 à 1), nuit (la lampe éteinte), voyant ;
   puis la marche : d (de combien l'œil a avancé vers la porte), bx, by (la tête qui se balance à chaque pas), marche (0 à 1) */
function porteEtat(P,e){
  const th=e.th||0,lum=lisse(clamp(th/45)),C=chant(th*Math.PI/180),po=P.po,d=e.d||0,f=PO.f;
  /* Chaque plan grandit selon sa distance : le mur et le chambranle, tout près, passent de chaque côté ;
     le battant ouvert défile à gauche ; la pièce claire, au fond, approche lentement */
  P.battant.style.transform=(d?'translateZ('+d.toFixed(2)+'px) ':'')+(th?'rotateY('+th.toFixed(3)+'deg)':'');
  P.mur.style.transform=d?'scale('+(f/(f-d)).toFixed(4)+')':'';
  P.piece.style.transform=d?'scale('+((f+PO.fond)/(f+PO.fond-d)).toFixed(4)+')':'';
  P.banc.style.transform=d?'scale('+((f+PO.banc)/(f+PO.banc-d)).toFixed(4)+')':'';
  P.vue.style.transform=(e.bx||e.by)?'translate('+(e.bx||0).toFixed(2)+'px,'+(e.by||0).toFixed(2)+'px)':'';
  po.poignee.setAttribute('transform','rotate('+(-28*(e.poignee||0)).toFixed(2)+' 179.5 298)');
  const n=(e.nuit||0)*(1-.35*lum);
  po.nuit.setAttribute('opacity',n.toFixed(3));P.ombre.style.opacity=(n*.9).toFixed(3);
  po.voyant.setAttribute('opacity',(e.voyant||0).toFixed(3));
  P.jour.style.opacity=(lum*.2).toFixed(3);
  /* La lumière de la pièce claire tombe sur le sol du labo, par l'ouverture entre le chant du battant et le chambranle */
  const S={x:205,y:560},Y=1010,J=PO.x+PO.l,B=PO.y+PO.h,k1=(Y-S.y)/(C.bas-S.y),k2=(Y-S.y)/(B-S.y);
  po.flaque.setAttribute('points',[C.x,C.bas,J,B,S.x+(J-S.x)*k2,Y,S.x+(C.x-S.x)*k1,Y].map(v=>v.toFixed(1)).join(' '));
  po.flaque.setAttribute('opacity',lum.toFixed(3));
  po.bord.setAttribute('opacity',(lum*.75).toFixed(3));
  po.lueur.setAttribute('cx',((C.x+J)/2).toFixed(1));po.lueur.setAttribute('opacity',(lum*.6).toFixed(3));
  /* Au sortir du noir, la pièce claire éblouit ; l'œil s'y fait à mesure que la porte s'ouvre et qu'on y entre */
  P.voile.style.opacity=Math.max(0,.9-.5*lum-.3*(e.marche||0)).toFixed(3);
}
/* Le geste « pousser la porte », seconde par seconde (accordé au son de la porte, qui démarre à 0,6 s) :
   l'interrupteur, la lampe qui s'éteint et le voyant qui s'allume ; la béquille qu'on abaisse ; le pêne qui se libère,
   la porte qui décolle de son joint, puis qui s'ouvre, lourde. Puis on marche : quatre pas jusqu'à la paillasse,
   à pas réguliers (cadence), la tête qui monte et se balance à chaque pas. Pendant les derniers pas, la planche-contact vient
   en fondu par-dessus la pièce claire (prepare : on la prépare, invisible, dès qu'on marche ; planche : début du fondu ;
   fondu : sa durée), et elle continue d'approcher un peu (approche), pour que le mouvement ne s'arrête pas pendant le fondu. */
const PORTE={nuit:.05,poignee:.55,pene:1.5,ouvre:2.2,ouvert:1.6,lache:2.05,marche:3.45,duree:2.75,cadence:.64,pas:4,avance:560,
  tete:7,balance:3.5,prepare:3.6,planche:5.3,fondu:1.6,approche:.955};
function porteTemps(t){
  if(reduit)return{th:t>.5?74:0,poignee:0,nuit:.7*clamp(t/.3),voyant:clamp(t/.3)};
  const T=PORTE,u=clamp((t-T.marche)/T.duree),av=(1-Math.cos(Math.PI*u))/2,vit=Math.sin(Math.PI*u),
    n=Math.max(0,t-T.marche)/T.cadence,phi=Math.PI*n;
  return{
    th:5*lisse(clamp((t-T.pene)/(T.ouvre-T.pene)))+69*lisse(clamp((t-T.ouvre)/T.ouvert)),
    poignee:t<T.lache?lisse(clamp((t-T.poignee)/.3)):1-lisse(clamp((t-T.lache)/.22)),
    nuit:.72*lisse(clamp((t-T.nuit)/.8)),
    voyant:lisse(clamp((t-.25)/.5)),
    d:T.avance*av,marche:av,pas:n,
    bx:T.balance*Math.sin(phi)*vit,
    by:T.tete*Math.abs(Math.sin(phi))*vit
  };
}

/* Le bouton « lever l'aiguille » couvre le tourne-disque dessiné dans l'image du labo (meuble, plateau, bras) */
function placerAiguille(P){
  try{
    const m=P.decor.getScreenCTM(),r=P.el.getBoundingClientRect();if(!m)return;
    const pt=(x,y)=>{const q=P.decor.createSVGPoint();q.x=x;q.y=y;return q.matrixTransform(m);},a=pt(236,476),b=pt(392,640);
    Object.assign(P.aiguille.style,{left:(a.x-r.left)+'px',top:(a.y-r.top)+'px',width:(b.x-a.x)+'px',height:(b.y-a.y)+'px'});
  }catch(_){}
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
    init(P){P.t=0;P.parti=false;P.cible=null;P.clic=false;P.tLampe=0;P.decor=P.el.querySelector('.labo');P.inter=P.el.querySelector('.interrupteur');
      P.inter.addEventListener('click',()=>{if(planches[cur]===P)allumer(P);});},
    enter(P,avant){P.t=0;P.parti=false;P.clic=false;P.tLampe=0;P.depart=Infinity;P.question=false;P.demande=false;decor(P);majPlatine();P.decor.style.opacity=0;P.decor.style.transform='';P.inter.classList.remove('visible','allume');if(avant==='sortie')SON.porte(true);},
    /* Toucher l'écran, comme toucher l'interrupteur, allume la lampe (une fois l'œil un peu habitué) */
    down(P){if(P.t>1)allumer(P);},
    tick(P,dt){
      P.t+=dt;
      if(P.t>SEUIL_VOYANT&&!P.clic)P.inter.classList.add('visible');
      /* L'œil s'habitue : on devine des formes ; la lampe montre le labo ; on s'approche de la cuvette */
      const avant=.07*lisse(clamp((P.t-.9)/4)),u=P.clic?P.t-P.tLampe:-1;
      /* Une fois la lampe allumée, on voit le tourne-disque : on propose un disque (sauf s'il tourne déjà, ou si l'on a dit non) */
      if(P.clic&&!P.demande&&u>1){
        P.demande=true;
        if(SON.ecoute()&&SON.platine.dispo()&&!SON.platine.etat().joue&&!refusDisque)poserQuestion(P);else P.depart=P.tLampe+SEUIL_REGARD;
      }
      if(P.question&&P.t-P.tLampe>14)repondre(P,false);
      const allume=P.clic?lisse(clamp(u/.35)):0,va=P.clic?lisse(clamp((P.t-P.depart)/SEUIL_APPROCHE)):0;
      P.decor.style.opacity=(Math.max(avant,allume)*(1-va)).toFixed(3);
      if(va>0&&!reduit)P.decor.style.transform='scale('+(1+.06*va).toFixed(4)+')';
      if(P.clic&&P.t>=P.depart+SEUIL_APPROCHE&&!P.parti){
        P.parti=true;const c=P.cible!=null?P.cible:cur+1;P.cible=null;montrer(c);
      }
    },
    lampe(P){return P.clic?AMBIANCE:0;},
    son(){return [1,0,.8];},
    consigne(P){if(P.clic)return '';if(P.t>SEUIL_ALLUMER)return 'Allumer la lampe';return P.t>.8&&P.t<SEUIL_OEIL?'Laisser l’œil s’habituer au noir':'';},
    up(P){}
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
      /* La feuille s'éclaire quand la lampe s'intensifie */
      if(PAPIER){const c=holding&&!P.dev?1:0;if(P.eclair!==c){P.eclair=c>P.eclair?Math.min(1,P.eclair+dt/1.2):Math.max(0,P.eclair-dt/1.2);sale=true;}}
      if(!P.dev){
        SON.developper(P.id,holding);
        if(holding){
          P.prog=Math.min(1,P.prog+dt/DEV_TEXTE);sale=true;
          if(P.prog>=1){P.dev=true;vus.texte=true;SON.finDev();if(P.apres.length)SON.platine.pause(true);}
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
    init(P){P.sas=P.el.querySelector('.sas');P.dehors=P.el.querySelector('.dehors');P.feuilleP=P.dehors.querySelector('.dehors-page');P.decor=P.el.querySelector('.labo');P.aiguille=P.el.querySelector('.aiguille');
      P.t=0;P.etape='dehors';P.direct=false;P.garder=false;P.rince=0;P.pas=0;P.vu=false;
      porteLabo(P);
      /* En sortant, on peut lever l'aiguille du disque : on touche le tourne-disque */
      P.aiguille.addEventListener('click',()=>{SON.debloquer();SON.platine.pause();majPlatine();P.aiguille.hidden=true;});
      P.dehors.addEventListener('scroll',()=>stage.classList.toggle('defile',P.dehors.scrollTop>24),{passive:true});},
    enter(P){
      fermerVis();construireGrille();P.dehors.scrollTop=0;stage.classList.remove('defile');P.garder=false;
      /* La porte revient fermée, la lampe allumée */
      Object.assign(P.dehors.style,{transition:'',visibility:'',opacity:'',willChange:''});Object.assign(P.feuilleP.style,{transition:'',transform:'',willChange:''});
      P.sas.style.transition='';P.sas.classList.remove('marche');P.prep=false;
      P.sas.style.opacity=0;P.sas.style.visibility='hidden';echelleSas(P);porteEtat(P,{});P.pas=0;P.vu=false;
      if(P.direct){P.direct=false;P.etape='dehors';P.decor.style.opacity=0;P.dehors.classList.add('visible');}
      else{P.etape='rincer';P.t=0;decor(P);P.decor.style.opacity=1;P.dehors.classList.remove('visible');}
      P.coule=false;P.decor.classList.remove('coule');
      placerAiguille(P);
    },
    /* Premier geste : ouvrir le robinet ; second geste : pousser la porte */
    down(P){
      if(P.etape==='rincer'){P.etape='rince';P.t=0;P.rince=SON.rincer()||1.2;}
      else if(P.etape==='porte'){P.etape='ouvre';P.t=0;P.pas=0;P.vu=false;P.prep=false;P.sas.style.opacity=1;P.decor.style.opacity=0;P.sas.classList.add('marche');SON.pousser();}
    },
    tick(P,dt){
      if(P.etape==='dehors')return;
      P.t+=dt;
      /* Tant qu'on voit le labo et que le disque tourne, on peut en lever l'aiguille */
      const montre=(P.etape==='rincer'||P.etape==='rince')&&SON.platine.etat().joue;
      if(P.aiguille.hidden===montre){P.aiguille.hidden=!montre;if(montre)placerAiguille(P);}
      /* Les tirages rincés, on se tourne vers la porte */
      /* Le robinet coule, accordé au son du rinçage (l'eau de 0,2 à 3 s) ; sans le son, un peu moins longtemps */
      const coule=P.etape==='rince'&&(P.rince>2?P.t>=.2&&P.t<3:P.t>=.1&&P.t<1);
      if(coule!==P.coule){P.coule=coule;P.decor.classList.toggle('coule',coule);}
      if(P.etape==='rince'&&P.t>=P.rince){P.etape='porte';P.t=0;P.sas.style.visibility='visible';}
      if(P.etape==='porte'){
        P.decor.style.opacity=(1-lisse(clamp(P.t/(reduit?.2:.7)))).toFixed(3);
        P.sas.style.opacity=lisse(clamp((P.t-(reduit?0:.25))/(reduit?.2:.9))).toFixed(3);
      }
      if(P.etape==='ouvre'){
        const e=porteTemps(P.t);porteEtat(P,e);
        /* Les pas : un à chaque fois que le pied se pose */
        const k=Math.floor(e.pas||0);if(k>P.pas&&k<=PORTE.pas){P.pas=k;SON.marcher(k,k===PORTE.pas);}
        /* La planche-contact, préparée tôt (mise en page et peinture faites pendant qu'on marche, pour que rien n'accroche
           pendant le fondu), vient par-dessus la pièce claire pendant les derniers pas ; la pièce reste entière dessous
           jusqu'à la fin du fondu (sinon l'image passerait par un creux sombre) ; la planche continue d'approcher. */
        const T=reduit?{prepare:.5,planche:.8,fondu:.8,approche:1}:PORTE,D=P.dehors;
        if(!P.prep&&P.t>=T.prepare){
          P.prep=true;echelle();
          Object.assign(D.style,{transition:'none',visibility:'visible',opacity:'.01',willChange:'opacity'});
          Object.assign(P.feuilleP.style,{transition:'none',transform:T.approche!==1?'scale('+T.approche+')':'',willChange:'transform'});
        }
        if(!P.vu&&P.t>=T.planche){
          P.vu=true;void D.offsetWidth;
          D.style.transition='opacity '+T.fondu+'s cubic-bezier(.4,0,.6,1)';D.style.opacity='1';D.classList.add('visible');
          P.feuilleP.style.transition='transform '+(T.fondu+.9)+'s cubic-bezier(.1,.55,.3,1)';P.feuilleP.style.transform='';
        }
        if(P.t>=T.planche+T.fondu+.05){
          P.etape='dehors';P.sas.style.visibility='hidden';P.sas.classList.remove('marche');
          /* Le fondu fini, la planche redevient une page ordinaire */
          setTimeout(()=>{if(P.etape!=='dehors')return;Object.assign(D.style,{transition:'',visibility:'',opacity:'',willChange:''});P.feuilleP.style.willChange='';},1200);
        }
      }
    },
    lampe(P){return P.etape==='rincer'||P.etape==='rince'||P.etape==='porte'||(P.etape==='ouvre'&&P.t<.1)?AMBIANCE:0;},
    son(P){return P.etape==='dehors'||(P.etape==='ouvre'&&P.t>PORTE.ouvre+.1)?[0,1,.9]:[1,0,.8];},
    /* Sur la paillasse, les gestes en consigne discrète (une fois chacun), effacée dès qu'on fait défiler */
    consigne(P){
      if(P.etape==='dehors'){
        if(vis.ouverte||P.dehors.scrollTop>24)return '';
        if(!vus.agrandi)return 'Toucher une vue pour l’agrandir';
        if(!vus.loupe)return 'Garder le doigt sur la planche pour le compte-fils';
        return '';
      }
      return P.etape==='rincer'?'Ouvrir le robinet pour rincer les tirages':P.etape==='porte'?'Pousser la porte':'';
    },
    glisse(P,dx){if(vis.ouverte)visNav(dx<0?1:-1);}
  }
};

/* Le tourne-disque. On le voit dans le labo, au seuil ; on y propose un disque. Ensuite, dans le labo,
   une note de musique, à côté de « sortir », ouvre ses commandes : jouer ou mettre en pause, changer de morceau, l'autre face. */
const noteEl=$('note'),panPl=$('platine-commandes'),questionEl=$('question-disque');
let plOuvert=false,plMinuterie=0,refusDisque=false;
function majPlatine(){
  const e=SON.platine.etat();
  noteEl.classList.toggle('joue',!!e.joue);
  document.querySelectorAll('svg.labo').forEach(sv=>sv.classList.toggle('joue',!!e.joue));
  if(!plOuvert)return;
  $('pl-piste').textContent=e.fin?e.faceTitre+' : la face est finie':(e.joue||e.arret)?e.faceTitre+' · '+(e.piste+1)+'. '+e.titre+' — '+e.auteur:'';
  $('pl-lire').hidden=!!e.joue;$('pl-lire').textContent=e.arret?'reprendre':'jouer le disque';
  $('pl-pause').hidden=!e.joue;
}
function garderPl(){clearTimeout(plMinuterie);plMinuterie=setTimeout(fermerPl,9000);}
function ouvrirPl(){if(!SON.platine.pret())return;plOuvert=true;panPl.hidden=false;majPlatine();garderPl();}
function fermerPl(){plOuvert=false;panPl.hidden=true;clearTimeout(plMinuterie);}
noteEl.addEventListener('click',()=>{plOuvert?fermerPl():ouvrirPl();});
function geste(f){return()=>{SON.debloquer();f();majPlatine();garderPl();};}
$('pl-lire').addEventListener('click',geste(()=>SON.platine.lire()));
$('pl-pause').addEventListener('click',geste(()=>SON.platine.pause()));
$('pl-suiv').addEventListener('click',geste(()=>SON.platine.suivante()));
$('pl-face').addEventListener('click',geste(()=>SON.platine.autreFace()));
/* La question, au seuil, une fois la lampe allumée */
function poserQuestion(P){P.question=true;P.depart=Infinity;questionEl.hidden=false;}
function repondre(P,oui){
  if(!P.question)return;
  P.question=false;questionEl.hidden=true;
  if(oui){SON.debloquer();SON.platine.lire();majPlatine();}else refusDisque=true;
  P.depart=P.t+(oui?4.6:.5);
}
$('qd-oui').addEventListener('click',()=>{const P=planches[cur];if(P.kind==='seuil')repondre(P,true);});
$('qd-non').addEventListener('click',()=>{const P=planches[cur];if(P.kind==='seuil')repondre(P,false);});

/* Le lecteur allume la lampe rouge du labo */
function allumer(P){
  if(P.clic)return;
  P.clic=true;P.tLampe=P.t;SON.interrupteur(true);P.inter.classList.add('allume');
}
/* Sortir à tout moment : on garde la planche où l'on était, pour y revenir */
function sortirMaintenant(){const s=planches.length-1;planches[s].garder=true;montrer(s);}

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
  SON.calme();fermerPl();questionEl.hidden=true;
  if(A.kind==='dessin'&&n!==cur)liberer(A);
  cur=n;const P=planches[cur];P.el.classList.add('active');stage.dataset.kind=P.kind;
  /* En venant du seuil, la cuvette sort lentement du noir */
  P.el.classList.remove('arrivee');if(avant==='seuil'&&!reduit){void P.el.offsetWidth;P.el.classList.add('arrivee');}
  prevoir(cur);
  /* La planche où l'on s'arrête est gardée ; sortir par la porte au bout du livre l'oublie */
  if(estTirage(P))sauverPos(P.id);else if(P.kind==='sortie'&&!P.direct&&!P.garder)sauverPos(null);
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
  if(e.target.closest('button,#platine-commandes,#question-disque'))return;
  if(plOuvert){fermerPl();return;}
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
$('sortir').addEventListener('click',sortirMaintenant);
btnP.addEventListener('click',precedent);
revoir.addEventListener('click',()=>{const s=planches.length-1;planches[s].direct=true;montrer(s);});
$('rentrer').addEventListener('click',()=>rentrer());
/* Les crédits, rangés : quand on les ouvre, on les fait venir à l'écran */
$('credits').addEventListener('toggle',e=>{const d=e.currentTarget;if(d.open)setTimeout(()=>d.scrollIntoView({block:'start',behavior:reduit?'auto':'smooth'}),30);});
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
  tailleCommune();planches.forEach(Q=>{Q.ajuste=null;});
  const P=planches[cur];
  if(P.kind==='dessin')taille(P);
  if(P.kind==='texte'){P.ajuste=null;ajuster(P);}
  if(P.kind==='sortie'){echelle();echelleSas(P);placerAiguille(P);}
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
tailleCommune();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{tailleCommune();planches.forEach(P=>{P.ajuste=null;});const P=planches[cur];if(P.kind==='texte')ajuster(P);});

let tPrec=performance.now(),dernier=null,lampeV=-1,tourPl=0;
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
  if((++tourPl)%20===0)majPlatine();
  const c=U.consigne?U.consigne(Q):'';
  const jour=Q.kind==='sortie'&&Q.etape==='dehors';consigne.classList.toggle('jour',jour);
  /* Petit écran : la consigne passerait sur les liens ; un voile de paillasse la détache */
  consigne.classList.toggle('voile',jour&&!!c&&$('credits').getBoundingClientRect().bottom>innerHeight-100);
  if(c!==dernier){dernier=c;if(c){consigne.textContent=c;consigne.style.opacity=1;}else consigne.style.opacity=0;}
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
try{stage.focus({preventScroll:true});}catch(_){}

/* Le livre gardé sur le téléphone, pour le lire sans réseau ; puis, en arrière-plan, le disque */
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
  addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').then(()=>navigator.serviceWorker.ready).then(reg=>{
      setTimeout(()=>{try{if(reg.active)reg.active.postMessage('musique');}catch(_){}},4000);
    }).catch(()=>{});
  });
}
})();
