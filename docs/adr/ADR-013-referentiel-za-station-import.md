# Import du référentiel réel (ZA/PA/Station), nouvelle entité Zone Anti-Acridienne, région/district/commune normalisés

**Contexte** : `poste_acridien`/`station_fixe` ne portaient que des fixtures de démo inventées
(5 PA fictifs, 15 stations). L'utilisateur a fourni le fichier `Station_intensive.xlsx` (export
réel du réseau intensif, colonnes `CODE ZA`, `ZA`, `PA`, `Station`, `LAT_DD`, `LNG_DD`,
`Code_nature`, `COMMUNE`, `DISTRICT`, `REGION`, 97 lignes, `Code_nature == 'int'` partout). Deux
constats à l'analyse :

1. Une colonne `ZA` (`ZA1`…`ZA6`, ex. "Befandriana sud") regroupe plusieurs PA (17 PA au total,
   2 à 3 par ZA) — confirmée par l'utilisateur comme "zone anti-acridienne", un niveau
   organisationnel IFVM au-dessus du poste acridien, absent du modèle jusqu'ici.
2. Un même PA a des stations dans des communes, districts, et parfois régions administratives
   différents (ex. PA "Amboasary" : stations en région Androy ET Anosy). `poste_acridien.region`
   (texte libre, un seul par PA) est donc un défaut de modélisation : `region` n'est pas
   fonctionnellement dépendant de `pa_id`, mais de `station_id`.

**Décision** :

- Nouvelle entité `zone_anti_acridien` (ZA), 1:N vers `poste_acridien` via `poste_acridien.za_id`
  (participation totale des deux côtés — tout PA appartient à une ZA).
- `poste_acridien.region` supprimée.
- Commune/District/Région normalisés en trois tables (`region`, `district`, `commune`), et
  `station_fixe.commune_id` référence `commune` (district/région dérivés par jointure, non
  dupliqués sur la station). C'est la vraie dépendance : `station → commune → district → region`,
  hiérarchie administrative de Madagascar déjà documentée dans `CONTEXT.md`. Normalisé plutôt que
  laissé en texte libre car c'est une donnée de référence stable pour une entité qui ne bouge pas
  (contrairement à `prospection.region`/`traitement.region`, qui restent du texte libre à dessein :
  un instantané figé au moment de la fiche, pas une donnée de référence).
- Les fixtures de démo (`poste_acridien`/`station_fixe`) sont purgées en migration plutôt que
  migrées — elles n'ont aucune valeur réelle, et 3 prospections de démo qui les référençaient sont
  détachées (`station_id = NULL`, FK déjà nullable).
- Codes générés (absents du fichier source) : `PA-<NOM-SLUG>` pour un poste (noms de PA vérifiés
  uniques globalement dans le fichier), `ST-<PA-SLUG>-<NN>` pour une station, numérotée dans
  l'ordre du fichier au sein de son PA (deux noms de station se répètent entre PA différents :
  "Anjaraday", "Andranomasy" — d'où le besoin d'un code stable indépendant du nom).
- `GET /zones-anti-acridiennes` ajouté (lecture seule, même pattern que `/postes-acridiens`) et
  `zones_anti_acridiennes` ajouté au payload `GET /referentiel/pull`.

**Effet de bord découvert et corrigé en cours de route** : deux migrations Alembic distinctes
partageaient le même identifiant littéral `"0025"` (collision réelle, pas une simple branche) —
renommée en `0026` avant d'empiler la migration ZA dessus. Cette même migration 0026 (contrainte
`type_station IN ('xerophyle','mesophyle','hydrophyle')`) n'avait jamais été exécutée contre des
données réelles : la DB de dev portait encore d'anciennes valeurs (`bas_fond`, `riziere_bordure`)
d'une classification différente (usage du sol, pas biotope) sans correspondance fiable vers la
nouvelle — remises à `NULL` plutôt que mappées au hasard.

**Alternative rejetée** : garder `commune`/`district`/`region` en texte libre sur `station_fixe`
(cohérent avec `prospection.region`). Rejetée après clarification : ces derniers sont des
instantanés d'événement (doivent figer la valeur au moment de la fiche même si la géographie
administrative est renommée plus tard), alors que `station_fixe` est une donnée de référence
stable — exactement le cas que la normalisation est censée couvrir, pas une exception à la règle
du projet.
