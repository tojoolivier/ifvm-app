from app.models.base import Base  # noqa: F401

# Import all models so SQLAlchemy registers them in Base.metadata
from app.models.geo import PosteAcridien, Station, StationMeteo  # noqa: F401
from app.models.users import Utilisateur  # noqa: F401
from app.models.meteo import ReleveMeteo, MesureMeteoJour  # noqa: F401
from app.models.prospection import (  # noqa: F401
    ProspectionExtensive,
    ProspectionIntensive,
    Capture,
    PopulationAcridien,
    Infestation,
    Vegetation,
    HumiditeSol,
    TextureSol,
)
from app.models.traitement import (  # noqa: F401
    CompteRenduTraitement,
    CrtPointGps,
    CrtCibleEspece,
    CrtZoneCible,
    CrtMoyensHumains,
    CrtMoyensMateriels,
    CrtPesticide,
    CrtNonCible,
    CrtHabitatProximite,
    FicheConflictArchive,
)
from app.models.vol import FicheVol, FicheVolPassage, FicheVolCumul, FicheVolPesticide  # noqa: F401
