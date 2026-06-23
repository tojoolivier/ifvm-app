from fastapi import APIRouter

router = APIRouter()


@router.get("/crt")
async def list_crt():
    # TODO: implémenter la liste des CRT
    return []


@router.post("/crt", status_code=201)
async def create_crt():
    # TODO: implémenter la création d'un CRT
    return {"detail": "not implemented"}
