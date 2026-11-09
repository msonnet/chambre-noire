/* Chambre noire hors ligne : tout le livre est gardé sur le téléphone, le disque aussi.
   Fichier produit par outils/construire.py ; la version change dès qu'un fichier du livre change.
   Le disque (25 Mo) a son propre cache, qui ne change que si la musique change : il est téléchargé en arrière-plan,
   une fois le livre gardé, à la demande de la page. */
const VERSION='chambre-noire-/*VERSION*/';
const MUSIQUE='chambre-noire-musique-/*MVERSION*/';
const FICHIERS=[
  /*FICHIERS*/
];
const MORCEAUX=[
  /*MORCEAUX*/
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FICHIERS.map(f=>new Request(f,{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('chambre-noire-')&&k!==VERSION&&k!==MUSIQUE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
/* Garder le disque, morceau par morceau (si le téléphone interrompt, la page relance à la visite suivante) */
let enCours=null;
async function garderMusique(){
  const c=await caches.open(MUSIQUE);
  for(const f of MORCEAUX){
    if(await c.match(f))continue;
    try{const r=await fetch(f,{cache:'no-store'});if(r.ok&&r.status===200)await c.put(f,r);}catch(_){return;}
  }
}
self.addEventListener('message',e=>{
  if(e.data==='musique'){if(!enCours)enCours=garderMusique().finally(()=>{enCours=null;});e.waitUntil(enCours);}
});
/* La page et le code : d'abord le réseau (pour recevoir les corrections), la copie gardée si le réseau manque ou tarde */
function reseauDabord(r,cle){
  return new Promise(ok=>{
    let fini=false;
    const copie=()=>caches.match(cle||r,{ignoreSearch:true});
    const t=setTimeout(()=>copie().then(m=>{if(m&&!fini){fini=true;ok(m);}}),3000);
    fetch(r).then(rep=>{
      clearTimeout(t);
      if(rep.ok){const c=rep.clone();caches.open(VERSION).then(k=>k.put(cle||r,c));}
      if(!fini){fini=true;ok(rep);}
    }).catch(()=>{clearTimeout(t);copie().then(m=>{if(!fini){fini=true;ok(m||Response.error());}});});
  });
}
/* Le disque : la copie gardée (avec les demandes partielles que font les lecteurs audio), sinon le réseau, qu'on garde au passage */
async function morceau(r){
  const m=await caches.match(r.url,{ignoreSearch:true});
  const plage=r.headers.get('range');
  if(!m){
    if(plage)return fetch(r);
    const rep=await fetch(r);
    if(rep.ok&&rep.status===200){const c=rep.clone();caches.open(MUSIQUE).then(k=>k.put(new URL(r.url).pathname,c));}
    return rep;
  }
  if(!plage)return m;
  const b=await m.arrayBuffer(),n=b.byteLength,x=/bytes=(\d*)-(\d*)/.exec(plage)||[];
  let debut=x[1]?+x[1]:0,fin=x[2]?+x[2]:n-1;
  if(!x[1]&&x[2]){debut=Math.max(0,n-(+x[2]));fin=n-1;}
  fin=Math.min(fin,n-1);
  if(debut>fin||debut>=n)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+n}});
  return new Response(b.slice(debut,fin+1),{status:206,headers:{'Content-Type':'audio/mpeg','Content-Range':'bytes '+debut+'-'+fin+'/'+n,'Content-Length':String(fin-debut+1),'Accept-Ranges':'bytes'}});
}
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  if(r.mode==='navigate'){e.respondWith(reseauDabord(r,'./'));return;}
  if(/\/musique\/.+\.mp3$/.test(u.pathname)){e.respondWith(morceau(r));return;}
  if(/\.(js|css|json|webmanifest)$/.test(u.pathname)){e.respondWith(reseauDabord(r));return;}
  /* Images, sons, polices : la copie gardée, sinon le réseau */
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(m=>m||fetch(r)));
});
