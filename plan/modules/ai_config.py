import os
import sys
from pathlib import Path

# Load .env from the plan/ directory (one level up from this modules/ folder)
_env_file = Path(__file__).parent.parent / ".env"
try:
    from dotenv import load_dotenv

    load_dotenv(_env_file)
except ImportError:
    if _env_file.exists():
        for _line in _env_file.read_text().splitlines():
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))


def get_config():
    """Return (api_key, model, flux_model) from environment, exiting if missing."""
    api_key = os.environ.get("MONICA_API_KEY", "").strip()
    model = os.environ.get("MONICA_MODEL", "").strip()
    flux_model = os.environ.get("MONICA_FLUX_MODEL", "flux_pro").strip()

    missing = []
    if not api_key:
        missing.append("MONICA_API_KEY")
    if not model:
        missing.append("MONICA_MODEL")

    if missing:
        sys.exit(
            f"Missing required .env value(s): {', '.join(missing)}\n"
            "Copy plan/.env.example to plan/.env and fill in the values."
        )

    return api_key, model, flux_model
