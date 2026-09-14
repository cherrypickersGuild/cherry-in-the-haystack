#!/usr/bin/env node
/* 노션 CSV → DB 적재 (🔴 쓰기 · 단일 트랜잭션 · 재실행 안전)
   계획 정의: plan.cjs   사전 점검: precheck.cjs   검증: verify.cjs

   원칙 (기획 D9) — **값을 고치지 않는다.** CSV 글자 그대로 cells 에 넣는다.
   분류 통일·중복 정리는 나중에 화면에서 사람이 한다.

   사용: node scripts/source-registry/import-csv.cjs --confirm [--dir <폴더>] [--reimport]
     --reimport  이미 행이 있는 표를 비우고 다시 넣는다 (화면에서 고친 것이 사라진다)
*/
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
const P = require("./plan.cjs");

const args = process.argv.slice(2);
const DIR = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : P.DEFAULT_DIR;
const REIMPORT = args.includes("--reimport");
if (!args.includes("--confirm")) {
  console.log("🔴 DB 에 씁니다. 실행하려면 --confirm 을 붙이세요.");
  process.exit(1);
}

function findCsv(prefix) {
  for (const d of fs.readdirSync(DIR)) {
    const full = path.join(DIR, d);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (f.startsWith(prefix) && f.endsWith("_all.csv")) return path.join(full, f);
    }
  }
  return null;
}
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

(async () => {
  const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, "apps/api/.env"), "utf8").split("\n")
    .filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
  const c = new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
    password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("begin");

  let nRows = 0, nFields = 0, skipped = [];
  try {
    for (const [i, t] of P.TABLES.entries()) {
      const file = findCsv(t.file);
      if (!file) throw new Error(`${t.label}: CSV 없음`);
      const rows = parseCsv(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
      const head = rows[0];
      const body = rows.slice(1).filter((r) => r.some((x) => x.trim()));
      const keys = head.map(P.fieldKey);

      /* 표 — 이름이 같으면 덮어쓴다(재실행 안전) */
      const tr = await c.query(
        `insert into content.source_table(key,label,url_field,sort) values($1,$2,$3,$4)
         on conflict (key) do update set label=excluded.label, url_field=excluded.url_field,
           sort=excluded.sort, updated_at=now() returning id`,
        [t.key, t.label, t.url_field, i]);
      const tableId = tr.rows[0].id;

      /* 칼럼 — (표,이름) 이 같으면 덮어쓴다. 분류에는 표준값을 기본 선택지로 깔아 둔다(D15) */
      for (const [j, key] of keys.entries()) {
        const kind = P.fieldKind(key);
        let options = null;
        if (kind === "multi" || kind === "select") {
          const seen = new Set();
          for (const r of body) String(r[j] ?? "").split(",").map((v) => v.trim()).filter(Boolean).forEach((v) => seen.add(v));
          const list = kind === "multi" ? [...new Set([...P.STANDARD_CATEGORIES, ...seen])] : [...seen];
          options = JSON.stringify(list);
        }
        await c.query(
          `insert into content.source_field(table_id,key,label,kind,options,sort)
           values($1,$2,$3,$4,$5::jsonb,$6)
           on conflict (table_id,key) do update set label=excluded.label, kind=excluded.kind,
             options=excluded.options, sort=excluded.sort, updated_at=now()`,
          [tableId, key, P.LABEL[key] || head[j].trim(), kind, options, j]);
        nFields++;
      }

      /* 행 — 이미 있으면 건드리지 않는다. 화면에서 고친 것을 덮지 않기 위해서다. */
      const have = await c.query("select count(*)::int n from content.source_row where table_id=$1", [tableId]);
      if (have.rows[0].n > 0 && !REIMPORT) { skipped.push(`${t.label}(${have.rows[0].n}행)`); continue; }
      if (have.rows[0].n > 0) await c.query("delete from content.source_row where table_id=$1", [tableId]);

      for (const r of body) {
        const cells = {};
        keys.forEach((k, j) => {
          const raw = String(r[j] ?? "").trim();
          if (!raw) return;
          cells[k] = P.fieldKind(k) === "multi"
            ? raw.split(",").map((v) => v.trim()).filter(Boolean)   // 분류만 쪼갠다
            : raw;                                                  // 나머지는 글자 그대로 (D9)
        });
        await c.query("insert into content.source_row(table_id,cells,origin) values($1,$2::jsonb,'NOTION')",
          [tableId, JSON.stringify(cells)]);
        nRows++;
      }
      console.log(`  ${t.label.padEnd(6)} 칼럼 ${String(keys.length).padStart(2)} · 행 ${String(body.length).padStart(4)}`);
    }
    await c.query("commit");
    console.log(`\n✓ 적재 완료 — 칼럼 ${nFields} · 행 ${nRows}`);
    if (skipped.length) console.log("  건너뜀(이미 행이 있음):", skipped.join(", "), "— 다시 넣으려면 --reimport");
  } catch (e) {
    await c.query("rollback");
    console.error("✗ 롤백했습니다 (DB 변경 0):", e.message);
    process.exitCode = 1;
  } finally { await c.end(); }
})();
