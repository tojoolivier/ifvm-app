from datetime import date, datetime, time
from typing import Any, Dict, List, Optional

from pydantic import UUID4, BaseModel, Field


class CRTPersonnelSchema(BaseModel):
    utilisateur_id: UUID4
    role: str = Field(..., pattern="^(AGENT_PERMANENT|AGENT_TEMPORAIRE|PERSONNEL_LOCAL)$")


class CRTMaterielSchema(BaseModel):
    type_materiel: str
    quantite: int
    unite: Optional[str] = None


class CRTBase(BaseModel):
    prospection_id: UUID4
    numero_crt: str = Field(..., min_length=1, max_length=50)

    # 1. Référence
    chef_equipe_id: Optional[UUID4] = None
    agent_encadreur_id: Optional[UUID4] = None
    date_validation: Optional[date] = None
    numero_validation: Optional[str] = Field(None, max_length=50)
    date_traitement: date
    localite: Optional[str] = None
    cr: Optional[str] = None
    district: Optional[str] = None
    pa_code: Optional[str] = None
    za: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    altitude: Optional[float] = None

    # 2. Cible
    espece: Optional[str] = Field(None, pattern="^(LMC|NSE|MELANGE)$")
    phase: Optional[str] = None
    surface_infestee_ha: Optional[float] = Field(None, ge=0)
    densite_ind_ha: Optional[float] = Field(None, ge=0)
    population_type: Optional[str] = Field(None, pattern="^(DIFFUSE|GROUPE|TACHE|BANDE)$")

    # 3. Traitement
    mode_traitement: Optional[str] = Field(None, pattern="^(TOTAL|BARRIERE|IRREGULIER)$")
    surface_atomiseur_dos: Optional[float] = Field(None, ge=0)
    surface_disque_rotatif: Optional[float] = Field(None, ge=0)
    surface_autre: Optional[float] = Field(None, ge=0)
    surface_reste_traiter: Optional[float] = Field(None, ge=0)
    traitement_debut: Optional[time] = None
    traitement_fin: Optional[time] = None
    vent: Optional[str] = None
    temperature_debut: Optional[float] = None
    temperature_fin: Optional[float] = None
    taux_mortalite: Optional[float] = Field(None, ge=0, le=100)
    evaluation_apres_traitement: Optional[str] = None
    methode_evaluation: Optional[str] = Field(None, pattern="^(VISUELLE|COMPTAGE)$")

    # 4. Moyens
    nb_agents_permanents: Optional[int] = Field(None, ge=0)
    nb_agents_temporaires: Optional[int] = Field(None, ge=0)
    nb_personnel_local: Optional[int] = Field(None, ge=0)
    nb_atomiseur: Optional[int] = Field(None, ge=0)
    essence_litres: Optional[float] = Field(None, ge=0)
    nb_disque_rotatif: Optional[int] = Field(None, ge=0)
    nb_piles: Optional[int] = Field(None, ge=0)
    nb_poudreuse_manuelle: Optional[int] = Field(None, ge=0)
    autre_materiel: Optional[str] = None
    kit_combinaison: bool = False
    kit_gants: bool = False
    kit_lunettes: bool = False
    kit_masques: bool = False
    kit_boite: bool = False

    # 5. Pesticides
    pesticide_id: Optional[UUID4] = None
    matiere_active: Optional[str] = None
    stock_initial_l: Optional[float] = Field(None, ge=0)
    approvisionnement_l: Optional[float] = Field(None, ge=0)
    produits_consommes_l: Optional[float] = Field(None, ge=0)
    stock_final_l: Optional[float] = Field(None, ge=0)

    # 6. Zones exposées
    zones_exposees: Optional[Dict[str, Any]] = None

    # 7. Végétation
    hauteur_strate_herbeuse_m: Optional[float] = Field(None, ge=0)
    hauteur_strate_arboree_m: Optional[float] = Field(None, ge=0)
    recouvrement_percent: Optional[int] = Field(None, ge=0, le=100)

    # 8. Empoisonnement
    empoisonnement: bool = False
    empoisonnement_type: Optional[str] = Field(None, pattern="^(AGENT|POPULATION)$")
    empoisonnement_mode: Optional[str] = Field(
        None, pattern="^(INGESTION|INHALATION|CONTACT|AUTRE)$"
    )
    empoisonnement_autre: Optional[str] = None

    # 9. Évaluation du risque
    evaluation_risque: Optional[Dict[str, Any]] = None

    # 10. Comportement anormal
    comportement_anormal: bool = False
    comportement_non_cibles: Optional[Dict[str, Any]] = None

    # 11. Mortalité
    mortalite: bool = False
    mortalite_familles: Optional[Dict[str, Any]] = None

    # Statut
    statut: Optional[str] = Field("brouillon", pattern="^(brouillon|en_attente|validee|rejetee)$")

    # Relations
    personnel: List[CRTPersonnelSchema] = []
    materiel: List[CRTMaterielSchema] = []


class CRTCreate(CRTBase):
    pass


class CRTUpdate(BaseModel):
    """Modèle pour la mise à jour partielle du CRT"""

    date_traitement: Optional[date] = None
    localite: Optional[str] = None
    # ... tous les champs optionnels
    statut: Optional[str] = Field(None, pattern="^(brouillon|en_attente|validee|rejetee)$")


class CRTResponse(CRTBase):
    id: UUID4
    statut: str
    statut_sync: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID4] = None
    validated_by: Optional[UUID4] = None
    validated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
