import sys
from pathlib import Path

# Allow imports like `from api.main import app` in test files located anywhere under
# python_services/. Insert python_services/ itself so `api` is importable directly.
sys.path.insert(0, str(Path(__file__).parent))
