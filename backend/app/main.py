from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.config import settings
from app.presentation import (
    campagne_routes,
    fiche_vol_routes,
    prospection_routes,
    referentiel_routes,
    traitement_routes,
)
from app.routers import auth, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="IFVM API", version="0.1.0", lifespan=lifespan, root_path=settings.ROOT_PATH)

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(campagne_routes.router, prefix="/campagnes", tags=["campagnes"])
app.include_router(referentiel_routes.router, prefix="", tags=["referentiels"])
app.include_router(prospection_routes.router, prefix="/prospections", tags=["prospections"])
app.include_router(traitement_routes.router, prefix="/traitements", tags=["traitements"])
app.include_router(fiche_vol_routes.router, prefix="/fiches-vol", tags=["fiches-vol"])


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok"}
