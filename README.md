# Chambre noire

Le recueil *Chambre noire* (19 poèmes, 21 dessins) de Nathan Sonnet, en livre à développer du doigt sur téléphone.

On entre par un sténopé, on frappe à la porte, on attend que l'œil s'habitue au noir. Sous la lampe rouge, on garde le doigt sur la page pour développer les poèmes, on promène une lumière inactinique dans le noir pour révéler les dessins. En sortant, on rince les tirages et l'on retrouve la planche-contact dans la pièce claire du labo, sur la paillasse.

Le livre s'installe sur l'écran d'accueil, se lit sans réseau et reprend là où le lecteur s'était arrêté.

## Contenu

- `public/` — le site tel qu'il est publié (Vercel sert ce dossier tel quel, sans étape de construction)
  - `index.html` — **produit** par `outils/construire.py`, ne pas l'éditer à la main
  - `livre.js` — le moteur sonore (`creerSon`) puis le livre ; réglages en tête : `VOL` (volumes), `DEV_TEXTE`, `FIXAGE`, `DEV_DESSIN`, `SEUIL_DESSIN`, `SILENCE_XVII`, `APPARITION_XVII`, `LUMIERE`…
  - `style.css`, `img/` (dessins en WebP, blanc sur transparent), `sons/` (MP3 + `meta.json`), `polices/` (Lora, SIL OFL), `icones/`
  - `sw.js` — **produit** par `outils/construire.py` : la liste des fichiers gardés hors ligne et leur version
- `donnees/poemes.json` — les poèmes extraits du PDF (strophes, vers, silence de XVII, XIV sur deux feuillets)
- `donnees/sons-emplacements.json` — où retrouver chaque enregistrement dans le jeu de données Hugging Face `benjamin-paine/freesound-laion-640k`
- `outils/` — les scripts : extraction des poèmes (`poemes.py`) et des images (`images.py`) depuis le PDF, téléchargement (`telecharger_sons.py`) et préparation des sons (`prep_sons.py`), construction de la page (`construire.py`, `gabarit.html`, `sw-gabarit.js`)

## Le seuil et la planche-contact

- **Le seuil** : l'œil s'habitue au noir (on devine des formes), puis la lampe rouge s'allume et montre le labo : la lampe, la corde à linge où sèchent les derniers tirages du lecteur (à la première visite, des bandes-test et des pinces qui attendent), l'agrandisseur, les flacons, le robinet qui goutte, les trois cuvettes (révélateur, arrêt, fixateur). On s'approche de la cuvette et le premier tirage commence. Réglages : `SEUIL_LAMPE`, `SEUIL_APPROCHE`, `SEUIL_FIN` ; dessin dans `decor()`.
- **Planche-contact** : une vraie planche 18×24, d'un seul tenant : les 42 vues en sept bandes de six (`PAR_BANDE`) posées à la main sous la vitre, à l'échelle d'un film 35 mm (`--mm`) : vues 24×36 aux coins arrondis, huit perforations par vue, numéros de vue et nom du film en tout petit sur le bord, quelques poussières et un cheveu. La pellicule vierge (vues pas encore développées) garde le gris sombre du support. Un cadre au crayon gras rouge, tiré à main levée (filtre `#cire`), entoure les vues regardées à l'agrandisseur. Garder le doigt sur la planche fait venir le **compte-fils** (`LOUPE`), qui suit le doigt ; un toucher bref agrandit la vue. La planche est posée sur la paillasse de la pièce claire du labo (résine sombre sous la lumière blanche du plafond), sans bord blanc, avec la pince à tirages en bambou, quelques gouttes et le crayon gras rouge (objets dessinés dans `outils/gabarit.html`, classe `.objet`). Un chapeau d'une ligne ; les gestes viennent en consigne discrète (« Toucher une vue pour l'agrandir », puis le compte-fils), une fois chacun ; les crédits sont rangés derrière « Crédits ».

## Les gestes uniques de la visite

- **Allumer la lampe** : au seuil, « Laisser l'œil s'habituer au noir » jusqu'à `SEUIL_OEIL`, un temps de noir, puis « Allumer la lampe » (`SEUIL_ALLUMER`) ; le voyant de l'interrupteur apparaît entre les deux (`SEUIL_VOYANT`) ; le lecteur allume lui-même la lampe rouge (toucher l'interrupteur ou l'écran).
- **Sortir à tout moment** : « sortir », en haut à droite du labo. On ouvre le robinet pour rincer les tirages, puis on pousse la porte. La planche où l'on était est gardée ; « Rentrer dans la chambre noire » y ramène.
- **La porte du labo** (à la sortie) : les tirages rincés, on se tourne vers la porte, dessinée dans `porteLabo()` : porte isoplane peinte en noir, joint d'étanchéité à la lumière sur le chambranle, béquille et cylindre, plaque de propreté, un tablier en caoutchouc pendu à une patère ; à droite, l'interrupteur de la lampe. « Pousser la porte » : l'interrupteur claque, la lampe s'éteint et son voyant orange s'allume (comme à l'entrée) ; la béquille s'abaisse, le pêne se libère, un filet de lumière passe le joint, puis le battant s'ouvre, lourd (rotation 3D sur ses gonds, accordée au son de la porte) ; la lumière de la pièce claire tombe sur le sol du labo. Puis on **marche** jusqu'à la paillasse : chaque plan avance à sa profondeur (le chambranle passe de chaque côté, le battant ouvert défile à gauche, la pièce claire approche lentement), quatre pas réguliers qu'on entend, la tête qui monte et se balance à chaque pas ; pendant les derniers pas, la planche-contact vient en fondu par-dessus la pièce claire (qui reste entière dessous jusqu'à la fin du fondu, sans creux sombre), préparée invisible dès qu'on marche pour que rien n'accroche, et elle continue d'approcher un peu pendant le fondu. Réglages : `PORTE` (minutage, cadence, avance, balancement de la tête, prepare, planche, fondu, approche), `PO` (géométrie, perspective, profondeur du fond), `echelleSas()` (la porte couvre l'écran sans trop grandir sur les grands écrans ; mur et pièce claire dessinés sur la seule largeur visible).
- **Rincer** : en sortant, « Ouvrir le robinet pour rincer les tirages » : le robinet coule dans la première cuvette (filet d'eau, ronds dans l'eau), accordé au son du rinçage (de 0,2 à 3 s) ; quand on ferme, le filet se détache et tombe (`.filet` dans `decor()`, classe `coule`).
- **Lever l'aiguille en sortant** : tant qu'on voit le labo (au moment de rincer) et que le disque tourne, « lever l'aiguille » sur le tourne-disque de l'image : toucher le tourne-disque relève le bras et arrête le disque (`placerAiguille()`).
- **Le tourne-disque** : on le voit dans l'image du labo, au seuil (plateau, disque, bras, pochette contre le mur) ; une fois la lampe allumée, « Voulez-vous écouter un disque ? » (oui / non merci ; la question ne revient pas si le disque tourne déjà ou si l'on a dit non). Quand le disque joue, il tourne dans l'image et le bras est posé dessus. Dans le labo, une note de musique (à côté de « sortir ») ouvre les commandes : pause / reprendre (au même endroit du morceau), morceau suivant, autre face. Son par le labo, assez bas (petit haut-parleur, craquements du vinyle) ; l'aiguille se relève d'elle-même pour le silence de XVII. Le disque est gardé hors ligne lui aussi : une fois le livre gardé, ses 12 morceaux (25 Mo) sont téléchargés en arrière-plan dans un cache à part, qui ne change que si la musique change ; les morceaux sont lus depuis cette copie, chargés à l'avance en entier (le suivant pendant celui qui joue).

## Le disque

Chopin (Musopen, *The Complete Works of Frédéric Chopin*, CC0), Rachmaninov et Satie (Jaan Patterson, Free Music Archive, CC0). Liste et crédits dans `donnees/musique.json` ; préparation : `python3 outils/prep_musique.py <dossier des enregistrements>` (MP3 mono 64 kb/s, niveau égalisé, 0,9 s de silence au début), puis `python3 outils/construire.py` (les crédits de la planche-contact suivent).

## Les bruitages ajoutés

La pièce claire est silencieuse (le vent dans un peuplier, entendu comme de la pluie, a été retiré). Très rarement, la vie du bâtiment (un plancher à l'étage, un radiateur, de l'eau dans un tuyau), entendue à travers le plafond ; parfois, la pince qui tape le bord de la cuvette quand on sort un poème du bain. Tous CC0, préparés par `outils/prep_sons.py`.

## Les poèmes sur papier

Les poèmes se développent comme sur un vrai papier photo : une feuille rougie par la lampe dans la cuvette, le texte qui monte en sombre, puis la lumière blanche (un ivoire atténué) une fois le tirage fixé. Choix de Nathan le 9 novembre. L'ancienne version, en clair sur noir, reste visible en ajoutant `?negatif` à l'adresse. Réglages : `FEUILLE_FAIBLE`, `FEUILLE_LAMPE`, `FEUILLE_JOUR`, `ENCRE_LABO`, `ENCRE_JOUR`.

## Après une modification

```
python3 outils/construire.py
```

Cela régénère `public/index.html` et `public/sw.js` (nouvelle version du hors-ligne : les téléphones reçoivent la mise à jour à la prochaine ouverture).

## Discrétion

Pendant la mise au point, le site n'est pas référencé : `noindex` dans la page et dans les en-têtes (`vercel.json`), et `robots.txt` qui refuse les robots. Seuls ceux qui ont le lien le trouvent.

## Crédits

Poèmes et dessins © Nathan Sonnet. Sons : enregistrements de Freesound.org — ventilation de silencyo (CC BY 3.0), les autres en CC0 (cabled_mess, colo777, carroll27, LampEight, Kinoton, toddcircle, odilonmarcenar, Nox_Sound, haulaway, matieke, Pipelenisf, leonseptavaux, ValentinPetite, Joao_Janz). Police Lora (SIL Open Font License).
