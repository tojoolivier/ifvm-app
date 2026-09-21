import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, hash_password
from app.database import get_db
from app.infrastructure.referentiel_model import PosteAcridienModel
from app.models.users import ROLES_A_LA_VOLEE, Utilisateur
from app.schemas.users import (
    UtilisateurAnnuaireRead,
    UtilisateurCreate,
    UtilisateurCreateALaVolee,
    UtilisateurRead,
    UtilisateurUpdate,
)

router = APIRouter()


def _contrainte_violee(exc: IntegrityError) -> str | None:
    """Nom de la contrainte violée — même mécanique que
    `prospection_repository._contrainte_violee` : `exc.orig` est l'erreur
    asyncpg, qui porte `constraint_name` un cran plus bas."""
    erreur: BaseException | None = getattr(exc, "orig", None)
    while erreur is not None:
        nom = getattr(erreur, "constraint_name", None)
        if nom:
            return str(nom)
        erreur = erreur.__cause__
    return None


def _detail_creation_utilisateur(exc: IntegrityError) -> str:
    """Traduit l'IntegrityError en message actionnable pour le formulaire web.

    Sans ça, `create_user` laissait l'exception remonter telle quelle :
    Starlette la rend en 500 texte brut (pas de champ `detail` JSON), que le
    front (`UsersPage.tsx`) ne sait afficher que comme « Erreur lors de la
    création » — un email dupliqué ou un rôle refusé par
    `ck_utilisateur_role` (cf. migration 0051) restaient donc muets pour
    l'agent, alors même que la cause est connue côté serveur."""
    contrainte = _contrainte_violee(exc)
    if contrainte == "utilisateur_email_key":
        return "Un utilisateur avec cet email existe déjà."
    if contrainte == "ck_utilisateur_role":
        return "Ce rôle n'est pas autorisé."
    return "La création viole une contrainte de la base."


@router.get("/me", response_model=UtilisateurRead)
async def me(current_user: Annotated[Utilisateur, Depends(get_current_user)]):
    return current_user


@router.get("/chefs-de-base", response_model=list[UtilisateurAnnuaireRead])
async def list_chefs_de_base(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    """Annuaire des chefs de base actifs, pour le sélecteur `chef_de_base_id`
    de la gestion des équipes aériennes —
    ce champ FK doit préexister (comme pour `create_user_a_la_volee`, issue
    #319), donc pas de création à la volée ici. Ouvert à tout utilisateur
    authentifié comme `POST /users/a-la-volee` : l'appelant est un agent de
    terrain, pas un admin."""
    stmt = (
        select(Utilisateur)
        .where(Utilisateur.role == "chef_de_base", Utilisateur.actif.is_(True))
        .order_by(Utilisateur.nom)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/chefs-equipe", response_model=list[UtilisateurAnnuaireRead])
async def list_chefs_equipe(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    """Annuaire des chefs d'équipe actifs, pour le sélecteur `chef_equipe_id` du
    formulaire de création d'équipe terrestre (portail web, #equipe-terrestre) —
    même patron que `list_chefs_de_base`."""
    stmt = (
        select(Utilisateur)
        .where(Utilisateur.role == "chef_equipe", Utilisateur.actif.is_(True))
        .order_by(Utilisateur.nom)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


def require_admin(current_user: Annotated[Utilisateur, Depends(get_current_user)]) -> Utilisateur:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Accès réservé aux admins"
        )
    return current_user


@router.get("/", response_model=list[UtilisateurRead])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(require_admin)],
):
    # Jointure externe : un utilisateur peut ne pas être rattaché à un poste.
    stmt = (
        select(Utilisateur, PosteAcridienModel.code, PosteAcridienModel.nom)
        .outerjoin(PosteAcridienModel, Utilisateur.pa_id == PosteAcridienModel.id)
        .order_by(Utilisateur.nom)
    )
    result = await db.execute(stmt)
    return [
        UtilisateurRead.model_validate(user).model_copy(
            update={"pa_code": pa_code, "pa_nom": pa_nom}
        )
        for user, pa_code, pa_nom in result.all()
    ]


@router.post("/", response_model=UtilisateurRead, status_code=201)
async def create_user(
    body: UtilisateurCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(require_admin)],
):
    data = body.model_dump()
    data["password_hash"] = hash_password(data.pop("password"))
    data["sigle"] = (data["sigle"] or "").strip() or None
    user = Utilisateur(**data)
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_detail_creation_utilisateur(exc),
        ) from exc
    await db.refresh(user)
    return user


@router.post("/a-la-volee", response_model=UtilisateurRead, status_code=201)
async def create_user_a_la_volee(
    body: UtilisateurCreateALaVolee,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    """Création d'identité seule (pilote/mécanicien/consultant) depuis le
    formulaire de traitement aérien : compte non-authentifiable
    (`peut_se_connecter=False`), email/mot de passe générés et inexploitables.
    Chef de base explicitement exclu : il doit préexister (issue #319).

    Volontairement ouvert à tout utilisateur authentifié (pas `require_admin`
    comme `POST /` ci-dessus) : l'appelant est le personnel de terrain qui
    remplit la fiche de traitement, pas un admin. Le compte créé ne peut de
    toute façon ni se logger ni obtenir de droits au-delà de son rôle."""
    if body.role not in ROLES_A_LA_VOLEE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Création à la volée impossible pour le rôle '{body.role}' : "
                f"seuls {', '.join(ROLES_A_LA_VOLEE)} peuvent être créés ainsi "
                "(chef de base doit préexister)."
            ),
        )
    jeton = uuid.uuid4().hex
    user = Utilisateur(
        nom=body.nom,
        prenom=body.prenom,
        email=f"a-la-volee.{jeton}@ifvm.invalid",
        password_hash=hash_password(jeton),
        role=body.role,
        peut_se_connecter=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UtilisateurRead)
async def update_user(
    user_id: uuid.UUID,
    body: UtilisateurUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Utilisateur, Depends(require_admin)],
):
    # Un admin ne modifie pas son propre compte ici : il pourrait se retirer le
    # rôle admin ou se désactiver et se verrouiller hors de l'administration.
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Un admin ne peut pas modifier son propre compte",
        )
    user = await db.get(Utilisateur, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if body.role is not None:
        user.role = body.role
    if body.actif is not None:
        user.actif = body.actif
    # Chaîne vide = effacement explicite (distinct de l'absence du champ dans
    # le corps de la requête, qui laisse le sigle inchangé) — un sigle vide
    # n'a pas de sens dans un numéro de fiche.
    if body.sigle is not None:
        user.sigle = body.sigle.strip() or None
    await db.commit()
    await db.refresh(user)
    return user
