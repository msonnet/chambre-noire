# Dessins : masque (smask) comme canal alpha d'une image blanche, sans recadrage, 1200 px de haut.
# Couverture : gravure en négatif sur fond 18/255 ; alpha = (luminance-18)/237, recadrée, 900 px de large.
# Usage : python3 outils/images.py <dossier des images extraites>
#   (avant : pdfimages -png -f 1 -l 1 PDF <dossier>/cov  puis, pour chaque page p de dessin, pdfimages -png -f p -l p PDF <dossier>/p<p>)
from PIL import Image
import numpy as np, os, sys
E=sys.argv[1];S='public/img'
PAGES=[8,10,12,13,16,17,20,22,24,26,28,30,32,34,36,39,40,42,44,48,51]
tot=0
for p in PAGES:
    rgb=np.asarray(Image.open(f'{E}/p{p}-000.png').convert('RGB'))
    assert rgb.min()>=250, (p,rgb.min())  # le dessin est blanc
    m=Image.open(f'{E}/p{p}-001.png').convert('L')
    h=1200;w=round(m.width*h/m.height)
    m=m.resize((w,h),Image.LANCZOS)
    a=np.asarray(m)
    Image.fromarray(np.dstack([np.full((h,w,3),255,np.uint8),a]),'RGBA').save(f'{S}/d{p:02d}.webp',lossless=True,quality=100,method=6)
    s2=os.path.getsize(f'{S}/d{p:02d}.webp');tot+=s2
    print(p,w,h,s2//1024,'Ko webp')
    v=Image.open(f'{S}/d{p:02d}.webp');vh=360;vw=round(v.width*vh/v.height)
    v.resize((vw,vh),Image.LANCZOS).save(f'{S}/vignettes/d{p:02d}.webp',quality=82,alpha_quality=80,method=6)
c=np.asarray(Image.open(f'{E}/cov-000.png').convert('L')).astype(float)
print('fond couverture',np.median(c))
al=np.clip((c-18)/237,0,1)
ys,xs=np.where(al>.06);y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
al=al[y0:y1,x0:x1];im=Image.fromarray((al*255).round().astype(np.uint8),'L')
w=900;h=round(im.height*w/im.width);im=im.resize((w,h),Image.LANCZOS);a=np.asarray(im)
Image.fromarray(np.dstack([np.full((a.shape[0],a.shape[1],3),255,np.uint8),a]),'RGBA').save(f'{S}/couverture.webp',lossless=True,method=6)
print('couverture',w,h,os.path.getsize(f'{S}/couverture.webp')//1024,'Ko')
print('total dessins',tot//1024,'Ko')

# La texture du papier (feuilles des poèmes, agrandissements, planche-contact) : un grain fin, une marbrure douce et
# quelques fibres, qui se raccorde sans couture ; appliquée en « multiplier » sur la couleur du papier.
def texture_papier(sortie='public/img/papier.webp', N=256, graine=7):
    rng = np.random.default_rng(graine)
    def bruit(pente):
        f = np.fft.fftfreq(N); fx, fy = np.meshgrid(f, f); r = np.sqrt(fx**2 + fy**2); r[0, 0] = 1
        spec = (rng.normal(size=(N, N)) + 1j * rng.normal(size=(N, N))) / r**pente; spec[0, 0] = 0
        x = np.real(np.fft.ifft2(spec)); return (x - x.mean()) / x.std()
    grain, nuage = bruit(.35), bruit(1.6)
    fib = np.zeros((N, N))
    for _ in range(260):
        x0, y0 = rng.uniform(0, N, 2); a = rng.uniform(0, np.pi); L = rng.uniform(6, 22); v = rng.choice([-1, 1]) * rng.uniform(.4, 1)
        for t in np.linspace(0, L, int(L * 2)):
            fib[int(y0 + t * np.sin(a)) % N, int(x0 + t * np.cos(a)) % N] += v
    img = np.clip(1 - .024 * grain - .015 * nuage - .02 * fib, .9, 1.0)
    Image.fromarray((img * 255).round().astype(np.uint8), 'L').save(sortie, quality=86, method=6)
