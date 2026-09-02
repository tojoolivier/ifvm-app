# Seed e2e — compte + campagne dédiés (#194)

Provisionne un jeu de données isolé et reproductible pour les tests e2e mobile
(Maestro, épic #193) sur l'environnement staging
(`https://ifvm.orakotondravao.com/api`).

Script : [`backend/app/e2e_seed.py`](../backend/app/e2e_seed.py).

## Ce qui est créé / mis à jour

| Objet | Valeur | Filtrable par |
| --- | --- | --- |
| Utilisateur | `e2e-bot@e2e.ifvm.test`, rôle `prospecteur`, `actif=True` | domaine email `@e2e.ifvm.test` |
| Campagne | `[E2E] Campagne e2e-bot` (créée par e2e-bot) | préfixe `[E2E] ` |
| Zone anti-acridienne | code `E2E-ZAA-01`, `[E2E] Zone acridienne de test` | préfixe `[E2E] ` / code `E2E-` |

Ces marqueurs permettent d'exclure ces données des rapports / statistiques réels.

## Idempotence

Ré-exécutable sans limite : chaque objet est retrouvé par sa clé naturelle
(email / nom / code), jamais dupliqué. À chaque exécution le script **réaligne** le
mot de passe du compte sur la valeur attendue et **réactive** le compte s'il avait
été désactivé — la rotation du secret CI ne demande donc aucun geste manuel.

## Credentials

| | |
| --- | --- |
| Email | `e2e-bot@e2e.ifvm.test` (constante `E2E_BOT_EMAIL`) |
| Mot de passe | variable d'env `E2E_BOT_PASSWORD` |
| Défaut de dev (non secret) | `e2e-bot-local-dev` |

En CI/staging, `E2E_BOT_PASSWORD` doit venir d'un secret GitHub Actions. Le workflow
Maestro (#195) lit ce même secret pour se connecter dans le flow.

**Garde-fou** : lancé sans `E2E_BOT_PASSWORD`, le script **refuse de tourner** (pour
ne pas poser le mot de passe par défaut, public, sur staging). Pour l'accepter en
dev local : `E2E_SEED_ALLOW_DEV_DEFAULT=1`.

## Position GPS de test

La saisie de prospection exige une position GPS valide. Coordonnées fixes à injecter
dans l'émulateur avant le flow Maestro (constantes du script) :

- latitude : `-23.712`
- longitude : `44.401`

Secteur Betioky / Toliara (Sud-Ouest malgache), zone acridienne connue.

## Exécution

```bash
# local (backend démarré via docker compose)
E2E_SEED_ALLOW_DEV_DEFAULT=1 make seed-e2e
# ou : docker compose exec -e E2E_SEED_ALLOW_DEV_DEFAULT=1 backend python -m app.e2e_seed

# contre staging (runner CI ; DATABASE_URL -> base staging)
E2E_BOT_PASSWORD=*** DATABASE_URL=*** python -m app.e2e_seed
```

Le script affiche en sortie les ids créés, les credentials et les coordonnées GPS.

## Vérification via l'API existante

```bash
# login
curl -sX POST $API/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"e2e-bot@e2e.ifvm.test","password":"'$E2E_BOT_PASSWORD'"}'

# campagne + zone visibles dans le référentiel (avec le token ci-dessus)
curl -s $API/referentiel/pull -H "Authorization: Bearer $TOKEN" \
  | jq '.campagnes.upserts[].name, .zones_anti_acridiennes.upserts[].code'
```

Tests : `backend/tests/test_e2e_seed.py` (création, idempotence, réparation d'un
compte désactivé, login, visibilité dans `/referentiel/pull`).
