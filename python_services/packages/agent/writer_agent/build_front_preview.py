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
      --bg: #f5efe6;
      --panel: rgba(255, 255, 255, 0.84);
      --card: #fffdf9;
      --ink: #1f1a17;
      --ink-soft: #62564d;
      --line: #dfd1c2;
      --accent: #aa4e22;
      --accent-2: #275d66;
      --accent-3: #8b6f1a;
      --parent-bg: #efe5d1;
      --child-bg: #e0edf0;
      --shadow: 0 20px 40px rgba(39, 28, 17, 0.12);
      --radius: 22px;
    }}

    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      color: var(--ink);
      font-family: "Iowan Old Style", "Palatino Linotype", serif;
      background:
        radial-gradient(circle at top left, rgba(255, 244, 228, 0.95), transparent 35%),
        linear-gradient(180deg, #f8f3ea 0%, #ede2d3 100%);
    }}

    .page {{
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 20px 56px;
    }}

    .layout {{
      display: grid;
      grid-template-columns: minmax(0, 2.1fr) minmax(280px, 0.9fr);
      gap: 24px;
      align-items: start;
    }}

    .sidebar {{
      display: grid;
      gap: 18px;
      position: sticky;
      top: 18px;
    }}

    .hero {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 30px;
      box-shadow: var(--shadow);
      padding: 28px 28px 24px;
    }}

    .eyebrow {{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-soft);
    }}

    .dot {{
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--accent);
    }}

    h1 {{
      margin: 14px 0 10px;
      font-size: clamp(36px, 5vw, 56px);
      line-height: 0.95;
      letter-spacing: -0.04em;
    }}

    .dek {{
      margin: 0;
      max-width: 760px;
      color: var(--ink-soft);
      font-size: 17px;
      line-height: 1.6;
    }}

    .section {{
      margin-top: 24px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 26px;
      box-shadow: var(--shadow);
      padding: 24px;
    }}

    .sidebar-card {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 26px;
      box-shadow: var(--shadow);
      padding: 22px;
    }}

    .sidebar-title {{
      margin: 0 0 14px;
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-soft);
      font-weight: 700;
    }}

    .roadmap-current {{
      border: 3px solid #ca4f73;
      border-radius: 18px;
      padding: 18px 14px 10px;
      text-align: center;
      font-weight: 700;
      color: #ca4f73;
      background: #fffdfd;
    }}

    .roadmap-caption {{
      margin-top: 6px;
      text-align: center;
      font-size: 12px;
      color: #9b8daf;
    }}

    .roadmap-group {{
      margin-top: 18px;
      border: 1px solid #ded6ea;
      border-radius: 16px;
      padding: 14px;
      background: #f2eef8;
    }}

    .roadmap-group.advanced {{
      background: #fbf8ff;
    }}

    .roadmap-group h4 {{
      margin: 0 0 10px;
      text-align: center;
      font-size: 12px;
      color: #8f86a8;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }}

    .roadmap-pills {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }}

    .roadmap-pill {{
      border-radius: 12px;
      border: 1px solid #d7cdea;
      padding: 8px 10px;
      font-size: 13px;
      background: white;
    }}

    .roadmap-pill.advanced {{
      border-color: #b497ef;
      color: #6f57aa;
    }}

    .roadmap-legend {{
      margin-top: 18px;
      display: grid;
      gap: 8px;
      font-size: 13px;
      color: var(--ink-soft);
    }}

    .legend-row {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}

    .legend-dot {{
      width: 15px;
      height: 15px;
      border-radius: 999px;
      border: 3px solid #d8cfdf;
    }}

    .legend-dot.current {{ border-color: #ca4f73; }}
    .legend-dot.advanced {{ border-color: #7f61ca; }}
    .legend-dot.other {{ border-color: #ddd5df; }}

    .section h2 {{
      margin: 0 0 14px;
      font-size: 22px;
      letter-spacing: -0.02em;
    }}

    .section-number {{
      color: var(--accent);
      margin-right: 8px;
    }}

    .overview p {{
      margin: 0 0 14px;
      color: var(--ink-soft);
      line-height: 1.7;
    }}

    .why {{
      font-weight: 700;
      color: var(--ink);
    }}

    .stack {{
      display: grid;
      gap: 14px;
    }}

    .card {{
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 18px;
    }}

    .card h3, .card h4 {{
      margin: 0 0 10px;
      font-size: 18px;
    }}

    .muted {{
      color: var(--ink-soft);
    }}

    .insight {{
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #eadfce;
    }}

    .claim {{
      margin: 0 0 6px;
      font-weight: 700;
      line-height: 1.5;
    }}

    .excerpt {{
      margin: 0 0 8px;
      color: var(--ink-soft);
      line-height: 1.5;
    }}

    .evidence-id {{
      font-size: 12px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--accent-2);
    }}

    .concept-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 14px;
    }}

    .concept-tag {{
      display: inline-block;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }}

    .concept-tag.parent {{ background: var(--parent-bg); color: #74510f; }}
    .concept-tag.child {{ background: var(--child-bg); color: #1d5863; }}

    .ref-grid {{
      display: grid;
      gap: 14px;
    }}

    .ref-order {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 999px;
      background: var(--accent);
      color: white;
      font-weight: 700;
      margin-bottom: 12px;
    }}

    .ref-meta {{
      font-size: 13px;
      color: var(--ink-soft);
      margin-top: 10px;
    }}

    ul {{
      margin: 10px 0 0;
      padding-left: 18px;
      color: var(--ink-soft);
    }}

    @media (max-width: 640px) {{
      .page {{ padding: 16px 12px 32px; }}
      .hero, .section {{ padding: 18px; }}
    }}
    @media (max-width: 980px) {{
      .layout {{ grid-template-columns: 1fr; }}
      .sidebar {{ position: static; }}
    }}
  </style>
</head>
<body>
  <div class=\"page\">
    <div class=\"layout\">
      <main>
        <section class=\"hero\">
          <div class=\"eyebrow\">
            <span>{page_data.get("section") or "Basics"}</span>
            <span class=\"dot\"></span>
            <span>Concept Reader</span>
          </div>
          <h1>{page_data.get("overview", {}).get("title") or page_data.get("topic") or "Untitled Topic"}</h1>
          <p class=\"dek\">{page_data.get("overview", {}).get("summary") or ""}</p>
        </section>

        <section class=\"section overview\">
          <h2><span class=\"section-number\">01</span>Overview</h2>
          <p>{page_data.get("overview", {}).get("summary") or ""}</p>
          <p class=\"why\">{page_data.get("overview", {}).get("why_it_matters") or ""}</p>
        </section>

        <section class=\"section\">
          <h2><span class=\"section-number\">02</span>Cherries</h2>
          <div id=\"cherries\" class=\"stack\"></div>
        </section>

        <section class=\"section\">
          <h2><span class=\"section-number\">03</span>Child Concepts</h2>
          <div id=\"concepts\" class=\"concept-grid\"></div>
        </section>

        <section class=\"section\">
          <h2><span class=\"section-number\">04</span>Progressive References</h2>
          <div id=\"references\" class=\"ref-grid\"></div>
        </section>

        <section class=\"section\">
          <h2><span class=\"section-number\">05</span>Patch Notes</h2>
          <div id=\"updates\" class=\"stack\"></div>
        </section>
      </main>

      <aside class=\"sidebar\">
        <section class=\"sidebar-card\">
          <h3 class=\"sidebar-title\">Learning Roadmap</h3>
          <div class=\"roadmap-current\" id=\"roadmap-current\"></div>
          <div class=\"roadmap-caption\">(you are here)</div>
          <div class=\"roadmap-group\">
            <h4>Prerequisites</h4>
            <div id=\"roadmap-prerequisites\" class=\"roadmap-pills\"></div>
          </div>
          <div class=\"roadmap-group advanced\">
            <h4>Advanced</h4>
            <div id=\"roadmap-advanced\" class=\"roadmap-pills\"></div>
          </div>
          <div id=\"roadmap-legend\" class=\"roadmap-legend\"></div>
        </section>

        <section class=\"sidebar-card\">
          <h3 class=\"sidebar-title\">New in Digest</h3>
          <p class=\"muted\">No digest item connected yet.</p>
        </section>

        <section class=\"sidebar-card\">
          <h3 class=\"sidebar-title\">Knowledge Team</h3>
          <p class=\"muted\">No contributors connected yet.</p>
        </section>
      </aside>
    </div>
  </div>

  <script>
    const pageData = {json.dumps(page_data)};
    const patchData = {json.dumps(patch_data)};

    const cherriesRoot = document.getElementById('cherries');
    (pageData.cherries || []).forEach((cherry) => {{
      const card = document.createElement('div');
      card.className = 'card';
      const insights = (cherry.insights || []).map((insight) => `
        <div class="insight">
          <p class="claim">${{insight.claim || ''}}</p>
          <p class="excerpt">${{insight.excerpt || ''}}</p>
          <div class="evidence-id">${{insight.evidence_id || ''}}</div>
        </div>
      `).join('');
      card.innerHTML = `
        <h3>${{cherry.source || 'Unknown Source'}}</h3>
        __INSIGHTS__
      `.replace('__INSIGHTS__', insights);
      cherriesRoot.appendChild(card);
    }});

    const conceptsRoot = document.getElementById('concepts');
    (pageData.child_concepts || []).forEach((concept) => {{
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <span class="concept-tag ${{concept.relation_type || 'child'}}">${{concept.relation_type || 'child'}}</span>
        <h4>${{concept.label || ''}}</h4>
        <p class="muted">${{concept.description || ''}}</p>
      `;
      conceptsRoot.appendChild(card);
    }});

    const referencesRoot = document.getElementById('references');
    (pageData.progressive_references || []).forEach((ref) => {{
      const card = document.createElement('div');
      card.className = 'card';
      const metaParts = [
        ref.source?.book_title || ref.source?.url || '',
        ref.source?.book_author || ref.source?.author || ''
      ].filter(Boolean);
      card.innerHTML = `
        <div class="ref-order">${{ref.order || ''}}</div>
        <h3>${{ref.title || ''}}</h3>
        <p><strong>What it teaches:</strong> ${{ref.what_it_teaches || ''}}</p>
        <p><strong>Why next:</strong> ${{ref.why_next || ''}}</p>
        <div class="ref-meta">${{metaParts.join(' · ')}}</div>
      `;
      referencesRoot.appendChild(card);
    }});

    const roadmap = pageData.learning_roadmap || {{}};
    const roadmapCurrent = document.getElementById('roadmap-current');
    roadmapCurrent.textContent = roadmap.current || pageData.topic || '';

    const prereqRoot = document.getElementById('roadmap-prerequisites');
    (roadmap.prerequisites || []).forEach((label) => {{
      const pill = document.createElement('div');
      pill.className = 'roadmap-pill';
      pill.textContent = label;
      prereqRoot.appendChild(pill);
    }});

    const advancedRoot = document.getElementById('roadmap-advanced');
    (roadmap.advanced || []).forEach((label) => {{
      const pill = document.createElement('div');
      pill.className = 'roadmap-pill advanced';
      pill.textContent = label;
      advancedRoot.appendChild(pill);
    }});

    const legendRoot = document.getElementById('roadmap-legend');
    (roadmap.legend || []).forEach((item) => {{
      const row = document.createElement('div');
      row.className = 'legend-row';
      row.innerHTML = `<span class="legend-dot ${{item.tone || 'other'}}"></span><span>${{item.label || ''}}</span>`;
      legendRoot.appendChild(row);
    }});

    const updatesRoot = document.getElementById('updates');
    (patchData.updates || []).forEach((update) => {{
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>${{update.title || 'Update'}}</h3>
        <p class="muted">${{update.body || ''}}</p>
      `;
      updatesRoot.appendChild(card);
    }});

    if (patchData.patch_notes && patchData.patch_notes.length) {{
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>Patch Notes</h3>
        <ul>${{patchData.patch_notes.map((note) => `<li>${{note}}</li>`).join('')}}</ul>
      `;
      updatesRoot.appendChild(card);
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
