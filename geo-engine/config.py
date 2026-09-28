"""
GeoSync — Geo Engine Configuration
Reads from .env file and environment variables.
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Literal


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    # ── Database ───────────────────────────────────────────────────────────────
    database_url: str = Field(
        default="postgresql://postgres:password@localhost:5432/geoharmonize_geo",
        description="PostGIS-enabled PostgreSQL connection string"
    )

    # ── Storage ────────────────────────────────────────────────────────────────
    storage_backend: Literal["local", "minio"] = "local"
    storage_local_path: str = "./storage"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "geoharmonize"

    # ── OCR ────────────────────────────────────────────────────────────────────
    tesseract_cmd: str = "tesseract"

    # ── CORS ───────────────────────────────────────────────────────────────────
    allowed_origins: str = "http://localhost:3000"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    # ── App ────────────────────────────────────────────────────────────────────
    environment: Literal["development", "staging", "production"] = "development"
    log_level: str = "info"

    # ── Confidence thresholds (PRD §5) ─────────────────────────────────────────
    auto_link_threshold: float = 0.90
    human_review_threshold: float = 0.60

    # ── Source reliability weights (PRD §5) ────────────────────────────────────
    source_weight_gnss: float = 0.95
    source_weight_drone: float = 0.90
    source_weight_drone_ori: float = 0.90
    source_weight_dsm_dtm: float = 0.85
    source_weight_cadastral: float = 0.80
    source_weight_municipal: float = 0.75
    source_weight_building_footprint: float = 0.75
    source_weight_revenue: float = 0.70
    source_weight_utility: float = 0.65

    def source_reliability(self, source_type: str) -> float:
        """Return the static reliability weight for a given source_type."""
        weights = {
            "gnss": self.source_weight_gnss,
            "drone_ori": self.source_weight_drone_ori,
            "dsm_dtm": self.source_weight_dsm_dtm,
            "cadastral": self.source_weight_cadastral,
            "municipal": self.source_weight_municipal,
            "building_footprint": self.source_weight_building_footprint,
            "revenue": self.source_weight_revenue,
            "utility": self.source_weight_utility,
        }
        return weights.get(source_type, 0.70)


settings = Settings()
