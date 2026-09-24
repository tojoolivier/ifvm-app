# Discovery — La fiche de vol

> **Nous écrivons un projet, pas l'existant.** La fiche de vol est le journal journalier d'un
> aéronef, tous types de vols confondus — **à construire**. Le code en service (tables `fiche_vol`,
> `vol`, `fiche_vol_signature`) est un **brouillon déjà écrit**, pas une contrainte. Ce qui n'y
> figure pas n'est pas un défaut : c'est ce qui reste à décider.
>
> Coupe du mur complet `journee-aerienne.md`, resserrée sur cette seule fiche. Le produit, les
> cuves, les fûts, le stock et le compte-rendu de traitement en sortent.
>
> Version publiée : https://claude.ai/code/artifact/af0b3e3b-d58d-4beb-bd50-9245bb63620c

## La distinction qui organise ce document

**Ce que nous pouvons décider au bureau** (`D01`–`D17`) et **ce que seul le terrain sait**
(`Q01`–`Q17`). Les confondre coûte une séance : on y débat de ce qu'il fallait demander, et on y
demande ce qu'il nous appartenait de trancher.

| | Nombre |
|---|---|
| Événements retenus | 55 sur 128 |
| Informations portées par la fiche | 24 arrêtées · 5 à décider |
| Gestes | 4 — dont **2 à modéliser** |
| Décisions `D*` | 17 |
| Questions terrain `Q*` | 17 |
| Réponses acquises | 4 |

---

## Ce que le terrain a déjà dit

### R1 — Le pilote vérifie la fiche ; c'est pourquoi il ne la saisit pas

Le pilote et le consultant international n'entrent aucune donnée. Le rôle du pilote sur cette
fiche est la **vérification** : il contrôle ce que le chef de base a écrit, et sa signature en
est la trace.

- **Ça corrige le mur.** Il disait « il ne fait que signer ». Sa signature n'est pas une
  approbation de forme, c'est l'aboutissement d'un contrôle.
- **Ça corrige une seconde fois.** Le mur jugeait fragile l'hypothèse « une seule personne
  saisit toute la journée », parce que trois personnes écrivent en même temps dans trois lieux.
  Il confondait *écrire* et *saisir*. Si aucune de ces écritures n'est une saisie, l'hypothèse
  tient — elle redevient la plus probable.
- **Ça ouvre le manque le plus net de la discovery** : s'il vérifie, il peut trouver une erreur.
  Et alors ? Ni refus, ni renvoi, ni réserve. → `D10`
- **Ça ouvre une contrainte de conception** : il vérifie un texte écrit à partir de son propre
  récit, sur des faits dont il est le seul témoin. Quand vérifie-t-il, et sur quoi ? → `Q01`, `Q03`

### R2 — La matrice des acteurs

| Fiche | Côté mobile — qui saisit |
|---|---|
| Prospection terrestre | Prospecteur · Chef de base · Chef de zone |
| Prospection aérienne | Chef de base · Chef de zone |
| Traitement terrestre | Prospecteur · Responsable traitement terrestre · Chef de base · Chef de zone |
| Traitement aérien | Chef de base · Chef de zone |
| **Fiche de vol** | Chef de base · **Pilote — *pour signature*** |

| Rôle portail | Qui |
|---|---|
| Vérificateur | Chef de base · Chef de zone · Cellule de veille |
| **Validateur** | **Cellule de veille — elle seule** |
| Admin | Cellule de veille · Directeur Technique · Directeur du SIC |

- **Ça tranche** : la cellule de veille valide, elle seule. Et le brouillon était déjà cohérent
  sur un point — seul un `chef_de_base` peut créer une fiche.
- **Ça ouvre** : vérifier et valider sont deux étapes ; le brouillon n'en porte qu'une
  (`brouillon` → `validee`). Et il y a désormais **deux** vérifications — celle du pilote sur le
  contenu, celle du portail sur le dossier. → `D11`, `Q16`

### R4 — Les heures d'interdiction

> Ne jamais traiter pendant la période chaude — généralement **entre 11 h et 16 h**.
> Ne jamais traiter sous **1 m/s** de vent, ni au-dessus de **6 m/s**.

Sur ce périmètre, ce qui compte est la contrainte horaire : elle porte sur `vol.heure_debut` et
`vol.heure_fin`. Les heures des vols d'application deviennent **vérifiables contre une règle
connue** — et rien ne les vérifie aujourd'hui.

Conséquence de forme : **la journée n'est pas un continuum.** Une fenêtre matinale, cinq heures
de coupure, une fenêtre de fin d'après-midi. → `Q09`

---

## Les informations que la fiche devra porter

`✍️` écrite au moment où elle naît · `🧠` reconstituée plus tard · `?` à établir ·
`◇` **à décider — aucune colonne aujourd'hui**

| Information | Qui l'écrit | D'où elle vient | Trace |
|---|---|---|---|
| Numéro de fiche | Chef de base | Attribué ; suffixe `-02` en cas de collision, pour ne jamais bloquer le terrain | ✍️ |
| Date du vol | Chef de base | Le jour — mais le réel ou le prévu, quand une MEP est reportée ? | ? |
| Compagnie | Chef de base | Figée à l'instant ; pas de référentiel d'aéronefs | ✍️ |
| Immatriculation | Chef de base | Idem | ✍️ |
| Base — code, nom, lat, lon, alt | Chef de base | Figée. Une base secondaire subie n'a nulle part où s'écrire | ✍️ |
| Stand — code, nom, lat, lon, alt | Chef de base | Figé. Un stand relocalisé n'a pas de seconde ligne | ✍️ |
| Pilote | Chef de base | Nom en texte ; le pilote ne saisit rien | ✍️ |
| Mécanicien | Chef de base | Nom en texte | ✍️ |
| Chef de base | Chef de base | Seul rôle contrôlé par le brouillon | ✍️ |
| Consultant international | Chef de base | Nom en texte ; absent de la matrice des acteurs | ✍️ |
| Statut | Cellule de veille | `brouillon` → `validee`. Aucun palier de vérification | ✍️ |
| Numéro de vol | Chef de base | Séquence dans la journée, unique par fiche | ✍️ |
| Type de vol | Chef de base | Prospection · MEP · application · convoyage · divers. « Mixte » n'existe pas | ✍️ |
| Heure de début | Chef de base | Le pilote la connaît ; il ne l'écrit pas lui-même | ? |
| Heure de fin | Chef de base | Idem. Aucune durée stockée — recalculée | ? |
| Rattachement à une rotation | **personne d'identifié** | Exigé pour les vols MEP et application. Le geste n'a aucun propriétaire connu | ? |
| Rattachement à une prospection | Chef de base | Vols de prospection uniquement | ? |
| Observations | Chef de base | Texte libre — là où atterrit ce que le modèle ne sait pas nommer | 🧠 |
| Signature — rôle | Le signataire | Pilote · mécanicien · chef de base · consultant | ✍️ |
| Signature — nom | Le signataire | | ✍️ |
| Signature — tracé manuscrit | Le signataire | Facultatif. Sur quel appareil, si le pilote n'en a pas ? | ? |
| Signature — horodatage | Le système | **Le seul horodatage fiable de toute la fiche** | ✍️ |
| État de synchronisation | Le système | `local` · `synced` · `conflict` · `echec` — sans compteur de tentatives | ✍️ |
| Création et modification | Le système | Avec l'horodatage de signature, les seuls repères de temps | ✍️ |
| **Température et vent en vol** | — | Décidés par l'ADR-014, jamais construits. Seul le relevé au sol existe, sur la rotation | ◇ |
| **Heures avant la grande visite** | — | Trois moments de la journée en dépendent | ◇ |
| **Base secondaire** | — | Se poser ailleurs n'a pas d'endroit où s'écrire | ◇ |
| **Vol mixte** | — | Interdit par la contrainte de type ; le terrain écrit deux fiches | ◇ |
| **Durée de vol** | — | Non stockée ; recalculée depuis début et fin | ◇ |

---

## Les quatre gestes

| Geste | Qui | Ce que c'est | État du brouillon |
|---|---|---|---|
| **Saisir** | Chef de base · chef de zone | Remplir la fiche depuis ce qu'il a vu au sol et ce que le pilote lui a raconté | Permis côté serveur. **L'écran terrain reste à construire** — c'est l'objet du projet |
| **Vérifier** | Pilote | Contrôler que l'écrit correspond au vol effectué. La raison pour laquelle il ne saisit pas | **À modéliser entièrement.** Ni état, ni horodatage, ni geste quand la vérification échoue |
| **Signer** | Les quatre rôles | Engager sa responsabilité. Pour le pilote, la trace de sa vérification | Existe. **Le contrôle de rôle est à écrire** |
| **Vérifier au portail** | Chef de base · chef de zone · cellule de veille | Relire le dossier au bureau. Distinct de la vérification du pilote | **À modéliser.** Aucun palier entre brouillon et validée |
| **Valider** | Cellule de veille seule | Verrouiller. La journée devient opposable | Existe. Restent le contrôle de rôle et le circuit de correction |

---

## Ce que nous décidons — `D01`–`D17`

Aucune ne demande le terrain. Les dépendances sont notées.

### Ce que la fiche portera

| # | Décision | Dépend de |
|---|---|---|
| D01 | **Porte-t-on le relevé de température et de vent fait en vol ?** L'ADR-014 le décide — deux acteurs, deux mesures — et la colonne n'a jamais été construite. Si le pilote ne fait que raconter au retour, cette colonne donnerait à une reconstitution l'apparence d'une mesure. | **`Q02`** |
| D02 | **Un vol annulé existe-t-il sur la fiche ?** Le brouillon exige `heure_fin > heure_debut` ; un vol qui n'a pas eu lieu n'a ni l'une ni l'autre. Ligne avec motif, ou absence pure ? | — |
| D03 | **Porte-t-on la base secondaire ?** Se poser ailleurs qu'à sa base n'a nulle part où s'écrire, alors que la base est un champ figé. | — |
| D04 | **Porte-t-on les heures avant la grande visite ?** Champ saisi, ou valeur calculée depuis le compteur ? | `Q08` |
| D05 | **Le stand peut-il changer en cours de journée ?** Il est figé à l'instant ; un stand relocalisé n'a pas de seconde ligne. | — |
| D06 | **Le tracé manuscrit est-il exigé, ou facultatif ?** Il l'est sur la fiche de vol, pas sur le traitement. | `Q04` |
| D07 | **Rapproche-t-on les heures du carnet de bord et celles de la fiche ?** Le mécanicien relève au compteur la seule mesure instrumentale de la journée — et elle va au carnet, pas à la fiche. | — |
| D08 | **Que devient le champ `observations` ?** Ce qu'on y trouvera après six mois d'usage dira ce qu'il fallait modéliser. | — |

### Les gestes à modéliser

| # | Décision |
|---|---|
| D09 | **Comment se modélise la vérification du pilote ?** État distinct, horodatage propre, ou attribut de la signature ? |
| D10 | **Que fait le pilote qui trouve une erreur ?** Aucun geste de refus, de renvoi, ni de réserve. Ne pas signer bloque la journée entière sans en dire la raison. **Le manque le plus net de la discovery.** |
| D11 | **Vérifier au portail : un état, ou un geste hors application ?** La matrice sépare vérificateur et validateur ; le brouillon n'a aucun palier. |
| D12 | **Le circuit de correction après verrou.** Qui déverrouille, qui en est informé, et **la vérification du pilote doit-elle être refaite ?** |
| D13 | **Le contrôle de rôle, à écrire.** Seule la cellule de veille valide, et chaque signature appartient à un rôle. Rien n'est vérifié aujourd'hui. |
| D14 | **Que rend-on à la base après la remontée ?** Aujourd'hui elle n'apprend rien : ni l'arrivée, ni le conflit, ni l'échec. |
| D15 | **Deux versions de la même journée au serveur : laquelle survit ?** Et la perdante est-elle conservée ? Le cas se produira d'autant plus que le mobile arrive. |
| D16 | **Un envoi qui échoue sans compteur de tentatives.** Au bout de combien de temps quelqu'un le sait, et par quel signe ? |
| D17 | « Clôturer », « archiver », « pousser au serveur » : trois gestes, ou trois mots pour un seul ? À arrêter avant de coder. |

---

## Ce que nous demandons — `Q01`–`Q17`

### La vérification du pilote

| # | Question | À | Quand |
|---|---|---|---|
| Q01 | **Quand vérifiez-vous la fiche ?** Juste après le vol, pendant la coupure de 11 h – 16 h, ou le soir ? La fenêtre décide de ce qui peut encore être rattrapé de mémoire — et du moment où l'écran doit être disponible. | Pilote | S2 · récit dirigé |
| Q02 | **Écrivez-vous quelque chose en vol, ou seulement racontez-vous au retour ?** Carnet à bord, planchette, rien ? Commande `D01`. | Pilote | **S2 · à poser en premier** |
| Q03 | **Sur quoi vérifiez-vous ?** Papier qu'on vous tend, écran du chef de base, lecture à voix haute ? | Pilote | S2 |
| Q04 | **Avez-vous un appareil à vous ?** Sinon, comment signez-vous ? | Pilote | S2 |
| Q05 | Quand le chef de base remplit la fiche d'un pilote absent, **qui vérifie ?** | Chef de base | S2 |
| Q06 | **Que certifient les trois autres signataires ?** Ce qu'ils ont vu, ou seulement qu'ils ont lu ? | Signataires | S2 |
| Q07 | L'ordre des signatures est-il réel, contraint, ou arbitraire ? La vérification doit-elle précéder ? | Chef de base | S2 |

### Les heures, et le trou d'observation

| # | Question | À | Quand |
|---|---|---|---|
| Q08 | **Les heures de début et de fin naissent en vol.** Qui les note, à quel instant, sur quoi ? Et les heures avant la grande visite : lues au compteur, ou calculées ? | Pilote + mécanicien | S2 · bande « Lieu » |
| Q09 | **Que se passe-t-il pendant la coupure de 11 h – 16 h ?** Si les papiers s'y remplissent et s'y vérifient, la reconstitution de mémoire recule de plusieurs heures — et l'écran se conçoit pour ce moment-là. | Chef de base + pilote | S2 |
| Q10 | **Le numéro de cuve que vous connaissez et celui que le chef de base écrit : le même ?** Qui l'attribue, et quand ? | Pilote + chef de base | S2 |

### Les mots, et les rattachements

| # | Question | À | Quand |
|---|---|---|---|
| Q11 | **Qui rattache un vol à une rotation, quand, en regardant quoi ?** Et surtout : **le mot « rotation » vous parle-t-il ?** | Chef de base | S2 |
| Q12 | **« Mixte » : deux espèces, ou deux activités dans le même vol ?** Les sept lentilles se sont divisées exactement en deux. Et un vol peut-il faire deux choses sans se poser ? | Pilote + chef de base | S2 |
| Q13 | **Après un vol de prospection, combien de fiches remplissez-vous ?** Une, ou une par endroit repéré ? Comment savez-vous où c'était ? | Pilote | S2 |
| Q14 | **La date de la fiche : le jour réel, ou le jour prévu ?** | Chef de base | S2 |
| Q15 | **Le chef de zone saisit la fiche au même titre que le chef de base.** Où est-il pendant la journée, et qu'est-ce qui décide lequel remplit ? | Chef de zone | S2 |
| Q16 | **Le consultant et le mécanicien ne figurent pas dans la matrice**, alors que leur signature conditionne la validation. Sont-ils là tous les jours ? Comment signent-ils ? | Chef de base + direction | S2 |
| Q17 | Quand la fiche et le CRT divergent, **qui a le dernier mot ?** Le mur dit : le plus ancien. Règle, ou usage ? | Chef de base | S2 |

---

## Réponses acquises

Gardées en vue : une discovery qui efface ses réponses perd la trace de ses raisons.

| | Question | Réponse | Reste |
|---|---|---|---|
| R·a | La fiche de vol se saisit-elle sur mobile, ou pas encore ? | **C'est un projet, pas un existant.** L'absence d'écran terrain et de synchro est le périmètre à construire. | — |
| R·b | Qui valide et verrouille la fiche ? | **La cellule de veille, elle seule.** | `D11`, `D13` |
| R·c | Pourquoi le pilote ne saisit-il pas ? | **Parce qu'il vérifie.** Sa signature est la trace de ce contrôle. | `D09`, `D10` |
| R·d | Quel seuil interdit d'épandre ? | **Vent < 1 m/s ou > 6 m/s, et jamais entre 11 h et 16 h.** | `Q09` |

---

## Les 55 événements retenus

Extraits du mur complet, ils sont la matière de la discovery : chacun est un fait métier que la
fiche devra ou non savoir accueillir. **Ils ne vont pas au mur des participants** — le guide
d'atelier exige un mur vide ; ils servent au contrôle de couverture des vingt dernières minutes.

Le détail — lieu, trace, provenance des lentilles, annotations Process Level — est dans
`journee-aerienne.md`. Bandes retenues ici :

| Bande | Événements | Ce qu'elle dit de la fiche |
|---|---|---|
| Avant le vol | E01, E04–E07, E09, E35–E39, E41, E105 | Le mécanicien signe un avis de mise en condition de vol **qui n'a aucune colonne**. Et un vol annulé pour météo : figure-t-il sur la fiche du jour ? → `D02` |
| **Le vol** *(hors de vue)* | E42, E43, E44, E46, E47, E55, E60, E61, E63, E65, E66 | Les deux heures que la fiche exige **naissent ici**, dans la seule zone que personne au sol ne constate, et leur mode d'inscription est inconnu. → `Q02`, `Q08` |
| Le retour | E67–E69, E79, E81–E83, E85 | Le mécanicien relève au compteur **la seule mesure instrumentale de la journée** — et elle va au carnet, pas à la fiche. → `D07` |
| L'écriture | E89–E93, E96–E98, E100–E103 | E102 reste **le geste fantôme**. Et E090 : on remplit la fiche d'un pilote absent — qui la vérifie alors ? → `Q05`, `Q11` |
| **Vérification et signatures** | **E129**, E107–E110, E113 | **E129 vient du terrain, pas des lentilles.** Aucune des sept ne l'avait produit. → `D09`, `D10` |
| Après le verrou | E115–E117, E119–E123, E125–E127 | E125–E127 décrivent une synchronisation **qui n'existe pas encore** pour cette fiche. → `D14`, `D15`, `D16` |

---

## L'ordre de travail

1. **Poser `Q02` au pilote avant tout le reste.** *Écrivez-vous quelque chose en vol, ou
   seulement racontez-vous au retour ?* Une seule question, et elle commande `D01`. Y répondre
   au bureau reviendrait à construire une colonne qui donne à une reconstitution l'apparence
   d'une mesure.
2. **Puis `Q01` et `Q08` — quand, et sur quoi.** Si la vérification a lieu pendant la coupure de
   11 h – 16 h plutôt que le soir, ce n'est pas la même application.
3. **En parallèle, trancher `D09` et `D10` au bureau.** La vérification du pilote est confirmée :
   elle se modélise. Et le geste qui manque le plus, c'est celui du pilote qui trouve une erreur.
4. **Ne pas projeter la timeline en séance.** Ces 55 événements viennent du bureau.
