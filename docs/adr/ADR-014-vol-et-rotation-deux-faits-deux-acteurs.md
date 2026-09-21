# `vol` et `traitement_rotation` : deux faits, deux acteurs — duplication assumée

**Statut** : accepté (2026-08-26). Complète ADR-011 §5.6, dont il tranche la lecture.

## Contexte — ce que les fiches papier disent

La confrontation des deux formulaires sources fait apparaître une duplication que le modèle
n'avait jamais nommée.

**`docs/IFVM_fiche de vol (1).md`** — colonnes du tableau des vols de la journée :

```
N° | n° cuve | Produit | Quant. (l) | Heure début | T début | Vent début
   | Heure fin | T fin | Vent fin | Heures vol | Type de vol | Observation
```

**`traitement_model.py:141-158`** — `traitement_rotation` :

```
numero_cuve, produit_id, quantite_l,
temperature_debut_c, temperature_fin_c, vent_debut_ms, vent_fin_ms
```

C'est la même ligne, moins les heures et le type de vol.

**`docs/IFVM_Fiche_compte_rendu_traitement (1).md`** — la fiche CRT, elle, ne contient **aucune**
table de rotations, **aucun** numéro de cuve. Son §3 « Condition de traitement » porte *une seule*
ligne `Début / Fin / Vent / Température` pour le traitement entier.

Autrement dit : **`traitement_rotation` n'a pas été modélisé depuis la fiche CRT**. Ses colonnes
viennent du tableau de la fiche de vol, rangées sous `traitement_aerien`. La question posée en
implémentant le module fiche de vol — « la météo appartient-elle au vol ou à la rotation ? » —
n'avait donc pas de réponse : elle porte sur la même ligne de terrain.

## Décision

**Les deux tables sont conservées. La duplication est assumée, parce que ce ne sont pas les
mêmes faits : ce sont les mêmes conditions consignées par deux acteurs différents.**

- La **fiche de vol** est tenue par le **pilote**. `vol.temperature_*` et `vol.vent_*` sont *son*
  relevé, dans *son* appareil, à *son* heure.
- Le **compte-rendu de traitement** est tenu par le **chef de base**.
  `traitement_rotation.temperature_*` et `.vent_*` sont *son* relevé, au sol.

Aucune des deux sources ne fait foi contre l'autre. **La concordance des deux saisies est
elle-même une information** — c'est ce que l'écran de rapprochement sert à montrer. Les fusionner
en une seule table produirait un chiffre unique et détruirait le seul contrôle croisé dont dispose
le dispositif.

Le lien entre les deux reste ce qu'ADR-011 §7.3 a posé : `vol.rotation_id`, N:1, arbitré à la
saisie. Le **numéro de cuve appartient à la rotation** ; un vol MEP ou APPLICATION *désigne* une
rotation et hérite de son numéro pour l'affichage — il ne le ressaisit jamais.

## Options écartées

- **Fusionner** — `vol` absorbe n° de cuve, produit, quantité et météo ; `traitement_rotation`
  devient une vue. Une seule saisie, une seule vérité. Écarté : supprime le contrôle croisé, et
  impose au pilote de saisir des données de traitement qui ne sont pas les siennes.
- **La rotation comme agrégat** — elle garde produit et quantité (faits de la cuve), les vols
  gardent heures et météo (faits du vol). Séduisant sur le papier, mais la fiche de vol papier
  demande explicitement produit et quantité **sur la ligne de vol** : ce serait retirer au pilote
  une colonne de son propre formulaire.

## Conséquences

- La migration qui ajoute `temperature_debut_c / temperature_fin_c / vent_debut_ms / vent_fin_ms`
  à `vol` est **justifiée**, et n'est pas une dénormalisation à résorber. Le commentaire de colonne
  doit dire pourquoi, sinon un lecteur futur « corrigera » la duplication.
- L'écran de rapprochement du mobile doit **montrer l'écart** entre les deux relevés quand un vol
  est rattaché à une rotation, plutôt que d'en masquer un.

## Décision annexe — unité des cumuls (clôt ADR-011 §7.4 pt 4)

Le cahier des charges l'emporte sur la fiche papier : les cumuls sont **jour / semaine ISO / mois /
total**, et non jour / décade / campagne. `cumuler_durees` et `GET /fiches-vol/cumuls` sont donc
déjà conformes ; aucune évolution backend n'est requise de ce côté.

En revanche, la **ventilation par type de vol** que la fiche papier imprime (6 colonnes de type ×
3 lignes de période) reste ouverte — voir les questions ci-dessous.

## Questions laissées ouvertes — à vérifier auprès du terrain avant toute autre migration

Neuf questions structurantes sont apparues au même examen et **ne sont pas tranchées**. Aucune
migration ne doit les préempter.

1. **L'aérien est-il un *moyen* ou un *type* de traitement ?** La fiche CRT §3 aligne quatre
   moyens sur la même ligne — « atomiseur à dos / disque rotatif / ulvamast / **aéronef** » — alors
   que le modèle impose une spécialisation disjointe totale `AERIEN | TERRESTRE`, et que
   `surface_aeronef_ha` n'existe nulle part (les trois surfaces terrestres vivent sur
   `traitement_terrestre`, `traitement_model.py:189-191`). **Un chantier commencé à l'aéronef et
   terminé à l'atomiseur est inreprésentable aujourd'hui.** À vérifier : cela arrive-t-il ?
2. **Le type de vol « mixte ».** Présent dans la légende de la fiche de vol papier, absent de
   `ck_vol_type`. Sa définition métier n'est pas établie. Conséquence si « mixte » = MEP +
   application en un seul vol : `valider_rotations_completes` (`domain/fiche_vol.py:149`) rejette
   en 422 une journée valide. Mis de côté, ni implémenté ni retiré.
3. **La prospection aérienne.** `type_vol = PROSPECTION` pointe une `prospection`, mais rien sur
   `prospection` ne dit qu'elle a été faite depuis un aéronef, et sa géométrie est un **point**
   (station ou lat/lon). Un vol de prospection d'une heure et demie survole des dizaines de
   kilomètres. À vérifier : le prospecteur note-t-il des points successifs, ou faut-il une
   géométrie de survol ?
4. **Stock de pesticide.** Le §5 de la fiche CRT (5.3 stock initial, 5.4 approvisionnement,
   5.5 produit consommé, 5.6 stock final) **n'est implémenté nulle part** — seul
   `total_pesticide_l` existe. La fiche de vol réclame le même vocabulaire à un autre grain
   (par jour et par base), plus la quantité perdue et le compteur de fûts. Objet métier manquant
   des deux côtés : qui tient le stock, et à quel grain ?
5. **La « quantité perdue ».** La fiche papier porte un astérisque — « expliquer comment est-elle
   arrivée ? » — ce qui décrit un **événement déclaré** (fuite, fût percé, renversement). La
   maquette la **calcule** (`théorique − relevé`) et exige une explication pour un écart qu'elle
   a produit seule. Déclarée, calculée, ou les deux distinguées ?
6. **Ventilation des heures par type de vol.** La fiche papier imprime une matrice
   6 types × 3 périodes ; l'API ne rend que des totaux. La ventilation est-elle ce qui sert à
   rapporter l'activité et à justifier le coût de l'heure de vol ?
7. **Potentiel cellule et grande visite.** Le mécanicien lit-il « il reste N heures » sur le
   carnet de bord (un relevé du jour), ou un compteur horaire qu'il faut rapprocher d'un point
   d'ancrage ? Le premier cas invalide l'idée d'un référentiel aéronef porteur du potentiel.
8. **« Base secondaire ».** Le mot figure sur la fiche papier sans définition : second stand de
   remplissage, base de repli pour la nuit, ou simple drapeau « pas la base habituelle » ? Chaque
   lecture produit un modèle différent.
9. **Disponibilité des rotations au moment de la saisie du vol.** `vol.rotation_id` suppose que
   la rotation existe déjà. Or une rotation n'existe que portée par un `traitement_aerien`, donc
   par un `traitement`, donc par une `prospection` — et le compte-rendu de traitement peut n'être
   rédigé qu'en fin de journée, après les vols. Deux constats techniques s'ajoutent au doute
   métier : le serveur expose `GET /traitements` mais **`mobile/src/lib/api-client.ts` n'a aucune
   méthode pour l'appeler** (aucun pull des traitements vers le mobile), et la table locale
   `rotation` n'est alimentée que par `addRotation()`, donc **uniquement sur l'appareil qui a
   saisi le CRT**. Un pilote et un chef de base sur deux appareils distincts — la situation
   nominale selon la décision ci-dessus — ne partagent aujourd'hui aucune rotation.
   Conséquence de conception : tant que ce point n'est pas tranché, l'écran de saisie des vols
   doit accepter une paire mise en place / application **non rattachée**, et permettre le
   rattachement ultérieur. Questions B5 et B6.

Le questionnaire correspondant, rédigé en langage métier, est dans
`docs/questions-metier-fiche-de-vol.md`.
