from decimal import Decimal
from uuid import uuid4

from app.domain.traitement import RotationAerienne, TraitementAerien


class TestTraitementAerien:
    def test_ajouter_rotation_recalcule_totaux(self):
        # GIVEN
        traitement = TraitementAerien(
            id=uuid4(),
            traitement_id=uuid4(),
            pilote="Pilote Test",
            mecanicien="Mecanicien Test",
            chef_de_base_id=uuid4(),
        )

        rotation1 = RotationAerienne(
            id=uuid4(),
            traitement_aerien_id=traitement.id,
            numero=0,
            numero_cuve="C001",
            produit_id=uuid4(),
            quantite_l=Decimal("10.5"),
            temperature_debut_c=Decimal("25.0"),
            temperature_fin_c=Decimal("27.0"),
            vent_debut_ms=Decimal("3.5"),
            vent_fin_ms=Decimal("4.0"),
        )

        rotation2 = RotationAerienne(
            id=uuid4(),
            traitement_aerien_id=traitement.id,
            numero=0,
            numero_cuve="C002",
            produit_id=uuid4(),
            quantite_l=Decimal("5.0"),
            temperature_debut_c=Decimal("26.0"),
            temperature_fin_c=Decimal("28.0"),
            vent_debut_ms=Decimal("3.0"),
            vent_fin_ms=Decimal("3.5"),
        )

        # WHEN
        traitement.ajouter_rotation(rotation1)
        traitement.ajouter_rotation(rotation2)

        # THEN
        assert traitement.nb_rotations == 2
        assert traitement.total_pesticide_l == Decimal("15.5")
        assert rotation1.numero == 1
        assert rotation2.numero == 2

    def test_supprimer_rotation_recalcule_totaux(self):
        # GIVEN
        traitement = TraitementAerien(
            id=uuid4(),
            traitement_id=uuid4(),
            pilote="Pilote Test",
            mecanicien="Mecanicien Test",
            chef_de_base_id=uuid4(),
        )

        rotation1 = RotationAerienne(
            id=uuid4(),
            traitement_aerien_id=traitement.id,
            numero=0,
            numero_cuve="C001",
            produit_id=uuid4(),
            quantite_l=Decimal("10.5"),
            temperature_debut_c=Decimal("25.0"),
            temperature_fin_c=Decimal("27.0"),
            vent_debut_ms=Decimal("3.5"),
            vent_fin_ms=Decimal("4.0"),
        )

        rotation2 = RotationAerienne(
            id=uuid4(),
            traitement_aerien_id=traitement.id,
            numero=0,
            numero_cuve="C002",
            produit_id=uuid4(),
            quantite_l=Decimal("5.0"),
            temperature_debut_c=Decimal("26.0"),
            temperature_fin_c=Decimal("28.0"),
            vent_debut_ms=Decimal("3.0"),
            vent_fin_ms=Decimal("3.5"),
        )

        traitement.ajouter_rotation(rotation1)
        traitement.ajouter_rotation(rotation2)

        # WHEN
        traitement.supprimer_rotation(rotation1.id)

        # THEN
        assert traitement.nb_rotations == 1
        assert traitement.total_pesticide_l == Decimal("5.0")
        assert rotation2.numero == 1
