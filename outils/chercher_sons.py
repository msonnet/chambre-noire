# Trouve dans quel fichier / groupe de lignes se trouve chaque son Freesound voulu
from huggingface_hub import HfFileSystem, HfApi
import pyarrow.parquet as pq, json, sys
from concurrent.futures import ThreadPoolExecutor
IDS={338220,338219,251435,151894,402464,352439,442355,148882,121546,576593,434193,462556,560352,346466,624484,473712,167434}
R='benjamin-paine/freesound-laion-640k'
files=[f for f in HfApi().list_repo_files(R,repo_type='dataset') if f.endswith('.parquet')]
fs=HfFileSystem()
def scan(name):
    for essai in range(3):
        try:
            with fs.open(f'datasets/{R}/{name}','rb',block_size=256*1024) as f:
                m=pq.ParquetFile(f);out=[]
                for g in range(m.metadata.num_row_groups):
                    ids=m.read_row_group(g,columns=['freesound_id','license']).to_pydict()
                    for k,(i,l) in enumerate(zip(ids['freesound_id'],ids['license'])):
                        if i in IDS:out.append({'id':i,'file':name,'rg':g,'row':k,'license':l})
                return out
        except Exception as e:err=e
    return [{'erreur':str(err),'file':name}]
res=[]
with ThreadPoolExecutor(12) as ex:
    for n,r in enumerate(ex.map(scan,files)):
        res+=r
        if n%100==0:print(n,len(res),flush=True)
json.dump(res,open('donnees/sons-emplacements.json','w'),indent=1)
print('trouvés',sorted({r['id'] for r in res if 'id' in r}))
print('manquants',sorted(IDS-{r['id'] for r in res if 'id' in r}))
print('erreurs',[r for r in res if 'erreur' in r][:5])
