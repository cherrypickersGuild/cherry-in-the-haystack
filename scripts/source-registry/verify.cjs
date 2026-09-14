#!/usr/bin/env node
/* 적재 후 검증 (🔵 읽기 전용)
   CSV 와 DB 를 대조한다. 검수표 2-3 · 2-4 · 2-2a~d 가 이 스크립트로 판정된다.
   사용: node scripts/source-registry/verify.cjs [--dir <폴더>]
*/
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
const P = require("./plan.cjs");
const DIR = process.argv.includes("--dir") ? process.argv[process.argv.indexOf("--dir") + 1] : P.DEFAULT_DIR;

let fail = 0;
const ok = (m) => console.log("  ✓ " + m);
const bad = (m) => { console.log("  ✗ " + m); fail++; };

function findCsv(p) { for (const d of fs.readdirSync(DIR)) { const f = path.join(DIR, d); if (!fs.statSync(f).isDirectory()) continue;
  for (const x of fs.readdirSync(f)) if (x.startsWith(p) && x.endsWith("_all.csv")) return path.join(f, x); } return null; }
function parseCsv(text) { const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else if (c !== "\r") cell += c; }
  if (cell || row.length) { row.push(cell); rows.push(row); } return rows; }

(async () => {
  const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, "apps/api/.env"), "utf8").split("\n")
    .filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
  const c = new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
    password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log("■ 행 수 대조 (검수 2-3)");
  let csvTotal = 0, dbTotal = 0, samples = [];
  for (const t of P.TABLES) {
    const rows = parseCsv(fs.readFileSync(findCsv(t.file), "utf8").replace(/^﻿/, ""));
    const head = rows[0], body = rows.slice(1).filter((r) => r.some((x) => x.trim()));
    const keys = head.map(P.fieldKey);
    const db = await c.query(`select r.cells from content.source_row r join content.source_table t on t.id=r.table_id
      where t.key=$1 and r.revoked_at is null`, [t.key]);
    csvTotal += body.length; dbTotal += db.rowCount;
    if (db.rowCount !== body.length) bad(`${t.label}: CSV ${body.length} ≠ DB ${db.rowCount}`);
    /* 값 대조 (검수 2-4) — 이름으로 짝짓지 않는다.
       CSV 안에 이름이 같은 행이 실제로 있다(발굴 후보 2건). 이름으로 맞추면 헛일치가 난다.
       행 하나를 한 줄 글자로 만들어 **묶음끼리** 비교한다 — 순서·중복과 무관하게 정확하다. */
    const canon = (cells) => JSON.stringify(Object.keys(cells).sort().map((k) =>
      [k, Array.isArray(cells[k]) ? cells[k].join("|") : cells[k]]));
    const want = body.map((r) => { const cells = {};
      keys.forEach((k, j) => { const v = String(r[j] ?? "").trim(); if (!v) return;
        cells[k] = P.fieldKind(k) === "multi" ? v.split(",").map((x) => x.trim()).filter(Boolean) : v; });
      return canon(cells); }).sort();
    const got = db.rows.map((r) => canon(r.cells)).sort();
    let diff = want.filter((x, i) => x !== got[i]).length;
    diff ? bad(`${t.label}: 내용이 다른 행 ${diff}개`) : samples.push(t.label);
  }
  csvTotal === dbTotal ? ok(`합계 CSV ${csvTotal} = DB ${dbTotal}`) : bad(`합계 CSV ${csvTotal} ≠ DB ${dbTotal}`);
  if (samples.length === P.TABLES.length) ok(`값이 CSV 와 글자 그대로 같다 — ${samples.length}개 표 전부 (검수 2-4)`);

  console.log("\n■ 칼럼 규칙 (검수 2-2a~d)");
  const wf = await c.query(`select count(distinct f.key)::int n from content.source_field f where f.key like 'why%'`);
  wf.rows[0].n === 1 ? ok("`Why I Follow`·`Why I follow`·`Why I follow ` 가 한 칼럼(why_follow)으로 모였다")
                     : bad(`why* 칼럼이 ${wf.rows[0].n}개로 갈렸다`);
  const arc = await c.query(`select f.key from content.source_field f join content.source_table t on t.id=f.table_id
    where t.key='archive' and f.key in ('url','website','substack','linkedin','youtube','threads') order by 1`);
  arc.rowCount === 6 ? ok("아카이브의 플랫폼 칼럼 6개가 각각 남았다 (url 하나로 안 뭉쳐짐)")
                     : bad(`아카이브 플랫폼 칼럼이 ${arc.rowCount}개만 남았다`);
  const nonascii = await c.query(`select key from content.source_field where key ~ '[^a-z0-9_]'`);
  nonascii.rowCount === 0 ? ok("칼럼 이름에 한글·공백·특수문자 없음") : bad(`이상한 칼럼 이름 ${nonascii.rows.map(r=>r.key).join(", ")}`);
  const uf = await c.query(`select t.key, t.url_field from content.source_table t
    where not exists (select 1 from content.source_field f where f.table_id=t.id and f.key=t.url_field)`);
  uf.rowCount === 0 ? ok("표 11개 모두 대표 주소 칼럼이 실재한다") : bad(`대표 주소 칼럼 없음: ${uf.rows.map(r=>r.key).join(", ")}`);

  console.log("\n■ 건드리면 안 되는 것 (검수 1-2 · 7-4)");
  const src = await c.query("select count(*)::int n from content.source");
  src.rows[0].n === 20 ? ok("content.source 20행 그대로") : bad(`content.source 가 ${src.rows[0].n}행으로 바뀌었다`);

  console.log(`\n■ 결과: 실패 ${fail}`);
  await c.end();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
