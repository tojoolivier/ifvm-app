# Mur — La journée aérienne

> **Statut : mur clos au Process Level, recadré en discovery le 30 août 2026.**
> Timeline, pivots et annotations (commandes, acteurs, vues de lecture, politiques,
> systèmes externes) sont posés. Ce mur est une **répétition de facilitateur**, produite par
> des agents à partir des fiches papier, du modèle en service et des ADR. **Il ne doit pas être
> projeté aux participants de la séance S2** : le guide d'atelier exige un mur vide au
> démarrage. Il sert à préparer les questions et à enrichir la réserve.

## Cadre de lecture — nous sommes en discovery

**Nous écrivons un projet, pas l'existant.** Le code en service — tables, contrainte de
`type_vol`, matrice des signatures — est un **brouillon déjà écrit**, pas une contrainte. Ce
qui n'y figure pas n'est pas un défaut : c'est ce qui reste à décider.

Deux conséquences sur la lecture de tout ce qui suit :

1. **Les mentions « n'existe pas », « colonne inexistante », « aucun endpoint »** décrivent
   l'état d'un brouillon, pas une dette. En particulier : l'absence d'écran mobile et
   d'endpoint de synchronisation pour la fiche de vol **est le périmètre du projet**, pas un
   écart à expliquer.
2. **Les points chauds `PC*` ci-dessous mélangent deux natures** — ce que nous pouvons trancher
   au bureau, et ce que seul le terrain sait. Ce mélange coûte une séance : on y débat de ce
   qu'il fallait demander, et on y demande ce qu'il nous appartenait de trancher.
   La coupe **fiche de vol** — `docs/event-storming/fiche-de-vol.md` — reprend cette matière
   séparée en **décisions `D*`** et **questions terrain `Q*`**. C'est elle, aujourd'hui, le
   document de travail. Ce mur-ci reste la matière brute, notamment pour la chaîne du produit
   et le compte-rendu de traitement, hors périmètre de la coupe.

## Retours du terrain

Les seules lignes de ce document qui ne viennent pas du bureau. Elles priment sur tout le reste.

### R1 — Le pilote vérifie la fiche de vol ; c'est pourquoi il ne la saisit pas

> **Complétée le 30 août 2026.** La première formulation de ce retour disait « le pilote et le
> consultant international ne saisissent pas ; ils signent ». C'était réducteur, et la précision
> apportée depuis change la nature du geste : **le rôle du pilote sur cette fiche est la
> vérification.** Il contrôle ce que le chef de base a écrit, et sa signature en est la trace —
> pas une approbation de forme.

**Ce que la vérification change.**

- **Ce que la signature du pilote atteste cesse d'être flou** : elle atteste un contrôle. La
  question « atteste-t-il ce qu'il a vu, ce qu'on lui a dit, ou seulement qu'il a lu ? » est
  répondue pour lui — elle reste ouverte pour le mécanicien, le chef de base et le consultant.
- **Un acte métier confirmé n'a aucune existence dans le brouillon.** Ni état, ni horodatage
  propre, ni — surtout — de geste à poser **quand la vérification échoue**. Un pilote qui trouve
  une erreur n'a aujourd'hui qu'une option : ne pas signer, ce qui bloque la journée entière
  sans en dire la raison. **C'est le manque le plus net révélé par la discovery.**
- **Il vérifie un texte écrit à partir de son propre récit**, sur des faits dont il est le seul
  témoin. La vérification est réelle, mais elle ne rattrape pas ce qu'il a mal raconté ou oublié
  au retour. D'où : *quand* vérifie-t-il, et *sur quoi* ?
- **Et quand le chef de base remplit la fiche d'un pilote absent, qui vérifie ?** La vérification
  saute-t-elle, ou quelqu'un l'assume-t-il ?

**Ce que ça tranche aussi.**

- **PC02 est à moitié réglé.** Ce n'est pas le pilote qui remplit la fiche de vol. Reste : qui,
  alors — le chef de base, le mécanicien, le rapportage ? et pour le CRT, la même personne ?
- **PC29 devient net.** Le consultant international est un signataire pur, extérieur, sans aucun
  autre geste dans la journée. Sa signature figure pourtant dans la matrice qui conditionne la
  validation : **son absence bloque la clôture, et rien ne prévoit ce cas.**
- **Le code est cohérent avec ce fait** sur un point : seul un `chef_de_base` peut créer une
  fiche de vol. C'est la seule règle de rôle du domaine, et le terrain vient de la confirmer.

**Ce que ça déplace — la correction la plus importante de ce mur.**

> ⚠️ **Le mur affirmait que l'hypothèse H1 (« une seule personne saisit toute la journée ») était
> fragile.** C'était faux, et pour une raison précise : le mur confondait *écrire* et *saisir*.
> Trois personnes écrivent simultanément dans trois lieux — le pilote son heure, le mécanicien
> son compteur, le chef de base son volume au stand. Mais si **aucune de ces écritures n'est une
> saisie**, H1 tient. Elle redevient l'hypothèse la plus probable, et non la plus menacée.

**La question que R1 ouvre, et qui commande tout le reste.**

Si le pilote ne saisit pas, **écrit-il quand même quelque chose ?**

| Si… | Alors… |
|---|---|
| Il écrit sur un carnet à bord, et quelqu'un recopie | Les faits de la bande « hors de vue » **existent** ; il faut un porteur entre le carnet et la saisie, et ce porteur n'est nulle part dans le modèle. |
| Il n'écrit rien, et raconte au retour | Les heures et les relevés en vol sont **reconstitués par un tiers à partir d'un récit oral**. La colonne `vol.temperature` que l'ADR-014 décide sans l'avoir construite ne doit alors **jamais** l'être : elle donnerait à une reconstitution l'apparence d'une mesure. |

**C'est la question à poser en premier en S2**, avant la bande « Lieu » — elle décide si PC01,
PC09 et PC40 portent sur des faits ou sur des récits.

**Ce que R1 ne règle pas, et qu'elle rend plus aigu.**

- **PC26.** Si le pilote ne fait que signer, la signature est son **unique** geste dans le
  système — et c'est justement l'endroit sans aucun contrôle de rôle. Comment signe-t-il ?
  On lui tend un appareil ? Il signe du papier qu'on numérise ensuite ?
- **PC30.** Le pilote est **le seul témoin** des faits en vol, il ne les enregistre pas, et il
  **signe le récit qu'un autre en a écrit**. Que certifie sa signature exactement — que le texte
  est fidèle à ce qu'il a vécu, ou seulement qu'il l'a lu ?
- **PC06.** Le rattachement vol ↔ rotation est forcément le fait de celui qui saisit. Le cercle
  se resserre, mais le geste reste sans propriétaire nommé.

### R2 — La matrice des acteurs de l'application

Source : planche « Acteurs principaux de l'application ».

| Fiche | Côté mobile — qui saisit |
|---|---|
| Prospection terrestre | Prospecteur · Chef de base · Chef de zone |
| **Prospection aérienne** | Chef de base · Chef de zone |
| Traitement terrestre | Prospecteur · Responsable traitement terrestre · Chef de base · Chef de zone |
| Traitement aérien | Chef de base · Chef de zone |
| **Fiche de vol** | Chef de base · **Pilote — *pour signature*** |

| Rôle portail web | Qui |
|---|---|
| Vérificateur | Chef de base · Chef de zone · Cellule de veille |
| **Validateur** | **Cellule de veille — elle seule** |
| Admin | Cellule de veille · Directeur Technique · Directeur du Système d'Information et de la Communication |

**Ce que ça tranche.**

- **R1 est confirmée par écrit.** La planche annote elle-même le pilote « *pour signature* ».
- **PC27 est réglé.** Celui qui valide, c'est la **cellule de veille**, et elle seule.
- **PC26 cesse d'être une question ouverte et devient un défaut.** La règle métier existe et elle
  est nette ; le code, lui, laisse **n'importe quel utilisateur authentifié** signer et valider.
  Ce n'est plus « confiance assumée ou faille » : c'est un écart entre une règle écrite et son
  implémentation. À corriger, pas à débattre.

**Ce que ça ouvre — trois écarts nouveaux.**

- **PC50 🔴 — Vérifier et valider sont deux étapes, le modèle n'en connaît qu'une.**
  La planche distingue un rôle *vérificateur* (chef de base, chef de zone, cellule de veille) et
  un rôle *validateur* (cellule de veille). Le modèle ne porte que `brouillon | validee`.
  Où passe la vérification ? Est-ce un état manquant, ou un geste hors application ?
- **PC51 🔴 — Le consultant international et le mécanicien n'existent pas dans la matrice.**
  Or le modèle exige leur signature : la contrainte de rôle admet `PILOTE`, `MECANICIEN`,
  `CHEF_DE_BASE`, `CONSULTANT_INTERNATIONAL`, et la matrice des signatures obligatoires
  conditionne la validation. **Deux signataires que le code réclame n'ont aucune place dans
  l'application.** Comment signent-ils ? Sur l'appareil du chef de base ? Sur papier ?
- **PC52 🟠 — Le « chef de zone » n'apparaît nulle part sur ce mur.** Aucune des sept lentilles
  ne l'a produit, et il saisit pourtant quatre fiches sur cinq. Que fait-il pendant la journée
  aérienne, et où est-il physiquement ?

**Et un renversement sur H7.** La **prospection aérienne est une fiche à part entière**, saisie
sur mobile. Le silence relevé en PC43 — aucune lentille n'a produit d'événement de relevé de
point en vol — ne veut donc pas dire que la chose n'existe pas : il veut dire que **le bureau ne
sait pas comment elle se remplit**. La question reste la même, mais elle n'est plus une
hypothèse à tuer : c'est un écran existant dont on ignore le mode d'emploi réel.

### R3 — Le processus de lutte officiel, en onze étapes

Source : planche « Processus de lutte ».

> 1. Si un traitement est nécessaire · 2. Choisir une méthode de lutte · 3.1 Choisir l'équipement
> de traitement · 3.2 Définir le mode d'application · 3.3 Choisir un insecticide ·
> **4. Étalonner l'équipement de traitement** · **5. Informer la population locale** ·
> **6. Baliser le lieu infesté** · 7. S'assurer des conditions météo favorables ·
> 8. Traiter les criquets de façon sûre et efficace · **9. Évaluer le taux de mortalité** ·
> 10. Assurer l'entretien des appareils · 11. Soumettre un rapport

**Défaut de couverture du mur — à énoncer sans le maquiller.** Quatre étapes officielles n'ont
produit **aucun événement** dans les 212 rendus par les sept lentilles. Elles manquent :

| Étape officielle | Ce qui manque au mur |
|---|---|
| 4 · Étalonner l'équipement | Aucun événement d'étalonnage. Le débit de la rampe conditionne pourtant la dose à l'hectare — et donc toute la comptabilité matière de la bande 4. |
| 5 · Informer la population locale | Aucun événement. Un geste envers des tiers extérieurs, avant l'épandage, qui n'a ni acteur ni trace. |
| 6 · Baliser le lieu infeste | Aucun événement. **Et c'est une action au sol qui conditionne un vol** : quelqu'un est sur le bloc avant l'aéronef. |
| 9 · Évaluer le taux de mortalité | Aucun événement — il tombe le lendemain, hors de la journée. Frontière à confirmer, pas à supposer. |

Les étapes 1 à 3.3 sont en amont du périmètre (décision de traitement). L'étape 10 correspond à
E69/E85, l'étape 11 à E119–E121.

**PC53 🔴 — Qui étalonne l'équipement, quand, et où le résultat est-il écrit ?** Sans le débit
réel, « quantité épandue » et « surface traitée » ne se relient pas — c'est le chaînon manquant
de PC42.
**PC54 🟠 — Qui balise le bloc, et à quel moment par rapport au décollage ?** Un acteur au sol,
sur le bloc, absent de la bande « Lieu ».
**PC55 🟡 — Qui informe la population locale, et cela laisse-t-il une trace ?**

### R4 — Les règles d'épandage

Source : planche des conditions de bon dépôt.

> **Ne jamais traiter** pendant la période chaude de la journée, quand la température est élevée
> — généralement **entre 11 h et 16 h** : l'air chaud au ras du sol s'élève et empêche les
> gouttelettes de se déposer sur les criquets.
> **Ne jamais traiter** lorsque la vitesse du vent est **inférieure à 1 m/s**.
> **Ne jamais traiter** lorsque la vitesse du vent est **supérieure à 6 m/s**.

**Ce que ça tranche.** **PC20 est réglé** : le seuil existe, il est écrit, il est chiffré. La
fenêtre d'épandage est **1 à 6 m/s**, hors de la tranche 11 h – 16 h.

**Ce que ça révèle — et c'est le résultat le plus exploitable de la journée.**

Ces trois règles sont **vérifiables sur les données déjà enregistrées**. Le modèle stocke le vent
en **m/s** — la même unité que la règle — au début et à la fin de chaque rotation, la température
en degrés, et les heures de début et de fin de chaque vol.

> **PC56 🔴 — Trois règles métier absolues, les données pour les vérifier, et rien qui les
> vérifie.** Aucune contrainte, aucune alerte, aucun contrôle à la validation. Une rotation
> épandue à 7 m/s ou à 13 h entre aujourd'hui dans la base exactement comme une rotation
> conforme. Questions à trancher : la règle est-elle **bloquante** (on refuse la saisie),
> **avertissante** (on saisit mais on signale), ou **descriptive** (on enregistre, et l'écart
> se lit après coup dans un rapport) ? Et **qui doit le voir** — le chef de base au moment de
> la saisie, le vérificateur, ou la cellule de veille à la validation ?

**Et une conséquence sur la forme de la journée.** L'interdit de 11 h – 16 h signifie que la
journée aérienne n'est **pas un continuum** : c'est une fenêtre matinale et une fenêtre de fin
d'après-midi, séparées par une coupure de cinq heures. Le mur, lui, a été construit comme une
seule séquence. **PC57 🟠 — Que se passe-t-il pendant la coupure ?** Les papiers se remplissent-ils
là, à chaud, plutôt que le soir de mémoire ? Si oui, une partie de la bande 6 change de place et
de nature — et la contradiction fondatrice s'en trouve allégée.

---

## Phrase de périmètre

> « Depuis le briefing du matin sur la base jusqu'à la clôture de la fiche du jour, ce qui se
> passe pendant une journée de traitement aérien à l'IFVM. »

## Lentilles (Phase 1, mode FLOOD, aveugles les unes aux autres)

| Code | Lentille | Événements rendus |
|---|---|---|
| `N` | Le chemin nominal — la journée ordinaire, de bout en bout | 28 |
| `P` | Le pilote — celui qui déclenche et qui est seul témoin en l'air | 30 |
| `B` | Le chef de base — celui qui subit l'aval et doit raconter ce qu'il n'a pas vu | 31 |
| `M` | Le mécanicien et la machine — heures, carnet de bord, conformité | 30 |
| `Q` | Le produit, la cuve, le fût — comptabilité matière et redevabilité | 28 |
| `D` | La panne, le retour en arrière et la débrouille | 30 |
| `A` | *As-built* — ce que le code en service prétend qu'il se passe | 35 |
| | **Total** | **212** |

**Réserve de la lentille N et B** : ces deux agents ont désobéi à la consigne et ont lu
`CONTEXT.md` et l'ADR-011. Leur contribution est partiellement contaminée par le modèle. Tout
ce qui, chez elles, ressemble à une phrase d'ADR (« rotation = 1 MEP + 1 APPLICATION ») est
marqué ⚠️ et ne compte pas comme confirmation terrain.

---

## Timeline

Les colonnes **Lieu** reprennent la bande de la section 03 du guide d'atelier :
`Bureau · Base · Stand · En vol · Bloc`. La colonne **Trace** répond à la question qui décide
de tout : *est-ce que quelqu'un, à cet endroit, à ce moment, avait de quoi l'écrire ?*
`✍️` = oui · `🧠` = non, ce sera reconstitué plus tard · `?` = inconnu, à établir en séance.

### Bande 0 — L'ouverture de la journée

| # | Événement | Lieu | Trace | Lentilles |
|---|---|---|---|---|
| E01 | Le briefing du matin a eu lieu | Base | ? | N1·N2, P1, B1, M1 |
| E02 | Le chef de base a décidé des blocs à traiter et du nombre de rotations | Base | ? | B7, B8 |
| E03 | Le chef de base a attribué une cuve à l'aéronef | Base | ? | B2 |
| E04 | Le mécanicien a ouvert le carnet de bord et consigné son heure d'arrivée | Base | ✍️ | M2, M3 |
| E05 | Le mécanicien a fait la visite avant vol | Base | ✍️ | M4, M5, N3, P2 |
| E06 | Une anomalie a été relevée à la visite avant vol | Base | ✍️ | M6 |
| E07 | Le décompte des heures avant la grande visite a été établi | Base | ? | M7, M8 |
| E08 | Une pièce de rechange s'est avérée manquante | Base | ? | M29 |
| E09 | L'appareil a été immobilisé jusqu'au lendemain | Base | ? | M30 |
| E10 | Le carburant disponible a été relevé | Base | ✍️ | M9 |
| E11 | Le chef de base a autorisé le ravitaillement | Base | 🧠 | M10 |
| E12 | L'aéronef a été avitaillé en carburant | Base | ? | M11, N4 |
| E13 | La rampe de pulvérisation a été montée | Base | ? | M14 |

### Bande 1 — Le produit avant la cuve

| # | Événement | Lieu | Trace | Lentilles |
|---|---|---|---|---|
| E14 | Le stock de fûts a été dénombré | Base | ? | Q1 |
| E15 | Le stock initial a été estimé après inventaire partiel (fûts endommagés exclus) | Base | 🧠 | D27 |
| E16 | Le produit a été livré au stand de remplissage | Stand | ? | M12 |
| E17 | Le lot du fût ouvert a été identifié | Stand | ? | Q2 |
| E18 | Un fût a été prélevé et acheminé au poste de préparation | Stand | ? | Q3 |
| E19 | Le produit a été mesuré et versé hors du fût | Stand | ? | Q4 |
| E20 | Le diluant a été ajouté | Stand | ? | Q5 |
| E21 | Le mélange a été préparé | Stand | ? | Q6 |
| E22 | Le chef de base a lancé l'ordre de remplissage | Stand | 🧠 | B4 |
| E23 | Le stock initial a été mesuré et enregistré | Stand | ✍️ | B3 |
| E24 | La cuve numérotée a été remplie | Stand | ? | Q7, M13, N6 |
| E25 | Le chef de base a observé le remplissage | Stand | 🧠 | B5 |
| E26 | Le volume chargé a été enregistré | Stand | ✍️ | B6, Q8 |
| E27 | Le numéro de cuve a été écrit sur la fiche de vol | Stand ou Base ? | ? | N7, A(CuveDésignéePourRotation) |
| E28 | Le fond de fût entamé a été remis en stock | Stand | ? | Q16 |
| E29 | Le fût vide a été comptabilisé | Stand | ? | Q17 |
| E30 | Un fût a débordé et le stand a été relocalisé | Stand | 🧠 | D5 |
| E31 | Du produit a été renversé | Stand | ? | Q20 |
| E32 | Un agent a été exposé au produit | Stand | ? | Q21 |
| E33 | La zone de rinçage a été isolée | Base | ? | Q22 |
| E34 | Un second aéronef s'est servi au même stand avant le ravitaillement du premier | Stand | 🧠 | D11 |

### Bande 2 — Le départ

| # | Événement | Lieu | Trace | Lentilles |
|---|---|---|---|---|
| E35 | Le mécanicien a signé l'avis de mise en condition de vol | Base | ✍️ | M15 |
| E36 | Le pilote a signé le carnet de bord avant décollage | Base | ✍️ | M16 |
| E37 | Le pilote a lancé l'essai moteur | Base | ? | P3 |
| E38 | Le pilote a jugé la faisabilité du vol d'après la météo observée | Base | 🧠 | P4 |
| E39 | Le vol a été annulé pour météo | Base | ? | D1 |
| E40 | La rotation a été reportée à cause d'une panne du compresseur au sol | Stand | ? | D2 |
| E41 | Le chef de base a donné le feu vert au décollage | Base | 🧠 | B9 |
| **E42** | **🔶 L'aéronef a décollé** | Base → En vol | — | P5, M17, N8, Q10, B10 |
| E43 | Le pilote a enregistré l'heure de décollage | En vol | ? | P6 |
| **E44** | **🔶 L'aéronef est sorti de la vue du chef de base** | En vol | 🧠 | B11 |

### Bande 3 — En vol : personne au sol ne constate

| # | Événement | Lieu | Trace | Lentilles |
|---|---|---|---|---|
| E45 | Le pilote a observé les conditions en route (vent, visibilité, nuages) | En vol | 🧠 | P7 |
| E46 | Le pilote a relevé la température et le vent en début de vol | En vol | ? | A(Température/VentDébut) |
| E47 | Le pilote a repéré le bloc à traiter depuis l'altitude de reconnaissance | En vol | 🧠 | P8, N9 |
| E48 | Le pilote a estimé les dimensions de la zone infestée | En vol | 🧠 | P9 |
| E49 | Le pilote a descendu à l'altitude de pulvérisation | En vol | 🧠 | P10 |
| E50 | L'épandage a commencé | Bloc | 🧠 | P11, N10, Q11 |
| E51 | Le pilote a observé la dérive du produit sous le vent | Bloc | 🧠 | P12 |
| E52 | Le pilote a constaté la réaction des criquets à l'épandage | Bloc | 🧠 | P13 |
| E53 | L'épandage a été interrompu par le vent | Bloc | 🧠 | D3 |
| E54 | L'épandage a été terminé | Bloc | 🧠 | P25, N11, Q12 |
| E55 | Le pilote a relevé la température et le vent en fin de vol | En vol | ? | A(Température/VentFin) |
| E56 | Le pilote a jugé la couverture insuffisante | En vol | 🧠 | P21 |
| E57 | Le pilote a décidé d'une rotation supplémentaire | En vol | 🧠 | P22 |
| E58 | Le pilote a détecté une surconsommation de carburant | En vol | 🧠 | P17, P23 |
| E59 | Le pilote a réévalué la faisabilité d'une troisième rotation | En vol | 🧠 | P24 |
| E60 | Le pilote a signalé une anomalie mécanique détectée en vol | En vol | 🧠 | P30 |
| E61 | Le convoyage vers le poste acridien a dépassé le délai estimé | En vol | 🧠 | D25 |
| E62 | Le pilote a mis cap sur la base | En vol | 🧠 | P26 |
| E63 | L'aéronef s'est posé sur la base secondaire faute de carburant | Base secondaire | 🧠 | D4 |

### Bande 4 — Le retour : le fait devient un dire

| # | Événement | Lieu | Trace | Lentilles |
|---|---|---|---|---|
| E64 | Le pilote a annoncé son approche | En vol → Base | 🧠 | B12 |
| E65 | L'aéronef a atterri | Base | ? | M18, N12, B13 |
| E66 | Le pilote a enregistré l'heure de poser | Base | ? | P27 |
| **E67** | **🔶 Le pilote a rapporté au chef de base ce qu'il avait fait en vol** | Base | 🧠 | B14, P28, P29 |
| E68 | Le mécanicien a relevé les heures au compteur | Base | ✍️ | M19 |
| E69 | Le mécanicien a fait la visite après vol | Base | ✍️ | M24, N13 |
| E70 | Le résidu en cuve a été mesuré | Stand | ? | B15, Q13, Q14 |
| E71 | La quantité épandue a été calculée par différence | Stand | 🧠 | B16, Q15 |
| E72 | La quantité épandue a été estimée à partir de la durée de vol | Base | 🧠 | D9 |
| E73 | La quantité perdue a été évaluée à l'œil | Stand | 🧠 | D10 |
| E74 | Un écart a été constaté entre le rapport du pilote et le calcul du chef de base | Base | 🧠 | B17, Q19 |
| E75 | Le chef de base a enquêté auprès du pilote sur l'écart | Base | 🧠 | B18 |
| E76 | La quantité perdue a été expliquée ou supposée | Base | 🧠 | B19 |
| E77 | La cuve et la rampe ont été rincées | Stand | ? | Q18, M25 |
| E78 | La cuve a été rechargée sans avoir été vidée du résidu précédent | Stand | 🧠 | D24 |
| E79 | Une nouvelle rotation a été lancée *(la boucle E22→E77 recommence)* | Base | — | B20, B21, N16-N19, P18, P19, P20, M20 |
| E80 | Le chef d'équipe a documenté les conditions de la rotation sur le CRT | Base | ✍️ | N15 |

### Bande 5 — La fin des vols

| # | Événement | Lieu | Trace | Lentilles |
|---|---|---|---|---|
| E81 | La fin des rotations a été décidée | Base | 🧠 | B22 |
| E82 | L'aéronef a regagné la base définitivement | Base | ? | B23, M21 |
| E83 | Les heures totales de vol du jour ont été relevées | Base | ✍️ | M22, N20 |
| E84 | La consommation de carburant a été calculée | Base | ✍️ | M23 |
| E85 | Les anomalies du jour ont été consignées au carnet de bord | Base | ✍️ | M26 |
| E86 | Le stock du soir a été compté | Base | ? | N22, Q24 |
| E87 | Le stock du soir ne tombait pas juste | Base | 🧠 | Q19(bis) |
| E88 | La traçabilité du lot a été rattachée au bloc traité | Base | ? | Q27 |

### Bande 6 — Le papier

| # | Événement | Lieu | Trace | Lentilles |
|---|---|---|---|---|
| E89 | La fiche de vol a été complétée | Base | 🧠 | B24, Q26, A(FicheVolCréée, Vol*Créé, ObservationsEnregistrées) |
| E90 | Le chef de base a rempli la fiche d'un pilote absent | Base | 🧠 | D12 |
| E91 | L'heure de décollage a été reconstituée de mémoire le soir | Base | 🧠 | D7 |
| E92 | L'heure avant la grande visite a été retrouvée dans le carnet de vol | Base | 🧠 | D8 |
| E93 | La fiche de vol a été retrouvée mouillée après la pluie | Base | — | D6 |
| E94 | Le CRT a été compilé | Base | ✍️ | N21, B25, Q25, A(TraitementAérienCréé) |
| E95 | Le CRT a été complété le lendemain matin à partir de notes griffonnées | Bureau | 🧠 | D28 |
| E96 | La MEP avait été reportée d'un jour, la fiche a gardé la date initiale | Base | 🧠 | D21 |
| E97 | Le chef de base a rapproché la fiche de vol et le CRT | Base | ✍️ | B26 |
| E98 | Une divergence entre les deux fiches a été détectée | Base | 🧠 | B27, B28 |
| E99 | Le chiffre final a été reconstitué et arbitré | Base | 🧠 | B29 |
| E100 | L'heure contestée a été tranchée par le plus ancien | Base | 🧠 | D18 |
| E101 | Le vol mixte a été noté sur deux fiches différentes | Base | 🧠 | D22 |
| E102 | La rotation a été rattachée au vol au moment de la saisie | Bureau | ✍️ | A(RotationArbitrée×2, RotationIdentifiéeParNuméro) |
| E103 | Le numéro de fiche a reçu un suffixe `-02` après collision | Bureau | ✍️ | A(NuméroFicheAssigné) |
| E104 | La quantité de produit de la rotation a été saisie | Bureau | ✍️ | A(QuantitéPesticideLivrée, ProduitSélectionné) |
| E105 | L'aéronef, la base et le stand ont été figés sur la fiche | Bureau | ✍️ | A(AéronefEnregistré) |
| E106 | La température et le vent au sol ont été relevés par le chef de base | Base | ? | A(Température/VentAuSol) |
| **E107** | **🔶 La fiche de vol a été signée par le pilote** | Base | ✍️ | N23, A, D16 |
| E108 | La fiche de vol a été signée par le mécanicien | Base | ✍️ | N24, A |
| E109 | La fiche de vol a été signée par le chef de base | Base | ✍️ | N25, A, M27 |
| E110 | La fiche de vol a été signée par le consultant international | Base | ✍️ | A |
| E111 | Le CRT a été signé par le chef d'équipe | Base | ✍️ | N26, A |
| E112 | Le CRT a été signé par le chef de base | Base | ✍️ | N27 |
| **E113** | **🔶 La fiche de vol a été validée et verrouillée** | Bureau | ✍️ | A(FicheVolValidée, FicheVolVerrouillée) |
| E114 | Le traitement aérien a été validé | Bureau | ✍️ | A(TraitementAérienValidé, TraitementSignéChefÉquipe) |

### Bande 7 — Après la signature

| # | Événement | Lieu | Trace | Lentilles |
|---|---|---|---|---|
| E115 | Une erreur de numéro de cuve a été découverte après signature | Base | — | D13 |
| E116 | La correction a été appliquée au blanc sur la fiche papier | Base | — | D14 |
| E117 | La fiche a été recopiée en intégralité sur un nouveau papier | Base | — | D15 |
| E118 | L'agent encadreur a été remplacé sans trace écrite | Base | 🧠 | D23 |

### Bande 8 — La remontée

| # | Événement | Lieu | Trace | Lentilles |
|---|---|---|---|---|
| E119 | Les papiers ont été remis au responsable du rapportage | Base | ✍️ | N28 |
| E120 | La fiche a été clôturée et remontée au bureau | Bureau | ✍️ | B30, B31 |
| E121 | La fiche de vol a été archivée | Bureau | ✍️ | M28 |
| E122 | La remontée des fiches a été retardée de deux jours | Bureau | — | D19 |
| E123 | Le réseau était absent ; les fiches sont parties en lot le lendemain | Base | — | D20 |
| E124 | L'accès au formulaire central manquait ; on a rempli du papier trois jours | Base | — | D29 |
| E125 | La journée a été poussée au serveur | Bureau | ✍️ | A(FichePushée) |
| E126 | Deux versions de la même journée se sont rencontrées au serveur | Bureau | ✍️ | A(ConflitDeSynchro), D17 |
| E127 | L'envoi a échoué et personne n'a compté combien de fois | Bureau | — | A(ÉchecDeSynchro) |
| E128 | Celui qui a collationné les fiches ignorait le nouveau format du CRT | Bureau | — | D30 |

---

## Fusions et rejets (registre de traçabilité)

Chaque événement rendu en Phase 1 est **sur la timeline**, **au parking**, ou **nommé ici**.

**Fusions de formulation** (les deux libellés sont conservés comme conflits de vocabulaire) :

| Retenu | Formulation écartée | Lentille |
|---|---|---|
| E01 | « Le chef de base a convoqué l'équipe » / « Briefing reçu du bureau » / « ordre de mission transmis au mécanicien » | N1, B1, M1 |
| E24 | « Une deuxième cuve a été remplie » — répétition de boucle, absorbée par E79 | N16 |
| E42 | « L'aéronef a décollé pour la MEP de la rotation 1 » ⚠️ formulation d'ADR | N8 |
| E54 | « La première rotation a été complétée » ⚠️ formulation d'ADR | N11 |
| E79 | « Rotations subséquentes complétées », « rotation 2 » (N17, N18, N19, B21, M20) | N, B, M |
| E89 | « FicheVolCréée », « VolProspectionCréé », « VolMEPCréé », « VolApplicationCréé », « VolConvoyageCréé », « VolDiversCréé » — le code appelle « création » ce que le terrain appelle « remplir la fiche » | A |
| E102 | « RotationArbitréeAuVolMEP » + « RotationArbitréeAuVolApplication » + « RotationIdentifiéeParNuméro » | A |
| E126 | « Un doublon de fiche a été détecté trois jours après » ≡ le 409 du serveur | D17 + A |

**Rejetés — faits techniques, pas des faits métier** (au parking, section « à ne pas remonter au mur ») :

- `A` « RéférentielPesticideTiréAuMobile » — le rafraîchissement d'un référentiel n'est pas un fait métier.
- `A` « ActionAuditEnregistrée » — l'écriture d'une ligne d'audit n'est pas un fait métier ; ce qui l'est, c'est E113.
- `Q` « Quantité perdue versée dans le bassin de traitement des effluents » (Q23) — événement inventé par la lentille, aucune fiche IFVM ne mentionne de bassin d'effluents. **Rejeté comme hallucination probable, à ne pas poser en séance.**
- `Q` « Mesure de précaution : zone de rinçage isolée » (Q22) — retenu en E33 mais **non confirmé**, même réserve.

---

## Parking

Hors du périmètre « journée aérienne », à traiter sur un autre mur :

| Sujet | Origine | Pourquoi il sort |
|---|---|---|
| La station météo hors service, conditions rapportées visuellement | D26 | Relève de la fiche « relevé météorologique », pas de la journée aérienne |
| Restitution des fûts vides au fournisseur | Q28 | Chaîne d'approvisionnement, en amont/aval de la journée |
| Traçabilité du lot de pesticide jusqu'au bloc | Q2, Q27 | Redevabilité bailleur — mur à part, mais **touche E17 et E88** |
| Suite donnée à l'exposition d'un agent au produit | Q21 | Santé/sécurité — la journée en produit le fait, pas la suite |
| Validation des pièces de rechange en stock | M(hotspot) | Maintenance, pas la journée |
| Le chantier au sol qui reprend la même zone | — | C'est le mur S3, délibérément séparé |

---

## Événements pivots — **proposition, à trancher par le métier**

Les cinq moments où l'état du monde change de façon irréversible, et qui découpent la timeline
en bandes.

| Pivot | Ce qui bascule |
|---|---|
| **E42 — L'aéronef a décollé** | Le produit quitte le sol. Il ne peut plus être recompté, seulement estimé au retour. |
| **E44 — L'aéronef est sorti de la vue du chef de base** | La journée cesse d'être observée et devient une journée **rapportée**. C'est le pivot que le modèle actuel ne représente pas du tout. |
| **E67 — Le pilote a rapporté ce qu'il avait fait** | Le fait vécu devient un dire. À partir d'ici, tout ce qui sera écrit est un témoignage, pas une mesure. |
| **E107 — La fiche de vol a été signée par le pilote** | Une personne engage sa responsabilité sur un texte. |
| **E113 — La fiche a été validée et verrouillée** | La journée devient un document opposable. Le code interdit toute modification ensuite, **et n'offre aucun circuit de correction**. |

---

## Phase 4 — Process Level

Une lentille par bande, en mode ANNOTATE, ne voyant que ses propres événements. Chaque bande
portait **une colonne supplémentaire** conçue pour elle : c'est dans ces colonnes que se trouve
l'essentiel du résultat.

⚠️ = la lentille a refusé de nommer un acteur ou une règle plutôt que d'en inventer un.
C'est le comportement voulu : un trou déclaré vaut mieux qu'un acteur plausible.

### Bande 1 — Avant le décollage · colonne propre : *aucune*

| # | Commande | Acteur | Vue de lecture | Politique / Système externe |
|---|---|---|---|---|
| E01 | ⚠️ inconnue | Chef de base | ⚠️ indéterminée | — |
| E02 | Décider blocs et rotations | Chef de base | Zones infestées, ressources, météo prévue | Cartographie de l'infestation *(externe)* |
| E03 | Attribuer une cuve | Chef de base | Cuves disponibles, aéronef | — |
| E04 | Ouvrir le carnet, consigner l'heure | Mécanicien | Heure courante | — |
| E05 | Faire la visite avant vol | Mécanicien | État physique de l'appareil | — |
| E06 | *(subi)* | Mécanicien (découvre) | Appareil inspecté | ⚠️ aucune règle : « quand une anomalie est relevée, alors… » |
| E07 | Établir le décompte d'heures | Mécanicien | Carnet de bord, heures accumulées | — |
| E08 | *(subi)* | Mécanicien (découvre) | Anomalie E06, stock de pièces | Fournisseur de pièces *(externe)* |
| E09 | Immobiliser l'appareil | ⚠️ inconnu | E06 + E08 | Quand une pièce ne peut être remplacée le jour même |
| E10 | Relever le carburant | ⚠️ inconnu | Jauge, stocks au sol | — |
| E11 | Autoriser le ravitaillement | Chef de base | ⚠️ vue de lecture inconnue | Fournisseur de carburant *(externe)* |
| E12 | Avitailler | ⚠️ inconnu | Autorisation E11 | Quand E11, appliquer |
| E13 | Monter la rampe | Mécanicien | État de la rampe | — |
| E14 | Dénombrer les fûts | ⚠️ inconnu | Fûts physiques au stand | — |
| E15 | Estimer le stock valide | ⚠️ inconnu | E14 + état des fûts | Quand E14 fait, estimer |
| E16 | Livrer le produit | ⚠️ inconnu | Décision E02 | Fournisseur de produit *(externe)* |
| E17 | Identifier le lot | Agent de ravitaillement | Étiquette du fût | Fournisseur *(externe)* |
| E18 | Prélever et acheminer | Agent de ravitaillement | Stock E14/E15 | — |
| E19 | Mesurer et verser | Agent de ravitaillement | Quantité commandée | — |
| E20 | Ajouter le diluant | Agent de ravitaillement | Formule de préparation | Fournisseur de diluant *(externe)* |
| E21 | Préparer le mélange | Agent de ravitaillement | E19 + E20 | Quand E19 et E20 faits |
| E22 | Lancer l'ordre de remplissage | Chef de base | Mélange prêt, cuve attribuée, équipe présente | — |
| E23 | Mesurer et enregistrer le stock initial | Agent de rapportage | Mélange disponible | — |
| E24 | Remplir la cuve | Agent de ravitaillement | Mélange, n° de cuve, volume | Quand E22 lancé |
| E25 | Observer le remplissage | Chef de base | Opération en cours | — |
| E26 | Enregistrer le volume | Agent de rapportage | Volume délivré | — |
| E27 | Écrire le numéro de cuve | ⚠️ **inconnu** | Numéro attribué E03 | — |
| E28 | Remettre le fond de fût en stock | Agent de ravitaillement | Fût partiellement vidé | — |
| E29 | Comptabiliser le fût vide | ⚠️ inconnu | Fût vidé | — |
| E30 | Relocaliser le stand | ⚠️ inconnu | Débordement détecté | Quand un fût déborde |
| E31 | *(subi)* | ⚠️ aucun | — | Quand débordement ou manutention |
| E32 | *(subi)* | ⚠️ aucun | — | Quand E31 ou manipulation dangereuse |
| E33 | Isoler la zone de rinçage | ⚠️ inconnu | E32 ou procédure | ⚠️ « quand E32, alors ? » — non établi |
| E34 | *(subi)* | ⚠️ inconnu | Stand disponible | ⚠️ **aucune politique de priorité entre appareils** |
| E35 | Signer l'avis de mise en condition de vol | Mécanicien | Appareil complet, anomalies résolues | Autorité de l'aviation *(externe)* |
| E36 | Signer le carnet avant décollage | Pilote | Carnet, avis E35, charge | Autorité de l'aviation *(externe)* |
| E37 | Lancer l'essai moteur | Pilote | État mécanique approuvé | — |
| E38 | Juger la faisabilité | Pilote | Météo observée, bloc, charge | Station météo *(externe)* |
| E39 | Annuler le vol | ⚠️ inconnu | Jugement E38 | Quand le pilote juge le vol non faisable |
| E40 | Reporter la rotation | ⚠️ inconnu | Panne découverte — ⚠️ quand ? | Quand panne au sol |
| E41 | Donner le feu vert | Chef de base | Avis E35, jugement E38, charge E26 | Autorité de l'aviation *(externe)* |

### Bande 2 — Hors de vue · colonne propre : **Support à l'instant du fait**

`✍️ carnet à bord` · `🧠 mémoire` · `📻 radio` · `📟 instrument` · `❓ inconnu`

| # | Commande | Acteur | Vue de lecture | **Support** | Politique |
|---|---|---|---|---|---|
| E42 | Décider du décollage | Pilote | Météo, appareil, carburant, check-list | 📟 | Après ordre du chef de base |
| E43 | Enregistrer l'heure de décollage | Pilote | Horloge de l'appareil | ❓ **inconnu** | — |
| E44 | *(aucune — perte d'observabilité)* | ⚠️ **aucun** | — | — | Le chef de base ne peut plus observer |
| E45 | Observer les conditions en route | Pilote | Instruments + visuel | 🧠 | Surveillance continue |
| E46 | Relever température et vent (début) | Pilote | Thermomètre, anémomètre de bord | ❓ **inconnu** | Mesure de début de vol |
| E47 | Repérer le bloc | Pilote | Visuel du sol, carte, plan | 🧠 + ✍️ | Après convoyage vers zone |
| E48 | Estimer les dimensions | Pilote | Visuel, altitude, repères | 🧠 + ✍️ | Après repérage |
| E49 | Descendre à l'altitude de pulvérisation | Pilote | Altimètre, terrain | 📟 | Après estimation |
| E50 | Commencer l'épandage | Pilote | Altitude atteinte, conditions | 📟 + 📻 ? | Quand altitude ET conditions OK |
| E51 | Observer la dérive | Pilote | Visuel du produit, vent, repères | 🧠 | Pendant l'épandage |
| E52 | Constater la réaction des criquets | Pilote | Visuel du comportement au sol | 🧠 | Pendant l'épandage |
| E53 | Arrêter l'épandage | Pilote | Anémomètre, visuel, stabilité | 📟 | ⚠️ **seuil de vent non établi** |
| E54 | Terminer l'épandage | Pilote | Zone traitée, carburant, couverture | 📟 + 🧠 | Couverture complète OU limite atteinte |
| E55 | Relever température et vent (fin) | Pilote | Thermomètre, anémomètre | ❓ **inconnu** | Mesure de fin de vol |
| E56 | Juger la couverture | Pilote | Zone restante, carburant | 🧠 | Après fin d'épandage |
| E57 | Décider une rotation supplémentaire | Pilote | Couverture, carburant, météo | 🧠 | Si couverture insuffisante ET carburant > seuil |
| E58 | Détecter la surconsommation | Pilote | Jauge vs plan de vol | 📟 | Surveillance continue |
| E59 | Réévaluer la 3e rotation | Pilote | Carburant, météo, couverture | 📟 + 🧠 | Après surconsommation |
| E60 | Signaler l'anomalie mécanique | Pilote | Instruments d'alerte, comportement appareil | 📻 | Dès détection : escalade |
| E61 | *(constat)* | Pilote | Horloge, plan de vol | 📟 | ⚠️ **dépassement de délai : aucune suite définie** |
| E62 | Mettre cap sur la base | Pilote | Navigation, position, carburant | 📟 | Après traitement OU conditions impraticables |
| E63 | Atterrir (forcé) | Pilote | Jauge critique, position, options | 📟 + 📻 | Quand carburant critique · **Base secondaire = tiers externe** |
| E64 | Annoncer l'approche | Pilote | Navigation, altitude | 📻 | Distance seuil ⚠️ non établie |
| E65 | Atterrir | Pilote | Instruments, piste, conditions | 📟 + 📻 | Après annonce ET confirmation sol |
| E66 | Enregistrer l'heure de poser | Pilote | Horloge de l'appareil | ❓ **inconnu** | — |

> **Résultat de la bande 2.** Sur 25 événements, **19 n'ont pour support que la mémoire du pilote
> ou un support inconnu**. Les quatre écritures qui alimentent la fiche de vol — E43, E46, E55,
> E66 — sont toutes les quatre `❓ inconnu` : la lentille a refusé de trancher entre « il écrit
> en pilotant » et « il note plus tard ». **C'est la question que la bande « Lieu » de S2 doit
> résoudre, et personne au bureau ne peut y répondre.**

### Bande 3 — Le retour et la reconstitution · colonne propre : **Origine du chiffre**

| # | Commande | Acteur | Vue de lecture | **Origine du chiffre** | Politique |
|---|---|---|---|---|---|
| E67 | *(aucune — rendre compte)* | Pilote | Son vol | s/o | Après chaque vol, le pilote rend compte |
| E68 | Relever les heures | Mécanicien | Compteur aéronef | **mesuré à l'instrument** | Après atterrissage |
| E69 | Faire la visite après vol | Mécanicien | Inspection | s/o | Après chaque vol |
| E70 | Mesurer le résidu | ⚠️ « agent stand » (rôle non confirmé) | Cuve | **mesuré à l'instrument** | Après chaque vol |
| E71 | Calculer l'épandu | Chef de base | Chargé − résidu | **calculé par différence** | Une fois le résidu connu |
| E72 | Estimer l'épandu | Chef de base | Durée de vol | **estimé empiriquement** | Alternative quand la mesure est impossible |
| E73 | Évaluer la perte | ⚠️ « agent stand » | État visuel cuve/rampe | **estimé de mémoire** | Évaluation des fuites |
| E74 | *(constat d'écart)* | Chef de base | Rapport pilote ≠ calcul propre | s/o | ⚠️ **aucune politique** |
| E75 | Enquêter sur l'écart | Chef de base | L'écart lui-même | s/o | Quand écart constaté |
| E76 | *(convergence)* | Pilote + chef de base | Dialogue, mémoire | **arbitré entre deux versions** | Converger sur une cause probable |
| E77 | Rincer cuve et rampe | ⚠️ « agent stand » | État visible | s/o | Avant la rotation suivante |
| E78 | *(constat de non-respect)* | ⚠️ « agent stand » | Résidu en cuve | s/o | ⚠️ **politique violée, aucune clause de réaction** |
| E79 | Lancer la rotation | Chef de base | Appareil, bloc, météo | s/o | Après recharge carburant + produit |
| E80 | Documenter la rotation | Chef d'équipe | Bloc, conditions, vol, résultats | s/o | Pour chaque rotation complétée |
| E81 | Arrêter les vols | ⚠️ **inconnu** | ⚠️ **critères inconnus** | s/o | ⚠️ **politique manquante ou multiple** · possiblement le bureau national |
| E82 | Regagner la base | Pilote | E81, carburant, météo | s/o | Quand la fin est décidée |
| E83 | Relever le total d'heures | Mécanicien | Compteur | **mesuré à l'instrument** | Fin de journée |
| E84 | Calculer la consommation | Chef de base | Chargé − résidu | **calculé par différence** | Fin de journée |
| E85 | Consigner les anomalies | Chef de base | Anomalies du jour | s/o | Fin de journée, carnet de bord |
| E86 | Compter le stock du soir | Agent de rapportage | Magasin physique | **compté** | Fin de journée |
| E87 | *(constat de désaccord)* | Agent de rapportage | Compté ≠ attendu | s/o | ⚠️ **aucune politique** |
| E88 | Rattacher le lot au bloc | Agent de rapportage | Bloc traité, fiche, lot | s/o | Avant clôture |

> **Résultat de la bande 3.** Trois origines de chiffre — E71 `calculé par différence`,
> E72 `estimé empiriquement`, E73 `estimé de mémoire` — **produisent un nombre qui atterrit au
> même endroit sur la fiche**, sans que rien ne distingue leur mode d'obtention. Et les trois
> constats d'écart (E74, E78, E87) n'ont **aucune politique de réaction écrite**.

### Bande 4 — Le papier · colonne propre : **Sur quel document**

| # | Commande | Acteur | Vue de lecture | **Document** | Politique |
|---|---|---|---|---|---|
| E89 | Compléter la fiche de vol | ⚠️ chef de base **ou** pilote | Notes, horaires, observations | Fiche de vol | Dès le vol terminé |
| E90 | Remplir la fiche d'un absent | Chef de base | Journal, compte-rendu tiers | Fiche de vol | Quand le pilote est absent à la clôture |
| E91 | Reconstituer l'heure | ⚠️ chef de base (probable) | **Mémoire seule** | Fiche de vol | Si l'heure n'a pas été enregistrée |
| E92 | Chercher dans le carnet | ⚠️ chef de base ou agent | Carnet de vol | Carnet → fiche | Quand une donnée manque |
| E93 | *(subi)* | ⚠️ aucun | — | Fiche endommagée | ⚠️ **aucune** — météo/incident |
| E94 | Compiler le CRT | ⚠️ chef d'équipe **ou** agent de rapportage | Notes de terrain, relevés | CRT | Fin de journée |
| E95 | Compléter le CRT le lendemain | Agent au bureau | Notes griffonnées ⚠️ d'origine inconnue | CRT | Si incomplet le soir |
| E96 | *(subi)* | ⚠️ aucun | — | Fiche (date) | ⚠️ **date initiale ou date réelle ?** |
| E97 | Rapprocher fiche et CRT | Chef de base | Les deux côte à côte | Les deux | Fin de journée |
| E98 | *(constat de divergence)* | Chef de base | Fiche vs CRT | Les deux | ⚠️ **quels champs ? quelle tolérance ?** |
| E99 | Arbitrer le chiffre final | ⚠️ chef de base (probable) ou hiérarchie | Fiche + CRT | Fiche de vol | Quand les deux divergent |
| E100 | Trancher l'heure | **Le plus ancien** ⚠️ de qui ? | Arguments, traces du jour | Fiche de vol | Usage, pas règle écrite |
| E101 | *(subi)* | ⚠️ implicite | Nature « mixte » | **Deux fiches** | ⚠️ **qui décide le découpage ?** |
| E102 | Rattacher la rotation au vol | ⚠️ **« le geste fantôme » — aucun humain identifié** | ⚠️ **inconnue** | Fiche (saisie) | Système informatique *(externe)* |
| E103 | *(subi)* Ajouter le suffixe | Système ou agent de saisie | Numéros existants | Fiche `-02` | Quand collision détectée |
| E104 | Saisir la quantité de la rotation | Agent de saisie | Rotation + CRT | Fiche de vol | Pour chaque rotation rattachée |
| E105 | Figer aéronef, base et stand | Système ou agent de saisie | Données saisies | Fiche (verrouillé) | ⚠️ **métier ou contrainte technique ?** |
| E106 | Relever température et vent au sol | Chef de base | Instruments au sol, visuel | Fiche de vol | ⚠️ **quand exactement ?** |

> **Résultat de la bande 4.** La lentille a nommé E102 « **le geste fantôme** » : le rattachement
> d'un vol à une rotation est exigé par le modèle, et **aucun humain ne peut lui être attribué**.
> Elle demande, sans qu'on le lui ait suggéré : *« l'équipe terrain sait-elle ce qu'est une
> rotation ? »*

### Bande 5 — La signature et le verrou · colonnes propres : **Ce qu'atteste la signature** / **Obligatoire ?**

| # | Acteur | Vue de lecture | **Ce que la signature atteste** | **Obligatoire ?** |
|---|---|---|---|---|
| E107 | Pilote | Fiche rédigée | « Les informations correspondent au vol que j'ai effectivement piloté » | **oui** (pivot) |
| E108 | Mécanicien | Données techniques pré/post-vol | « L'appareil était en état de vol et l'inspection confirme les données » | ⚠️ **inconnu** |
| E109 | Chef de base | ⚠️ relecture du contenu **ou** simple présence des signatures ? | « La fiche est complète, conforme, et peut être transmise » | **oui** |
| E110 | Consultant international | ⚠️ idem E109 ou analyse propre ? | « La mission est conforme aux protocoles de supervision internationale » | ⚠️ **inconnu** — **rôle externe, présence quotidienne inconnue** |
| E111 | Chef d'équipe | CRT rédigé | « Les zones ont été traitées selon les ordres, mes observations sont exactes » | ⚠️ **inconnu** |
| E112 | Chef de base | CRT + E111 | « Le compte-rendu est complet et conforme » | **oui** |
| E113 | ⚠️ **rôle bureau non identifié** | Présence des signatures — ⚠️ **et le contenu ?** | *aucun acte de signature humaine* | **oui** (verrou) |
| E114 | ⚠️ **rôle bureau non identifié** | E113 verrouillé, E112 signé | ⚠️ conformité de fond ou pure administration ? | **oui** |

> **Résultat de la bande 5.** Les deux événements qui ferment définitivement la journée — E113 et
> E114 — **n'ont aucun acteur identifiable**. Et l'ordre supposé des quatre signatures
> (pilote → mécanicien → chef de base → consultant) n'a été confirmé par rien : la lentille
> demande s'il est réel, contraint, ou arbitraire.

### Bande 6 — Après le verrou · colonne propre : **Qui l'apprend, et quand**

| # | Commande | Acteur | **Qui l'apprend, et quand** | Politique |
|---|---|---|---|---|
| E115 | *(subi)* | ⚠️ découvreur non nommé | Le cercle immédiat de la base, tout de suite | — |
| E116 | Corriger au blanc | ⚠️ **non spécifié** | **Personne hors du cercle immédiat** | Quand erreur découverte |
| E117 | Recopier en entier | ⚠️ non spécifié | **Personne hors de la base** | Quand les corrections sont trop nombreuses |
| E118 | *(subi)* | remplacement, pas commande | **Jamais**, ou par collision tardive de signatures | Quand agent indisponible |
| E119 | Remettre au rapportage | Logistique base | Responsable rapportage, à la réception | Fin de journée |
| E120 | Clôturer et remonter | ⚠️ **rapportage base ou bureau ?** | Le bureau, à réception | Fiches complètes |
| E121 | Archiver | Archives bureau | **Personne** | Après clôture |
| E122 | *(subi)* | retard logistique | Le bureau, **en constatant l'absence, à J+2/J+3** | Quand la remontée échoue |
| E123 | *(subi)* | absence réseau | Le bureau, **J+1 au mieux** | Réseau/courrier *(externe)* |
| E124 | *(subi)* | formulaire inaccessible | Le bureau, **quand les papiers arrivent, J+3 et plus** | Système central *(externe)* |
| E125 | Pousser au serveur | ⚠️ **script ou opérateur ?** | Le serveur (log) ; le bureau ⚠️ ? | Quand réseau OK |
| E126 | *(subi)* | ⚠️ aucun | **Personne** — ou un développeur dans les logs | ⚠️ **aucune règle de résolution** |
| E127 | *(subi)* | système d'envoi | **Personne**, ou découverte manuelle à J+N | ⚠️ **aucun retry, aucune alerte** |
| E128 | Collationner | Collationneur bureau | Un développeur ou un utilisateur en erreur, ⚠️ à J+? | Quand le format change sans que le collationneur le sache |

> **Résultat de la bande 6.** La colonne « qui l'apprend » répond **`personne`** pour E116, E117,
> E118, E121, E126 et E127. **Après avoir remis ses papiers, la base n'apprend plus jamais rien** :
> ni que la fiche est arrivée, ni qu'elle a créé un conflit, ni que l'envoi a échoué.

---

## Registre des points chauds

Chaque ligne est une question posée à un humain nommé. Classement selon le guide Brandolini.
**P** = priorité : 🔴 bloquant · 🟠 structurant · 🟡 à clarifier.

### Le trou d'observation — la contradiction fondatrice

| # | P | Question | Type | À poser à |
|---|---|---|---|---|
| PC01 | 🔴 | Sur les 25 événements entre le décollage et le poser, **combien ont été écrits au moment où ils se sont produits, et sur quoi ?** Les quatre écritures qui alimentent la fiche (heure de décollage, température/vent début et fin, heure de poser) : en pilotant, ou plus tard ? | Exception non modélisée | Pilote **et** chef de base ensemble — S2, bande « Lieu », 00:50 |
| PC02 | 🔴 | ~~Qui a rempli la fiche de vol ?~~ **R1 + R2 : le chef de base ou le chef de zone — pas le pilote.** Reste ouvert : **le CRT, la même personne, le même soir ?** Et le chef de zone, où est-il ? | Propriété | Chef de base — S2 |
| PC03 | 🔴 | Le numéro de cuve que le pilote écrit et celui que le chef de base écrit : le même, tiré de la même liste ? Qui l'attribue, et à quel moment ? | Vocabulaire | Chef de base + pilote |
| PC04 | 🟠 | À partir de quel moment l'aéronef sort-il de vue ? La portée radio suit-elle ? Que fait le sol entre ce moment et le poser ? | Ambiguïté temporelle | Chef de base + pilote |
| PC05 | 🟠 | Comment le pilote capture-t-il des observations qualitatives (dérive, réaction des criquets) alors qu'il pilote ? Quelqu'un les reçoit-il, ou meurent-elles au poser ? | Événement manquant | Pilote |

### Le geste que personne ne fait

| # | P | Question | Type | À poser à |
|---|---|---|---|---|
| PC06 | 🔴 | **Le rattachement d'un vol à une rotation** : qui pose ce geste, quand, en regardant quoi ? Que se passe-t-il si on saisit l'APPLICATION avant la MEP ? **Et l'équipe terrain sait-elle ce qu'est une « rotation » ?** | Événement manquant | Chef de base **puis** équipe applicative |
| PC07 | 🟠 | La quantité de produit d'une rotation : litres par rotation ou par application ? D'où sort le chiffre — CRT, carnet du mécanicien, ou conversation ? | Vocabulaire | Chef de base |
| PC08 | 🟡 | Figer aéronef, base et stand sur la fiche : besoin métier, ou contrainte technique ? Qui peut défiger, et dans quel cas ? | Exception non modélisée | Équipe applicative |

### Le chiffre écrit — mesure, calcul, ou estimation ?

| # | P | Question | Type | À poser à |
|---|---|---|---|---|
| PC09 | 🔴 | **Trois chiffres, un seul emplacement.** Calcul par différence, estimation par la durée, évaluation à l'œil : lequel finit sur la fiche ? Y a-t-il une hiérarchie, ou un arbitrage ? Faut-il tracer le mode d'obtention ? | Événement manquant | Chef de base |
| PC10 | 🟠 | Quand le pilote annonce 200 ℓ et que le calcul du chef de base en donne 160, **qui a raison** — le témoin du vol, ou la mesure du résidu ? Et si aucun ne cède ? | Propriété | Pilote + chef de base ensemble |
| PC11 | 🟠 | « Résidu » et « perte » : deux choses disjointes, ou l'une est l'inverse de l'autre ? Le résidu inclut-il ce qui reste dans la rampe, l'évaporation, les fuites ? | Vocabulaire | Chef de base + mécanicien |
| PC12 | 🟠 | « Quantité perdue » : incident physique constaté, ou manque découvert en comptant le soir ? Deux événements, un seul mot. | Vocabulaire | Chef de base + rapportage |
| PC13 | 🟠 | Le stock de la fiche de vol et celui du CRT : mêmes chiffres, ou deux comptes ? Qui remplit lequel ? | Propriété | Rapportage |
| PC14 | 🟠 | Quand le stock du soir ne tombe pas juste : on recompte ? On tolère un écart ? Qui enquête, vers qui escalade-t-on, et **quel chiffre est finalement écrit — le compté ou le théorique** ? | Exception non modélisée | Rapportage + chef de base |
| PC15 | 🟡 | À quel volume un fond de fût retourne-t-il en stock, et à quel volume bascule-t-il en perte ? | Vocabulaire | Rapportage |
| PC16 | 🟡 | Une cuve rechargée sans avoir été vidée du résidu précédent : la quantité chargée est-elle fausse dès le départ ? Qui aurait dû le vérifier ? | Exception non modélisée | Chef de base |

### Qui décide, et sur quelle autorité

| # | P | Question | Type | À poser à |
|---|---|---|---|---|
| PC17 | 🔴 | **Qui décide d'arrêter les vols du jour**, et sur quoi s'appuie-t-il — heures avant grande visite, bloc terminé, météo, carburant, ordre du bureau ? Si plusieurs critères, lequel prime ? | Propriété | Chef de base + pilote |
| PC18 | 🟠 | Quand la fiche et le CRT divergent, **qui a le dernier mot** — chef de base, rapportage, ou bureau ? Le mur dit aujourd'hui : « le plus ancien ». Le plus ancien de qui ? Est-ce une règle écrite ou un usage ? Et qui en est informé après ? | Propriété | Chef de base + bureau |
| PC19 | 🟠 | Après une anomalie relevée à la visite avant vol, **qui autorise le vol quand même** ? Seuil, checklist, ou jugement ? | Exception non modélisée | Mécanicien + chef de base |
| ~~PC20~~ | ✅ | ~~Quel est le seuil de vent qui arrête l'épandage ?~~ **Réglé par R4** : jamais sous 1 m/s, jamais au-dessus de 6 m/s, jamais entre 11 h et 16 h. Reporté en PC56. | — | *clos* |
| PC21 | 🟡 | Qui est autorisé à remplir la fiche d'un acteur absent — et peut-il attester ce qu'il n'a pas vu ? | Propriété | Chef de base |
| PC22 | 🟡 | Deux appareils au même stand : y a-t-il un ordre de priorité ? Comment chaque fiche sait-elle ce qui lui revient ? | Exception non modélisée | Chef de base |
| PC23 | 🟡 | Le rôle « agent de rapportage » n'est défini nulle part. **Recopie-t-il des chiffres, ou en produit-il ?** | Propriété | Direction / bureau |

### La signature et le verrou

| # | P | Question | Type | À poser à |
|---|---|---|---|---|
| PC24 | 🔴 | **Une fiche validée est verrouillée et aucun circuit de correction n'existe** — or corriger après signature est ordinaire (au blanc, ou fiche recopiée). Qui a le droit de déverrouiller, et qui en est informé ? | Exception non modélisée | Chef de base + bureau |
| PC25 | 🔴 | Après une correction au blanc, **la signature d'origine reste-t-elle valable** ? Et après une recopie intégrale, les signatures transférées sont-elles encore des signatures ? Faut-il re-signer ? | Exception non modélisée | Chef de base + bureau |
| PC26 | 🔴 | **N'est plus une question — c'est un défaut.** R2 établit que seule la cellule de veille valide ; le code laisse tout utilisateur authentifié signer **et** valider. Écart entre une règle écrite et son implémentation. | *écart règle ↔ code* | Équipe applicative — à corriger |
| ~~PC27~~ | ✅ | ~~Qui valide et verrouille la fiche au bureau ?~~ **Réglé par R2 : la cellule de veille, elle seule.** Reste ouvert, et reporté en PC50 : la vérification est une étape distincte que le modèle ne porte pas. | — | *clos* |
| PC28 | 🟠 | L'ordre des quatre signatures est-il réel, contraint, ou arbitraire ? Le chef de base peut-il signer si celle du pilote manque ? | Ambiguïté temporelle | Chef de base |
| PC29 | 🟠 | Le consultant international est-il présent tous les jours ? **Quand il est absent et que sa signature est attendue, que se passe-t-il ?** | Dépendance externe | Chef de base + direction |
| PC30 | 🟡 | Chaque signataire atteste-t-il ce qu'il a vu, ce qu'on lui a dit, ou seulement qu'il a lu ? Le pilote relit-il vraiment avant de signer ? | Vocabulaire | Les quatre signataires |
| PC31 | 🟡 | ⚠️ **Homonymie à surveiller toute la séance** : « valider une fiche » (relecture au bureau) et « prospection de validation » (sortie terrain pour vérifier le signalement d'un agriculteur) n'ont rien à voir. | Vocabulaire | Facilitateur, en continu |

### L'information qui meurt sur place

| # | P | Question | Type | À poser à |
|---|---|---|---|---|
| PC32 | 🔴 | **Après avoir remis ses papiers, la base n'apprend plus rien** : ni que la fiche est arrivée, ni qu'elle a créé un conflit, ni que l'envoi a échoué. Absence de mécanisme, ou choix assumé que le bureau est seul responsable après la remise ? | Propriété | Bureau + équipe applicative |
| PC33 | 🟠 | Deux versions de la même journée se rencontrent au serveur : **quelle règle décide laquelle survit**, et la version perdante est-elle conservée ou perdue ? Qui remarque la collision ? | Exception non modélisée | Équipe applicative + bureau |
| PC34 | 🟠 | Un envoi échoue sans que personne ne compte les tentatives. **Combien de temps avant que quelqu'un s'en aperçoive, et par quel signe ?** | Exception non modélisée | Équipe applicative |
| PC35 | 🟠 | « Clôturer », « archiver », « pousser au serveur » : trois gestes distincts faits par trois personnes, ou trois mots pour un seul ? | Vocabulaire | Rapportage + bureau |
| PC36 | 🟡 | Quel délai maximum entre le fait et la saisie centrale avant que la donnée soit à risque ? Combien de jours de papier consécutifs avant escalade ? | Ambiguïté temporelle | Bureau |
| PC37 | 🟡 | Quand le format du CRT change, qui prévient les collationneurs, et comment détecte-t-on une fiche collationnée à l'ancien format ? | Dépendance externe | Bureau + équipe applicative |

### Ce que le modèle ne porte pas

| # | P | Question | Type | À poser à |
|---|---|---|---|---|
| PC38 | 🟠 | Un vol peut-il faire deux choses sans se poser entre les deux ? Le modèle l'interdit, et le terrain s'en sort en écrivant **deux fiches**. | Vocabulaire | Pilote + chef de base |
| PC39 | 🟠 | **« Mixte » : deux espèces, ou deux activités dans un même vol ?** Les sept lentilles se sont divisées exactement en deux sur ce mot. | Vocabulaire | Chef de base + pilote |
| PC40 | 🟠 | Le relevé du pilote en vol et celui du chef de base au sol : **deux instants différents, ou une recopie ?** L'ADR-014 tranche « deux mesures » — le terrain ne l'a jamais confirmé, et la colonne côté `vol` n'est pas construite. | Ambiguïté temporelle | Pilote + chef de base ensemble |
| PC41 | 🟠 | **Les heures avant la grande visite** : lues sur un compteur, ou calculées ? Colonne inexistante dans le modèle, alors que trois événements en dépendent. | Événement manquant | Mécanicien |
| PC42 | 🟠 | **La surface traitée par aéronef n'est nulle part.** Comment rapproche-t-on « 150 ℓ épandus » et « 200 ha traités » ? | Événement manquant | Chef de base + rapportage |
| PC43 | 🟠 | **Silence remarquable :** aucune lentille — pas même celle du pilote, à qui on l'avait explicitement demandé — n'a produit d'événement de relevé de point d'observation en prospection aérienne. Après un vol de prospection, combien de fiches remplissez-vous ? | Événement manquant | Pilote |
| PC44 | 🟠 | Se poser sur une **base secondaire** : qui consigne les heures et les anomalies au carnet ? Cette base est-elle IFVM ou un tiers ? Un appel radio est-il obligatoire avant ? La notion n'existe pas dans le modèle. | Dépendance externe | Pilote + mécanicien |
| PC45 | 🟡 | **« Bloc à traiter » n'existe pas dans le schéma.** Les rotations sont-elles groupées en blocs, ou est-ce une simple succession ? | Vocabulaire | Chef de base |
| PC46 | 🟡 | Le relevé météo journalier est « entièrement ouvert, non construit » : décision de ne rien enregistrer, ou dette ? | Événement manquant | Équipe applicative |
| PC47 | 🟡 | La date sur la fiche : le jour réel, ou le jour prévu ? Quand la MEP est reportée d'un jour, laquelle est écrite ? | Vocabulaire | Chef de base |
| PC48 | 🟡 | `traitement_signature` n'a pas d'image, `fiche_vol_signature` en a une. Deux gestes différents, ou un oubli ? | Vocabulaire | Équipe applicative |
| PC49 | 🟡 | Un lot de produit peut-il servir plusieurs blocs, et un bloc recevoir plusieurs lots ? Le rattachement lot ↔ bloc suppose un événement d'allocation qui n'est nulle part. | Événement manquant | Rapportage |

---

### Ouverts par les retours du terrain

| # | P | Question | Type | À poser à |
|---|---|---|---|---|
| PC50 | 🔴 | **Vérifier et valider sont deux étapes distinctes** dans la matrice des acteurs ; le modèle ne connaît que `brouillon | validee`. Où passe la vérification — état manquant, ou geste hors application ? | Événement manquant | Cellule de veille + équipe applicative |
| PC51 | 🔴 | **Le consultant international et le mécanicien ne figurent nulle part dans la matrice des acteurs**, alors que le code réclame leur signature pour valider. Comment signent-ils — sur l'appareil du chef de base, sur papier, ou pas du tout ? | Ambiguïté de propriété | Chef de base + direction |
| PC53 | 🔴 | **Qui étalonne l'équipement de traitement, quand, et où le résultat est-il écrit ?** Sans le débit réel de la rampe, « quantité épandue » et « surface traitée » ne se relient pas. C'est le chaînon manquant de PC42. | Événement manquant | Mécanicien + chef de base |
| PC56 | 🔴 | **Trois règles absolues, les données pour les vérifier, et rien qui les vérifie.** La règle est-elle bloquante, avertissante, ou descriptive ? Et qui doit voir l'écart — le saisisseur, le vérificateur, ou la cellule de veille ? | Exception non modélisée | Cellule de veille + équipe applicative |
| PC52 | 🟠 | **Le chef de zone saisit quatre fiches sur cinq et n'apparaît sur aucune ligne de ce mur.** Que fait-il pendant la journée aérienne, et où est-il physiquement ? | Événement manquant | Chef de zone |
| PC54 | 🟠 | **Qui balise le bloc infesté, et à quel moment par rapport au décollage ?** Un acteur au sol, sur le bloc, absent de la bande « Lieu ». | Événement manquant | Chef d'équipe + chef de base |
| PC57 | 🟠 | L'interdit de 11 h – 16 h coupe la journée en deux fenêtres. **Que se passe-t-il pendant la coupure ?** Les papiers s'y remplissent-ils, à chaud, plutôt que le soir de mémoire ? | Ambiguïté temporelle | Chef de base + pilote |
| PC58 | 🟠 | **Le pilote écrit-il quelque chose, ou seulement raconte-t-il ?** R1 dit qu'il ne saisit pas — écrire sur un carnet et saisir dans l'application sont deux gestes. Celui-ci décide si la bande « hors de vue » porte des faits ou des récits. | Exception non modélisée | Pilote — **à poser en premier** |
| PC55 | 🟡 | Qui informe la population locale avant l'épandage, et cela laisse-t-il une trace ? | Événement manquant | Chef d'équipe |

---

## Ébauche de langage commun

La troisième colonne — **le mot que vous employez vraiment** — reste vide. Elle ne se remplit
qu'en séance ; un terme inventé au bureau serait pire qu'une case vide.

| Terme | Lecture A | Lecture B | Le mot que vous employez |
|---|---|---|---|
| **Rotation** | Un cycle cuve complet : remplir → MEP → application → retour | Une passe sur le bloc / une équipe au sol | *à remplir en séance* |
| **Mise en place (MEP)** | Le vol du stand jusqu'au bloc | Le montage de la rampe avant vol | *à remplir en séance* |
| **Mixte** | Deux espèces (LMC + NSE) | Un vol qui enchaîne deux activités | *à remplir en séance* |
| **Convoyage** | Transfert de l'aéronef vers une autre base | Transport de produit ou de personnel | *à remplir en séance* |
| **Cuve** | Le réservoir embarqué | Aussi les récipients de préparation au sol | *à remplir en séance* |
| **Quantité perdue** | Incident physique constaté | Écart comptable du soir | *à remplir en séance* |
| **Résidu** | Ce qui reste en cuve au retour | Cuve + rampe + évaporation + fuites | *à remplir en séance* |
| **Bloc à traiter** | Polygone délimité d'avance | Foyer désigné verbalement | *à remplir en séance* |
| **Base secondaire** | Terrain de dégagement subi | Base avancée choisie | *à remplir en séance* |
| **Fût** | Contenant de volume standard | Unité de compte, volume inconnu | *à remplir en séance* |
| **Poste acridien / Station** | Deux choses distinctes | La même chose que « bloc » | *à remplir en séance* |
| **Valider** | Relire et verrouiller un document au bureau | ⚠️ à ne pas confondre avec « prospection de validation » | *à remplir en séance* |
| **Clôturer / Archiver / Pousser** | Trois gestes, trois personnes | Trois mots pour un seul geste | *à remplir en séance* |
| **Agent de rapportage** | ⚠️ rôle cité nulle part défini | — | *à remplir en séance* |

---

## Suites

**Ce mur s'arrête au Process Level.** Il n'y a délibérément ni agrégats ni contextes bornés :
les tracer maintenant reviendrait à concevoir sans le terrain.

**Le document de travail est désormais la coupe fiche de vol** — `fiche-de-vol.md` — qui reprend
cette matière recadrée en discovery et séparée en décisions `D*` et questions terrain `Q*`.
Ce mur-ci reste la matière brute, et la seule source pour ce que la coupe laisse dehors : la
chaîne du produit, les cuves, les fûts, le stock et le compte-rendu de traitement. Quand la
discovery s'étendra au CRT, c'est ici qu'il faudra revenir.

Avant la séance S2 :

1. **Ne pas projeter ce mur.** Le guide d'atelier exige un mur vide. Ce document sert à préparer
   le facilitateur, pas les participants.
2. **Verser au contrôle de couverture** — les événements que la réserve de 62 candidats ne
   contenait pas et que les lentilles ont produits : la perte d'observabilité (E44), la
   surconsommation détectée en vol (E58), la cuve rechargée sans vidange (E78), la fiche remplie
   pour un absent (E90), la date conservée d'un jour reporté (E96), l'arbitrage à l'ancienneté
   (E100).
3. **Poser PC01 par la bande « Lieu »**, jamais en question directe — c'est la consigne de la
   section 07 du guide, et elle reste juste.

Après la séance : reprendre ce fichier, remplacer chaque ⚠️ par ce qui aura été dit, et
mesurer combien d'hypothèses de bureau ont survécu. Le passage au Design Level (agrégats,
contextes bornés) devient légitime à ce moment-là — et c'est le `ddd-orchestrator` qui le prend
en charge, à partir de sa phase 2, puisque ce mur porte déjà le glossaire et les déclencheurs.
