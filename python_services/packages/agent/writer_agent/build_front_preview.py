import argparse
import json
from datetime import datetime
from pathlib import Path

from format_for_frontend import build_page_payload, build_patch_notes_payload


def build_preview_html(page_data: dict, patch_data: dict) -> str:
    return f"""<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>Writer Agent Preview</title>
  <style>
    :root {{
      --bg: #f6f2ed;
      --ink: #1e1e1e;
      --ink-soft: #4a4a4a;
      --accent: #0e6f5c;
      --accent-2: #e0823d;
      --card: #ffffff;
      --line: #e5dccf;
      --shadow: 0 14px 30px rgba(32, 24, 16, 0.12);
      --radius: 18px;
    }}

    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Palatino Linotype", "Book Antiqua", Palatino, serif;
      color: var(--ink);
      background: radial-gradient(circle at top left, #fff6ea 0%, var(--bg) 40%, #efe6dc 100%);
    }}

    .page {{
      display: grid;
      grid-template-columns: 260px 1fr;
      gap: 28px;
      padding: 28px 32px 48px;
      min-height: 100vh;
    }}

    aside {{
      background: #fff;
      border-radius: var(--radius);
      padding: 20px;
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
      height: fit-content;
    }}

    .nav-title {{
      font-weight: 700;
      font-size: 16px;
      margin-bottom: 10px;
    }}

    .nav-item {{
      font-size: 14px;
      padding: 8px 10px;
      border-radius: 10px;
      margin-bottom: 6px;
      background: #f7f0e7;
    }}

    main {{
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid var(--line);
      border-radius: 28px;
      padding: 28px 36px 40px;
      box-shadow: var(--shadow);
    }}

    header h1 {{
      font-size: 34px;
      margin: 0 0 6px;
      letter-spacing: -0.5px;
    }}

    header p {{
      margin: 0;
      color: var(--ink-soft);
    }}

    .section {{
      margin-top: 26px;
    }}

    .section-title {{
      font-size: 18px;
      font-weight: 700;
      display: inline-block;
      background: #efe6dc;
      padding: 8px 14px;
      border-radius: 999px;
    }}

    .summary-card {{
      margin-top: 12px;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 18px 20px;
      box-shadow: var(--shadow);
    }}

    .summary-card p {{
      margin: 10px 0 0;
      color: var(--ink-soft);
    }}

    .grid {{
      margin-top: 14px;
      display: grid;
      gap: 14px;
    }}

    .card {{
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 10px 20px rgba(33, 26, 18, 0.08);
    }}

    .card h4 {{
      margin: 0 0 8px;
      font-size: 16px;
    }}

    .card p {{
      margin: 0;
      color: var(--ink-soft);
      line-height: 1.4;
    }}

    .pill-row {{
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
    }}

    .pill {{
      background: #fff6ea;
      border: 1px solid #f0d9c2;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 13px;
    }}

    .reference {{
      border-left: 4px solid var(--accent);
    }}

    .patch {{
      border-left: 4px solid var(--accent-2);
    }}

    @media (max-width: 960px) {{
      .page {{ grid-template-columns: 1fr; }}
      aside {{ order: 2; }}
    }}
  </style>
</head>
<body>
  <div class=\"page\">
    <aside>
      <div class=\"nav-title\">LLM Engineering Basics</div>
      <div class=\"nav-item\">0. Prologue - What is LLM</div>
      <div class=\"nav-item\">1. FM & Prompt Engineering</div>
      <div class=\"nav-title\" style=\"margin-top:16px;\">LLM Engineering Advanced</div>
      <div class=\"nav-item\">MCP - Model Context Protocol</div>
      <div class=\"nav-title\" style=\"margin-top:16px;\">Contributor Guide</div>
    </aside>

    <main>
      <header>
        <h1 id=\"topic\"></h1>
        <p>Your weekly digest of the most important developments in the LLM ecosystem.</p>
      </header>

      <section class=\"section\">
        <div class=\"section-title\">Summary & Why It Matters</div>
        <div class=\"summary-card\">
          <strong>Summary</strong>
          <p id=\"summary\"></p>
          <strong>Why it matters</strong>
          <p id=\"why\"></p>
        </div>
      </section>

      <section class=\"section\">
        <div class=\"section-title\">Important Evidence</div>
        <div id=\"evidence\" class=\"grid\"></div>
      </section>

      <section class=\"section\">
        <div class=\"section-title\">Related Concepts</div>
        <div id=\"related\" class=\"pill-row\"></div>
      </section>

      <section class=\"section\">
        <div class=\"section-title\">References</div>
        <div id=\"references\" class=\"grid\"></div>
      </section>

      <section class=\"section\">
        <div class=\"section-title\">Patch Notes</div>
        <div id=\"updates\" class=\"grid\"></div>
      </section>
    </main>
  </div>

  <script>
    const pageData = {json.dumps(page_data)};
    const patchData = {json.dumps(patch_data)};

    document.getElementById('topic').textContent = pageData.topic || 'Untitled Topic';
    document.getElementById('summary').textContent = pageData.summary || '';
    document.getElementById('why').textContent = pageData.why_it_matters || '';

    const evidenceRoot = document.getElementById('evidence');
    pageData.evidence_cards.forEach((card) => {{
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <h4>${{card.title}}</h4>
        <p>${{card.excerpt}}</p>
        <p style="margin-top:10px;color:#7a6f63;font-size:12px;">
          ${{card.source.book_title || ''}}${{card.source.book_author ? ' · ' + card.source.book_author : ''}}
        </p>
      `;
      evidenceRoot.appendChild(div);
    }});

    const relatedRoot = document.getElementById('related');
    pageData.related_cards.forEach((item) => {{
      const span = document.createElement('span');
      span.className = 'pill';
      span.textContent = item.label;
      relatedRoot.appendChild(span);
    }});

    const refRoot = document.getElementById('references');
    pageData.reference_cards.forEach((ref) => {{
      const div = document.createElement('div');
      div.className = 'card reference';
      const snippets = (ref.snippets || []).map((s) => `<li>${{s.excerpt || ''}}</li>`).join('');
      div.innerHTML = `
        <h4>${{ref.source || 'Unknown Source'}}</h4>
        <p>${{ref.author || ''}}</p>
        <ul style="padding-left:18px;color:#6f6255;">${{snippets}}</ul>
      `;
      refRoot.appendChild(div);
    }});

    const updateRoot = document.getElementById('updates');
    patchData.updates.forEach((u) => {{
      const div = document.createElement('div');
      div.className = 'card patch';
      div.innerHTML = `
        <h4>${{u.title}}</h4>
        <p>${{u.body}}</p>
      `;
      updateRoot.appendChild(div);
    }});

    if (patchData.patch_notes && patchData.patch_notes.length) {{
      const div = document.createElement('div');
      div.className = 'card patch';
      div.innerHTML = `
        <h4>Patch Notes</h4>
        <ul style="padding-left:18px;color:#6f6255;">${{patchData.patch_notes.map((n) => `<li>${{n}}</li>`).join('')}}</ul>
      `;
      updateRoot.appendChild(div);
    }}
  </script>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Build frontend payloads and preview HTML.")
    parser.add_argument("input", help="Path to writer_agent output JSON.")
    parser.add_argument(
        "--out-dir",
        default="./dev/apps/agent/writer_agent/front_outputs",
        help="Output directory for frontend payloads.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    data = json.loads(input_path.read_text())
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    stem = input_path.stem
    page_path = out_dir / f"{stem}_page.json"
    patch_path = out_dir / f"{stem}_patch.json"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    preview_path = out_dir / f"preview_{timestamp}.html"

    page_payload = build_page_payload(data)
    patch_payload = build_patch_notes_payload(data)

    page_path.write_text(json.dumps(page_payload, ensure_ascii=True, indent=2))
    patch_path.write_text(json.dumps(patch_payload, ensure_ascii=True, indent=2))
    preview_path.write_text(build_preview_html(page_payload, patch_payload))

    print(f"Wrote: {page_path}")
    print(f"Wrote: {patch_path}")
    print(f"Wrote: {preview_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
