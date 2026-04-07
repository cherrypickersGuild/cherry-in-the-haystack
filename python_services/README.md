# Python Services API

FastAPI server for cherry-in-the-haystack Python services.

## Installation

```bash
# Using Poetry (recommended)
poetry install

# Or using pip
pip install -r requirements.txt
```

## Running

```bash
# Default: http://127.0.0.1:8000
python python_services/api.py

# Custom host/port
API_HOST=0.0.0.0 API_PORT=8080 python python_services/api.py
```

## Endpoints

- `GET /` — API information
- `GET /health` — Health check
- `POST /echo` — Echo test endpoint

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_HOST` | `127.0.0.1` | Bind address |
| `API_PORT` | `8000` | Port number |
