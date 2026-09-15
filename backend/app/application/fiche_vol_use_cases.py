"""Cas d'usage de la fiche de vol.

Le domaine (`app/domain/fiche_vol.py`) porte les règles ; ces classes les orchestrent
autour du dépôt et traduisent les conflits de persistance.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime

from app.domain.fiche_vol import (
    ChefDeBaseVolInvalideError,
    FicheVol,
    FicheVolIntrouvableError,
    FicheVolSyncConflitError,
    FicheVolValideeSyncRejeteError,
    FicheVolVerrouilleeError,
    SignatureVol,
    Vol,
    composer_numero_fiche,
    contenu_diverge,
    cumuler_durees,
    valider_rotations_completes,
    valider_signatures,
)


async def _exiger_brouillon(repo, fiche_vol_id: uuid.UUID) -> FicheVol:
    fiche = await repo.get_by_id(fiche_vol_id)
    if fiche is None:
        raise FicheVolIntrouvableError(str(fiche_vol_id))
    if fiche.statut != "brouillon":
        raise FicheVolVerrouilleeError(
            f"fiche {fiche.numero_fiche} déjà validée : plus aucune écriture"
        )
    return fiche


@dataclass
class CreateFicheVol:
    repo: object
    utilisateur_repo: object

    async def execute(self, fiche: FicheVol) -> FicheVol:
        chef = await self.utilisateur_repo.get_by_id(fiche.chef_de_base_id)
        if chef is None or chef.role != "chef_de_base":
            raise ChefDeBaseVolInvalideError(str(fiche.chef_de_base_id))

        # equipe = base_aerienne.numero, résolu avant l'écriture pour composer le
        # numéro de fiche. next_compteur alloue atomiquement (verrou de ligne côté
        # serveur) : contrairement à l'ancien mécanisme de suffixe, deux fiches créées
        # en même temps n'obtiennent jamais le même compteur, donc jamais le même
        # numéro — plus besoin de boucle de réessai sur conflit.
        equipe = await self.repo.get_base_numero(fiche.base_id)
        fiche.compteur = await self.repo.next_compteur(fiche.campagne_id)
        fiche.numero_fiche = composer_numero_fiche(
            fiche.compteur, fiche.date_vol, equipe, fiche.immatriculation
        )
        return await self.repo.create(fiche)


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
class SyncPushFicheVol:
    """Point d'entrée hors-ligne (#fiche-vol-sync-hors-ligne, même patron que
    `SyncPushTraitementTerrestre`/`Aerien`) : `fiche.id` fourni par le client, upsert
    idempotent — un renvoi réseau (même contenu) est traité `synced` sans jamais être
    vu comme un conflit."""

    repo: object
    utilisateur_repo: object

    async def execute(self, fiche: FicheVol, base_updated_at: datetime) -> tuple[FicheVol, bool]:
        chef = await self.utilisateur_repo.get_by_id(fiche.chef_de_base_id)
        if chef is None or chef.role != "chef_de_base":
            raise ChefDeBaseVolInvalideError(str(fiche.chef_de_base_id))

        existante = await self.repo.get_by_id(fiche.id)

        if existante is None:
            # equipe = base_aerienne.numero, résolu avant l'écriture pour composer le
            # numéro de fiche — même séquence que CreateFicheVol.execute.
            equipe = await self.repo.get_base_numero(fiche.base_id)
            fiche.compteur = await self.repo.next_compteur(fiche.campagne_id)
            fiche.numero_fiche = composer_numero_fiche(
                fiche.compteur, fiche.date_vol, equipe, fiche.immatriculation
            )
            fiche.statut_sync = "synced"
            return await self.repo.create(fiche), True

        if existante.statut != "brouillon":
            raise FicheVolValideeSyncRejeteError(existante)

        if existante.updated_at > base_updated_at and contenu_diverge(existante, fiche):
            marquee = await self.repo.marquer_conflict(existante.id)
            raise FicheVolSyncConflitError(marquee)

        # numero_fiche/compteur/created_at : attribués une fois à la création, jamais
        # renvoyés par le client — repris tels quels de l'existant.
        fiche.numero_fiche = existante.numero_fiche
        fiche.compteur = existante.compteur
        fiche.created_at = existante.created_at
        fiche.updated_at = datetime.utcnow()
        return await self.repo.update_sync(fiche), False


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
