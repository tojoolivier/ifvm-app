from app.models.base import Base  # noqa: F401
from app.models.users import Utilisateur  # noqa: F401

# Import du module référentiel pour enregistrer PosteAcridienModel et StationFixeModel
import app.infrastructure.referentiel_model  # noqa: F401

# Import du module prospection pour enregistrer ProspectionModel et les modèles liés
import app.infrastructure.prospection_model  # noqa: F401