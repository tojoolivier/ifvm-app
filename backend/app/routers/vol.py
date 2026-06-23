from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_fiches_vol():
    # TODO: implémenter la liste des fiches de vol
    return []


@router.post("/", status_code=201)
async def create_fiche_vol():
    # TODO: implémenter la création d'une fiche de vol
    return {"detail": "not implemented"}
