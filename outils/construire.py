"""Construit public/index.html à partir de donnees/poemes.json, dans l'ordre du recueil.
Usage : python3 outils/construire.py   (depuis la racine du dépôt)
Puis met à jour la liste des fichiers mis en cache hors ligne (public/sw.js)."""
import json, html, re, hashlib, os, pathlib

RACINE = pathlib.Path(__file__).resolve().parent.parent
PUB = RACINE / 'public'

# L'ordre du livre (pages du PDF) : poèmes et dessins (dNN = dessin de la page NN)
ORDRE = ['epi', 'i', 'd08', 'ii', 'd10', 'iii', 'd12', 'd13', 'iv', 'd16', 'd17', 'v', 'd20', 'vi', 'd22',
         'vii', 'd24', 'viii', 'd26', 'ix', 'd28', 'x', 'd30', 'xi', 'd32', 'xii', 'd34', 'xiii', 'd36',
         'xiv', 'xiv-2', 'd39', 'd40', 'xv', 'd42', 'xvi', 'd44', 'xvii', 'xviii', 'd48', 'xix', 'd51']

def typo(t):
    """Espaces insécables de la typographie française (le PDF a des espaces ordinaires)."""
    t = re.sub(r' ([:;!?»])', '\u00a0\\1', t)
    t = re.sub(r'« ', '«\u00a0', t)
    # « m o u c h e s » : les lettres espacées restent ensemble
    t = re.sub(r'\b(\w) (?=\w\b)', '\\1\u00a0', t) if re.search(r'\b\w \w \w \w\b', t) else t
    return html.escape(t, quote=False)

def strophes(liste):
    out = []
    for s in liste:
        vers = ''.join(f'<span class="v">{typo(v)}</span>' for v in s['vers'])
        if s['silence']:
            out.append('<div class="silence" aria-hidden="true"></div>')
            out.append(f'<div class="strophe apres">{vers}</div>')
        else:
            out.append(f'<div class="strophe">{vers}</div>')
    return '\n'.join(out)

def planche_poeme(p, k):
    feuillet = p['feuillets'][k]
    nlignes = sum(len(s['vers']) for s in feuillet)
    long = ' long' if nlignes >= 18 else ''
    if k == 0:
        pid, label, num = p['id'], f"Poème {p['num']}", f'<p class="num">{p["num"]}</p>\n'
    else:
        pid, label, num = f"{p['id']}-{k+1}", f"Poème {p['num']}, suite", ''
    return (f'<section class="planche" data-kind="texte" data-id="{pid}" aria-label="{label}">\n'
            f'<div class="page{long}">\n{num}{strophes(feuillet)}\n</div>\n</section>')

def planche_dessin(d):
    return (f'<section class="planche" data-kind="dessin" data-id="{d}" data-src="img/{d}.webp" data-vignette="img/vignettes/{d}.webp" aria-label="Dessin">\n'
            '<canvas class="expo" role="img" aria-label="Dessin de Nathan Sonnet, à révéler à la lumière du doigt"></canvas>\n</section>')

EPI = '''<section class="planche" data-kind="texte" data-id="epi" aria-label="Épigraphe">
<div class="page epi">
<div class="strophe"><span class="v">Ces mots et ces traits sont les témoins</span><span class="v">de celui que j’étais à mes 20 ans.</span></div>
<div class="strophe"><span class="v">«\u00a0Regarder sans comprendre, c’est cela le paradis.</span><span class="v">L’enfer serait donc le lieu où l’on comprend,</span><span class="v">où l’on comprend trop.\u00a0»</span></div>
<div class="strophe source"><span class="v">— Cioran, De l’inconvénient d’être né</span></div>
</div>
</section>'''

def construire():
    poemes = {p['id']: p for p in json.load(open(RACINE / 'donnees/poemes.json'))}
    blocs = []
    for cle in ORDRE:
        if cle == 'epi':
            blocs.append(EPI)
        elif cle.startswith('d'):
            blocs.append(planche_dessin(cle))
        else:
            pid, _, n = cle.partition('-')
            blocs.append(planche_poeme(poemes[pid], int(n) - 1 if n else 0))
    gabarit = (RACINE / 'outils/gabarit.html').read_text()
    page = gabarit.replace('<!--PLANCHES-->', '\n\n'.join(blocs))
    (PUB / 'index.html').write_text(page)
    n_poemes = sum(1 for c in ORDRE if not c.startswith('d') and c != 'epi' and '-' not in c)
    n_dessins = sum(1 for c in ORDRE if c.startswith('d'))
    print(f'index.html : {n_poemes} poèmes, {n_dessins} dessins, {len(ORDRE)} tirages')
    maj_cache()

def maj_cache():
    """Liste de tous les fichiers du livre pour le hors-ligne, et une version qui change avec leur contenu."""
    fichiers = sorted(str(p.relative_to(PUB)) for p in PUB.rglob('*')
                      if p.is_file() and p.name not in ('sw.js', 'robots.txt') and not p.name.endswith('.txt'))
    h = hashlib.sha256()
    for f in fichiers:
        h.update(f.encode()); h.update((PUB / f).read_bytes())
    version = h.hexdigest()[:10]
    sw = (RACINE / 'outils/sw-gabarit.js').read_text()
    liste = ',\n  '.join(json.dumps('./' if f == 'index.html' else f) for f in fichiers)
    sw = sw.replace('/*VERSION*/', version).replace('/*FICHIERS*/', liste)
    (PUB / 'sw.js').write_text(sw)
    taille = sum((PUB / f).stat().st_size for f in fichiers)
    print(f'hors ligne : {len(fichiers)} fichiers, {taille/1e6:.1f} Mo, version {version}')

if __name__ == '__main__':
    construire()
