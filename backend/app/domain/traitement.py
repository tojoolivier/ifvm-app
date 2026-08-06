from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID


@dataclass
class RotationAerienne:
    """Une rotation = une cuve de produit pour un traitement aérien"""

    id: UUID
    traitement_aerien_id: UUID
    numero: int  # auto-incrémenté
    numero_cuve: str
    produit_id: UUID
    quantite_l: Decimal
    temperature_debut_c: Decimal
    temperature_fin_c: Decimal
    vent_debut_ms: Decimal
    vent_fin_ms: Decimal
    created_at: Optional[date] = None


@dataclass
class TraitementAerien:
    """Traitement aérien - agrégat racine"""

    id: UUID
    traitement_id: UUID  # FK vers la table traitement (héritage)
    pilote: str
    mecanicien: str
    chef_de_base_id: UUID
    consultant_international: Optional[str] = None
    nb_rotations: int = 0
    total_pesticide_l: Decimal = Decimal("0")
    rotations: List[RotationAerienne] = field(default_factory=list)
    created_at: Optional[date] = None
    updated_at: Optional[date] = None

    def ajouter_rotation(self, rotation: RotationAerienne) -> None:
        """Ajoute une rotation et recalcule les totaux"""
        # Attribuer le numéro de rotation (auto-incrément)
        rotation.numero = len(self.rotations) + 1
        rotation.traitement_aerien_id = self.id
        self.rotations.append(rotation)
        self._recalculer_totaux()

    def supprimer_rotation(self, rotation_id: UUID) -> None:
        """Supprime une rotation et recalcule les totaux"""
        self.rotations = [r for r in self.rotations if r.id != rotation_id]
        # Réattribuer les numéros
        for idx, rotation in enumerate(self.rotations, start=1):
            rotation.numero = idx
        self._recalculer_totaux()

    def _recalculer_totaux(self) -> None:
        """Méthode unique de recalcul - jamais appelée en lecture seule"""
        self.nb_rotations = len(self.rotations)
        self.total_pesticide_l = sum(r.quantite_l for r in self.rotations)
