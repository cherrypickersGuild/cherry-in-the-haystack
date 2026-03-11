import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from run_news_agent import (
    load_items,
    run_pipeline,
    load_prompts,
    load_env_file,
    load_newsletter_prompts,
    run_newsletter_draft,
)


BASE_DIR = Path(__file__).resolve().parent
UI_PATH = BASE_DIR / "mock_ui" / "index.html"
OUTPUT_DIR = Path("dev/apps/agent/news_agent/outputs")
PROMPTS_PATH = BASE_DIR / "prompts.json"
NEWSLETTER_PROMPTS_PATH = BASE_DIR / "newsletter_prompts.json"
DATA_CSV = Path("dev/apps/agent/news_agent/data/example_data.csv")
ENV_PATH = BASE_DIR / ".env"


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    data = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    try:
        handler.send_response(status)
        handler.send_header("Content-Type", "application/json")
        handler.send_header("Content-Length", str(len(data)))
        handler.end_headers()
        handler.wfile.write(data)
    except BrokenPipeError:
        # Client disconnected before response completed.
        return


def read_body(handler: BaseHTTPRequestHandler) -> str:
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0:
        return ""
    return handler.rfile.read(length).decode("utf-8")


def latest_output_file() -> Path | None:
    if not OUTPUT_DIR.exists():
        return None
    files = sorted(OUTPUT_DIR.glob("news_agent_output_*.json"))
    return files[-1] if files else None


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/":
            if not UI_PATH.exists():
                self.send_error(404, "UI not found")
                return
            content = UI_PATH.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        if path == "/api/latest":
            latest = latest_output_file()
            if not latest:
                json_response(self, 404, {"error": "No output yet"})
                return
            data = json.loads(latest.read_text())
            json_response(self, 200, data)
            return

        if path == "/api/items":
            items = load_items(DATA_CSV)
            json_response(self, 200, {"items": items})
            return

        if path == "/api/prompts":
            prompts = load_prompts(PROMPTS_PATH)
            json_response(self, 200, prompts)
            return

        if path == "/api/newsletter_prompts":
            prompts = load_newsletter_prompts(NEWSLETTER_PROMPTS_PATH)
            json_response(self, 200, prompts)
            return

        self.send_error(404, "Not Found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/prompts":
            body = read_body(self)
            try:
                payload = json.loads(body) if body else {}
            except json.JSONDecodeError:
                json_response(self, 400, {"error": "Invalid JSON"})
                return

            PROMPTS_PATH.write_text(json.dumps(payload, ensure_ascii=True, indent=2))
            json_response(self, 200, {"ok": True})
            return

        if path == "/api/newsletter_prompts":
            body = read_body(self)
            try:
                payload = json.loads(body) if body else {}
            except json.JSONDecodeError:
                json_response(self, 400, {"error": "Invalid JSON"})
                return

            NEWSLETTER_PROMPTS_PATH.write_text(json.dumps(payload, ensure_ascii=True, indent=2))
            json_response(self, 200, {"ok": True})
            return

        if path == "/api/run":
            body = read_body(self)
            try:
                payload = json.loads(body) if body else {}
            except json.JSONDecodeError:
                json_response(self, 400, {"error": "Invalid JSON"})
                return

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
            json_response(self, 200, output)
            return

        if path == "/api/newsletter_draft":
            body = read_body(self)
            try:
                payload = json.loads(body) if body else {}
            except json.JSONDecodeError:
                json_response(self, 400, {"error": "Invalid JSON"})
                return

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
            json_response(self, 200, draft)
            return

        self.send_error(404, "Not Found")


def main() -> int:
    load_env_file(ENV_PATH)
    host = os.getenv("NEWS_AGENT_HOST", "127.0.0.1")
    port = int(os.getenv("NEWS_AGENT_PORT", "8787"))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"News Agent web running on http://{host}:{port} at {datetime.now(timezone.utc).isoformat()}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
