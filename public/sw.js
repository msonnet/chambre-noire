/* Chambre noire hors ligne : tout le livre est gardé sur le téléphone.
   Fichier produit par outils/construire.py ; la version change dès qu'un fichier du livre change. */
const VERSION='chambre-noire-03c8ad7351';
const FICHIERS=[
  "icones/apple-touch-icon.png",
  "icones/icone-192.png",
  "icones/icone-512.png",
  "img/couverture.webp",
  "img/d08.webp",
  "img/d10.webp",
  "img/d12.webp",
  "img/d13.webp",
  "img/d16.webp",
  "img/d17.webp",
  "img/d20.webp",
  "img/d22.webp",
  "img/d24.webp",
  "img/d26.webp",
  "img/d28.webp",
  "img/d30.webp",
  "img/d32.webp",
  "img/d34.webp",
  "img/d36.webp",
  "img/d39.webp",
  "img/d40.webp",
  "img/d42.webp",
  "img/d44.webp",
  "img/d48.webp",
  "img/d51.webp",
  "img/vignettes/d08.webp",
  "img/vignettes/d10.webp",
  "img/vignettes/d12.webp",
  "img/vignettes/d13.webp",
  "img/vignettes/d16.webp",
  "img/vignettes/d17.webp",
  "img/vignettes/d20.webp",
  "img/vignettes/d22.webp",
  "img/vignettes/d24.webp",
  "img/vignettes/d26.webp",
  "img/vignettes/d28.webp",
  "img/vignettes/d30.webp",
  "img/vignettes/d32.webp",
  "img/vignettes/d34.webp",
  "img/vignettes/d36.webp",
  "img/vignettes/d39.webp",
  "img/vignettes/d40.webp",
  "img/vignettes/d42.webp",
  "img/vignettes/d44.webp",
  "img/vignettes/d48.webp",
  "img/vignettes/d51.webp",
  "./",
  "livre.js",
  "manifest.webmanifest",
  "musique/disques.json",
  "polices/lora-latin-400-italic.woff2",
  "polices/lora-latin-400-normal.woff2",
  "polices/lora-latin-600-normal.woff2",
  "sons/bain.mp3",
  "sons/batiment.mp3",
  "sons/coups.mp3",
  "sons/craquement.mp3",
  "sons/dehors.mp3",
  "sons/feuilles.mp3",
  "sons/gouttes.mp3",
  "sons/interrupteur.mp3",
  "sons/meta.json",
  "sons/obturateur.mp3",
  "sons/papier.mp3",
  "sons/pas.mp3",
  "sons/pince.mp3",
  "sons/pincettes.mp3",
  "sons/platine.mp3",
  "sons/portes.mp3",
  "sons/rincage.mp3",
  "sons/sillon.mp3",
  "sons/ventilation.mp3",
  "style.css"
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
