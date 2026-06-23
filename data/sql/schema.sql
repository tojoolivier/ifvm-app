-- ══════════════════════════════════════════════════════════════════
--  IFVM — Schéma PostgreSQL
--  Système de gestion acridienne
--  Voir CONTEXT.md et docs/adr/ pour les décisions d'architecture
-- ══════════════════════════════════════════════════════════════════

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ══════════════════════════════════════════════
--  RÉFÉRENTIELS GÉOGRAPHIQUES
-- ══════════════════════════════════════════════

CREATE TABLE poste_acridien (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(20)  NOT NULL UNIQUE,
    nom         VARCHAR(100) NOT NULL,
    region      VARCHAR(100) NOT NULL,
    district    VARCHAR(100),
    commune     VARCHAR(100),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE poste_acridien IS 'Unité administrative de base de l''IFVM. N''est pas une station.';

-- Deux types :
--   fixe       → prospection intensive (point géographique stable, reconductible)
--   ponctuelle → prospection extensive ou validation (créée à la volée sur le terrain)
CREATE TABLE station (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pa_id       UUID         NOT NULL REFERENCES poste_acridien(id),
    code        VARCHAR(20)  NOT NULL,
    nom         VARCHAR(100),
    type        VARCHAR(20)  NOT NULL CHECK (type IN ('fixe', 'ponctuelle')),
    latitude    DECIMAL(9,6) NOT NULL,
    longitude   DECIMAL(9,6) NOT NULL,
    altitude_m  INTEGER,
    biotope     TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE(pa_id, code)
);

-- Référentiel distinct des stations de prospection
CREATE TABLE station_meteo (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pa_id       UUID         NOT NULL REFERENCES poste_acridien(id),
    code        VARCHAR(20)  NOT NULL UNIQUE,
    nom         VARCHAR(100),
    latitude    DECIMAL(9,6) NOT NULL,
    longitude   DECIMAL(9,6) NOT NULL,
    altitude_m  INTEGER
);

-- ══════════════════════════════════════════════
--  UTILISATEURS
-- ══════════════════════════════════════════════

CREATE TABLE utilisateur (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nom         VARCHAR(100) NOT NULL,
    prenom      VARCHAR(100) NOT NULL,
    email         VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(200) NOT NULL DEFAULT '',
    role          VARCHAR(30)  NOT NULL CHECK (role IN (
                      'prospecteur', 'chef_equipe', 'agent_encadreur',
                      'pilote', 'mecanicien', 'chef_de_base', 'admin')),
    pa_id         UUID REFERENCES poste_acridien(id),
    actif         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════
--  MÉTÉOROLOGIE
-- ══════════════════════════════════════════════

CREATE TABLE releve_meteo (
    id               UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    station_meteo_id UUID     NOT NULL REFERENCES station_meteo(id),
    mois             SMALLINT NOT NULL CHECK (mois BETWEEN 1 AND 12),
    annee            SMALLINT NOT NULL CHECK (annee >= 2000),
    saisi_par        UUID     NOT NULL REFERENCES utilisateur(id),
    valide_par       UUID     REFERENCES utilisateur(id),
    valide_le        DATE,
    -- Colonnes de sync (ADR-002)
    local_version    INTEGER  NOT NULL DEFAULT 1,
    server_version   INTEGER  NOT NULL DEFAULT 0,
    sync_status      VARCHAR(20) NOT NULL DEFAULT 'local'
                         CHECK (sync_status IN ('local', 'synced', 'conflict')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(station_meteo_id, mois, annee)
);

CREATE TABLE mesure_meteo_jour (
    id              UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    releve_id       UUID     NOT NULL REFERENCES releve_meteo(id) ON DELETE CASCADE,
    jour            SMALLINT NOT NULL CHECK (jour BETWEEN 1 AND 31),
    decade          CHAR(2)  NOT NULL CHECK (decade IN ('D1', 'D2', 'D3')),
    pluie_mm        DECIMAL(6,1),
    pluie_nb_jours  SMALLINT CHECK (pluie_nb_jours >= 0),
    temp_min_c      DECIMAL(4,1),
    temp_max_c      DECIMAL(4,1),
    temp_moy_c      DECIMAL(4,1),
    direction_vent  VARCHAR(10),   -- ex : 'NNE', 'SW'
    force_vent_ms   DECIMAL(5,1) CHECK (force_vent_ms >= 0),
    observation     TEXT,
    UNIQUE(releve_id, jour),
    CONSTRAINT temp_coherente CHECK (
        temp_min_c IS NULL OR temp_max_c IS NULL OR temp_min_c <= temp_max_c
    )
);

-- ══════════════════════════════════════════════
--  PROSPECTION EXTENSIVE
-- ══════════════════════════════════════════════
-- La fiche papier groupe 2 stations ; en BDD : 1 ligne par station (ADR Q11)

CREATE TABLE prospection_extensive (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    numero           VARCHAR(30) NOT NULL UNIQUE,   -- auto-généré : {PA}-{YYYYMM}-{seq}
    station_id       UUID        NOT NULL REFERENCES station(id),
    prospecteur_id   UUID        NOT NULL REFERENCES utilisateur(id),
    date_releve      DATE        NOT NULL,
    surface_ha       DECIMAL(10,2) CHECK (surface_ha > 0),
    degats_cultures_pct           DECIMAL(5,1) CHECK (degats_cultures_pct BETWEEN 0 AND 100),
    verdissement_herbeuse_pct     DECIMAL(5,1) CHECK (verdissement_herbeuse_pct BETWEEN 0 AND 100),
    hauteur_strate_herbeuse_m     DECIMAL(5,2) CHECK (hauteur_strate_herbeuse_m >= 0),
    derniere_pluie_date           DATE,
    derniere_pluie_intensite      VARCHAR(20)  CHECK (derniere_pluie_intensite IN ('faible', 'modere', 'fort')),
    observation      TEXT,
    -- Sync
    local_version    INTEGER     NOT NULL DEFAULT 1,
    server_version   INTEGER     NOT NULL DEFAULT 0,
    sync_status      VARCHAR(20) NOT NULL DEFAULT 'local'
                         CHECK (sync_status IN ('local', 'synced', 'conflict')),
    created_by       UUID        NOT NULL REFERENCES utilisateur(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════
--  PROSPECTION INTENSIVE
-- ══════════════════════════════════════════════

CREATE TABLE prospection_intensive (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_releve         VARCHAR(30) NOT NULL UNIQUE,
    station_id            UUID        NOT NULL REFERENCES station(id),
    prospecteur_id        UUID        NOT NULL REFERENCES utilisateur(id),
    date_releve           DATE        NOT NULL,
    surface_station_ha    DECIMAL(10,2) CHECK (surface_station_ha > 0),
    surface_prospectee_ha DECIMAL(10,2) CHECK (surface_prospectee_ha > 0),
    surface_infestee_ha   DECIMAL(10,2) CHECK (surface_infestee_ha >= 0),
    derniere_pluie_date   DATE,
    derniere_pluie_intensite VARCHAR(20) CHECK (derniere_pluie_intensite IN ('faible', 'modere', 'fort')),
    ennemis_naturels      TEXT,
    observation           TEXT,
    -- Sync
    local_version         INTEGER     NOT NULL DEFAULT 1,
    server_version        INTEGER     NOT NULL DEFAULT 0,
    sync_status           VARCHAR(20) NOT NULL DEFAULT 'local'
                              CHECK (sync_status IN ('local', 'synced', 'conflict')),
    created_by            UUID        NOT NULL REFERENCES utilisateur(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT surf_infestee_lte_prospectee CHECK (
        surface_infestee_ha IS NULL OR surface_prospectee_ha IS NULL
        OR surface_infestee_ha <= surface_prospectee_ha
    )
);

-- ──────────────────────────────────────────────
--  Captures : espece × stade × sexe × phase
--  Option B retenue (table de détail — voir ADR Q13)
-- ──────────────────────────────────────────────

CREATE TABLE capture (
    id                       UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    prospection_intensive_id UUID     REFERENCES prospection_intensive(id) ON DELETE CASCADE,
    prospection_extensive_id UUID     REFERENCES prospection_extensive(id)  ON DELETE CASCADE,
    espece                   VARCHAR(10) NOT NULL CHECK (espece IN ('LMC', 'NSE')),
    stade_type               VARCHAR(10) NOT NULL CHECK (stade_type IN ('imago', 'larve')),
    -- Imagos LMC : A1-A5 avec quarts pour A3 ; NSE larves : L1-L7
    stade_code               VARCHAR(10) NOT NULL,
    sexe                     VARCHAR(10) CHECK (sexe IN ('male', 'femelle')),  -- NULL pour larves
    phase                    VARCHAR(20) NOT NULL CHECK (phase IN (
                                 'solitaire', 'solitaro_trans', 'transiens', 'gregaire')),
    nombre                   INTEGER  NOT NULL CHECK (nombre >= 0),
    -- Exactement une des deux FK doit être renseignée
    CONSTRAINT capture_source_xor CHECK (
        (prospection_intensive_id IS NOT NULL)::INT +
        (prospection_extensive_id IS NOT NULL)::INT = 1
    )
);

-- Densités, accouplements, ponte par espèce
CREATE TABLE population_acridien (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    prospection_intensive_id UUID        REFERENCES prospection_intensive(id) ON DELETE CASCADE,
    prospection_extensive_id UUID        REFERENCES prospection_extensive(id)  ON DELETE CASCADE,
    espece                   VARCHAR(10) NOT NULL CHECK (espece IN ('LMC', 'NSE')),
    stade_type               VARCHAR(10) NOT NULL CHECK (stade_type IN ('imago', 'larve')),
    nb_captures              INTEGER     CHECK (nb_captures >= 0),
    temps_capture_min        INTEGER     CHECK (temps_capture_min > 0),
    densite_diffuse_ha       DECIMAL(12,2) CHECK (densite_diffuse_ha >= 0),
    densite_groupee_m2       DECIMAL(12,2) CHECK (densite_groupee_m2 >= 0),
    accouplements            VARCHAR(20) CHECK (accouplements IN ('neant', 'rare', 'peu', 'beaucoup', 'dominant')),
    ponte                    VARCHAR(20) CHECK (ponte IN ('neant', 'rare', 'peu', 'beaucoup', 'dominant')),
    surface_infestee_ha      DECIMAL(10,2) CHECK (surface_infestee_ha >= 0),
    surface_contaminees_ha   DECIMAL(10,2) CHECK (surface_contaminees_ha >= 0),
    CONSTRAINT population_source_xor CHECK (
        (prospection_intensive_id IS NOT NULL)::INT +
        (prospection_extensive_id IS NOT NULL)::INT = 1
    )
);

-- Pullulations (taches larves, bandes larves, vols clairs, essaims)
CREATE TABLE infestation (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    prospection_intensive_id UUID        REFERENCES prospection_intensive(id) ON DELETE CASCADE,
    prospection_extensive_id UUID        REFERENCES prospection_extensive(id)  ON DELETE CASCADE,
    espece                   VARCHAR(10) NOT NULL CHECK (espece IN ('LMC', 'NSE')),
    type_formation           VARCHAR(20) NOT NULL CHECK (type_formation IN (
                                 'tache_larves', 'bande_larves', 'vol_clair', 'essaim')),
    surf_totale_ha           DECIMAL(10,2),
    taille_min               DECIMAL(10,2),
    taille_max               DECIMAL(10,2),
    taille_moy               DECIMAL(10,2),
    densite_min              DECIMAL(10,2),
    densite_max              DECIMAL(10,2),
    densite_moy              DECIMAL(10,2),
    interdistance_m          DECIMAL(10,2),
    repos                    BOOLEAN,
    deplacement              BOOLEAN,
    direction_de             VARCHAR(50),
    direction_vers           VARCHAR(50),
    vent_de                  VARCHAR(50),
    vent_vitesse_ms          DECIMAL(5,1),
    densite_vol              VARCHAR(20) CHECK (densite_vol IN ('clair', 'dense', 'tres_dense')),
    CONSTRAINT infestation_source_xor CHECK (
        (prospection_intensive_id IS NOT NULL)::INT +
        (prospection_extensive_id IS NOT NULL)::INT = 1
    )
);

-- Végétation (7 strates, prospection intensive uniquement)
CREATE TABLE vegetation (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    prospection_intensive_id UUID        NOT NULL REFERENCES prospection_intensive(id) ON DELETE CASCADE,
    type_strate              VARCHAR(30) NOT NULL CHECK (type_strate IN (
                                 'sol_nu', 'arboree', 'arbustive', 'buissonneuse',
                                 'herbeuse', 'culture_seche', 'culture_hygrophile')),
    surf_relative_pct        DECIMAL(5,1) CHECK (surf_relative_pct BETWEEN 0 AND 100),
    hauteur_moy_m            DECIMAL(5,2) CHECK (hauteur_moy_m >= 0),
    recouvrement_pct         DECIMAL(5,1) CHECK (recouvrement_pct BETWEEN 0 AND 100),
    verdissement_pct         DECIMAL(5,1) CHECK (verdissement_pct BETWEEN 0 AND 100),
    repousse                 BOOLEAN,
    orpad_germination        BOOLEAN,
    orpad_feuille            BOOLEAN,
    orpad_fleur              BOOLEAN,
    orpad_fruit              BOOLEAN,
    orpad_sec                BOOLEAN,
    UNIQUE(prospection_intensive_id, type_strate)
);

CREATE TABLE humidite_sol (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    prospection_intensive_id UUID        NOT NULL REFERENCES prospection_intensive(id) ON DELETE CASCADE,
    profondeur               VARCHAR(20) NOT NULL CHECK (profondeur IN (
                                 'surface', '0_5cm', '5_12cm', '12_30cm', 'sup_30cm')),
    etat                     VARCHAR(10) CHECK (etat IN ('sec', 'humide')),
    UNIQUE(prospection_intensive_id, profondeur)
);

CREATE TABLE texture_sol (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    prospection_intensive_id UUID        NOT NULL REFERENCES prospection_intensive(id) ON DELETE CASCADE,
    texture                  VARCHAR(20) NOT NULL CHECK (texture IN (
                                 'argileuse', 'limoneuse', 'sable_fin',
                                 'sable_grossier', 'gravier', 'cailloux', 'bloc'))
);

-- ══════════════════════════════════════════════
--  COMPTE-RENDU DE TRAITEMENT (CRT)
-- ══════════════════════════════════════════════

CREATE TABLE compte_rendu_traitement (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_crt               VARCHAR(30) NOT NULL UNIQUE,   -- auto-généré
    numero_validation        VARCHAR(30) UNIQUE,
    date_validation          DATE,
    date_traitement          DATE        NOT NULL,
    chef_equipe_id           UUID        NOT NULL REFERENCES utilisateur(id),
    agent_encadreur_id       UUID        REFERENCES utilisateur(id),
    -- Lien obligatoire avec la prospection déclencheuse (1-N côté prospection)
    prospection_intensive_id UUID        REFERENCES prospection_intensive(id),
    prospection_extensive_id UUID        REFERENCES prospection_extensive(id),
    CONSTRAINT crt_prospection_xor CHECK (
        (prospection_intensive_id IS NOT NULL)::INT +
        (prospection_extensive_id IS NOT NULL)::INT = 1
    ),
    -- Localisation
    pa_id                    UUID        NOT NULL REFERENCES poste_acridien(id),
    localite                 VARCHAR(100),
    commune_rurale           VARCHAR(100),
    district                 VARCHAR(100),
    zone_acridienne          VARCHAR(100),
    region                   VARCHAR(100),
    -- Cibles
    espece_cible             VARCHAR(10) NOT NULL CHECK (espece_cible IN ('LMC', 'NSE', 'mixte')),
    surface_infestee_ha      DECIMAL(10,2) CHECK (surface_infestee_ha >= 0),
    densite_ind_ha           DECIMAL(10,2) CHECK (densite_ind_ha >= 0),
    population_type          VARCHAR(20) CHECK (population_type IN ('diffuse', 'groupee')),
    -- Traitement
    mode_traitement          VARCHAR(30) NOT NULL CHECK (mode_traitement IN (
                                 'couverture_totale', 'barriere', 'irregulier')),
    surf_atomiseur_dos_ha    DECIMAL(10,2) CHECK (surf_atomiseur_dos_ha >= 0),
    surf_disque_rotatif_ha   DECIMAL(10,2) CHECK (surf_disque_rotatif_ha >= 0),
    surf_ulvamast_ha         DECIMAL(10,2) CHECK (surf_ulvamast_ha >= 0),
    surf_aeronef_ha          DECIMAL(10,2) CHECK (surf_aeronef_ha >= 0),
    surf_reste_traiter_ha    DECIMAL(10,2) CHECK (surf_reste_traiter_ha >= 0),
    -- Conditions météo au moment du traitement
    heure_debut              TIME,
    heure_fin                TIME,
    vent_vitesse_ms          DECIMAL(5,1) CHECK (vent_vitesse_ms >= 0),
    vent_direction           VARCHAR(10),
    temperature_c            DECIMAL(4,1),
    -- Efficacité
    taux_mortalite_pct       DECIMAL(5,1) CHECK (taux_mortalite_pct BETWEEN 0 AND 100),
    evaluation_apres_h       DECIMAL(4,1) CHECK (evaluation_apres_h >= 0),
    methode_evaluation       VARCHAR(30)  CHECK (methode_evaluation IN (
                                 'estimation_visuelle', 'comptage_pre_post')),
    -- Empoisonnement
    cas_empoisonnement       BOOLEAN,
    empoisonne_qui           VARCHAR(20) CHECK (empoisonne_qui IN ('agent', 'population')),
    empoisonne_mode          VARCHAR(20) CHECK (empoisonne_mode IN (
                                 'ingestion', 'inhalation', 'contact', 'autre')),
    -- Non-cibles
    comportement_anormal     BOOLEAN,
    mortalite_non_cibles     BOOLEAN,
    observation              TEXT,
    -- Sync
    local_version            INTEGER     NOT NULL DEFAULT 1,
    server_version           INTEGER     NOT NULL DEFAULT 0,
    sync_status              VARCHAR(20) NOT NULL DEFAULT 'local'
                                 CHECK (sync_status IN ('local', 'synced', 'conflict')),
    created_by               UUID        NOT NULL REFERENCES utilisateur(id),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT heure_traitement_coherente CHECK (
        heure_debut IS NULL OR heure_fin IS NULL OR heure_debut <= heure_fin
    )
);

-- Points GPS du périmètre et de la 1ère passe (recommandation Q12)
CREATE TABLE crt_point_gps (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    crt_id      UUID        NOT NULL REFERENCES compte_rendu_traitement(id) ON DELETE CASCADE,
    ordre       SMALLINT    NOT NULL CHECK (ordre >= 1),
    type        VARCHAR(20) NOT NULL CHECK (type IN ('perimetre', 'premiere_passe')),
    latitude    DECIMAL(9,6) NOT NULL,
    longitude   DECIMAL(9,6) NOT NULL,
    UNIQUE(crt_id, ordre, type)
);

-- Phase et stade par espèce ciblée (utile pour mixte)
CREATE TABLE crt_cible_espece (
    id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    crt_id  UUID        NOT NULL REFERENCES compte_rendu_traitement(id) ON DELETE CASCADE,
    espece  VARCHAR(10) NOT NULL CHECK (espece IN ('LMC', 'NSE')),
    phase   VARCHAR(50),
    stade   VARCHAR(50),
    UNIQUE(crt_id, espece)
);

-- Zones agricoles ou naturelles ciblées
CREATE TABLE crt_zone_cible (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    crt_id      UUID        NOT NULL REFERENCES compte_rendu_traitement(id) ON DELETE CASCADE,
    type        VARCHAR(30) NOT NULL CHECK (type IN (
                    'mais', 'riz', 'canne_sucre', 'banane', 'manioc', 'sorgho',
                    'paturage', 'apiculture', 'aquaculture',
                    'production_organique', 'zone_forestiere')),
    surface_ha  DECIMAL(10,2) CHECK (surface_ha >= 0)
);

CREATE TABLE crt_moyens_humains (
    id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    crt_id                UUID    NOT NULL UNIQUE REFERENCES compte_rendu_traitement(id) ON DELETE CASCADE,
    nb_agents_permanents  INTEGER CHECK (nb_agents_permanents >= 0),
    nb_agents_temporaires INTEGER CHECK (nb_agents_temporaires >= 0),
    nb_personnel_local    INTEGER CHECK (nb_personnel_local >= 0)
);

CREATE TABLE crt_moyens_materiels (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    crt_id              UUID    NOT NULL UNIQUE REFERENCES compte_rendu_traitement(id) ON DELETE CASCADE,
    nb_atomiseurs       INTEGER CHECK (nb_atomiseurs >= 0),
    essence_litres      DECIMAL(8,2) CHECK (essence_litres >= 0),
    nb_disques_rotatifs INTEGER CHECK (nb_disques_rotatifs >= 0),
    nb_piles            INTEGER CHECK (nb_piles >= 0),
    nb_ulvamasts        INTEGER CHECK (nb_ulvamasts >= 0),
    nb_combinaisons     INTEGER CHECK (nb_combinaisons >= 0),
    nb_gants            INTEGER CHECK (nb_gants >= 0),
    nb_lunettes         INTEGER CHECK (nb_lunettes >= 0),
    nb_masques          INTEGER CHECK (nb_masques >= 0),
    nb_bottes           INTEGER CHECK (nb_bottes >= 0)
);

CREATE TABLE crt_pesticide (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    crt_id              UUID        NOT NULL REFERENCES compte_rendu_traitement(id) ON DELETE CASCADE,
    nom_commercial      VARCHAR(100) NOT NULL,
    matieres_actives    VARCHAR(200),
    stock_initial_l     DECIMAL(10,2) CHECK (stock_initial_l >= 0),
    approvisionnement_l DECIMAL(10,2) CHECK (approvisionnement_l >= 0),
    produit_consomme_l  DECIMAL(10,2) CHECK (produit_consomme_l >= 0),
    stock_final_l       DECIMAL(10,2) CHECK (stock_final_l >= 0),
    CONSTRAINT pesticide_stock_coherent CHECK (
        stock_initial_l IS NULL OR approvisionnement_l IS NULL
        OR produit_consomme_l IS NULL OR stock_final_l IS NULL
        OR ABS((stock_initial_l + approvisionnement_l - produit_consomme_l) - stock_final_l) < 0.5
    )
);

-- Familles de non-cibles affectées (comportement anormal ou mortalité)
CREATE TABLE crt_non_cible (
    id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    crt_id  UUID        NOT NULL REFERENCES compte_rendu_traitement(id) ON DELETE CASCADE,
    type    VARCHAR(30) NOT NULL CHECK (type IN ('comportement_anormal', 'mortalite')),
    famille VARCHAR(20) NOT NULL CHECK (famille IN (
                'oiseaux', 'reptile', 'insecte', 'mammifere', 'amphibien', 'poisson'))
);

CREATE TABLE crt_habitat_proximite (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    crt_id          UUID        NOT NULL REFERENCES compte_rendu_traitement(id) ON DELETE CASCADE,
    ordre           SMALLINT    NOT NULL CHECK (ordre BETWEEN 1 AND 3),
    localisation    VARCHAR(200),
    distance_km     DECIMAL(6,2) CHECK (distance_km >= 0),
    sensibilisation BOOLEAN,
    UNIQUE(crt_id, ordre)
);

-- ══════════════════════════════════════════════
--  FICHE DE VOL  (1 vol = 1 CRT, voir ADR Q8)
-- ══════════════════════════════════════════════

CREATE TABLE fiche_vol (
    id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    numero                          VARCHAR(30) NOT NULL UNIQUE,
    crt_id                          UUID        NOT NULL UNIQUE REFERENCES compte_rendu_traitement(id),
    date_vol                        DATE        NOT NULL,
    societe                         VARCHAR(100),
    immatriculation                 VARCHAR(20),
    mecanicien_id                   UUID REFERENCES utilisateur(id),
    chef_de_base_id                 UUID REFERENCES utilisateur(id),
    pilote_id                       UUID REFERENCES utilisateur(id),
    base_nom                        VARCHAR(100),
    base_latitude                   DECIMAL(9,6),
    base_longitude                  DECIMAL(9,6),
    base_sec_nom                    VARCHAR(100),
    base_sec_latitude               DECIMAL(9,6),
    base_sec_longitude              DECIMAL(9,6),
    heures_vol_avant_grande_visite  DECIMAL(6,2) CHECK (heures_vol_avant_grande_visite >= 0),
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Détail des passages (jusqu'à 20 par journée)
CREATE TABLE fiche_vol_passage (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    fiche_vol_id    UUID        NOT NULL REFERENCES fiche_vol(id) ON DELETE CASCADE,
    numero_passage  SMALLINT    NOT NULL CHECK (numero_passage BETWEEN 1 AND 20),
    numero_cuve     VARCHAR(20),
    produit         VARCHAR(100),
    quantite_l      DECIMAL(8,2) CHECK (quantite_l >= 0),
    heure_debut     TIME,
    temp_debut_c    DECIMAL(4,1),
    vent_debut_ms   DECIMAL(5,1) CHECK (vent_debut_ms >= 0),
    heure_fin       TIME,
    temp_fin_c      DECIMAL(4,1),
    vent_fin_ms     DECIMAL(5,1) CHECK (vent_fin_ms >= 0),
    heures_vol_decimal DECIMAL(5,2) CHECK (heures_vol_decimal >= 0),
    type_vol        VARCHAR(20) NOT NULL CHECK (type_vol IN (
                        'application', 'convoyage', 'mise_en_place',
                        'prospection', 'mixte', 'divers')),
    observation     TEXT,
    UNIQUE(fiche_vol_id, numero_passage)
);

-- Cumul heures par période (jour / décade / campagne)
CREATE TABLE fiche_vol_cumul (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    fiche_vol_id    UUID        NOT NULL REFERENCES fiche_vol(id) ON DELETE CASCADE,
    periode         VARCHAR(10) NOT NULL CHECK (periode IN ('jour', 'decade', 'campagne')),
    convoyage_h     DECIMAL(6,2) CHECK (convoyage_h >= 0),
    mixte_h         DECIMAL(6,2) CHECK (mixte_h >= 0),
    prospection_h   DECIMAL(6,2) CHECK (prospection_h >= 0),
    mise_en_place_h DECIMAL(6,2) CHECK (mise_en_place_h >= 0),
    application_h   DECIMAL(6,2) CHECK (application_h >= 0),
    divers_h        DECIMAL(6,2) CHECK (divers_h >= 0),
    total_h         DECIMAL(6,2) CHECK (total_h >= 0),
    UNIQUE(fiche_vol_id, periode)
);

-- Inventaire pesticides de la fiche de vol
CREATE TABLE fiche_vol_pesticide (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    fiche_vol_id        UUID        NOT NULL REFERENCES fiche_vol(id) ON DELETE CASCADE,
    nom_commercial      VARCHAR(100) NOT NULL,
    quantite_dispo_l    DECIMAL(10,2) CHECK (quantite_dispo_l >= 0),
    quantite_recue_l    DECIMAL(10,2) CHECK (quantite_recue_l >= 0),
    quantite_utilisee_l DECIMAL(10,2) CHECK (quantite_utilisee_l >= 0),
    quantite_perdue_l   DECIMAL(10,2) CHECK (quantite_perdue_l >= 0),
    quantite_restante_l DECIMAL(10,2) CHECK (quantite_restante_l >= 0),
    explication_perte   TEXT,
    futs_disponibles    INTEGER CHECK (futs_disponibles >= 0),
    futs_recus          INTEGER CHECK (futs_recus >= 0),
    futs_pleins         INTEGER CHECK (futs_pleins >= 0),
    futs_vides          INTEGER CHECK (futs_vides >= 0)
);

-- ══════════════════════════════════════════════
--  GESTION DES CONFLITS DE SYNC (ADR-002)
-- ══════════════════════════════════════════════

CREATE TABLE fiche_conflict_archive (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name      TEXT        NOT NULL,
    fiche_id        UUID        NOT NULL,
    version_locale  JSONB       NOT NULL,
    version_serveur JSONB       NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolu_par      UUID REFERENCES utilisateur(id),
    resolu_le       TIMESTAMPTZ,
    resolution      VARCHAR(20) CHECK (resolution IN ('serveur', 'terrain', 'manuelle'))
);

-- ══════════════════════════════════════════════
--  INDEX
-- ══════════════════════════════════════════════

CREATE INDEX idx_station_pa          ON station(pa_id);
CREATE INDEX idx_prosp_ext_station   ON prospection_extensive(station_id);
CREATE INDEX idx_prosp_ext_date      ON prospection_extensive(date_releve);
CREATE INDEX idx_prosp_ext_sync      ON prospection_extensive(sync_status) WHERE sync_status != 'synced';
CREATE INDEX idx_prosp_int_station   ON prospection_intensive(station_id);
CREATE INDEX idx_prosp_int_date      ON prospection_intensive(date_releve);
CREATE INDEX idx_prosp_int_sync      ON prospection_intensive(sync_status) WHERE sync_status != 'synced';
CREATE INDEX idx_crt_pa              ON compte_rendu_traitement(pa_id);
CREATE INDEX idx_crt_date            ON compte_rendu_traitement(date_traitement);
CREATE INDEX idx_crt_sync            ON compte_rendu_traitement(sync_status) WHERE sync_status != 'synced';
CREATE INDEX idx_capture_intensive   ON capture(prospection_intensive_id);
CREATE INDEX idx_capture_extensive   ON capture(prospection_extensive_id);
CREATE INDEX idx_meteo_station_mois  ON releve_meteo(station_meteo_id, annee, mois);
CREATE INDEX idx_conflict_table      ON fiche_conflict_archive(table_name, fiche_id);
CREATE INDEX idx_conflict_non_resolu ON fiche_conflict_archive(resolu_le) WHERE resolu_le IS NULL;
