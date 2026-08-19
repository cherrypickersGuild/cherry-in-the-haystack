#!/usr/bin/env node
/* 이관 검증 — 스냅샷 ↔ Postgres 라운드트립 대조 (읽기 전용)
   기획: apps/docs/ontology-migration/2-implementation-guide.md §3-4 */
const fs=require("fs"), path=require("path");
const ROOT=path.resolve(__dirname,"../..");
const { Client }=require(path.join(ROOT,"apps/api/node_modules/pg"));
const SNAP=JSON.parse(fs.readFileSync(path.join(ROOT,"apps/docs/ontology-migration/ontology-snapshot.json"),"utf8"));
const env=Object.fromEntries(fs.readFileSync(path.join(ROOT,"apps/api/.env"),"utf8")
  .split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1).trim()]));
(async()=>{
const c=new Client({host:env.LOCAL_DB_HOST,port:+env.LOCAL_DB_PORT,user:env.LOCAL_DB_USER,
  password:env.LOCAL_DB_PASSWORD,database:env.LOCAL_DB_NAME,ssl:{rejectUnauthorized:false}});
await c.connect();
let fail=0; const ok=(b,m)=>{console.log(`   ${b?"✅":"❌"} ${m}`); if(!b)fail++;};

/* 1. 건수 */
const n=(await c.query(`SELECT
  (SELECT count(*)::int FROM handbook.concept WHERE revoked_at IS NULL) c,
  (SELECT count(*)::int FROM handbook.concept_alias WHERE revoked_at IS NULL) a,
  (SELECT count(*)::int FROM handbook.concept_relation WHERE revoked_at IS NULL) r`)).rows[0];
console.log("■ 건수 대조");
ok(n.c===SNAP.counts.concepts, `개념 ${n.c} = 스냅샷 ${SNAP.counts.concepts}`);
ok(n.a===SNAP.counts.aliases,  `별칭 ${n.a} = 스냅샷 ${SNAP.counts.aliases}`);
ok(n.r===SNAP.counts.relations,`관계 ${n.r} = 스냅샷 ${SNAP.counts.relations}`);

/* 2. 라운드트립 — 이름·설명 완전 일치 */
console.log("■ 내용 라운드트립");
const rows=(await c.query(`SELECT ontology_node, canonical_name, description
                           FROM handbook.concept WHERE revoked_at IS NULL`)).rows;
const db=new Map(rows.map(r=>[r.ontology_node,r]));
let mismatch=[];
for(const s of SNAP.concepts){
  const d=db.get(s.node);
  if(!d){ mismatch.push(`${s.node}: 없음`); continue; }
  if(d.canonical_name!==s.label) mismatch.push(`${s.node}: 이름 "${d.canonical_name}"≠"${s.label}"`);
  if((d.description||null)!==(s.description||null)) mismatch.push(`${s.node}: 설명 불일치`);
}
ok(mismatch.length===0, `이름·설명 불일치 ${mismatch.length}건` + (mismatch.length?` (${mismatch.slice(0,3).join(" / ")})`:""));

/* 3. 관계 방향 */
console.log("■ 관계 방향");
const rel=(await c.query(`SELECT cf.ontology_node f, ct.ontology_node t, r.relation_type::text ty
  FROM handbook.concept_relation r
  JOIN handbook.concept cf ON cf.id=r.from_concept_id
  JOIN handbook.concept ct ON ct.id=r.to_concept_id
  WHERE r.revoked_at IS NULL`)).rows;
const key=x=>`${x.f}|${x.t}|${x.ty||x.type}`;
const dbSet=new Set(rel.map(key)), snSet=new Set(SNAP.relations.map(x=>`${x.from}|${x.to}|${x.type}`));
const only1=[...snSet].filter(k=>!dbSet.has(k)), only2=[...dbSet].filter(k=>!snSet.has(k));
ok(only1.length===0 && only2.length===0,
   `방향 포함 완전 일치 (스냅샷에만 ${only1.length} · DB에만 ${only2.length})`);

/* 4. 샘플 육안 — RAG 의 하위 */
console.log("■ 샘플: RAG 의 하위 개념");
const rag=(await c.query(`SELECT cf.canonical_name nm, r.relation_type::text ty
  FROM handbook.concept_relation r
  JOIN handbook.concept cf ON cf.id=r.from_concept_id
  JOIN handbook.concept ct ON ct.id=r.to_concept_id
  WHERE ct.ontology_node='RAG' AND r.revoked_at IS NULL ORDER BY 2,1`)).rows;
rag.forEach(x=>console.log(`     ${x.nm} (${x.ty})`));
ok(rag.length>=7, `${rag.length}건 (기대 7 이상)`);

/* 5. 사이클 (SUBTOPIC 만) */
const cyc=(await c.query(`WITH RECURSIVE up(start_id, cur_id, depth, path) AS (
    SELECT r.from_concept_id, r.to_concept_id, 1, ARRAY[r.from_concept_id, r.to_concept_id]
      FROM handbook.concept_relation r WHERE r.relation_type='SUBTOPIC' AND r.revoked_at IS NULL
    UNION ALL
    SELECT u.start_id, r.to_concept_id, u.depth+1, u.path||r.to_concept_id
      FROM up u JOIN handbook.concept_relation r ON r.from_concept_id=u.cur_id
      WHERE r.relation_type='SUBTOPIC' AND r.revoked_at IS NULL
        AND u.depth < 20 AND NOT r.to_concept_id = ANY(u.path))
  SELECT count(*)::int n FROM up WHERE cur_id = start_id`)).rows[0].n;
console.log("■ 계층 사이클");
ok(cyc===0, `사이클 ${cyc}건`);

/* 6. 기존 데이터 무영향 */
const keep=(await c.query(`SELECT (SELECT count(*)::int FROM handbook.paragraph_chunk) a,
  (SELECT count(*)::int FROM public.key_ideas) b,
  (SELECT count(*)::int FROM content.concept_page) d`)).rows[0];
console.log("■ 기존 데이터");
ok(keep.a===3054 && keep.b===3067 && keep.d===1, `책문단 ${keep.a} · 구데이터 ${keep.b} · 페이지 ${keep.d} (불변)`);

console.log(fail===0 ? "\n✅ 검증 통과" : `\n❌ 실패 ${fail}건`);
await c.end(); process.exit(fail?2:0);
})().catch(e=>{console.error("실패:",e.message);process.exit(1)});
