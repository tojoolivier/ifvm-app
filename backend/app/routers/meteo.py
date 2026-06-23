from fastapi import APIRouter

router = APIRouter()


@router.get("/releves")
async def list_releves():
    # TODO: implémenter la liste des relevés météo
    return []


@router.post("/releves", status_code=201)
async def create_releve():
    # TODO: créer un relevé météo avec ses mesures journalières
    return {"detail": "not implemented"}
