# Fiche de vol & relevé météo — note de cadrage, arbitrage produit requis

**Statut** : *Proposé* — aucune migration ne doit être écrite avant arbitrage (cf. ADR-009, qui
range le lot 5 en `needs-info` ; l'issue porte en pratique `needs-triage`, le label `needs-info`
n'ayant été créé qu'ensuite dans le tracker — et `docs/design_handoff_web/PROMPT.md` § Lot 5 :
« ne tranche pas seul »).
**Issue** : #125. **Sources** : `docs/design_handoff_web/README.md` §8 ; bloc
`data-screen-label="Fiche de vol et meteo"` du prototype (lignes 740-812) et ses données JS
`vols` / `meteo` (lignes 1481-1493).

---

## 1. Ce que la maquette demande

Écran en deux colonnes (`1fr 1fr`) :

- **Gauche** — carte « Fiche de vol · VOL‑2026‑0042 », sous-titrée *aéronef MDG‑A21 · pilote
  Rakoto A. · base Ihosy · 2026‑08‑12*. Tableau : n° de vol (V1…V4), décollage → atterrissage,
  durée, n° de cuve, badge de rapprochement (`Rapproché` / `Sans rotation`). Pied de carte ambre :
  « Le vol V4 n'a pas de rotation correspondante dans la fiche de traitement — à arbitrer avec le
  chef de base », avec un bouton **Rapprocher**. Puis un panneau à trois agrégats : heures de vol
  `4 h 25`, pesticide embarqué `1 060 l`, rotations rapprochées `3 / 4`.
- **Droite** — carte « Relevé météo · station ST‑014 », sous-titrée *« Saisie quotidienne —
  conditionne l'autorisation de traitement »*. Tableau : date, T° min, T° max, pluie (mm), vent
  (m/s), badge traitement. Encart : « au-delà de **5 m/s** de vent ou en cas de pluie le jour même,
  le traitement est déconseillé et la fiche porte un avertissement ».

## 2. Ce qui existe déjà en base (vérifié)

| Objet | État | Fichier |
|---|---|---|
| `traitement` (`AERIEN` / `TERRESTRE`) | existe | `app/infrastructure/traitement_model.py` |
| `traitement_aerien` (`pilote`, `mecanicien`, `chef_de_base_id`, `nb_rotations`, `total_pesticide_l`) | existe | idem |
| `traitement_rotation` (`numero`, **`numero_cuve`**, `produit_id`, `quantite_l`, `temperature_debut_c/fin_c`, **`vent_debut_ms` / `vent_fin_ms`**) | existe, `UNIQUE(traitement_aerien_id, numero)` | idem |
| `station_fixe` (`code`, `nom`, `pa_id`, lat/lon/alt, `actif`) | existe | `app/infrastructure/referentiel_model.py` |
| Rôles utilisateur | `prospecteur, chef_equipe, agent_encadreur, pilote, mecanicien, chef_de_base, admin` | `alembic/versions/0001_initial.py` |
| `fiche_vol`, `vol`, `releve_meteo` | **inexistants** — ni modèle, ni route, ni schéma mobile | — |

**Art antérieur à connaître** : le lot 5 avait déjà été anticipé, et dans le même sens que ce que
propose cette note.

- `audit_log.fiche_type` autorise **déjà** les valeurs `'vol'` et `'meteo'`
  (`ck_audit_log_fiche_type`, `app/infrastructure/prospection_model.py:379`) : la traçabilité de ces
  deux objets était prévue dès l'origine.
- La migration `0010_add_crt_tables.py:242-245` pose un commentaire SQL explicite sur la colonne :
  *« Cle de croisement (convention de saisie, pas une FK garantie) avec la future table fiche_vol —
  hors perimetre de cette migration »*. C'est exactement le constat du point 1 ci-dessous, déjà
  écrit en base.

Deux conséquences immédiates :

1. **Le n° de cuve, clé de rapprochement voulue par la maquette, existe déjà** sur
   `traitement_rotation.numero_cuve` — mais **sans contrainte d'unicité**, et le commentaire SQL
   cité plus haut le qualifie lui-même de « convention de saisie, pas une FK garantie ». Il n'est
   unique que dans
   le contexte d'un `traitement_aerien`. Un `C‑101` peut donc réapparaître un autre jour ou sur une
   autre base : *le rapprochement par n° de cuve seul est ambigu*. Il faut lui adjoindre au minimum
   la date et la base.
2. **Le vent est déjà saisi deux fois dans le futur système** : `traitement_rotation.vent_debut_ms`
   / `vent_fin_ms` (mesure ponctuelle en vol) et le `releve_meteo` quotidien de station. Ce ne sont
   pas les mêmes faits et il ne faut pas les fusionner — mais il faut décider lequel fait foi
   (§5.4).

## 3. Modèle ER proposé

### 3.1 `fiche_vol` — entité forte

`id` (PK, UUID) · `numero` (`VOL-2026-0042`, **UNIQUE** — clé candidate métier) · `date_vol` ·
`aeronef` · `pilote_id` → `utilisateur` · `base_id` · `chef_de_base_id` → `utilisateur` ·
`created_at` / `updated_at`.

Deux choix à trancher :

- **`aeronef`** : simple colonne texte (immatriculation `MDG-A21`) ou entité à part entière ? Règle
  de classification : un descripteur devient entité dès qu'il porte ses *propres* descripteurs
  (type d'appareil, capacité de cuve, heures de cellule, propriétaire). Si l'IFVM suit un parc,
  c'est une entité `aeronef(immatriculation PK, …)` ; sinon une colonne. **Par défaut : colonne**,
  faute d'exigence connue.
- **`base_id`** : « base Ihosy » n'a pas de table. Trois options — réutiliser `poste_acridien`,
  réutiliser `station_fixe`, ou créer `base_aerienne`. Une base aérienne n'est pas un poste
  acridien ; sans confirmation, une colonne texte est préférable à une FK fausse.

### 3.2 `vol` — **entité faible** de `fiche_vol`

`V1…V4` n'a aucun sens hors de sa fiche : c'est un discriminant, pas un identifiant.

PK = `(fiche_vol_id, numero)` · `heure_decollage` · `heure_atterrissage` · `numero_cuve` ·
`rotation_id` (nullable, cf. §3.4).

Cardinalité : `fiche_vol` 1 —— N `vol`, participation **totale** côté `vol` (un vol n'existe pas
sans fiche), et au moins un vol par fiche.

**`duree` est un attribut dérivé** (`heure_atterrissage − heure_decollage`) : à calculer, pas à
stocker. Le stocker crée une redondance qu'aucune contrainte ne protège.

### 3.3 `releve_meteo` — entité forte à clé composite naturelle

`id` (PK technique) · `station_fixe_id` → `station_fixe` · `date_releve` · `t_min_c` · `t_max_c` ·
`pluie_mm` · `vent_ms` · `saisi_par_id` → `utilisateur` · `saisi_le`.

Clé candidate : **`(station_fixe_id, date_releve)`** → contrainte `UNIQUE`. C'est ce qui donne son
sens à « saisie quotidienne » : un relevé par station et par jour, et l'upsert de sync s'appuie
dessus.

**Le badge `Autorisé` / `Limite` / `Déconseillé` ne doit pas être stocké.** Il est fonctionnellement
déterminé par `(vent_ms, pluie_mm)` et le seuil ; le stocker introduit la dépendance
`(vent_ms, pluie_mm) → statut` dont le déterminant n'est pas superclé — violation de BCNF, avec
l'anomalie classique : modifier le vent sans recalculer le badge laisse une ligne qui se contredit
elle-même. Si le seuil doit pouvoir évoluer dans le temps, ce n'est pas le *résultat* qu'il faut
stocker mais le *seuil appliqué* (§5.2).

Vérification de forme normale : dans les trois relations, tout déterminant non trivial est une
superclé — **BCNF atteint**, sans sacrifice de préservation des dépendances.

### 3.4 Le rapprochement vol ↔ rotation

Trois modélisations possibles :

| | Modèle | Pour | Contre |
|---|---|---|---|
| **(a)** | FK nullable `vol.rotation_id` → `traitement_rotation.id`, avec `UNIQUE` partiel sur `rotation_id` (1:1 optionnel des deux côtés) | Persiste la décision, donc le bouton « Rapprocher » a un effet ; `NULL` exprime exactement le cas V4 | Suppose qu'un vol ↔ au plus une rotation |
| **(b)** | Table d'association `vol_rotation(vol_id, rotation_id, rapproche_par, rapproche_le)` | Supporte le N:N si un vol couvre plusieurs rotations | Plus lourd si le 1:1 suffit |
| **(c)** | Jointure calculée à la volée sur `numero_cuve` | Aucune migration | Rien à persister → « Rapprocher » n'a pas d'effet, et l'ambiguïté du §2.1 devient ingérable |

**Recommandation : (a)**, avec le rapprochement automatique par `numero_cuve` traité comme une
*proposition* et non comme une vérité — la maquette dit elle-même « à arbitrer avec le chef de
base ». Ajouter `rapproche_par_id` / `rapproche_le` sur `vol` pour tracer l'arbitrage humain.
Basculer sur (b) si le métier confirme qu'un vol peut couvrir plusieurs rotations.

> **Hypothèse à confirmer** : dans le prototype, le bouton « Rapprocher » est un simple
> `onClick="{{ goTraitements }}"` (ligne 769), c'est-à-dire une **navigation** vers l'écran
> Traitements — pas une action d'écriture. Les options (a) et (b) supposent au contraire qu'il
> *persiste* une décision. Si le bouton ne fait que renvoyer vers la fiche de traitement, l'option
> (c) redevient défendable et le lot n'a peut-être besoin d'aucune colonne de rapprochement.

### 3.5 Agrégats du panneau vert : tous dérivés

`heures de vol` = Σ des durées · `pesticide embarqué` = Σ `quantite_l` des rotations rapprochées ·
`rotations rapprochées` = `3 / 4`. **Aucun ne doit être une colonne.** `traitement_aerien` porte
déjà deux dénormalisations (`nb_rotations`, `total_pesticide_l`) sans chemin d'écriture unique
documenté ; n'en ajoutons pas une troisième avant d'avoir mesuré un besoin de performance réel.

## 4. Écart relevé entre le README et le prototype

Le README §8 ne décrit **que deux** états (`autorisé` / `déconseillé`). Les données JS du prototype
en portent **trois** :

| Vent | Pluie | Badge |
|---|---|---|
| 3,1 · 4,4 · 2,6 m/s | 0,0 | `Autorisé` (vert) |
| **4,9 m/s** | 0,0 | **`Limite`** (ambre) |
| 5,8 m/s | 2,5 mm | `Déconseillé` (rouge) |

Il existe donc un **second seuil d'alerte non spécifié**, quelque part entre 4,4 et 4,9 m/s. Sa
valeur doit être arbitrée, pas devinée (§5.2).

## 5. Questions d'arbitrage — à trancher avant toute migration

### 5.1 Périmètre et propriété de la saisie météo
Quel rôle saisit le relevé quotidien ? Aucun rôle « observateur météo » n'existe. Trois options :
réutiliser `chef_de_base` (déjà l'arbitre du rapprochement), réutiliser `agent_encadreur` pour un
agent rattaché à la station, ou **créer un rôle dédié** — ce qui suppose d'étendre la contrainte
`ck_utilisateur_role` et donc une migration sur `utilisateur`. **Et sur quel support** : web uniquement, ou aussi mobile ? Si mobile, `releve_meteo`
entre dans le périmètre de sync hors-ligne, ce qui impose de trancher un point de plus : un relevé
météo est une donnée *transactionnelle*, pas un référentiel — le protocole d'ADR-007 (pull par
upsert idempotent sur l'`id`, soft-delete via `actif` plutôt que suppression physique — la seule
dérogation connue étant le hard delete de `campagne`, qu'ADR-007 signale lui-même comme une
incohérence à corriger) est-il repris tel quel, ou faut-il un push depuis le terrain ? Dans les
deux cas : régénérer
`mobile/src/lib/api-schema.generated.ts` et faire passer `npm run check:schema-drift`.

### 5.2 Les seuils
- Confirmer `vent > 5 m/s` et « pluie le jour même » comme seuil de *déconseillé* (pluie : toute
  valeur `> 0`, ou un minimum en mm ?).
- Fixer le seuil de l'état intermédiaire `Limite` révélé par le prototype (§4).
- Les seuils sont-ils **globaux et fixes** (constantes en code), ou **paramétrables par station /
  par campagne** ? Si paramétrables, il faut une table de paramètres et stocker le seuil appliqué
  sur le relevé pour que les fiches anciennes restent lisibles.

### 5.3 Clé de rapprochement
Confirmer que le rapprochement est bien **1 vol ↔ au plus 1 rotation** (option (a)) et non N:N.
Confirmer que la paire `(date, base)` suffit à lever l'ambiguïté du n° de cuve — sinon, faut-il
rendre `numero_cuve` unique par jour et par base ?

### 5.4 Effet du seuil sur la fiche de traitement : avertissement ou blocage ?
**Recommandation : avertissement non bloquant.** Trois raisons :
1. `traitement_rotation` porte déjà le vent **mesuré sur place** ; une station à plusieurs dizaines
   de kilomètres ne peut pas invalider une mesure de terrain.
2. Un blocage serait inapplicable hors-ligne : le mobile ne dispose pas nécessairement du relevé du
   jour au moment de la saisie.
3. Le précédent existe déjà dans le schéma : `prospection.avertissements` (`list[str]`, migration
   `0024`) porte exactement ce type de signal non bloquant. `traitement` n'a pas encore d'équivalent
   — l'ajouter suivrait une convention établie plutôt que d'en inventer une.

Si le métier veut malgré tout un blocage, il faut décider ce qui se passe quand le relevé est
**absent** : bloque-t-on par défaut (sûr, mais paralyse le terrain) ou autorise-t-on (permissif) ?

### 5.5 Rattachements manquants
`aeronef` (colonne ou entité ?) et `base` (`poste_acridien`, `station_fixe`, nouvelle table, ou
texte ?) — cf. §3.1.

### 5.6 `fiche_vol` et `traitement_aerien` décrivent-ils la même journée ?
C'est la question la plus structurante et elle n'apparaît pas dans la checklist de l'issue. Le
sous-titre de la carte (prototype ligne 745 : *aéronef · pilote · base · date*) redit ce que
`traitement_aerien` porte déjà (`pilote`, `mecanicien`, `chef_de_base_id`, `nb_rotations`,
`total_pesticide_l`). Trois lectures possibles :

1. **`fiche_vol` est le pendant aviation de `traitement_aerien`** pour la même journée et la même
   base → alors la relation est 1:1 et le rapprochement vol ↔ rotation devient une simple
   correspondance interne, pas un appariement entre deux mondes.
2. **Une fiche de vol couvre plusieurs traitements** (l'appareil dessert plusieurs chantiers dans
   la journée) → relation N:N par l'intermédiaire des rotations, et c'est bien le §3.4 qui
   s'applique.
3. **Les deux objets sont saisis par des acteurs différents et volontairement indépendants** (le
   pilote consigne ses vols, le chef de base consigne son traitement) → la duplication de `pilote`
   et de la date est assumée, et c'est précisément ce que l'écran sert à confronter.

**Le §3 suppose implicitement la lecture 2 ou 3.** Si c'est la 1, une bonne partie du modèle
proposé disparaît. À trancher **avant** le reste du §5.

### 5.7 Quelle station météo fait foi pour une fiche ?
Le prototype juxtapose « base Ihosy » (ligne 745) et « station ST‑014 » (ligne 782) sans dire ce
qui les relie. Le relevé est rattaché à une `station_fixe` (§3.3), mais rien ne dit **quelle**
station conditionne **quel** traitement : la plus proche du chantier ? une station rattachée à la
base ? un choix manuel de l'opérateur ? Sans cette règle, l'avertissement du §5.4 n'est pas
calculable.

## 6. Conséquence

Trois points du §3 sont énoncés à l'impératif et ne figurent volontairement **pas** dans la liste
d'arbitrage : `duree` non stockée (§3.2), badge météo non stocké (§3.3), agrégats non stockés
(§3.5). Ce ne sont pas des choix produit mais des conséquences de la normalisation — les stocker
créerait des dépendances fonctionnelles dont le déterminant n'est pas superclé, donc des lignes
capables de se contredire. Ils restent contestables, mais sur le terrain de la performance
(dénormalisation mesurée), pas sur celui du métier.

Tant que §5 n'est pas tranché, **aucune migration Alembic, aucune route, aucun écran**. L'ordre de
traitement compte : **§5.6 d'abord** (si `fiche_vol` recouvre `traitement_aerien`, une bonne part du
§3 tombe), puis le reste. Une fois
l'arbitrage rendu, le lot 5 se reformule en tâches codables (migration `0029+`, routes, écran,
extension de la sync mobile si §5.1 l'exige) et l'issue #125 repasse en `ready-for-agent`.

---

## 7. Révision du 2026-08-24 — arbitrage partiel rendu

Le cahier des charges « Formulaire de gestion des heures de vol » (fourni par le porteur produit)
tranche l'essentiel du §5 **pour la fiche de vol**. Il ne dit **rien du relevé météo** : cette
moitié du lot reste entièrement ouverte (§7.4).

### 7.1 Questions du §5 désormais tranchées

| § | Question | Réponse | Effet sur le §3 |
|---|---|---|---|
| 5.6 | `fiche_vol` ↔ `traitement_aerien` : 1:1 ? | **Non.** La fiche est journalière **par aéronef** et couvre des vols de types hétérogènes, donc potentiellement plusieurs traitements, plusieurs prospections, et des vols rattachés à rien. | Lecture 2/3 confirmée ; le §3 tient. `CONTEXT.md` disait 1:1 — corrigé. |
| 5.3 | vol ↔ rotation : 1:1 ? | **Non — N:1.** « Une rotation (une cuve) nécessite au minimum 1 mise en place + 1 application » : une rotation vaut **au moins deux vols**. | **Invalide l'option (a) telle qu'écrite** (§3.4) : le `UNIQUE(rotation_id)` est faux. |
| 5.5 | `aeronef` : colonne ou entité ? | **Entité.** L'immatriculation est un identifiant unique et l'appareil porte sa compagnie (compagnie aérienne ou Armée malgache). | Contredit le « par défaut : colonne » du §3.1. |
| 5.5 | `base` : quelle table ? | **Ni `poste_acridien` ni `station_fixe`.** Deux lieux distincts et nouveaux : **base aérienne** et **stand de remplissage**, chacun en lat/lon/alt captées automatiquement hors ligne + nom saisi à la main. | — |
| 5.1 | Support de saisie | **Mobile obligatoire** : la géolocalisation est captée automatiquement hors ligne, et l'heure vient de l'horloge de l'appareil (que le cahier des charges demande de régler au préalable). | Le lot entre dans le périmètre de sync hors-ligne. |

### 7.2 Ce que le cahier des charges ajoute et que le §3 ignorait

- **Le type de vol** — `PROSPECTION | MEP | APPLICATION | CONVOYAGE | DIVERS`. C'est le concept
  central du modèle, et il est absent aussi bien du §3 que de la maquette. Il détermine à quoi le
  vol se rattache : une prospection, une rotation, ou rien.
- **Les signatures** — pilote, mécanicien, chef de base obligatoires ; consultant international si
  applicable. Le patron existe déjà : `traitement_signature` (`role`, `signataire_nom`,
  `horodatage`, `UNIQUE(fiche, role)`). À décliner en `fiche_vol_signature` plutôt qu'à réinventer.
- **Pilote et mécanicien sont externes à l'IFVM** (compagnie aérienne ou Armée malgache). Le §3.1
  proposait `pilote_id → utilisateur` : **c'est faux**. Le schéma avait d'ailleurs déjà tranché dans
  le bon sens — `traitement_aerien.pilote` et `.mecanicien` sont des colonnes `String(255)`
  (`traitement_model.py:125-126`), seul `chef_de_base_id` est une FK.
- **Le numéro de fiche est dérivé** : `[Date]-[Base numérotée]-[Immatriculation]`. Ce n'est pas une
  séquence mais une **clé naturelle composite**, ce qui contredit le `VOL-2026-0042` de la maquette
  (§3.1).
- **Les cumuls** — journalier, hebdomadaire, mensuel, total. Tous **dérivés**, comme la durée de vol
  (`heure_fin − heure_début`) : le §3.5 s'applique, aucune colonne. À noter : `CONTEXT.md` prévoyait
  « jour / décade / campagne » (unités acridiennes), le cahier des charges dit « jour / semaine /
  mois / total ». Divergence à trancher (§7.4).
- **Un champ observations** libre.
- **Une fiche signée téléchargeable** comme pièce justificative — hors modèle de données, mais
  détermine ce qu'une « signature » doit contenir (§7.4).

### 7.3 Modèle corrigé du rapprochement (remplace le §3.4)

La règle « N rotations ⇒ N mises en place + N applications » se traduit directement en contrainte,
au lieu de rester un contrôle applicatif :

```
vol.rotation_id  → traitement_rotation.id   (nullable, N:1)
UNIQUE (rotation_id, type_vol)              -- partiel : type_vol ∈ (MEP, APPLICATION)
CHECK  rotation_id IS NULL OR type_vol IN ('MEP','APPLICATION')
CHECK  prospection_id IS NULL OR type_vol = 'PROSPECTION'
```

« Exactement une mise en place et une application par rotation » devient une propriété du schéma.

Conséquence sur le §2.1 : **le n° de cuve n'est plus la clé de rapprochement**. Le cahier des
charges ne le mentionne jamais. Il peut rester une aide à la saisie (proposer la rotation
correspondante), mais le lien persisté est la FK, arbitrée par le chef de base — ce qui lève
l'ambiguïté relevée au §2.1 sans avoir à rendre `numero_cuve` unique.

### 7.4 Ce qui reste ouvert

1. **Base aérienne et stand de remplissage : référentiels ou relevés ponctuels ?** Le cahier des
   charges se contredit — il fait capter la position automatiquement et saisir le nom à la main
   (donc un relevé ponctuel, propre à la fiche), mais le format du numéro de fiche impose une
   **base numérotée** (donc un référentiel stable, avec un numéro).
2. **Unicité de la fiche.** « Une seule fiche par jour si possible » n'est pas une contrainte, mais
   le numéro `[Date]-[Base]-[Immatriculation]` est déjà pris si une seconde fiche est ouverte le
   même jour, sur la même base, pour le même appareil. Soit l'unicité est dure, soit le numéro
   porte un compteur.
3. **Nature de la signature.** Le patron `traitement_signature` atteste un nom et un horodatage. La
   « fiche signée téléchargeable » exige-t-elle davantage — un tracé graphique, une image ?
4. **Unité des cumuls** : décade (unité acridienne, déjà dans `CONTEXT.md`) ou semaine/mois (cahier
   des charges) ? Question d'affichage, sans effet sur le schéma tant que rien n'est stocké.
5. **Tout le relevé météo** — le cahier des charges n'en parle pas. Les §5.2, §5.4 et §5.7 restent
   intégralement ouverts, ainsi que le rattachement du relevé : `CONTEXT.md` prévoit une
   `station_meteo` **qui n'a jamais été implémentée** (seule `station_fixe` existe, migration
   `0004`). **Recommandation : scinder l'issue #125** — la fiche de vol est arbitrée et codable,
   la météo ne l'est pas.

### 7.5 Alerte sur la maquette

Le prototype §8 a été dessiné sur l'hypothèse « un vol = une rotation », que le cahier des charges
invalide. Trois écarts, dans l'ordre de gravité :

| | Prototype | Cahier des charges |
|---|---|---|
| Rapprochement | `V1…V4`, badge « 3 / 4 » | 3 rotations ⇒ **6 vols** (3 MEP + 3 applications) |
| Clé de rapprochement | n° de cuve | jamais mentionné |
| Types de vol | absents — tous les vols se valent | **5 types**, dont 3 ne se rapprochent de rien |
| Numéro de fiche | `VOL-2026-0042` | `[Date]-[Base]-[Immatriculation]` |

L'écran est à **redessiner**, pas seulement à implémenter : un tableau qui liste `V1…V4` sans
colonne « type de vol » ne peut pas représenter une journée réelle.

### 7.6 Arbitrage du 2026-08-24 sur les trois points ouverts du §7.4, et implémentation

| Question | Décision | Conséquence |
|---|---|---|
| Base aérienne / stand de remplissage | **Relevés ponctuels** portés par la fiche (nom saisi, position captée hors ligne) | Aucune nouvelle table de référentiel, aucun élargissement du périmètre ADR-007. Le « numéro de base » du format devient `fiche_vol.base_code`, saisi. |
| Unicité de la fiche | **Compteur dans le numéro** — seul `numero` est `UNIQUE` | « Une seule fiche par jour si possible » reste une convention. Le terrain n'est jamais bloqué : la 2ᵉ fiche du jour prend le suffixe `-02`. |
| Nature de la signature | **Nom horodaté + tracé manuscrit** (`signature_image`, data URI, nullable) | Diverge de `traitement_signature`, qui n'a pas de tracé. Coût de sync assumé (~20-50 Ko par signature) ; nullable pour que la fiche reste enregistrable avant le passage de signature. |

Restent ouverts : l'unité des cumuls affichée (décade *vs* semaine — sans effet sur le
schéma, rien n'étant stocké) et **tout le relevé météo**, désormais suivi séparément.

**Une violation de BCNF assumée, et une seule.** La fiche porte `compagnie` et
`immatriculation` alors que `immatriculation → compagnie` est une dépendance fonctionnelle
dont le déterminant n'est pas superclé de `fiche_vol`. Sortir une table `aeronef` la
lèverait, mais contredirait la décision « pas de nouveau référentiel » et ferait perdre
l'exploitant du jour lorsqu'un appareil change de compagnie. C'est donc une
**dénormalisation temporelle** délibérée, du même type que `cible` (« snapshot à la
création »), documentée par un `COMMENT ON COLUMN` dans la migration `0029`. Les trois
relations sont en BCNF par ailleurs.

**Ce que la base garantit maintenant seule**, sans contrôle applicatif :

```sql
UNIQUE (rotation_id, type_vol)                                   -- 1 MEP + 1 application max
CHECK  (rotation_id IS NULL OR type_vol IN ('MEP','APPLICATION'))
CHECK  (prospection_id IS NULL OR type_vol = 'PROSPECTION')
CHECK  (heure_fin > heure_debut)                                 -- un vol ne franchit pas minuit
```

La règle inverse — une rotation rapprochée doit avoir **les deux** vols — n'est pas
exprimable en contrainte de ligne ; elle est vérifiée à la validation de la fiche
(`valider_rotations_completes`), au même endroit que la complétude des signatures.

Migration `0029`, appliquée et annulée avec succès sur base vierge. Aucune colonne dérivée :
ni durée, ni cumul, ni décompte de rotations rapprochées.
