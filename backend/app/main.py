from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, geo, meteo, prospection, traitement, users, vol


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="IFVM API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(geo.router, prefix="/geo", tags=["geo"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(meteo.router, prefix="/meteo", tags=["météo"])
app.include_router(prospection.router, prefix="/prospection", tags=["prospection"])
app.include_router(traitement.router, prefix="/traitement", tags=["traitement"])
app.include_router(vol.router, prefix="/vol", tags=["vol"])


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok"}
