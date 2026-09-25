# Questions au métier — fiche de vol, traitement aérien, prospection aérienne

**À qui** : pilotes et mécaniciens de la compagnie aérienne / de l'Armée, chefs de base, chefs
d'équipe et agents encadreurs, prospecteurs, responsable du rapportage.
**Pourquoi** : dix points du formulaire papier n'ont pas de définition métier établie. Tant
qu'ils ne l'ont pas, on ne peut ni dessiner l'écran ni figer le modèle de données — et une erreur
ici coûte une migration et une reprise de saisie.
**Comment répondre** : le plus concrètement possible. Un exemple vécu vaut mieux qu'une règle
générale. « Ça dépend » est une réponse utile — dites de quoi.

Détail technique de chaque point : `docs/adr/ADR-014-vol-et-rotation-deux-faits-deux-acteurs.md`.

---

## A. Pour les pilotes et les mécaniciens

### A1. Le vol « mixte », c'est quoi exactement ?

La légende de la fiche de vol propose six types : *application, convoyage, mise en place,
prospection, **mixte**, divers*.

1. Quand cochez-vous « mixte » ? Décrivez le dernier vol pour lequel vous l'avez fait.
2. Est-ce qu'un même vol peut à la fois **emporter la cuve jusqu'au bloc et épandre** sans se
   poser entre les deux ? Si oui, est-ce l'ordinaire ou l'exception ?
3. Ou bien « mixte » veut-il dire autre chose — par exemple regarder l'état d'une zone pendant un
   convoyage ?
4. Si vous ne cochez jamais « mixte », dites-le : la case disparaîtra de l'application.

> **Ce que ça change** : si un vol peut mettre en place *et* épandre, alors une cuve ne
> correspond pas forcément à deux vols. L'application refuserait aujourd'hui de valider une
> journée pourtant normale.

### A2. Les heures avant la grande visite

La fiche demande « Nombre d'heures de vol avant la grande visite ».

1. Où lisez-vous ce nombre ? Sur le carnet de bord de l'appareil, sur un compteur, ailleurs ?
2. Le nombre que vous inscrivez est-il **déjà** le nombre d'heures restantes, ou faites-vous
   vous-même une soustraction ?
3. Quand un appareil arrive sur une base en cours de campagne après avoir volé ailleurs,
   comment savez-vous où il en est de son potentiel ?

> **Ce que ça change** : si vous recopiez un nombre lu, l'application le demandera. Si elle doit
> le calculer, elle a besoin de savoir depuis quel point de départ — sinon elle affichera un
> potentiel trop optimiste, dans le sens qui fait voler un appareil au-delà de sa visite.

### A3. La température et le vent que vous notez

Vous notez une température et un vent en début et en fin de vol. Le chef de base note aussi une
température et un vent pour le traitement.

1. Où prenez-vous la mesure : instruments de bord, station au sol, estimation ?
2. Vous arrive-t-il de constater un écart avec ce que le chef de base a noté ? Cet écart
   vous intéresse-t-il, ou est-ce du bruit ?

> **Ce que ça change** : on a décidé de conserver les deux relevés séparément plutôt que de les
> fusionner. On veut confirmer que c'est utile et non deux fois le même travail.

### A4. La « base secondaire »

La fiche a une ligne « Base » et une ligne « Base secondaire », chacune avec un stand de
remplissage.

1. Qu'est-ce qu'une base secondaire ? Un deuxième endroit où vous vous ravitaillez dans la
   journée ? Un endroit où l'appareil passe la nuit ? Autre chose ?
2. Combien de fois dans une campagne remplissez-vous cette ligne ?
3. Peut-il y en avoir plus de deux dans une même journée ?

---

## B. Pour les chefs de base et les chefs d'équipe

### B1. Qui tient le stock de pesticide, et pour quoi ?

Deux formulaires demandent le stock de pesticide, avec presque les mêmes mots :

- La **fiche de compte-rendu de traitement** demande stock initial, approvisionnement,
  produit consommé, stock final — pour **le chantier**.
- La **fiche de vol** demande quantité disponible, reçue, utilisée, perdue, restante, plus un
  compteur de fûts — pour **la journée**.

1. Est-ce la même personne qui remplit les deux ? Sinon, qui remplit quoi ?
2. Sont-ce les mêmes chiffres, ou comptez-vous vraiment deux choses différentes ?
3. Le stock de la fiche de vol, c'est le stock **du stand de remplissage** ou celui **de la
   base** ? Que se passe-t-il quand deux appareils se servent au même stand le même jour ?
4. Aujourd'hui, à quoi servent ces chiffres une fois la fiche remontée ? Qui les lit ?

### B2. La « quantité perdue »

La fiche de vol porte une note : *« Quantité perdue* — expliquer comment est-elle arrivée ? »*

1. Quand inscrivez-vous une quantité perdue ? Donnez un exemple réel.
2. Est-ce **un incident que vous constatez** (un fût percé, un renversement, une fuite), ou
   **un manque que vous découvrez en comptant** le soir ?
3. Si les chiffres du soir ne tombent pas juste sans qu'il y ait eu d'incident, qu'écrivez-vous ?

> **Ce que ça change** : la maquette actuelle calcule la perte comme un écart et vous réclame
> une explication. Si une cuve rentre à moitié pleine parce que le vent s'est levé, elle vous
> annoncerait cent litres « perdus » à justifier. On veut éviter ça.

### B3. Les fûts

1. Que comptez-vous exactement : des fûts disponibles, reçus, pleins, vides — à quel moment de
   la journée ?
2. Un fût entamé, il compte où ?
3. Ce compte sert-il à la restitution des fûts vides, à autre chose ?

### B4. Le numéro de cuve

1. Le numéro de cuve que le pilote inscrit sur sa ligne de vol, et celui que vous notez sur le
   compte-rendu de traitement : est-ce le même numéro, tiré de la même liste ?
2. Quand vous rapprochez les deux fiches en fin de journée, qu'est-ce que vous comparez
   concrètement ?

### B5. Quand ouvrez-vous le compte-rendu de traitement ?

Le pilote décolle à 07h40. Sur sa fiche, il doit pouvoir désigner **quelle cuve** il vient
d'emporter — c'est-à-dire une rotation de votre compte-rendu.

1. Ouvrez-vous le compte-rendu **avant** les vols, parce que vous savez déjà quelles cuves vous
   allez faire ? Ou le rédigez-vous **en fin de journée**, une fois le chantier terminé ?
2. Est-ce que ça dépend du chantier ? De quoi, alors ?
3. Le matin, avant le premier décollage, savez-vous déjà combien de rotations vous prévoyez ?

### B6. Qui rapproche les vols des rotations, et quand ?

1. En fin de journée, qui met les deux fiches côte à côte — vous, le pilote, les deux ?
2. Le pilote sait-il, en descendant de l'appareil, quel numéro de cuve il vient d'épandre ?
3. Si le rapprochement se fait le lendemain, ou plus tard, est-ce un problème ?

> **Ce que ça change** : si le compte-rendu n'existe pas encore quand le pilote saisit, il ne
> peut pas désigner de rotation — l'application doit accepter une paire de vols « non rattachée »
> et permettre de faire le lien plus tard. Aujourd'hui, l'appareil du pilote ne voit d'ailleurs
> **aucune** rotation saisie sur un autre appareil : rien ne les lui transmet.

---

## C. Pour les chefs d'équipe et agents encadreurs (compte-rendu de traitement)

### C1. Aéronef et matériel au sol sur le même chantier

Le compte-rendu de traitement demande, sur la même ligne, les surfaces traitées **par atomiseur à
dos**, **par disque rotatif**, **par ulvamast** et **par aéronef**.

1. Est-il déjà arrivé qu'un même chantier soit traité **à la fois** par aéronef et par du
   matériel au sol ? Décrivez le cas.
2. Si oui, remplissez-vous **une** fiche de compte-rendu ou **deux** ?
3. Y a-t-il un ordre habituel — l'aéronef d'abord et le sol en reprise, ou l'inverse ?
4. Si ça n'arrive jamais, dites-le clairement : un chantier est soit aérien, soit terrestre.

> **Ce que ça change** : c'est la question la plus lourde du lot. L'application considère
> aujourd'hui qu'un traitement est soit aérien, soit terrestre, jamais les deux — et n'a
> d'ailleurs aucune case pour la surface traitée par aéronef. Si les deux se mélangent, une
> partie du modèle est à reprendre.

### C2. Ce que couvre une fiche de compte-rendu

1. Une fiche de compte-rendu couvre-t-elle **un bloc traité**, **une journée**, ou **une
   opération** qui peut s'étaler sur plusieurs jours ?
2. Quand un traitement reprend le lendemain sur la surface restante, est-ce une nouvelle fiche ?

---

## D. Pour les prospecteurs

### D1. La prospection depuis l'aéronef

Le pilote peut cocher « prospection » comme type de vol.

1. Que fait-on pendant un vol de prospection ? On repère des zones infestées depuis l'air ? On
   se pose pour observer ?
2. Ce qui est rapporté ensuite, ce sont **des points précis** (comme une prospection au sol,
   avec des coordonnées), ou **une zone survolée**, ou **un trajet** ?
3. Remplissez-vous une fiche de prospection ordinaire après un vol de prospection, ou une autre
   fiche ?
4. Un même vol de prospection peut-il donner lieu à plusieurs observations en des endroits
   différents ?

> **Ce que ça change** : une prospection est aujourd'hui enregistrée comme **un point** sur la
> carte. Un vol d'une heure et demie survole des dizaines de kilomètres — un seul point ne peut
> pas le représenter fidèlement.

---

## E. Pour le rapportage

### E1. Les heures de vol par type

La fiche papier totalise les heures **par type de vol** (convoyage, mixte, prospection, mise en
place, application, divers) et par période.

1. À quoi sert ce détail par type ? Facturation de l'heure de vol, bilan de campagne, rapport à
   un bailleur, autre ?
2. Le total seul suffirait-il, ou avez-vous besoin de pouvoir dire « douze heures dont sept
   d'épandage » ?
3. Qui produit ce chiffre aujourd'hui, et à quelle fréquence ?

### E2. Les périodes

*(Point déjà tranché : l'application calculera jour / semaine / mois / total. Question de
confirmation uniquement.)*

1. La fiche papier totalise par **décade** et par **campagne**. Ces deux périodes vous
   manqueront-elles si l'application affiche semaine et mois à la place ?

---

## Synthèse — ce qui est bloqué en attendant

| Question | Ce qui ne peut pas avancer |
|---|---|
| C1 — aéronef + sol sur un chantier | La forme du traitement aérien, et donc le rattachement des vols |
| A1 — vol « mixte » | La règle de validation d'une journée de vol |
| D1 — prospection aérienne | Le rattachement d'un vol de prospection |
| B1, B2, B3 — stock, perte, fûts | Tout le bloc pesticide de l'écran |
| B5, B6 — chronologie et rapprochement | Le moment où le pilote peut désigner une rotation |
| A2 — potentiel cellule | Le bloc maintenance de l'écran |
| A4 — base secondaire | Les lieux portés par la fiche |
| E1 — ventilation par type | La forme de l'écran « cumuls des heures » |

Ce qui **n'est pas** bloqué et peut être construit dès maintenant : la saisie des vols
(heures, type, observations, météo du pilote), les signatures, le rattachement à une rotation ou
à une prospection existante, les cumuls jour / semaine / mois / total, et tout le socle
hors-ligne.
