#!/usr/bin/env node
/* 노션 → DB 이관 · 사전 점검 (🔵 읽기 전용 · SELECT 만 · 쓰기 없음)
   계획 정의: plan.cjs   적재: import-csv.cjs   검증: verify.cjs

   하나라도 실패하면 종료코드 1. 이 상태로 적재하면 안 된다.
   사용: node scripts/source-registry/precheck.cjs [--dir <노션 내보내기 폴더>]
*/
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
const P = require("./plan.cjs");

const argDir = process.argv.indexOf("--dir");
const DIR = argDir > -1 ? process.argv[argDir + 1] : P.DEFAULT_DIR;

let fail = 0, warn = 0;
const bad = (m) => { console.log("  ✗ " + m); fail++; };
const wrn = (m) => { console.log("  ! " + m); warn++; };
const ok  = (m) => console.log("  ✓ " + m);

/** 노션 폴더들에서 `_all.csv` 를 찾는다. 폴더 이름이 제각각이라 파일 이름으로 찾는다. */
function findCsv(prefix) {
  const hits = [];
  for (const d of fs.readdirSync(DIR)) {
    const full = path.join(DIR, d);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (f.startsWith(prefix) && f.endsWith("_all.csv")) hits.push(path.join(full, f));
    }
  }
  return hits;
}

/** 따옴표·줄바꿈이 든 노션 CSV 를 그대로 읽는다. */
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

(async () => {
  console.log("■ 노션 내보내기 폴더:", DIR);
  if (!fs.existsSync(DIR)) { bad("폴더가 없다"); process.exit(1); }

  const summary = [];
  console.log("\n■ CSV 읽기");
  for (const t of P.TABLES) {
    const hits = findCsv(t.file);
    if (hits.length === 0) { bad(`${t.label}: \`${t.file}…_all.csv\` 를 못 찾았다`); continue; }
    if (hits.length > 1) wrn(`${t.label}: 같은 이름 파일이 ${hits.length}개 — 첫 번째를 쓴다`);

    const raw = fs.readFileSync(hits[0], "utf8").replace(/^﻿/, "");
    const rows = parseCsv(raw);
    const head = rows[0] || [];
    const body = rows.slice(1).filter((r) => r.some((c) => c.trim()));

    // 칼럼 이름 충돌 — 서로 다른 머리줄이 같은 이름이 되면 칼럼이 사라진다
    const seen = {};
    head.forEach((h) => { const k = P.fieldKey(h); (seen[k] = seen[k] || []).push(h); });
    const collide = Object.entries(seen).filter(([, v]) => v.length > 1);
    const empty = head.filter((h) => !P.fieldKey(h));
    const nonAscii = Object.keys(seen).filter((k) => /[^a-z0-9_]/.test(k));

    if (collide.length) bad(`${t.label}: 칼럼이 뭉개진다 — ` + collide.map(([k, v]) => `${k} ← ${v.join("/")}`).join(", "));
    if (empty.length) bad(`${t.label}: 이름이 빈 칼럼 — ${empty.join(", ")}`);
    if (nonAscii.length) bad(`${t.label}: 칼럼 이름에 못 쓰는 글자 — ${nonAscii.join(", ")}`);

    const keys = head.map(P.fieldKey);
    if (t.url_field && !keys.includes(t.url_field)) {
      bad(`${t.label}: 대표 주소 칼럼 \`${t.url_field}\` 가 이 표에 없다 (있는 것: ${keys.join(", ")})`);
    }
    summary.push({ t, file: path.basename(hits[0]), cols: head.length, rows: body.length, keys });
  }

  if (summary.length === P.TABLES.length) ok(`표 ${summary.length}개 · 행 합계 ${summary.reduce((n, s) => n + s.rows, 0)}`);

  console.log("\n■ 표별 내역");
  summary.forEach((s) => console.log(`   ${s.t.label.padEnd(6)} ${String(s.rows).padStart(4)}행 · 칼럼 ${String(s.cols).padStart(2)} · 주소칼럼 ${s.t.url_field} · ${s.keys.slice(0, 6).join(", ")}${s.keys.length > 6 ? " …" : ""}`));

  console.log("\n■ DB 상태");
  const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, "apps/api/.env"), "utf8").split("\n")
    .filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
  const c = new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
    password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false } });
  await c.connect();
  for (const tbl of ["source_table", "source_field", "source_row"]) {
    const r = await c.query(`select count(*)::int n from content.${tbl}`);
    if (r.rows[0].n === 0) ok(`content.${tbl} 비어 있음`);
    else wrn(`content.${tbl} 에 이미 ${r.rows[0].n}행 있다 — 적재는 재실행 안전이라 덮어쓴다`);
  }
  const e = await c.query("select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='source_type_enum' and e.enumlabel='SUBSTACK'");
  e.rowCount ? ok("enum 에 SUBSTACK 있음") : bad("enum 에 SUBSTACK 이 없다 (D11)");
  const src = await c.query("select count(*)::int n from content.source");
  ok(`content.source ${src.rows[0].n}행 — 이번 작업으로 바뀌면 안 된다 (D6)`);
  await c.end();

  console.log(`\n■ 결과: 실패 ${fail} · 경고 ${warn}`);
  console.log(fail ? "  → 이 상태로 적재하면 안 된다." : "  → 적재해도 된다: node scripts/source-registry/import-csv.cjs --confirm");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
