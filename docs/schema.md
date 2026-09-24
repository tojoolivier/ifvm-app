# Schema de la base de donnees -- IFVM

Genere automatiquement par `backend/scripts/generate_schema_doc.py` a partir des modeles SQLAlchemy (source de verite) -- ne pas editer a la main. Une PR qui change les modeles/migrations doit relancer le script et committer le resultat (`python scripts/generate_schema_doc.py`), verifie en CI par `generate_schema_doc.py --check`.

## Referentiel

```mermaid
classDiagram
direction BT
class aeronef {
   UUID id
   VARCHAR(20) immatriculation
   TEXT societe
   NUMERIC(8, 2) volume_cuve_l
   BOOLEAN actif
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class base_aerienne {
   UUID id
   UUID parent_base_id
   UUID equipe_id
   TEXT numero
   TEXT localite
   NUMERIC(11, 8) longitude
   NUMERIC(10, 8) latitude
   NUMERIC(8, 2) altitude
   BOOLEAN actif
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class code_stade {
   UUID id
   TEXT code
   TEXT categorie
   TEXT sexe
   TEXT espece
   TEXT libelle
   INTEGER ordre
   BOOLEAN actif
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class commune {
   UUID id
   TEXT nom
   UUID district_id
}
class culture {
   UUID id
   TEXT code
   TEXT nom
   BOOLEAN actif
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class district {
   UUID id
   TEXT nom
   UUID region_id
}
class equipe_aerienne {
   UUID id
   TEXT nom
   UUID chef_de_base_id
   TEXT pilote
   TEXT mecanicien
   TEXT consultant_international
   UUID aeronef_id
   BOOLEAN actif
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class equipe_aerienne_membre {
   UUID id
   UUID equipe_aerienne_id
   TEXT nom
   TIMESTAMP created_at
}
class equipe_terrestre {
   UUID id
   TEXT nom
   UUID chef_equipe_id
   BOOLEAN actif
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class equipe_terrestre_membre {
   UUID id
   UUID equipe_terrestre_id
   TEXT nom
   TIMESTAMP created_at
}
class lieu_aerien {
   UUID id
   TEXT type_lieu
   TEXT nom
   NUMERIC(10, 8) latitude
   NUMERIC(11, 8) longitude
   NUMERIC(8, 2) altitude
   UUID equipe_aerienne_id
   BOOLEAN actif
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class pesticide {
   UUID id
   TEXT code
   TEXT nom
   TEXT matiere_active
   TEXT dose_reference
   TEXT type_produit
   BOOLEAN actif
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class poste_acridien {
   UUID id
   TEXT code
   TEXT nom
   UUID za_id
   UUID equipe_terrestre_id
   BOOLEAN actif
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class region {
   UUID id
   TEXT nom
}
class stade {
   TEXT code
   TEXT libelle
   BOOLEAN actif
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class stand_remplissage {
   UUID id
   TEXT numero
   TEXT localite
   NUMERIC(11, 8) longitude
   NUMERIC(10, 8) latitude
   NUMERIC(8, 2) altitude
   UUID equipe_aerienne_id
   BOOLEAN actif
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class station_fixe {
   UUID id
   TEXT code
   TEXT nom
   UUID pa_id
   NUMERIC latitude
   NUMERIC longitude
   NUMERIC altitude
   UUID commune_id
   BOOLEAN actif
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class zone_anti_acridien {
   UUID id
   TEXT code
   TEXT nom
   BOOLEAN actif
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
```

## Prospection

```mermaid
classDiagram
direction BT
class audit_log {
   UUID id
   TEXT fiche_type
   UUID fiche_id
   UUID auteur_id
   TEXT action
   JSONB details
   TIMESTAMP created_at
}
class prospection {
   UUID id
   TEXT type_prospection
   UUID campagne_id
   UUID prospecteur_id
   UUID station_id
   TEXT n_fiche
   TEXT n_message
   DATE date_prospection
   NUMERIC latitude
   NUMERIC longitude
   NUMERIC altitude
   JSONB biotope
   NUMERIC surface_station
   NUMERIC surface_prospectee
   NUMERIC surface_infestee
   TEXT degats_cultures
   DATE derniere_pluie
   TEXT intensite_pluie
   JSONB vegetation
   JSONB sol
   NUMERIC verdissement
   NUMERIC hauteur_strate
   TEXT ennemis_naturels
   TEXT observations
   TEXT statut
   TEXT statut_sync
   UUID verified_by
   TIMESTAMP verified_at
   UUID validated_by
   TIMESTAMP validated_at
   UUID revalide_de_id
   TIMESTAMP created_at
   TIMESTAMP updated_at
   TEXT region
   TEXT district
   TEXT commune
   TEXT za
   TEXT pa_code
   INTEGER degats_cultures_pourcent
   INTEGER verdissement_pourcent
   NUMERIC hauteur_herbe_cm
   TIMESTAMP heure_observation_at
   TEXT station_libre
   JSONB type_station
   TEXT verdure_strate
   TEXT signalement_source
   TEXT signalement_date
   TEXT signalement_description
   TEXT conclusion_validation
   JSONB avertissements
   TEXT mode_extensif
   TEXT societe
   TEXT immatricule_aeronef
   TEXT pilote
   TEXT mecanicien
   TEXT chef_de_base
   VARCHAR(255) base
   INTEGER base_numero
   DATE base_date_installation
   NUMERIC base_latitude
   NUMERIC base_longitude
   TEXT base_secondaire
   DATE base_secondaire_date_installation
   NUMERIC base_secondaire_latitude
   NUMERIC base_secondaire_longitude
   BOOLEAN pesticides_embarques
   TEXT pesticide_nom_commercial
   NUMERIC(10, 2) pesticide_quantite_disponible
   NUMERIC(10, 2) pesticide_quantite_recue
   INTEGER futs_disponible
   INTEGER futs_pleins
   INTEGER futs_vides
   INTEGER futs_recues
   TEXT signature_visa_nom
   TIMESTAMP signature_visa_horodatage
   TEXT signature_consultant_fao_nom
   TIMESTAMP signature_consultant_fao_horodatage
   TEXT signature_consultant_fao_image
   TEXT signature_pilote_nom
   TIMESTAMP signature_pilote_horodatage
   TEXT signature_pilote_image
   TEXT signature_chef_base_nom
   TIMESTAMP signature_chef_base_horodatage
   TEXT signature_chef_base_image
}
class prospection_capture {
   UUID id
   UUID prospection_id
   TEXT espece
   TEXT categorie
   TEXT sexe
   TEXT phase
   TEXT stade
   INTEGER effectif
}
class prospection_infestation {
   UUID id
   UUID prospection_id
   TEXT espece
   TEXT type_cible
   NUMERIC taille_min
   NUMERIC taille_max
   NUMERIC taille_moy
   NUMERIC surface_totale
   NUMERIC densite_min
   NUMERIC densite_max
   NUMERIC densite_moy
   NUMERIC interdistance
   TEXT comportement
   TEXT direction_de
   TEXT direction_vers
   TEXT vent_de
   NUMERIC vent_vitesse
}
class prospection_infestation_imago {
   UUID infestation_id
   INTEGER pullulation_nb
   NUMERIC taille_long
   NUMERIC taille_large
   NUMERIC taille_epaisseur
   BOOLEAN essaim_en_vol
   BOOLEAN essaim_pose
   TEXT type_essaim
   TEXT heure_observation
   NUMERIC densite_en_vol
   NUMERIC dimension_ha
}
class prospection_infestation_larve {
   UUID infestation_id
   INTEGER nb_taches_bandes
   NUMERIC interdistance_m
   NUMERIC interdistance_min
   NUMERIC interdistance_max
   NUMERIC interdistance_moy
   NUMERIC surface_contaminee_ha
   NUMERIC surface_infestee_pourcent
   TEXT type_larve
   TEXT stade_dominant
   NUMERIC taille_groupe_m2
   NUMERIC front_longueur_m
   NUMERIC front_largeur_m
   NUMERIC densite_max_front
   NUMERIC densite_moy_arriere_front
}
class prospection_operation_aerienne {
   UUID id
   UUID prospection_id
   INTEGER numero
   TEXT type_operation
   TEXT motif_divers
   TEXT debut_heure
   NUMERIC(5, 2) debut_temperature_c
   NUMERIC(5, 2) debut_vent_ms
   TEXT fin_heure
   NUMERIC(5, 2) fin_temperature_c
   NUMERIC(5, 2) fin_vent_ms
   INTEGER duree_minutes
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class prospection_population {
   UUID id
   UUID prospection_id
   TEXT espece
   TEXT categorie
   NUMERIC densite_diffuse
   NUMERIC densite_groupee
   INTEGER captures_nombre
   INTEGER temps_capture
   TEXT methode
   TEXT phase
   TEXT accouplement
   TEXT ponte
   INTEGER captures_sol
   INTEGER captures_trans
   INTEGER captures_greg
   TEXT stade_imago
   JSONB stades_imago
   BOOLEAN essaim_observe
   JSONB densites_larve
   BOOLEAN tache_larvaire
   BOOLEAN bande_larvaire
   NUMERIC interdistance
   TEXT deplacement
   NUMERIC surface_contaminee_ha
   JSONB type_cible
   TEXT direction_de
   TEXT direction_vers
   TEXT etat
   BOOLEAN essaim_en_vol
   BOOLEAN essaim_pose
}
```

## Traitement

```mermaid
classDiagram
direction BT
class cible {
   UUID traitement_id
   VARCHAR(10) espece
   VARCHAR(50) petites_larves
   VARCHAR(50) grandes_larves
   VARCHAR(50) vols_clairs_essaims
   VARCHAR(30) repartition_population
   NUMERIC(10, 2) surface_infestee_ha
   NUMERIC(10, 2) petites_larves_lmc
   NUMERIC(10, 2) petites_larves_nse
   NUMERIC(10, 2) grandes_larves_lmc
   NUMERIC(10, 2) grandes_larves_nse
   NUMERIC(10, 2) densite_diffuse_lmc
   NUMERIC(10, 2) densite_groupee_lmc
   NUMERIC(10, 2) densite_diffuse_nse
   NUMERIC(10, 2) densite_groupee_nse
}
class traitement {
   UUID id
   UUID prospection_id
   VARCHAR(50) numero_fiche
   VARCHAR(10) type_traitement
   VARCHAR(30) mode_traitement
   DATE date_traitement
   DATE date_validation
   VARCHAR(255) localite
   VARCHAR(100) region
   VARCHAR(100) district
   VARCHAR(100) commune
   NUMERIC(10, 8) latitude
   NUMERIC(11, 8) longitude
   NUMERIC(8, 2) altitude
   INTEGER nb_agents_permanents
   INTEGER nb_agents_temporaires
   INTEGER nb_personnel_local
   INTEGER moyens_atomiseur_nb
   NUMERIC(10, 2) moyens_essence_litres
   INTEGER moyens_disque_rotatif_nb
   INTEGER moyens_piles_nb
   INTEGER moyens_ulvamast_nb
   INTEGER kit_combinaison
   INTEGER kit_gants
   INTEGER kit_lunettes
   INTEGER kit_masques
   INTEGER kit_botte
   JSONB zones_exposees
   NUMERIC(5, 2) hauteur_strate_herbeuse_m
   NUMERIC(5, 2) hauteur_strate_arboree_m
   INTEGER recouvrement_percent
   BOOLEAN empoisonnement
   VARCHAR(30) empoisonnement_type
   VARCHAR(30) empoisonnement_mode
   TEXT empoisonnement_autre
   JSONB evaluation_risque
   BOOLEAN comportement_anormal
   JSONB comportement_non_cibles
   BOOLEAN mortalite
   JSONB mortalite_familles
   TEXT observations
   VARCHAR(30) statut
   VARCHAR(30) statut_sync
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class traitement_aerien {
   UUID traitement_id
   UUID chef_de_base_id
   VARCHAR(255) pilote
   VARCHAR(255) mecanicien
   VARCHAR(255) consultant_international
   VARCHAR(255) base_principale
   VARCHAR(255) stand
   VARCHAR(255) base_secondaire
   DATE stand_date_installation
   DATE base_secondaire_date_installation
   TEXT immatricule_aeronef
   INTEGER nb_rotations
   NUMERIC(10, 2) total_pesticide_l
   NUMERIC(10, 2) total_pesticide_kg
   NUMERIC(10, 2) surface_traitee_ha
   NUMERIC(10, 2) surface_restante_ha
   NUMERIC(10, 2) pesticide_recu_l
   NUMERIC(10, 2) pesticide_stock_restant_l
   NUMERIC(5, 2) taux_mortalite_pourcent
   NUMERIC(5, 2) evaluation_efficacite_heures_apres
   VARCHAR(50) methode_evaluation_efficacite
   BOOLEAN reprise_traitement
   UUID traitement_origine_id
   NUMERIC(10, 2) surface_cumulee_ha
}
class traitement_bloc {
   UUID id
   UUID traitement_aerien_id
   INTEGER numero
   VARCHAR(60) nom
   VARCHAR(255) localite
   NUMERIC(10, 2) surface_theorique_ha
   NUMERIC(10, 2) surface_reelle_ha
   NUMERIC(10, 2) surface_protegee_ha
   NUMERIC(10, 2) surface_traitee_ha
   NUMERIC(6, 2) largeur_andain_m
   NUMERIC(6, 2) interpasse_m
   NUMERIC(5, 2) hauteur_vol_min_m
   NUMERIC(5, 2) hauteur_vol_max_m
   TEXT observation
}
class traitement_evaluation_risque_population {
   UUID id
   UUID traitement_id
   INTEGER ordre
   TEXT habitat_proche
   NUMERIC(6, 2) distance_km
   BOOLEAN sensibilisation
}
class traitement_produit_utilise {
   UUID id
   UUID traitement_terrestre_id
   INTEGER numero
   UUID produit_id
   NUMERIC(10, 2) quantite_l
   TEXT nom_commercial
}
class traitement_rotation {
   UUID id
   UUID traitement_aerien_id
   UUID bloc_id
   INTEGER numero
   VARCHAR(50) numero_cuve
   UUID produit_id
   NUMERIC(10, 2) quantite
   VARCHAR(2) unite
   NUMERIC(10, 2) surface_ha
   NUMERIC(5, 2) temperature_debut_c
   NUMERIC(5, 2) temperature_fin_c
   NUMERIC(5, 2) vent_debut_ms
   NUMERIC(5, 2) vent_fin_ms
   TIME heure_debut
   TIME heure_ouverture_vanne
   TIME heure_fermeture_vanne
   TIME heure_fin
   TEXT nom_commercial
}
class traitement_signature {
   UUID id
   UUID traitement_id
   VARCHAR(30) role
   VARCHAR(255) signataire_nom
   TEXT signature_image
   TIMESTAMP horodatage
}
class traitement_terrestre {
   UUID traitement_id
   TIME heure_debut
   TIME heure_fin
   NUMERIC(5, 2) vitesse_vent_ms
   VARCHAR(2) direction_vent
   NUMERIC(5, 2) temperature_c
   NUMERIC(5, 2) taux_mortalite_pourcent
   NUMERIC(5, 2) evaluation_efficacite_heures_apres
   VARCHAR(50) methode_evaluation_efficacite
   BOOLEAN reprise_traitement
   UUID traitement_origine_id
   UUID chef_equipe_id
   VARCHAR(255) agent_encadreur
   VARCHAR(255) consultant_international
   NUMERIC(10, 2) surface_atomiseur_ha
   NUMERIC(10, 2) surface_disque_rotatif_ha
   NUMERIC(10, 2) surface_atomiseur_autoporte_ha
   NUMERIC(10, 2) surface_traitee_ha
   NUMERIC(10, 2) surface_cumulee_ha
   NUMERIC(10, 2) surface_restante_ha
   BOOLEAN surface_restante_abandonnee
   TEXT motif_surface_restante_abandonnee
   NUMERIC(10, 2) essence_litres
   INTEGER nb_piles
   VARCHAR(2) pesticide_unite
   NUMERIC(10, 2) total_pesticide_l
   NUMERIC(10, 2) pesticide_recu_l
   NUMERIC(10, 2) stock_initial_l
   NUMERIC(10, 2) pesticide_stock_restant_l
}
```

## Fiche de vol

```mermaid
classDiagram
direction BT
class campagne_fiche_vol_compteur {
   UUID campagne_id
   INTEGER dernier_compteur
}
class fiche_vol {
   UUID id
   VARCHAR(60) numero_fiche
   DATE date_vol
   VARCHAR(255) compagnie
   VARCHAR(20) immatriculation
   UUID equipe_aerienne_id
   UUID campagne_id
   INTEGER compteur
   UUID base_id
   UUID stand_id
   VARCHAR(255) pilote
   VARCHAR(255) mecanicien
   UUID chef_de_base_id
   VARCHAR(255) consultant_international
   UUID prospection_id
   TEXT pesticide_nom_commercial
   NUMERIC(10, 2) pesticide_quantite_disponible
   NUMERIC(10, 2) pesticide_quantite_recue
   INTEGER futs_disponible
   INTEGER futs_recues
   INTEGER futs_pleins
   INTEGER futs_vides
   TEXT observations
   VARCHAR(30) statut
   VARCHAR(30) statut_sync
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
class fiche_vol_signature {
   UUID id
   UUID fiche_vol_id
   VARCHAR(30) role
   VARCHAR(255) signataire_nom
   TEXT signature_image
   TIMESTAMP horodatage
}
class vol {
   UUID id
   UUID fiche_vol_id
   INTEGER numero
   VARCHAR(20) type_vol
   TIME heure_debut
   TIME heure_fin
   UUID rotation_id
   UUID prospection_id
   TEXT observations
}
```

## Campagne

```mermaid
classDiagram
direction BT
class campagne {
   UUID id
   VARCHAR(200) name
   DATE start_date
   DATE end_date
   BOOLEAN actif
   UUID created_by
   TIMESTAMP created_at
   TIMESTAMP updated_at
}
```

## Utilisateur

```mermaid
classDiagram
direction BT
class utilisateur {
   UUID id
   VARCHAR(100) nom
   VARCHAR(100) prenom
   VARCHAR(200) email
   VARCHAR(200) password_hash
   VARCHAR(30) role
   VARCHAR(10) sigle
   UUID pa_id
   BOOLEAN actif
   BOOLEAN peut_se_connecter
   TIMESTAMP created_at
   TIMESTAMP updated_at
   TIMESTAMP notifications_lues_at
}
```

## Relations

```mermaid
classDiagram
base_aerienne  -->  equipe_aerienne : equipe_id:id
base_aerienne  -->  base_aerienne : parent_base_id:id
code_stade  -->  stade : code:code
commune  -->  district : district_id:id
district  -->  region : region_id:id
equipe_aerienne  -->  aeronef : aeronef_id:id
equipe_aerienne  -->  utilisateur : chef_de_base_id:id
equipe_aerienne_membre  -->  equipe_aerienne : equipe_aerienne_id:id
equipe_terrestre  -->  utilisateur : chef_equipe_id:id
equipe_terrestre_membre  -->  equipe_terrestre : equipe_terrestre_id:id
lieu_aerien  -->  equipe_aerienne : equipe_aerienne_id:id
poste_acridien  -->  equipe_terrestre : equipe_terrestre_id:id
poste_acridien  -->  zone_anti_acridien : za_id:id
stand_remplissage  -->  equipe_aerienne : equipe_aerienne_id:id
station_fixe  -->  commune : commune_id:id
station_fixe  -->  poste_acridien : pa_id:id
audit_log  -->  utilisateur : auteur_id:id
prospection  -->  campagne : campagne_id:id
prospection  -->  utilisateur : prospecteur_id:id
prospection  -->  prospection : revalide_de_id:id
prospection  -->  station_fixe : station_id:id
prospection  -->  utilisateur : validated_by:id
prospection  -->  utilisateur : verified_by:id
prospection_capture  -->  prospection : prospection_id:id
prospection_capture  -->  stade : stade:code
prospection_infestation  -->  prospection : prospection_id:id
prospection_infestation_imago  -->  prospection_infestation : infestation_id:id
prospection_infestation_larve  -->  prospection_infestation : infestation_id:id
prospection_operation_aerienne  -->  prospection : prospection_id:id
prospection_population  -->  prospection : prospection_id:id
cible  -->  traitement : traitement_id:id
traitement  -->  prospection : prospection_id:id
traitement_aerien  -->  utilisateur : chef_de_base_id:id
traitement_aerien  -->  traitement : traitement_id:id
traitement_aerien  -->  traitement : traitement_origine_id:id
traitement_bloc  -->  traitement_aerien : traitement_aerien_id:traitement_id
traitement_evaluation_risque_population  -->  traitement : traitement_id:id
traitement_produit_utilise  -->  pesticide : produit_id:id
traitement_produit_utilise  -->  traitement_terrestre : traitement_terrestre_id:traitement_id
traitement_rotation  -->  traitement_bloc : bloc_id:id
traitement_rotation  -->  pesticide : produit_id:id
traitement_rotation  -->  traitement_aerien : traitement_aerien_id:traitement_id
traitement_signature  -->  traitement : traitement_id:id
traitement_terrestre  -->  utilisateur : chef_equipe_id:id
traitement_terrestre  -->  traitement : traitement_id:id
traitement_terrestre  -->  traitement : traitement_origine_id:id
campagne_fiche_vol_compteur  -->  campagne : campagne_id:id
fiche_vol  -->  base_aerienne : base_id:id
fiche_vol  -->  campagne : campagne_id:id
fiche_vol  -->  utilisateur : chef_de_base_id:id
fiche_vol  -->  equipe_aerienne : equipe_aerienne_id:id
fiche_vol  -->  prospection : prospection_id:id
fiche_vol  -->  stand_remplissage : stand_id:id
fiche_vol_signature  -->  fiche_vol : fiche_vol_id:id
vol  -->  fiche_vol : fiche_vol_id:id
vol  -->  prospection : prospection_id:id
vol  -->  traitement_rotation : rotation_id:id
campagne  -->  utilisateur : created_by:id
utilisateur  -->  poste_acridien : pa_id:id
```
