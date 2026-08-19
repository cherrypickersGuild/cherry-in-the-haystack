#!/usr/bin/env node
/* 스냅샷 JSON → Postgres (🔴 쓰기). 단일 트랜잭션 · INSERT 만 · 재실행 안전.
   기획: apps/docs/ontology-migration/2-implementation-guide.md §3-3
   사용: node scripts/ontology/import-postgres.cjs --confirm */
const fs=require("fs"), path=require("path");
const ROOT=path.resolve(__dirname,"../..");
const { Client }=require(path.join(ROOT,"apps/api/node_modules/pg"));
const SNAP=JSON.parse(fs.readFileSync(path.join(ROOT,"apps/docs/ontology-migration/ontology-snapshot.json"),"utf8"));
const IMPORT_SOURCE="graphdb-import";

if(!process.argv.includes("--confirm")){ console.error("안전장치: --confirm 필요"); process.exit(1); }

const env=Object.fromEntries(fs.readFileSync(path.join(ROOT,"apps/api/.env"),"utf8")
  .split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1).trim()]));

(async()=>{
const c=new Client({host:env.LOCAL_DB_HOST,port:+env.LOCAL_DB_PORT,user:env.LOCAL_DB_USER,
  password:env.LOCAL_DB_PASSWORD,database:env.LOCAL_DB_NAME,ssl:{rejectUnauthorized:false},statement_timeout:120000});
await c.connect();

const before=await c.query(`SELECT (SELECT count(*)::int FROM handbook.concept) a,
  (SELECT count(*)::int FROM handbook.concept_alias) b,
  (SELECT count(*)::int FROM handbook.concept_relation) d,
  (SELECT count(*)::int FROM handbook.paragraph_chunk) e,
  (SELECT count(*)::int FROM public.key_ideas) f`);
console.log("■ 실행 전:", JSON.stringify(before.rows[0]));

try{
  await c.query("BEGIN");

  /* ① 개념 — id 를 직접 생성해 넣는다(이 표는 기본값이 없다: S3 1회차 결함 ①) */
  let ins=0;
  for(const part of chunk(SNAP.concepts,100)){
    const ph=[], vals=[];
    part.forEach((x,i)=>{
      const o=i*3;
      ph.push(`(gen_random_uuid(), $${o+1}, $${o+2}, $${o+3}, true, now(), now())`);
      vals.push(x.label, x.description, x.node);
    });
    const r=await c.query(`INSERT INTO handbook.concept
      (id, canonical_name, description, ontology_node, is_active, created_at, updated_at)
      VALUES ${ph.join(",")} ON CONFLICT DO NOTHING`, vals);
    ins+=r.rowCount;
  }
  console.log(`   개념 삽입 ${ins}`);

  /* id 매핑 (ontology_node → concept id) — 살아있는 행만(S3 5회차 결함 ⑪) */
  const map=new Map((await c.query(
    `SELECT ontology_node, id FROM handbook.concept
      WHERE ontology_node IS NOT NULL AND revoked_at IS NULL`)).rows.map(r=>[r.ontology_node,r.id]));
  console.log(`   id 매핑 ${map.size}건`);

  /* ② 별칭 */
  let ali=0;
  for(const x of SNAP.concepts){
    for(const a of x.aliases){
      const id=map.get(x.node); if(!id) continue;
      const r=await c.query(`INSERT INTO handbook.concept_alias
        (id, concept_id, alias_text, alias_type, locale, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, 'VARIANT', 'en', now(), now())
        ON CONFLICT DO NOTHING`,[id,a]);
      ali+=r.rowCount;
    }
  }
  console.log(`   별칭 삽입 ${ali}`);

  /* ③ 관계 — from 은 to 의 <type> 이다 */
  let rel=0, skipped=[];
  for(const r0 of SNAP.relations){
    const f=map.get(r0.from), t=map.get(r0.to);
    if(!f||!t){ skipped.push(`${r0.from}→${r0.to}`); continue; }
    if(f===t){ skipped.push(`self:${r0.from}`); continue; }
    const r=await c.query(`INSERT INTO handbook.concept_relation
      (id, from_concept_id, to_concept_id, relation_type, origin, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3::handbook.concept_relation_enum, $4, now(), now())
      ON CONFLICT DO NOTHING`,[f,t,r0.type,IMPORT_SOURCE]);
    rel+=r.rowCount;
  }
  console.log(`   관계 삽입 ${rel}` + (skipped.length?`  (건너뜀 ${skipped.length}: ${skipped.slice(0,3).join(", ")})`:""));

  await c.query("COMMIT");
  console.log("   ✅ 커밋 완료");
}catch(e){
  await c.query("ROLLBACK");
  console.error("   ❌ 실패 — 전부 롤백:", e.message);
  await c.end(); process.exit(2);
}

const after=await c.query(`SELECT (SELECT count(*)::int FROM handbook.concept) a,
  (SELECT count(*)::int FROM handbook.concept_alias) b,
  (SELECT count(*)::int FROM handbook.concept_relation) d,
  (SELECT count(*)::int FROM handbook.paragraph_chunk) e,
  (SELECT count(*)::int FROM public.key_ideas) f`);
console.log("■ 실행 후:", JSON.stringify(after.rows[0]));
await c.end();

function chunk(a,n){const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o}
})().catch(e=>{console.error("실패:",e.message);process.exit(1)});
