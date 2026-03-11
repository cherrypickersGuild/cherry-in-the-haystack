import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from run_news_agent import (
    load_items,
    load_prompts,
    load_env_file,
    load_newsletter_prompts,
    run_newsletter_draft,
    run_pipeline,
)

BASE_DIR = Path(__file__).resolve().parent
UI_PATH = BASE_DIR / "mock_ui" / "index.html"
OUTPUT_DIR = Path("dev/apps/agent/news_agent/outputs")
PROMPTS_PATH = BASE_DIR / "prompts.json"
NEWSLETTER_PROMPTS_PATH = BASE_DIR / "newsletter_prompts.json"
DATA_CSV = Path("dev/apps/agent/news_agent/data/example_data.csv")
ENV_PATH = BASE_DIR / ".env"

app = FastAPI(title="News Agent Studio")


def latest_output_file() -> Path | None:
    if not OUTPUT_DIR.exists():
        return None
    files = sorted(OUTPUT_DIR.glob("news_agent_output_*.json"))
    return files[-1] if files else None


@app.on_event("startup")
def startup() -> None:
    load_env_file(ENV_PATH)


@app.get("/")
def index():
    if not UI_PATH.exists():
        raise HTTPException(status_code=404, detail="UI not found")
    return FileResponse(UI_PATH)


@app.get("/api/latest")
def api_latest():
    latest = latest_output_file()
    if not latest:
        raise HTTPException(status_code=404, detail="No output yet")
    data = json.loads(latest.read_text())
    return JSONResponse(content=data)


@app.get("/api/items")
def api_items():
    items = load_items(DATA_CSV)
    return JSONResponse(content={"items": items})


@app.get("/api/prompts")
def api_prompts():
    prompts = load_prompts(PROMPTS_PATH)
    return JSONResponse(content=prompts)


@app.post("/api/prompts")
def api_prompts_save(payload: Dict[str, Any]):
    PROMPTS_PATH.write_text(json.dumps(payload, ensure_ascii=True, indent=2))
    return JSONResponse(content={"ok": True})


@app.get("/api/newsletter_prompts")
def api_newsletter_prompts():
    prompts = load_newsletter_prompts(NEWSLETTER_PROMPTS_PATH)
    return JSONResponse(content=prompts)


@app.post("/api/newsletter_prompts")
def api_newsletter_prompts_save(payload: Dict[str, Any]):
    NEWSLETTER_PROMPTS_PATH.write_text(json.dumps(payload, ensure_ascii=True, indent=2))
    return JSONResponse(content={"ok": True})


@app.post("/api/run")
def api_run(payload: Dict[str, Any]):
    items = payload.get("items")
    if not items:
        items = load_items(DATA_CSV)

    limit = int(payload.get("limit", 0) or 0)
    if limit > 0:
        items = items[:limit]

    prompts = payload.get("prompts")
    if not prompts:
        prompts = load_prompts(PROMPTS_PATH)

    output = run_pipeline(
        items=items,
        output_dir=str(OUTPUT_DIR),
        prompts=prompts,
    )
    return JSONResponse(content=output)


@app.post("/api/newsletter_draft")
def api_newsletter_draft(payload: Dict[str, Any]):
    selected_items = payload.get("selected_items") or []
    user_instructions = payload.get("user_instructions", "")
    few_shots = payload.get("few_shots", "")
    brand_tone = payload.get("brand_tone", "")
    prompt_overrides = payload.get("prompts") or None

    draft = run_newsletter_draft(
        selected_items=selected_items,
        user_instructions=user_instructions,
        few_shots=few_shots,
        brand_tone=brand_tone,
        prompt_overrides=prompt_overrides,
    )
    return JSONResponse(content=draft)


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("NEWS_AGENT_HOST", "127.0.0.1")
    port = int(os.getenv("NEWS_AGENT_PORT", "8787"))
    print(f"News Agent FastAPI running on http://{host}:{port} at {datetime.now(timezone.utc).isoformat()}")
    uvicorn.run(app, host=host, port=port)
