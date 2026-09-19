"""Cas d'usage de la fiche de vol.

Le domaine (`app/domain/fiche_vol.py`) porte les règles ; ces classes les orchestrent
autour du dépôt et traduisent les conflits de persistance.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime

from app.domain.fiche_vol import (
    ChefDeBaseVolInvalideError,
    EquipeVolIntrouvableError,
    FicheVol,
    FicheVolIntrouvableError,
    FicheVolSyncConflitError,
    FicheVolValideeSyncRejeteError,
    FicheVolVerrouilleeError,
    LieuVolHorsEquipeError,
    SignatureVol,
    Vol,
    appliquer_equipe,
    composer_numero_fiche,
    contenu_diverge,
    cumuler_durees,
    valider_rotations_completes,
    valider_signatures,
)


def _sans_fuseau(valeur: datetime) -> datetime:
    """Neutralise la présence ou l'absence de fuseau avant comparaison
    (#erreur-sync-fiche-vol-datetime-naive-aware). `existante.updated_at` (colonne
    TIMESTAMPTZ, cf. fiche_vol_model.py) revient parfois "aware" (lecture fraîche
    depuis Postgres, asyncpg attache `tzinfo=UTC`) et parfois "naive" (objet encore en
    cache dans l'identity map de la session depuis sa création — `datetime.utcnow()`,
    naive, appliqué par la colonne `default=`, jamais réexpiré si `expire_on_commit`
    est faux) — comparer les deux bruts lève `TypeError: can't compare offset-naive
    and offset-aware datetimes`. `base_updated_at` (venu du client, une chaîne ISO
    sans décalage) est toujours naive. Les deux désignent le même instant UTC : sûr de
    retirer le fuseau plutôt que d'en forcer un côté client."""
    return valeur.replace(tzinfo=None) if valeur.tzinfo is not None else valeur


async def _appliquer_equipe_aerienne(repo, fiche: FicheVol, ecraser_en_tete: bool = True) -> None:
    """Migration 0075 : quand la fiche désigne une équipe, l'en-tête (chef de base, pilote,
    mécanicien, consultant, immatriculation, société) vient de l'équipe et le serveur en
    fait autorité — ce que le client a saisi est écrasé. La base et le stand doivent être
    ceux de cette équipe. Sans équipe (fiches antérieures, clients mobiles pas encore
    mis à jour), rien ne change : les valeurs saisies sont conservées.

    `ecraser_en_tete=False` : la fiche existe déjà avec cette même équipe (renvoi de
    synchro). L'en-tête est un snapshot du jour, jamais recalculé — on ne le réécrit pas
    si l'équipe a changé de pilote entre-temps ; seuls les lieux restent contrôlés.

    À exécuter AVANT la validation du chef de base : c'est le chef de l'équipe, pas celui
    que le client aurait envoyé, qui doit avoir le rôle `chef_de_base`."""
    if fiche.equipe_aerienne_id is None:
        return
    if ecraser_en_tete:
        contexte = await repo.resoudre_equipe(fiche.equipe_aerienne_id)
        if contexte is None:
            raise EquipeVolIntrouvableError(str(fiche.equipe_aerienne_id))
        appliquer_equipe(fiche, contexte)
    if not await repo.base_appartient_a_equipe(fiche.base_id, fiche.equipe_aerienne_id):
        raise LieuVolHorsEquipeError("la base choisie n'appartient pas à l'équipe aérienne")
    if not await repo.stand_appartient_a_equipe(fiche.stand_id, fiche.equipe_aerienne_id):
        raise LieuVolHorsEquipeError("le stand choisi n'appartient pas à l'équipe aérienne")


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
        await _appliquer_equipe_aerienne(self.repo, fiche)
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
        existante = await self.repo.get_by_id(fiche.id)
        # Fiche verrouillée : rejet systématique AVANT tout contrôle de contenu (dont
        # celui de l'équipe, qui pourrait sinon masquer ce 409 par un 422).
        if existante is not None and existante.statut != "brouillon":
            raise FicheVolValideeSyncRejeteError(existante)
        await _appliquer_equipe_aerienne(
            self.repo,
            fiche,
            ecraser_en_tete=existante is None
            or existante.equipe_aerienne_id != fiche.equipe_aerienne_id,
        )
        chef = await self.utilisateur_repo.get_by_id(fiche.chef_de_base_id)
        if chef is None or chef.role != "chef_de_base":
            raise ChefDeBaseVolInvalideError(str(fiche.chef_de_base_id))

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

        if _sans_fuseau(existante.updated_at) > _sans_fuseau(base_updated_at) and contenu_diverge(
            existante, fiche
        ):
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
