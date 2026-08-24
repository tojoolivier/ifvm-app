"""Cas d'usage de la fiche de vol.

Le domaine (`app/domain/fiche_vol.py`) porte les règles ; ces classes les orchestrent
autour du dépôt et traduisent les conflits de persistance.
"""

import uuid
from dataclasses import dataclass
from datetime import date

from app.domain.fiche_vol import (
    ChefDeBaseVolInvalideError,
    FicheVol,
    FicheVolIntrouvableError,
    FicheVolVerrouilleeError,
    NumeroFicheVolConflitError,
    SignatureVol,
    Vol,
    composer_numero_fiche,
    cumuler_durees,
    valider_rotations_completes,
    valider_signatures,
)

# Garde-fou sur la boucle de numérotation : au-delà, c'est une anomalie de saisie, pas
# une journée chargée.
_SUFFIXE_MAX = 99


async def _exiger_brouillon(repo, fiche_vol_id: uuid.UUID) -> FicheVol:
    fiche = await repo.get_by_id(fiche_vol_id)
    if fiche is None:
        raise FicheVolIntrouvableError(str(fiche_vol_id))
    if fiche.statut != "brouillon":
        raise FicheVolVerrouilleeError(f"fiche {fiche.numero} déjà validée : plus aucune écriture")
    return fiche


@dataclass
class CreateFicheVol:
    repo: object
    utilisateur_repo: object

    async def execute(self, fiche: FicheVol) -> FicheVol:
        chef = await self.utilisateur_repo.get_by_id(fiche.chef_de_base_id)
        if chef is None or chef.role != "chef_de_base":
            raise ChefDeBaseVolInvalideError(str(fiche.chef_de_base_id))

        # « Une seule fiche par jour si possible » : on tente le numéro nu, puis on
        # incrémente. Le conflit est arbitré par la contrainte UNIQUE, pas par un SELECT
        # préalable — deux tablettes qui synchronisent en même temps ne doivent pas
        # pouvoir obtenir le même numéro.
        for suffixe in [None, *range(2, _SUFFIXE_MAX + 1)]:
            fiche.numero = composer_numero_fiche(
                fiche.date_vol, fiche.base_code, fiche.immatriculation, suffixe
            )
            try:
                return await self.repo.create(fiche)
            except NumeroFicheVolConflitError:
                continue
        raise NumeroFicheVolConflitError(
            f"plus de {_SUFFIXE_MAX} fiches le {fiche.date_vol} pour {fiche.immatriculation}"
        )


@dataclass
class AddVol:
    repo: object

    async def execute(self, fiche_vol_id: uuid.UUID, vol: Vol) -> FicheVol:
        await _exiger_brouillon(self.repo, fiche_vol_id)
        return await self.repo.add_vol(fiche_vol_id, vol)


@dataclass
class RemoveVol:
    repo: object

    async def execute(self, fiche_vol_id: uuid.UUID, vol_id: uuid.UUID) -> FicheVol:
        await _exiger_brouillon(self.repo, fiche_vol_id)
        return await self.repo.remove_vol(fiche_vol_id, vol_id)


@dataclass
class UpsertSignatureVol:
    repo: object

    async def execute(self, fiche_vol_id: uuid.UUID, signature: SignatureVol) -> FicheVol:
        await _exiger_brouillon(self.repo, fiche_vol_id)
        return await self.repo.upsert_signature(fiche_vol_id, signature)


@dataclass
class ValiderFicheVol:
    repo: object

    async def execute(self, fiche_vol_id: uuid.UUID) -> FicheVol:
        fiche = await _exiger_brouillon(self.repo, fiche_vol_id)
        valider_signatures(fiche)
        valider_rotations_completes(fiche.vols)
        return await self.repo.valider(fiche_vol_id)


@dataclass
class GetFicheVol:
    repo: object

    async def execute(self, fiche_vol_id: uuid.UUID) -> FicheVol | None:
        return await self.repo.get_by_id(fiche_vol_id)


@dataclass
class ListFichesVol:
    repo: object

    async def execute(
        self,
        date_vol: date | None = None,
        immatriculation: str | None = None,
        chef_de_base_id: uuid.UUID | None = None,
    ) -> list[FicheVol]:
        return await self.repo.list_by_filters(date_vol, immatriculation, chef_de_base_id)


@dataclass
class CumulsHeuresVol:
    """Cumuls journalier / hebdomadaire / mensuel / total, en minutes.

    Recalculés à chaque appel : aucune colonne ne les porte, donc aucune ne peut se
    désynchroniser d'une correction d'horaire.
    """

    repo: object

    async def execute(
        self,
        reference: date,
        immatriculation: str | None = None,
        chef_de_base_id: uuid.UUID | None = None,
    ) -> dict[str, int]:
        fiches = await self.repo.list_by_filters(None, immatriculation, chef_de_base_id)
        return cumuler_durees(fiches, reference)
