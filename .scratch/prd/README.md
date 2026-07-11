# PRDs — IFVM Fiche de prospection antiacridienne numérisée

Source design : `Fiche prospection IFVM.dc.html` (projet claude.ai/design `db6125a6`)

---

## Parcours mobile (terrain, hors-ligne)

| # | Écran | Fichier |
|---|---|---|
| 01 | Accueil / Liste hors-ligne | [01-accueil-liste-hors-ligne.md](01-accueil-liste-hors-ligne.md) |
| 02 | A · Référence & GPS (autofill) | [02-reference-autofill-gps.md](02-reference-autofill-gps.md) |
| 03 | Filtre conditionnel — Qu'avez-vous observé ? | [03-filtre-conditionnel-especes.md](03-filtre-conditionnel-especes.md) |
| 04 | ★ Compteur de captures (imagos) | [04-compteur-captures.md](04-compteur-captures.md) |
| 04b | Lecture mobile (vue récapitulatif validée) | [04b-lecture-mobile.md](04b-lecture-mobile.md) |
| 06a | B · Densités (mobile) | [06a-densites-mobile.md](06a-densites-mobile.md) |
| 06b | B · Accouplement & Ponte (mobile) | [06b-accouplement-ponte-mobile.md](06b-accouplement-ponte-mobile.md) |
| 06c | C · Nomadacris septemfasciata (mobile) | [06c-nomadacris-mobile.md](06c-nomadacris-mobile.md) |
| 06d | D · Infestation — Description (mobile) | [06d-infestation-description-mobile.md](06d-infestation-description-mobile.md) |
| 06e | D · Infestation — Comportement (mobile) | [06e-infestation-comportement-mobile.md](06e-infestation-comportement-mobile.md) |
| 06f | E · Strates de végétation (mobile) | [06f-strates-vegetation-mobile.md](06f-strates-vegetation-mobile.md) |
| 05 | E · Végétation & Sol — vue simplifiée | [05-vegetation-sol.md](05-vegetation-sol.md) |
| 06g | E · Observations & Ennemis naturels (mobile) | [06g-observations-ennemis-mobile.md](06g-observations-ennemis-mobile.md) |

## Multi-espèces & larves (mobile)

| # | Écran | Fichier |
|---|---|---|
| 08a | ★ Plan de relevé — Hub multi-espèces | [08a-plan-releve-hub-multi-especes.md](08a-plan-releve-hub-multi-especes.md) |
| 08b | Larves Locusta L1→L5 | [08b-larves-locusta-mobile.md](08b-larves-locusta-mobile.md) |
| 08c | Larves Nomadacris L1→L7 | [08c-larves-nomadacris-mobile.md](08c-larves-nomadacris-mobile.md) |

## Supervision web (desktop)

| # | Écran | Fichier |
|---|---|---|
| 06 | Console web IFVM — Supervision & grille complète | [06-console-web-supervision.md](06-console-web-supervision.md) |
| 05w | ★ Saisie web bureau — grille éditable (Tab/Entrée) | [05-saisie-web-bureau.md](05-saisie-web-bureau.md) |
| 07 | Panneaux web B→E (Densités, Accouple, Nomadacris, Infest., ORPAD, Obs.) | [07-web-panels-b-e.md](07-web-panels-b-e.md) |
| 08d | Web · Larves — grilles les 2 espèces côte à côte | [08d-web-larves-grilles.md](08d-web-larves-grilles.md) |

## Archivage & export

| # | Écran | Fichier |
|---|---|---|
| 07pdf | Fiche de lecture / Récapitulatif A4 — export PDF | [07-fiche-lecture-pdf.md](07-fiche-lecture-pdf.md) |

---

## Flux mobile recommandé (approche B — adaptative)

```
Accueil (01)
  └→ Référence GPS (02)
       └→ Filtre espèces (03)
            └→ [Si 1 espèce/stade]
            |    └→ Compteur captures (04) → Densités (06a) → Accouplement (06b) → Infestation (06d→06e) → Végétation (06f) → Observations (06g)
            └→ [Si ≥ 2 espèces/stades]
                 └→ Hub de relevé (08a)
                      ├→ Compteur captures imagos (04)
                      ├→ Larves Locusta (08b)
                      ├→ Nomadacris imagos (06c)
                      └→ Larves Nomadacris (08c)
                           └→ Densités (06a) → Accouplement (06b) → Infestation → Végétation → Observations (06g)
                                └→ Lecture mobile (04b)
```

## Écrans clés (★)

- **04** — Compteur de captures : écran le plus complexe, cœur de l'expérience terrain
- **05w** — Saisie web bureau : grille éditable façon tableur (ressaisie papier)
- **07e** — Végétation ORPAD complète : tableau le plus dense du web
- **08a** — Hub multi-espèces : gestion de l'interruption de session
