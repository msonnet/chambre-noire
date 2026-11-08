"""Prépare les disques du tourne-disque : un MP3 mono par piste (niveau égalisé, silences du début et de la fin retirés,
puis 0,9 s de silence au début : le temps que l'aiguille trouve le sillon)
et public/musique/disques.json. Usage : python3 outils/prep_musique.py <dossier des enregistrements bruts>"""
import json, subprocess, sys, os, shutil
BRUT = sys.argv[1]; SORTIE = 'public/musique'
src = json.load(open('donnees/musique.json'))
shutil.rmtree(SORTIE, ignore_errors=True); os.makedirs(SORTIE)
out = {}
for cle, disque in src.items():
    os.makedirs(f'{SORTIE}/{cle}')
    pistes = []
    for k, p in enumerate(disque['pistes'], 1):
        f = f'{SORTIE}/{cle}/{k:02d}.mp3'
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', f"{BRUT}/{p['source']}", '-af',
            'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.3,areverse,silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.8,areverse,loudnorm=I=-19:TP=-2:LRA=11,adelay=900',
            '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '64k', f], check=True)
        d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)
        q = {k2: v for k2, v in p.items() if k2 != 'source'}; q.update(fichier=f'musique/{cle}/{k:02d}.mp3', duree=round(d, 1))
        pistes.append(q); print(f"{cle} {k} {p['titre'][:40]:40} {d:6.1f} s {os.path.getsize(f)//1024:5} Ko")
    out[cle] = {'titre': disque['titre'], 'pistes': pistes}
json.dump(out, open(f'{SORTIE}/disques.json', 'w'), ensure_ascii=False, indent=1)
print('total', sum(os.path.getsize(os.path.join(r, n)) for r, _, fs in os.walk(SORTIE) for n in fs) // 1024, 'Ko')
