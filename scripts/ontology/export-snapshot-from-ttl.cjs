#!/usr/bin/env node
/* TTL → ontology-snapshot.json (🔵 파일만) — 정본 방향의 두 번째 단계
   순서: TTL → **JSON** → DB
   사용: node scripts/ontology/export-snapshot-from-ttl.cjs [ttl] [out] */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const io = require("./ttl-io.cjs");
const DATA = path.join(ROOT, "python_services/packages/idea_to_graph_ontology/data");
const TTL = process.argv[2] || path.join(DATA, "llm_ontology_v4-2026-08-25.ttl");
const OUT = process.argv[3] || path.join(ROOT, "apps/docs/ontology-migration/ontology-snapshot.json");

const doc = io.parse(fs.readFileSync(TTL, "utf8"));
const aliOf = {}; doc.aliases.forEach((a) => (aliOf[a.node] = aliOf[a.node] || []).push(a.text));
const snap = {
  exportedFrom: path.basename(TTL) + " (정본 TTL)",
  infer: false,
  counts: { concepts: doc.concepts.size, relations: doc.rels.length, aliases: doc.aliases.length,
            withDescription: [...doc.concepts.values()].filter((c) => c.description).length },
  concepts: [...doc.concepts.keys()].sort().map((n) => {
    const c = doc.concepts.get(n);
    return { node: c.node, label: c.name, description: c.description, aliases: (aliOf[n] || []).slice().sort() };
  }),
  relations: doc.rels.slice().sort((a, b) => (a.from + a.type + a.to).localeCompare(b.from + b.type + b.to))
    .map((r) => ({ from: r.from, to: r.to, type: r.type })),
};
fs.writeFileSync(OUT, JSON.stringify(snap, null, 1));
console.log("✅ JSON:", OUT);
console.log(`   개념 ${snap.counts.concepts} · 관계 ${snap.counts.relations} · 별칭 ${snap.counts.aliases} · 설명보유 ${snap.counts.withDescription}`);
console.log("   exportedFrom:", snap.exportedFrom);
console.log("\n다음: node scripts/ontology/sync-postgres.cjs          (JSON → DB · 먼저 dry-run)");
