#!/usr/bin/env node
/* RAG 개념 페이지 발행 (🔴 쓰기) — 단일 트랜잭션 · 재실행 안전
   넣는 것: content.concept_page 1행 + paragraph_concept_link 7행(체리)
   사용: node scripts/ontology/seed-rag-page.cjs --confirm */
const fs=require("fs"), path=require("path");
const ROOT=path.resolve(__dirname,"../..");
const { Client }=require(path.join(ROOT,"apps/api/node_modules/pg"));
if(!process.argv.includes("--confirm")){ console.error("안전장치: --confirm 필요"); process.exit(1); }
const env=Object.fromEntries(fs.readFileSync(path.join(ROOT,"apps/api/.env"),"utf8")
  .split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1).trim()]));

const CHERRIES=[
 { chunk:"019e785e-8a20-702c-9e24-cc09a570c582",
   insight:"Retrieval starts before retrieval. A query router decides where to look — vector DB, a SQL database via query translation, or a web API — and, critically, whether context is needed at all, avoiding redundant calls to external storage. The same router can select the prompt template for the task." },
 { chunk:"019e785e-8a23-7196-94e1-fc63b0386a53",
   insight:"Chunking by tokens (using the generator's own tokenizer) makes chunks easier to work with downstream, since sizes line up with the model's limits. The cost is that token boundaries fall at arbitrary points in the text — the unit that is convenient for the model is not the unit that carries meaning." },
 { chunk:"019e785e-8a25-70af-897a-13f2e80f9e67",
   insight:"Hybrid search blends keyword and vector retrieval. Keyword search wins when the answer must contain an exact term; vector search wins on general semantic similarity and struggles with exact matches. An alpha parameter controls the balance between the two." },
 { chunk:"019e785e-8a22-7e93-b4ad-43f0262493a2",
   insight:"Context reranking is not search reranking. In search, the exact rank of a result is what matters. In context, order still matters but for a different reason — models process documents at the beginning and end of a context better than those buried in the middle." },
 { chunk:"019e785e-8a2b-7541-8732-67d18429afbd",
   insight:"Contextual Retrieval (Anthropic, 2024): before indexing, generate a short 50-100 token description that situates each chunk within its original document, prepend it to the chunk, and index the augmented chunk. The retriever then sees a passage that carries its own context." },
 { chunk:"019e785e-8a3d-75b7-94a3-a3e3dfea76fe",
   insight:"There is no universal workflow. After simple term-based retrieval, whether to move to more complex retrieval or to finetuning depends on the application's actual failure modes — and evaluation criteria should be defined before any adaptation step, not after." },
 { chunk:"019e785e-8a29-766a-99da-917044dcdefd",
   insight:"Million-token context windows enable retrieval-free generation for large documents, and index-free RAG pushes chunking and relevance scoring inside the long-context model itself — no external vector store or inverted index. Simpler pipelines, different trade-offs." },
];

const OVERVIEW=`Retrieval-Augmented Generation supplies a language model with documents fetched at **inference time** instead of encoding knowledge into its weights. A query is routed to one or more external stores, relevant passages are retrieved and placed in the context window, and the model generates its answer grounded in that retrieved material.

**Why it matters:** knowledge that changes weekly, or that belongs to one organization, cannot be baked into a model economically. RAG lets an application stay current and domain-specific without retraining, and it gives every claim a traceable source — which is what makes hallucination detectable rather than merely likely.

**The shape of the work:** route → retrieve → rerank → generate. The interesting engineering is not in the generation step. It is in chunking strategy, retrieval quality, and how much of a finite context window each retrieved passage deserves.`;

const REFS=[
 { order:1, stage:"START HERE", title:'AI Engineering — Ch.6 "RAG and Agents"', url:null, inLibrary:true, byline:"Chip Huyen",
   teaches:"The retrieval-first mental model, and why chunking and reranking decide output quality more than model choice does.",
   addsOverPrevious:"foundational mental model" },
 { order:2, stage:"NEXT →", title:'LLM Engineers Handbook — Ch.4 "RAG Feature Pipeline"', url:null, inLibrary:true, byline:null,
   teaches:"The pipeline as running code — query routing, batch vs streaming ingestion, hybrid search with an alpha parameter.",
   addsOverPrevious:"implementation and operations" },
 { order:3, stage:"THEN →", title:'Anthropic — "Introducing Contextual Retrieval" (2024)', url:"https://www.anthropic.com/news/contextual-retrieval", inLibrary:false, byline:null,
   teaches:"A concrete technique for the failure the first two only name — chunks that lose their meaning once separated from the document.",
   addsOverPrevious:"current state-of-the-art technique" },
 { order:4, stage:"DEEP DIVE →", title:'Building Applications with AI Agents — Ch.6 "Knowledge and Memory"', url:null, inLibrary:true, byline:"Michael Albada",
   teaches:"Where RAG is heading — GraphRAG over knowledge graphs, and whether million-token contexts make external retrieval unnecessary.",
   addsOverPrevious:"the argument against the previous three" },
];

(async()=>{
const c=new Client({host:env.LOCAL_DB_HOST,port:+env.LOCAL_DB_PORT,user:env.LOCAL_DB_USER,
  password:env.LOCAL_DB_PASSWORD,database:env.LOCAL_DB_NAME,ssl:{rejectUnauthorized:false},statement_timeout:60000});
await c.connect();
const before=await c.query(`SELECT (SELECT count(*)::int FROM content.concept_page) p,
  (SELECT count(*)::int FROM handbook.paragraph_concept_link) l`);
console.log("■ 실행 전:", JSON.stringify(before.rows[0]));

try{
  await c.query("BEGIN");
  const cid=(await c.query(
    `SELECT id FROM handbook.concept WHERE ontology_node='RAG' AND revoked_at IS NULL`)).rows[0]?.id;
  if(!cid) throw new Error("RAG 개념을 찾을 수 없음");

  const p=await c.query(`INSERT INTO content.concept_page
    (id, concept_slug, concept_name, content_md, is_published, published_at,
     related_concepts, progressive_refs, surface, ontology_node, section, created_at, updated_at)
    VALUES (gen_random_uuid(), 'rag', 'Retrieval-Augmented Generation (RAG)', $1, true, now(),
            '[]'::jsonb, $2::jsonb, 'learning', 'RAG', 'BASICS', now(), now())
    ON CONFLICT (concept_slug) DO NOTHING`, [OVERVIEW, JSON.stringify(REFS)]);
  console.log(`   발행 페이지 ${p.rowCount}행`);

  let n=0, miss=[];
  for(const [i,ch] of CHERRIES.entries()){
    const ok=(await c.query(`SELECT 1 FROM handbook.paragraph_chunk WHERE id=$1 AND revoked_at IS NULL`,[ch.chunk])).rowCount;
    if(!ok){ miss.push(ch.chunk); continue; }
    const r=await c.query(`INSERT INTO handbook.paragraph_concept_link
      (id, paragraph_chunk_id, concept_id, is_primary, insight, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, now(), now())
      ON CONFLICT (paragraph_chunk_id, concept_id) DO NOTHING`, [ch.chunk, cid, i===0, ch.insight]);
    n+=r.rowCount;
  }
  if(miss.length) throw new Error(`존재하지 않는 문단 ${miss.length}건: ${miss.join(", ")}`);
  console.log(`   체리 연결 ${n}행`);
  await c.query("COMMIT");
  console.log("   ✅ 커밋 완료");
}catch(e){ await c.query("ROLLBACK"); console.error("   ❌ 실패 — 전부 롤백:", e.message); await c.end(); process.exit(2); }

const after=await c.query(`SELECT (SELECT count(*)::int FROM content.concept_page) p,
  (SELECT count(*)::int FROM handbook.paragraph_concept_link) l`);
console.log("■ 실행 후:", JSON.stringify(after.rows[0]));
await c.end();
})().catch(e=>{console.error("실패:",e.message);process.exit(1)});
