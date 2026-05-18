"""Resolución de rutas relativa al fichero, robusta a cwd del usuario."""
from pathlib import Path

# freqtrade/agent/tools/_paths.py  -> parents[2] = freqtrade/
COMPOSE_DIR = Path(__file__).resolve().parents[2]
USER_DATA = COMPOSE_DIR / "user_data"
STRATEGIES_DIR = USER_DATA / "strategies"
DB_PATH = USER_DATA / "tradesv3.sqlite"
