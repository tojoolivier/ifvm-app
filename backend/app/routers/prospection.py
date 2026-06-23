from fastapi import APIRouter

router = APIRouter()


@router.get("/extensive")
async def list_extensives():
    # TODO: implémenter
    return []


@router.post("/extensive", status_code=201)
async def create_extensive():
    # TODO: implémenter
    return {"detail": "not implemented"}


@router.get("/intensive")
async def list_intensives():
    # TODO: implémenter
    return []


@router.post("/intensive", status_code=201)
async def create_intensive():
    # TODO: implémenter
    return {"detail": "not implemented"}
