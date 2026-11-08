# Extrait les 19 poèmes du PDF : numéro, strophes, vers ; le silence de XVII ; XIV sur deux pages.
# Usage : python3 outils/poemes.py "CHAMBRE NOIRE.pdf"   ->  donnees/poemes.json
import pymupdf, json, unicodedata, sys
doc=pymupdf.open(sys.argv[1])
PAGES={'i':[7],'ii':[9],'iii':[11],'iv':[15],'v':[19],'vi':[21],'vii':[23],'viii':[25],'ix':[27],'x':[29],'xi':[31],'xii':[33],'xiii':[35],'xiv':[37,38],'xv':[41],'xvi':[43],'xvii':[45],'xviii':[47],'xix':[49]}
out=[]
for pid,pages in PAGES.items():
    num=None;feuillets=[]
    for pn in pages:
        strophes=[];prev=None;prevsize=None
        for b in doc[pn-1].get_text('dict')['blocks']:
            for l in b.get('lines',[]):
                sp=l['spans'];t=''.join(s['text'] for s in sp);f=sp[0]['font'];sz=sp[0]['size'];y=l['bbox'][1]
                if 'Bold' in f:num=t;continue
                if sz<9:continue  # folio
                assert abs(l['bbox'][0]-62.4)<.5,(pid,t)
                gap=None if prev is None else y-prev
                lead=sz*1.8
                if gap is None or gap>lead*1.3:
                    strophes.append({'vers':[],'silence':bool(gap and gap>lead*3)})
                strophes[-1]['vers'].append(t);prev=y
        feuillets.append(strophes)
    out.append({'id':pid,'num':num,'feuillets':feuillets})
json.dump(out,open('donnees/poemes.json','w'),ensure_ascii=False,indent=1)
# Contrôles
n=0;chars=set()
for p in out:
    for f in p['feuillets']:
        for s in f:
            n+=len(s['vers'])
            for v in s['vers']:chars|=set(v)
    print(p['num'],[[len(s['vers'])for s in f] for f in p['feuillets']],[i for f in p['feuillets'] for i,s in enumerate(f) if s['silence']])
print('vers',n)
print('caractères non ASCII',sorted((c,unicodedata.name(c,'?')) for c in chars if ord(c)>127 and not c.isalpha()))
