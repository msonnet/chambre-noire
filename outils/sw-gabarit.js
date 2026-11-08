/* Chambre noire hors ligne : tout le livre est gardé sur le téléphone.
   Fichier produit par outils/construire.py ; la version change dès qu'un fichier du livre change. */
const VERSION='chambre-noire-/*VERSION*/';
const FICHIERS=[
  /*FICHIERS*/
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FICHIERS.map(f=>new Request(f,{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('chambre-noire-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
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
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  if(r.mode==='navigate'){e.respondWith(reseauDabord(r,'./'));return;}
  if(/\.(js|css|json|webmanifest)$/.test(u.pathname)){e.respondWith(reseauDabord(r));return;}
  /* Images, sons, polices : la copie gardée, sinon le réseau */
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(m=>m||fetch(r)));
});
