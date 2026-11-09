# Chambre noire

Le recueil *Chambre noire* (19 poèmes, 21 dessins) de Nathan Sonnet, en livre à développer du doigt sur téléphone.

On entre par un sténopé, on frappe à la porte, on attend que l'œil s'habitue au noir. Sous la lampe rouge, on garde le doigt sur la page pour développer les poèmes, on promène une lumière inactinique dans le noir pour révéler les dessins. En sortant, on rince les tirages et on retrouve la planche-contact au jour.

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
- **Planche-contact** : les vues tirées par contact en bandes de six (`PAR_BANDE`), perforations, numéros de vue et « CHAMBRE NOIRE » sur le bord ; les vues non développées restent noires ; un trait de crayon gras rouge entoure les vues regardées à l'agrandisseur.

## Les gestes uniques de la visite

- **Allumer la lampe** : au seuil, dans le noir, le voyant de l'interrupteur apparaît ; le lecteur allume lui-même la lampe rouge (toucher l'interrupteur ou l'écran).
- **Sortir à tout moment** : « sortir », en haut à droite du labo. On ouvre le robinet pour rincer les tirages, puis on pousse la porte. La planche où l'on était est gardée ; « Rentrer dans la chambre noire » y ramène.
- **Le tourne-disque** : on le voit dans l'image du labo, au seuil (plateau, disque, bras, pochette contre le mur) ; une fois la lampe allumée, « Voulez-vous écouter un disque ? » (oui / non merci ; la question ne revient pas si le disque tourne déjà ou si l'on a dit non). Quand le disque joue, il tourne dans l'image et le bras est posé dessus. Dans le labo, une note de musique (à côté de « sortir ») ouvre les commandes : pause / reprendre (au même endroit du morceau), morceau suivant, autre face. Son par le labo, assez bas (petit haut-parleur, craquements du vinyle) ; l'aiguille se relève d'elle-même pour le silence de XVII. Le disque est gardé hors ligne lui aussi : une fois le livre gardé, ses 12 morceaux (25 Mo) sont téléchargés en arrière-plan dans un cache à part, qui ne change que si la musique change ; les morceaux sont lus depuis cette copie, chargés à l'avance en entier (le suivant pendant celui qui joue).

## Le disque

Chopin (Musopen, *The Complete Works of Frédéric Chopin*, CC0), Rachmaninov et Satie (Jaan Patterson, Free Music Archive, CC0). Liste et crédits dans `donnees/musique.json` ; préparation : `python3 outils/prep_musique.py <dossier des enregistrements>` (MP3 mono 64 kb/s, niveau égalisé, 0,9 s de silence au début), puis `python3 outils/construire.py` (les crédits de la planche-contact suivent).

## Les bruitages ajoutés

Très rarement, la vie du bâtiment (un plancher à l'étage, un radiateur, de l'eau dans un tuyau), entendue à travers le plafond ; parfois, la pince qui tape le bord de la cuvette quand on sort un poème du bain. Tous CC0, préparés par `outils/prep_sons.py`.

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

Poèmes et dessins © Nathan Sonnet. Sons : enregistrements de Freesound.org — ventilation de silencyo (CC BY 3.0), les autres en CC0 (cabled_mess, colo777, carroll27, LampEight, Kinoton, toddcircle, odilonmarcenar, Nox_Sound, haulaway, matieke, Pipelenisf, leonseptavaux, ValentinPetite, Joao_Janz, felix.blume). Police Lora (SIL Open Font License).
