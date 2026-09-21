# Remodélisation du domaine aérien : équipe unifiée, site aérien unifié, entité `vol`, stock de pesticides centralisé

**Statut** : accepté (2026-09-22). **Révoque `ADR-017` pour la seule partie « entité `vol` »** ;
tout le reste d'ADR-017 (suppression de `fiche_vol`, `fiche_vol_signature`,
`campagne_fiche_vol_compteur`, du carnet de bord, des signatures et des cumuls d'heures) **reste en
vigueur**. Complète et révise `ADR-011` et `ADR-014`. Épic `tojoolivier/ifvm-app#592`, tickets
#602 à #610.

Ce document ne produit ni code ni migration : il cadre le lot et sert de référence citée par les
tickets d'implémentation.

## Contexte

### Ce que le modèle actuel ne sait pas dire

1. **Le référentiel équipe est éclaté en deux tables asymétriques** (`equipe_terrestre`,
   `equipe_aerienne`) avec des rôles nommés en dur (`chef_de_base_id`, `chef_equipe_id`) et des
   colonnes texte libre (`pilote`, `mecanicien`, `consultant_international`). Aucune prospection,
   aucun traitement n'est rattaché à l'équipe qui l'a mené : on ne sait pas où sont les équipes.
2. **`base_aerienne` et `stand_remplissage` sont deux référentiels quasi identiques**, et une base
   n'a qu'une position fixe alors qu'elle se déplace pendant la campagne.
3. **L'activité aérienne n'est plus représentée du tout.** Les heures de vol, le convoyage, la
   mise en place, la prospection aérienne n'ont plus de support depuis la migration `0080`.
4. **Le stock de pesticides n'existe qu'à l'échelle d'un traitement** (`pesticide_recu_l`,
   `pesticide_stock_restant_l`, `total_pesticide_l` / `total_pesticide_kg`). Le §5 de la fiche CRT
   (stock initial / approvisionnement / consommé / final) n'est implémenté nulle part.

### Ce qui a changé depuis ADR-017 (hier)

ADR-017 (2026-09-21) a retiré la fiche de vol sur **décision produit** : la migration `0080`
supprime `vol`, `fiche_vol`, `fiche_vol_signature` et `campagne_fiche_vol_compteur`, les données
existantes sont **perdues**, et `downgrade` lève `NotImplementedError` — la seule marche arrière
était la restauration d'un `pg_dump`. Réintroduire une entité `vol` un jour plus tard n'est donc
pas un ajout neutre : c'est la révocation explicite d'une décision récente, et elle doit être
justifiée par un fait nouveau.

Le fait nouveau est un **document de cadrage métier** — « Cadre conceptuel et instructions de
gestion des opérations aériennes de lutte antiacridienne » — porté à la connaissance de l'équipe
après ADR-017, et confronté au cadrage de #592 lors d'une session de challenge (2026-09-21). Ce
document impose des règles de rattachement **dures** que le modèle actuel ne peut pas exprimer, la
plus contraignante étant (§6) :

> « le système doit empêcher l'enregistrement d'une opération de traitement sans base principale ni
> stand de remplissage »

Cette règle porte sur l'**opération aérienne**, pas sur le compte-rendu agronomique. Sans objet qui
porte l'opération, elle est inexprimable : `traitement_aerien` ne connaît ni stand ni base
secondaire autrement qu'en texte libre, et un vol de convoyage ou de mise en place n'a pas de
traitement du tout. Le §9 du même document demande explicitement de « séparer l'organisation
administrative, l'implantation géographique, l'activité aérienne et la gestion des pesticides ».

Autrement dit : ce qui a été abandonné hier, c'est la **fiche de vol comme document du pilote**
(carnet de bord, signatures, cumuls d'heures, rapprochement vol↔rotation). Ce qui revient
aujourd'hui, c'est une **ligne d'activité aérienne**, exigée par le cadrage métier comme support de
règles de rattachement de sites. Les deux portent le même nom et ne sont pas le même objet.

## Décision

### 1. `vol` revient, mais ce n'est pas l'ancienne `vol`

Une entité `vol` est réintroduite comme **ligne d'activité aérienne** : un type, une équipe, un
aéronef, une date, et ses rattachements de site.

**Ce que la nouvelle `vol` ne reprend pas de l'ancienne** — et c'est ce qui rend la révocation
d'ADR-017 partielle et non une annulation :

| Abandonné par ADR-017 | Statut ici |
| --- | --- |
| `fiche_vol` (journal d'un aéronef sur une journée) | **reste supprimé** |
| `fiche_vol_signature` (signatures pilote / chef de base) | **reste supprimé** |
| `campagne_fiche_vol_compteur` (numérotation) | **reste supprimé** |
| Cumuls d'heures par jour / semaine ISO / mois (ADR-014 §décision annexe) | **reste supprimé** |
| `vol.rotation_id` et l'écran de rapprochement vol↔rotation | **non repris** |
| `vol.temperature_*` / `vol.vent_*` (relevé météo du pilote, ADR-014) | **non repris** |
| Carnet de bord, potentiel cellule, grande visite | **non repris** |

La nouvelle `vol` ne double donc aucun relevé de `traitement_rotation` : la duplication assumée
qu'ADR-014 défendait (« deux faits, deux acteurs ») **disparaît d'elle-même**, faute de second
relevé. ADR-014 reste la trace de pourquoi elle avait existé ; sa décision centrale devient sans
objet.

**Contenu de la nouvelle `vol`** (détail d'implémentation en #608, #610) :

- `type ∈ {mise_en_place, application, convoyage, prospection, divers}` ;
- `equipe_id` **obligatoire pour tous les types** — c'est la seule façon de tracer l'équipe sur un
  convoyage ou un vol divers, qui n'ont ni traitement ni prospection ;
- `aeronef_id` **obligatoire**, avec contrôle applicatif de cohérence contre `equipe_aeronef` à la
  date du vol (l'appareil doit être affecté à l'équipe du vol) ;
- rattachements de site : `site_principal_id`, `stand_id`, `base_secondaire_id` — trois FK vers
  `site_aerienne`, stand et base secondaire restant **deux attaches distinctes** (remplissage des
  cuves ≠ rapprochement logistique de l'équipe) ;
- CHECK : `site_principal_id` et `stand_id` NOT NULL pour `mise_en_place` et `application` (règle
  dure du §6) ; pas de contrainte pour `convoyage` / `prospection` / `divers` ;
- CHECK conditionnels : `motif` obligatoire si `type ∈ {convoyage, divers}` ;
  `lieu_depart` / `lieu_arrivee` obligatoires si `type = convoyage` (§5.3, §5.5) ;
- liens métier : 0..1 vers `traitement_aerien` (type `application`) et **1:N vers `prospection`**
  (un vol de prospection généralisée couvre plusieurs relevés) ;
- cohérence `stand.parent_base_id = base_secondaire.parent_base_id = site_principal_id` vérifiée
  **côté application** (422), pas par contrainte SQL — réponse au §9 du document.

### 2. `equipe_terrestre` + `equipe_aerienne` → `equipe`

Table unique `equipe(id, nom, type ∈ {terrestre, aerien}, actif, …)`, avec `UNIQUE(id, type)` pour
servir de cible à des **FK composites type-sûres** `(equipe_id, equipe_type) → equipe(id, type)`
depuis `site_aerienne`, `lieu_aerien`, `poste_acridien`, `prospection`, `traitement` et `vol`.

Les rôles nommés en dur sont remplacés par un **modèle de membres générique**
`equipe_membre(equipe_id, user_id, fonction)`, PK `(equipe_id, user_id)` :

- le vocabulaire de `fonction` est celui de `ROLES` sur `Utilisateur`, pas une seconde liste ;
- `user_id` est NOT NULL : un membre externe sans compte applicatif (pilote, mécanicien, consultant
  international) réutilise le mécanisme **« compte à la volée »** déjà en place
  (`peut_se_connecter=False`, `ROLES_A_LA_VOLEE`) plutôt qu'un mécanisme parallèle ;
- la règle métier actuelle « un seul chef par équipe, un chef d'une seule équipe » est préservée par
  deux index partiels `UNIQUE(equipe_id) WHERE fonction='chef'` et
  `UNIQUE(user_id) WHERE fonction='chef'`.

`equipe_aeronef(equipe_id, aeronef_id, date_debut, date_fin)` remplace la contrainte 1:1
`equipe_aerienne.aeronef_id` : une équipe dispose de 2 à 3 appareils, affectés successivement
(#603).

`utilisateur.chef_de_base_id` / `chef_equipe_id` sont **conservés tels quels** : redondance assumée
avec `equipe_membre(fonction='chef')`, dette explicite, pas de synchronisation automatique dans ce
lot.

### 3. `base_aerienne` + `stand_remplissage` → `site_aerienne`

Une seule entité couvre les trois rôles. Le discriminant n'est **pas une colonne `type` stockée**
mais `parent_base_id` :

- `parent_base_id IS NULL` → **site principal** ; il porte `equipe_id` ;
- `parent_base_id IS NOT NULL` → **site secondaire ou stand** ; il ne porte **pas** `equipe_id`,
  qui se déduit en remontant au parent. Ce choix élimine par construction le risque qu'un site
  secondaire pointe vers une autre équipe que sa principale — et il est **déjà en vigueur** :
  la contrainte `ck_base_aerienne_equipe_coherente` (migration `0066`) l'impose. Rien à faire de ce
  côté hors renommage.

Le nom « base » devenait trompeur pour une ligne jouant le rôle de stand : d'où `site_aerienne`, et
`site_aerienne_position` pour l'historisation.

`site_aerienne_position(site_id, latitude, longitude, altitude, date_debut, date_fin)` historise le
déplacement du siège d'opération ; `latitude` / `longitude` / `altitude` quittent `site_aerienne`.
La règle « une seule position active par site » est vérifiée côté application. `duree_implantation`
est **dérivée à la volée, jamais stockée**.

La position d'une équipe aérienne se lit donc par la position courante de son site principal ;
celle d'une EMT se **déduit de ses dernières interventions rattachées** — pas de table de position
dédiée pour le terrestre (#607).

### 4. Stock de pesticides centralisé, en deux unités

Le §3.3 du document exige une gestion **centralisée du stock au niveau de la base principale**, avec
traçabilité des transferts, chargements et consommations.

`mouvement_pesticide(type, pesticide_id, site_aerienne_id, site_aerienne_destination_id?,
quantite, unite, date)` avec `type ∈ {approvisionnement, transfert, consommation}` et
`site_aerienne_destination_id` renseigné **uniquement** pour `transfert`.

Deux points structurants :

- **Deux unités, pas des litres.** L'existant compte déjà en L **et** en kg : `traitement_aerien`
  porte `total_pesticide_l` et `total_pesticide_kg`, `traitement_rotation` porte `quantite` +
  `unite` (« une rotation en L ne s'additionne jamais à une rotation en kg »). `mouvement_pesticide`
  porte donc `quantite` + `unite`, et le **solde d'un site se calcule par (pesticide, unité)** —
  jamais comme un nombre unique. Le cadrage initial de #592, formulé en litres, est corrigé ici.
- **Pas de colonne « stock actuel ».** Le solde est une **agrégation `SUM` des mouvements**, source
  de vérité unique. Aucune dénormalisation : c'est précisément le genre de colonne qui dérive
  silencieusement (#606).

**Réinterprétation de « chargement » (§3.3)** : dans un contexte de gestion de stock, « chargement »
désigne l'**approvisionnement / réception** du stock à la base principale, pas le remplissage
physique d'une cuve au stand (§3.1). Le remplissage d'une cuve n'est pas un mouvement comptable : le
produit ne quitte le stock qu'à la **consommation réelle**, constatée par le traitement.

Conséquence : les quantités consommées (`total_pesticide_l` / `total_pesticide_kg`) **restent sur
`traitement_aerien`**, et non sur `vol` (cohérent avec la séparation
logistique / agronomique), et l'enregistrement du traitement **génère automatiquement** le
`mouvement_pesticide` de type `consommation` — une seule saisie, pas de double entrée (#609).
`pesticide_recu_l` / `pesticide_stock_restant_l` quittent `traitement_aerien` : le stock n'est plus
scopé par traitement.

### 5. Risque assumé : revenir au référentiel contraint

Le cadrage impose des FK là où le projet a déjà, **deux fois**, retiré des FK :

- **migration `0054`** — `traitement_aerien` : FK vers `lieu_aerien` **défaite**, retour au texte
  libre `base_principale` / `stand` / `base_secondaire` ;
- **migration `0063`** — `prospection.base` : FK vers `lieu_aerien` **défaite**, même raison.

Dans les deux cas, la cause n'était pas une erreur de modélisation mais un **refus du terrain** :
obliger un agent à choisir dans un référentiel synchronisé bloquait une saisie légitime quand le
lieu n'était pas (encore) au référentiel, sur un appareil hors ligne.

Le présent lot y revient délibérément : `traitement_aerien.base_principale_id` NOT NULL (#605), et
les trois FK de site sur `vol` (#608). **Ce n'est pas une correction évidente, c'est un pari.** Il
est pris parce que le document de cadrage en fait une règle dure (§6) et non une commodité de
saisie, et parce que le référentiel `site_aerienne` — contrairement à `lieu_aerien` — est **créé et
déplacé par l'équipe elle-même** : un chef de base qui ouvre un stand crée la ligne, il ne cherche
pas une entrée que quelqu'un d'autre aurait dû saisir avant lui.

**Ce pari doit être re-validé sur le terrain avant la mise en production du lot.** Si la troisième
tentative casse comme les deux premières, la marche arrière est le texte libre — et elle doit être
prévue comme telle, pas découverte en urgence. C'est la condition explicite de cette décision.

## Options écartées

- **Ne rien faire et attendre que le cadrage métier soit intégré au produit.** Écarté : les règles
  du §6 sont des règles de saisie, elles n'ont de valeur que si le modèle peut les porter. Les
  tickets #602 à #607 sont indépendants de `vol` et seraient bloqués à tort.
- **Restaurer le `pg_dump` d'avant la migration `0080`.** Séduisant (les données perdues
  reviendraient) mais écarté : cela ramènerait aussi le carnet de bord, les signatures, les cumuls
  et `vol.rotation_id`, c'est-à-dire exactement ce que la décision produit d'ADR-017 a retiré — et
  les 9 questions métier ouvertes d'ADR-014 avec. La perte de données de `0080` est **assumée et
  définitive**.
- **Faire de `vol` une spécialisation de `traitement_aerien`** (un vol = une ligne de traitement).
  Écarté : le convoyage, la mise en place et les vols divers n'ont pas de traitement, et la
  prospection aérienne en a plusieurs. La cardinalité ne tient pas dans un sens comme dans l'autre.
- **Absorber les rattachements de site dans `traitement_aerien`** plutôt que créer `vol`. Écarté
  pour la même raison : la règle du §6 porte sur l'opération aérienne, qui existe sans traitement.
- **Garder `base_aerienne` et `stand_remplissage` séparées.** Écarté : deux référentiels aux mêmes
  colonnes, dont l'un est un cas particulier de l'autre — et `vol` devrait porter des FK vers deux
  tables différentes pour trois rattachements de même nature.
- **Une colonne `type` stockée sur `site_aerienne`** plutôt que le dérivé `parent_base_id IS NULL`.
  Écarté : deux sources de vérité pour le même fait, donc une dérive garantie.
- **Une colonne `stock_actuel` dénormalisée sur `site_aerienne`.** Écarté : performance non
  démontrée comme problème, correction garantie comme problème. Et elle serait fausse dès la
  première unité oubliée.
- **Une seule unité de stock (litres), avec conversion.** Écarté : la densité varie par produit, la
  conversion introduirait un chiffre faux là où le terrain en tient deux justes.

## Conséquences

- **`ADR-017` n'est plus applicable pour la seule partie « entité `vol` ».** Un lecteur qui arrive
  par ADR-017 doit être renvoyé ici. Le reste d'ADR-017 tient : `FicheType.VOL` reste une valeur
  morte d'`audit_log`, la page web « Heures de vol » reste « Bientôt disponible » jusqu'à ce qu'un
  ticket la ré-adresse, et les applications mobiles appelant `/fiches-vol` continuent de recevoir
  des 404.
- **`ADR-014` devient largement sans objet.** Sa décision centrale (conserver `vol` et
  `traitement_rotation` comme deux relevés de deux acteurs) supposait une météo sur `vol` et un
  `vol.rotation_id` — dont ni l'un ni l'autre n'est repris. Le document reste la trace de l'analyse
  des fiches papier et des 9 questions métier, qui elles restent valides.
- **Le contrat OpenAPI change sur presque tout le domaine référentiel.** Après chaque migration du
  lot : `npm run generate:api-types` puis `npm run check:schema-drift` — déjà imposés par le hook
  pre-commit (`.lintstagedrc.json`) et la CI (`lint-mobile`).
- **Les composants mobiles `EquipeAerienneField.tsx` et `StandRemplissageField.tsx` deviendront
  incohérents** avec le contrat régénéré. Leur adaptation est un chantier séparé, hors de ce lot —
  mais elle devient bloquante pour toute release mobile.
- **Pièges relationnels à garder en tête pour le reporting** :
  - *fan trap* — `equipe` a deux relations 1:N indépendantes (`equipe_membre` et
    `prospection` / `traitement`) : ne pas les joindre dans une même requête, les lignes explosent
    artificiellement ;
  - *chasm trap* — la chaîne `equipe → site_aerienne → site_aerienne_position` est optionnelle à
    chaque étage : un rapport « position actuelle de chaque équipe » doit utiliser des `LEFT JOIN`,
    sinon les équipes sans site et les sites sans position disparaissent en silence.
- **Migration des FK existantes sans perte** : `lieu_aerien.equipe_aerienne_id` et
  `poste_acridien.equipe_terrestre_id` doivent pointer vers `equipe` unifiée.
- **Séquencement** : #602 (équipe) et #604 (site) sont les fondations ; #603, #605, #607 en
  dépendent ; #608 (vol) dépend de #604 ; #610 et #609 ferment le lot.

## Hors scope — acté, pas oublié

- **Barycentre opérationnel** (§2 du document, aide à la décision pour déplacer la base principale).
  Le document indique lui-même que **la méthode de calcul n'est pas validée par les responsables
  métier**. Seul le prérequis — l'historique des positions via `site_aerienne_position` — est
  couvert ici.
- **Entité fournisseur / dépôt central** pour les approvisionnements. Non exigée par le document ;
  `approvisionnement` reste une saisie manuelle simple.
- **Contrainte SQL `EXCLUDE USING gist`** contre les chevauchements temporels (`equipe_aeronef`,
  `site_aerienne_position`). Validation **applicative** uniquement dans ce lot.
- **Trigger d'immutabilité de `equipe.type`.** L'immutabilité est garantie par la seule absence du
  champ dans le schéma Pydantic `*Update`. Une écriture directe en base peut la violer.
- **Suppression de `utilisateur.chef_de_base_id` / `chef_equipe_id`.** Dette actée, chantier
  ultérieur.
- **Table de position dédiée pour l'EMT.** Décision explicite : la dériver des interventions.
- **Adaptation de l'UI mobile** au nouveau contrat (cf. Conséquences).

## Questions métier que cette modélisation n'ouvre plus

Des 9 questions d'ADR-014 (`docs/questions-metier-fiche-de-vol.md`), **cinq tombent** parce que
l'objet qui les portait n'est pas repris :

| # ADR-014 | Question | Pourquoi elle tombe |
| --- | --- | --- |
| 3 (partie météo) / A3 | La météo relevée par le pilote fait-elle foi contre celle du chef de base ? | Pas de météo sur `vol` : un seul relevé, celui de `traitement_rotation`. |
| 6 / E1, E2 | Ventilation des heures par type de vol × période | Pas de cumuls. Le type est porté par `vol`, la ventilation est une requête de reporting, pas une décision de modèle. |
| 7 / A2 | Potentiel cellule et grande visite : relevé du jour ou compteur ancré ? | Pas de carnet de bord, pas de potentiel au référentiel aéronef. |
| 9 / B5, B6 | Les rotations existent-elles au moment de la saisie du vol ? | Pas de `vol.rotation_id`, donc pas de rapprochement à arbitrer. Le lien va vers `traitement_aerien` (0..1) et `prospection` (1:N), tous deux **optionnels**. |
| 4 (partiel) / B1 | Qui tient le stock et à quel grain ? | **Tranchée** : le site principal, par (pesticide, unité), par agrégation des mouvements. |

## Questions métier qui restent ouvertes

Aucune migration du lot ne doit les préempter.

1. **Le type de vol « mixte »** (ADR-014 §2, questionnaire A1). Présent sur la fiche papier, absent
   du modèle, définition métier non établie. `type` est un CHECK : l'ajouter plus tard est une
   migration de contrainte, pas une refonte — **à condition de ne pas construire de règle qui
   suppose qu'un vol a un seul type**.
2. **La géométrie d'un vol de prospection** (ADR-014 §3, questionnaire D1). La relation 1:N
   `vol → prospection` permet plusieurs relevés ponctuels sous un même vol, ce qui **contourne** le
   problème sans le résoudre : on ne sait toujours pas si le terrain veut une trace de survol. Si
   oui, elle se posera sur `vol`, pas sur `prospection`.
3. **La définition métier de « base secondaire »** (ADR-014 §8, questionnaire A4) : second stand,
   base de repli pour la nuit, ou simple drapeau « pas la base habituelle » ? Le modèle prend acte
   que stand et base secondaire sont **deux attaches distinctes sur `vol`** (décision 1) sans
   trancher ce que la seconde signifie. Si elle s'avère être un simple drapeau, une des deux FK
   devient inutile.
4. **L'aérien : moyen ou type de traitement ?** (ADR-014 §1, questionnaire C1). Un chantier commencé
   à l'aéronef et terminé à l'atomiseur reste inreprésentable — la spécialisation
   `AERIEN | TERRESTRE` est disjointe totale. Ce lot ne la touche pas.
5. **La « quantité perdue »** : déclarée (fuite, fût percé) ou calculée (théorique − relevé) ?
   (ADR-014 §5, questionnaire B2). `mouvement_pesticide` ne porte **pas** de type `perte` : un écart
   de solde est aujourd'hui muet. À trancher avant d'ajouter un quatrième type de mouvement.
6. **Les fûts** (questionnaire B3). Compteur de fûts de la fiche papier : unité de conditionnement
   ou unité de mesure ? Non modélisé ; `unite` ne connaît que L et kg.

## Références

- `docs/adr/ADR-011-fiche-vol-et-releve-meteo-cadrage.md` — cadrage initial de la fiche de vol.
- `docs/adr/ADR-014-vol-et-rotation-deux-faits-deux-acteurs.md` — analyse des fiches papier,
  9 questions ouvertes.
- `docs/adr/ADR-017-abandon-fiche-de-vol.md` — abandon, migration `0080`.
- `docs/questions-metier-fiche-de-vol.md` — questionnaire terrain correspondant.
- « Cadre conceptuel et instructions de gestion des opérations aériennes de lutte antiacridienne »
  — document de référence métier, source externe au dépôt.
- Migrations citées : `0054`, `0063` (FK défaites), `0066` (cohérence équipe/base), `0080`
  (suppression de la fiche de vol).
