# Télécharge les enregistrements bruts (jeu de données Hugging Face benjamin-paine/freesound-laion-640k)
# d'après donnees/sons-emplacements.json, et les convertit en FLAC 48 kHz dans brut/<id>.flac
from huggingface_hub import HfFileSystem
import pyarrow.parquet as pq, json, subprocess, os, sys
from concurrent.futures import ThreadPoolExecutor
R='benjamin-paine/freesound-laion-640k'
dest=sys.argv[1] if len(sys.argv)>1 else 'brut'
os.makedirs(dest,exist_ok=True)
emp=json.load(open(os.path.join(os.path.dirname(__file__),'..','donnees','sons-emplacements.json')))
fs=HfFileSystem()
def un(e):
    sortie=f"{dest}/{e['id']}.flac"
    if os.path.exists(sortie):return e['id'],'déjà là'
    with fs.open(f"datasets/{R}/{e['file']}",'rb',block_size=8*1024*1024) as f:
        t=pq.ParquetFile(f).read_row_group(e['rg'],columns=['audio','freesound_id','title','username']).to_pylist()
    ligne=[x for x in t if x['freesound_id']==e['id']][0]
    b=ligne['audio']['bytes'];ext=os.path.splitext(ligne['audio']['path'] or '')[1] or '.bin'
    tmp=f"{dest}/{e['id']}.orig{ext}";open(tmp,'wb').write(b)
    subprocess.run(['ffmpeg','-loglevel','error','-y','-i',tmp,'-ar','48000','-c:a','flac',sortie],check=True)
    os.remove(tmp)
    return e['id'],f"{ligne['title']} — {ligne['username']} ({ext}, {len(b)//1024} Ko)"
with ThreadPoolExecutor(4) as ex:
    for i,m in ex.map(un,emp):print(i,m,flush=True)
