"""Découpe et règle les vrais enregistrements (Freesound, licences libres) pour le livre.
Usage : python3 outils/prep_sons.py <dossier brut> <dossier de sortie>
  brut/<id>.flac (48 kHz, voir outils/telecharger_sons.py)  ->  <sortie>/<nom>.mp3 + meta.json (segments [début, durée])."""
import soundfile as sf, numpy as np, subprocess, json, os, sys, tempfile
BRUT = sys.argv[1] if len(sys.argv) > 1 else 'brut'
SORTIE = sys.argv[2] if len(sys.argv) > 2 else 'public/sons'
os.makedirs(SORTIE, exist_ok=True)
SR=48000
def lire(fid):
    x,sr=sf.read(f'{BRUT}/{fid}.flac');assert sr==SR;return x if x.ndim==1 else x.mean(1)
def fondu(x,a=.01,b=.05):
    x=x.copy();na,nb=int(a*SR),int(b*SR)
    if na:x[:na]*=np.linspace(0,1,na)
    if nb:x[-nb:]*=np.linspace(1,0,nb)
    return x
def couper(x,t0,t1,a=.01,b=.05):return fondu(x[int(t0*SR):int(t1*SR)],a,b)
def rms_db(x):return 10*np.log10(np.mean(x**2)+1e-12)
def regler(x,rms=None,crete=-3):
    lim=10**(crete/20)
    if rms is None:return x*lim/np.abs(x).max()
    x=x*10**((rms-rms_db(x))/20);pk=np.abs(x).max()
    if pk>lim:x=x*lim/pk
    return x
def sprite(segs,pad=.03,gap=.25):
    out=[];pos=[];t=0
    for s in segs:
        p=np.zeros(int(pad*SR));g=np.zeros(int(gap*SR))
        pos.append([round(t,4),round(pad+len(s)/SR+.02,4)])
        out+= [p,s,g];t+= pad+len(s)/SR+gap
    return np.concatenate(out),pos
A={}
# 1. Pas dans le couloir (colo777, CC0) : l'approche, puis deux pas plus doux pour entrer
x=lire('251435')
approche=regler(couper(x,1.75,7.35,.35,.3),crete=-3)
dedans=[regler(couper(x,t-.03,t+.5,.005,.12),crete=-6) for t in (4.12,4.78)]
s,pos=sprite([approche]+dedans);A['pas']=(s,pos,96)
# 2. Coups frappés (carroll27, CC0) : cinq coups séparés
x=lire('151894')
coups=[regler(couper(x,t-.012,t+.34,.002,.04),crete=-2) for t in (.43,.79,1.14,1.5,1.86)]
s,pos=sprite(coups);A['coups']=(s,pos,112)
# 3. Portes (LampEight, Kinoton, CC0)
x=lire('402464');k=10**(-3/20)/np.abs(x[:int(6.85*SR)]).max()
entree=fondu(x[:int(6.85*SR)]*k,.005,.25)
sortie=couper(x*k,0,4.7,.005,.7)
x=lire('352439');rentrer=regler(couper(x,0,2.65,.005,.3),crete=-3)
s,pos=sprite([entree,sortie,rentrer]);A['portes']=(s,pos,112)
# 4. Interrupteur (toddcircle, CC0)
x=lire('442355')
s,pos=sprite([regler(couper(x,t-.015,t+.3,.002,.05),crete=-3) for t in (.05,1.03)]);A['interrupteur']=(s,pos,112)
# 5. Ventilation (silencyo, CC BY 3.0)
x=lire('148882');v=regler(couper(x,2,62,.5,.5),crete=-1)
A['ventilation']=(v,[[0,round(len(v)/SR,3)]],64)
# 6. Gouttes dans l'évier (odilonmarcenar, CC0)
x=lire('121546')
g=[regler(couper(x,t-.015,t+.9,.002,.3),crete=-3) for t in (.25,2.69,5.21,7.84,10.49,13.31,16.14,21.87,24.66,27.32)]
s,pos=sprite(g);A['gouttes']=(s,pos,96)
# 7. Le bain : mouvements d'eau lents (Nox_Sound, CC0) et clapots dans un plat peu profond (haulaway, CC0)
x=lire('576593')
segN=[(24.8,26.34),(27.48,29.82),(30.82,32.46),(33.28,35.72),(36.6,38.5),(39.14,41.58),(42.46,44.74),(45.82,48.34),(48.94,51.42),(52.16,54.54),(55.8,57.62),(58.24,60.34),(61.32,63.36),(64.2,66.06),(66.78,69.08),(69.86,72.44),(73.22,75.54),(76.2,78.16)]
b=[regler(couper(x,a-.05,c+.15,.04,.25),rms=-24,crete=-4) for a,c in segN]
x=lire('434193')
segH=[(1.46,2.12),(2.76,3.72),(4.74,5.74),(8.62,10.74),(28.42,29.18),(30.54,31.46)]
b+=[regler(couper(x,a-.05,c+.25,.03,.25),rms=-24,crete=-4) for a,c in segH]
s,pos=sprite(b);A['bain']=(s,pos,80)
# 8. Dehors : le vent dans un peuplier (felix.blume) — retiré le 9 nov. 2026 (Nathan : on l'entendait comme de la pluie sur la planche-contact)
# 9. Le sténopé : un vrai obturateur d'appareil argentique, ouvert 1/4 s (cabled_mess, CC0)
s,pos=sprite([regler(couper(lire(f),0,.7,.001,.12),crete=-3) for f in ('338220','338219')]);A['obturateur']=(s,pos,112)
# 10. Le papier qu'on sort et qu'on glisse dans le bain (matieke, Pipelenisf, leonseptavaux, CC0)
x=lire('462556');p=[regler(couper(x,a-.03,c+.12,.03,.15),rms=-28,crete=-6) for a,c in [(3.41,5.01),(5.13,5.75),(6.55,7.43),(8.39,9.9)]]
x=lire('560352');p+=[regler(couper(x,a,c,.03,.15),rms=-28,crete=-6) for a,c in [(.3,1.5),(1.5,2.8)]]
x=lire('346466');p+=[regler(couper(x,a-.03,c+.1,.03,.15),rms=-28,crete=-6) for a,c in [(2.54,3.44),(5.91,6.71),(10.89,12.01)]]
s,pos=sprite(p);A['papier']=(s,pos,96)
# 11. Le séchage : une pince à linge en bois (ValentinPetite, CC0)
x=lire('624484')
s,pos=sprite([regler(couper(x,t-.04,t+.4,.005,.1),crete=-3) for t in (.76,1.435,2.14,2.695)]);A['pince']=(s,pos,112)
# 12. Le rinçage : le robinet qu'on ouvre puis qu'on referme (Joao_Janz, CC0), raccourci par un fondu enchaîné
x=lire('473712');a=x[int(.1*SR):int(2.85*SR)].copy();b=x[int(4.6*SR):int(6.6*SR)].copy();F=int(.25*SR)
a[-F:]*=np.linspace(1,0,F);b[:F]*=np.linspace(0,1,F)
r=np.concatenate([a[:-F],a[-F:]+b[:F],b[F:]]);r=regler(fondu(r,.01,.4),crete=-3)
A['rincage']=(r,[[0,round(len(r)/SR,3)]],96)
# 13. La planche-contact : des feuilles qu'on prend en main (leonseptavaux, CC0)
x=lire('346466')
f=[regler(couper(x,a-.02,c+.08,.02,.1),rms=-28,crete=-6) for a,c in [(.62,1.15),(3.62,4.19),(4.62,4.85),(5.04,5.31),(5.44,5.74),(9.19,9.66),(9.8,10.19),(12.16,12.77)]]
s,pos=sprite(f);A['feuilles']=(s,pos,96)
# 14. Le tourne-disque : l'aiguille posée (Breviceps, Stratocube, CC0), puis relevée (thaighaudio, CC0)
x=lire('556722');pose1=regler(couper(x,.04,2.2,.003,.6),crete=-6)
x=lire('456281');pose2=regler(couper(x,0,.95,.002,.3),crete=-6)
x=lire('350309');leve1=regler(couper(x,1.68,2.02,.002,.08),crete=-8);leve2=regler(couper(x,2.68,3.02,.002,.08),crete=-8)
s,pos=sprite([pose1,pose2,leve1,leve2]);A['platine']=(s,pos,112)
# 15. Les craquements du disque (nervousneal, CC0) et le dernier sillon (Groschi, CC0), en boucle
x=lire('500975');c=regler(couper(x,.5,18,.3,.3),rms=-34,crete=-8);A['craquement']=(c,[[0,round(len(c)/SR,3)]],64)
x=lire('423893');r=regler(couper(x,.2,11.3,.2,.2),rms=-34,crete=-6);A['sillon']=(r,[[0,round(len(r)/SR,3)]],64)
# 16. La vie du bâtiment, très rare : un plancher qui craque à l'étage (Joao_Janz, Greg_Surr), un radiateur (willungawillun), l'eau dans un tuyau (kyles), tous CC0
b=[regler(lire(f),crete=-6) for f in ('504094','504130','504081')]
b.append(regler(couper(lire('590157'),.2,1.65,.01,.2),crete=-6))
x=lire('122000');b+=[regler(couper(x,a,c,.003,.15),crete=-6) for a,c in ((.6,1.15),(2.3,3.05),(7.4,8.0))]
x=lire('451937');b.append(regler(couper(x,10,19,1.2,2),rms=-30,crete=-8))
s,pos=sprite([fondu(v,.005,.08) for v in b]);A['batiment']=(s,pos,80)
# 17. La pince qui tape le bord de la cuvette (DJ_SoMaR, TiidWunduniik, CC0)
x=lire('531195');p=[regler(couper(x,max(0,t-.02),t+.22,.002,.08),crete=-6) for t in (0,.65,1.25,1.9)]
x=lire('489530');p.append(regler(couper(x,.48,.85,.002,.1),crete=-6))
s,pos=sprite(p);A['pincettes']=(s,pos,96)
meta={};total=0
with tempfile.TemporaryDirectory() as tmp:
    for k,(sig,pos,kbps) in A.items():
        sf.write(f'{tmp}/{k}.wav',sig.astype(np.float32),SR)
        subprocess.run(['ffmpeg','-loglevel','error','-y','-i',f'{tmp}/{k}.wav','-ac','1','-ar','48000','-c:a','libmp3lame','-b:a',f'{kbps}k',f'{SORTIE}/{k}.mp3'],check=True)
        n=os.path.getsize(f'{SORTIE}/{k}.mp3');total+=n
        meta[k]={'segs':pos,'duree':round(len(sig)/SR,2)}
        print(f'{k:13} {len(pos):2} segments {len(sig)/SR:6.1f} s  {n//1024:4} Ko  rms {rms_db(sig):6.1f} dB  crête {20*np.log10(np.abs(sig).max()):5.1f} dB')
print('total',total//1024,'Ko')
json.dump(meta,open(f'{SORTIE}/meta.json','w'))
