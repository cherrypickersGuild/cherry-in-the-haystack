#!/usr/bin/env node
/* GraphDB → 스냅샷 JSON (읽기 전용)
   기획: apps/docs/ontology-migration/2-implementation-guide.md §3-1
   이후 단계는 GraphDB 를 다시 묻지 않고 이 파일만 본다(재현·감사 가능). */
const fs=require("fs"), os=require("os"), path=require("path");
const { execFileSync }=require("child_process");
const EP=process.env.GRAPHDB_URL||"http://localhost:7200";
const REPO=process.env.GRAPHDB_REPO||"llm-ontology";
const OUT=process.argv[2]||path.resolve(__dirname,"../../apps/docs/ontology-migration/ontology-snapshot.json");

function sparql(q){
  const tmp=path.join(os.tmpdir(),`exp-${process.pid}.rq`);
  fs.writeFileSync(tmp,q);
  try{
    return JSON.parse(execFileSync("curl",["-s","-G","--data-urlencode",`query@${tmp}`,
      "--data-urlencode","infer=false","-H","Accept: application/sparql-results+json",
      `${EP}/repositories/${REPO}`],{maxBuffer:1<<28}).toString()).results.bindings;
  } finally { try{fs.unlinkSync(tmp)}catch{} }
}
const P=`PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX llm: <http://example.org/llm-ontology#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>`;
const local=(iri)=>iri.split("#").pop();

// 개념 (라벨은 클래스당 1개여야 정상)
const concepts={};
for(const b of sparql(`${P}\nSELECT ?s ?l WHERE { ?s a owl:Class ; rdfs:label ?l }`)){
  const id=local(b.s.value);
  (concepts[id]=concepts[id]||{node:id,labels:[],description:null,aliases:[]}).labels.push(b.l.value);
}
for(const b of sparql(`${P}\nSELECT ?s ?d WHERE { ?s llm:description ?d }`)){
  const id=local(b.s.value); if(concepts[id]) concepts[id].description=b.d.value;
}
for(const b of sparql(`${P}\nSELECT ?s ?a WHERE { ?s skos:altLabel ?a }`)){
  const id=local(b.s.value); if(concepts[id]) concepts[id].aliases.push(b.a.value);
}

// 관계 (IRI 기준 — 라벨로 조인하면 중복된다: S3 2회차 결함 ④)
const REL=[["rdfs:subClassOf","SUBTOPIC"],["llm:isPrerequisiteOf","PREREQUISITE"],
           ["llm:extends","EXTENDS"],["llm:relatedTo","RELATED"]];
const relations=[];
for(const [pred,type] of REL){
  for(const b of sparql(`${P}\nSELECT ?f ?t WHERE { ?f ${pred} ?t }`)){
    relations.push({from:local(b.f.value), to:local(b.t.value), type});
  }
}

const list=Object.values(concepts);
const bad=list.filter(c=>c.labels.length!==1);
const snap={
  exportedFrom:`${EP}/repositories/${REPO}`,
  infer:false,
  counts:{concepts:list.length, relations:relations.length,
          aliases:list.reduce((s,c)=>s+c.aliases.length,0),
          withDescription:list.filter(c=>c.description).length},
  concepts:list.map(c=>({node:c.node,label:c.labels[0],description:c.description,aliases:c.aliases})),
  relations,
};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT, JSON.stringify(snap,null,1));
console.log("✅ 스냅샷:",OUT);
console.log("   개념",snap.counts.concepts,"· 관계",snap.counts.relations,
            "· 별칭",snap.counts.aliases,"· 설명보유",snap.counts.withDescription);
console.log("   관계 내역:", REL.map(([,t])=>`${t} ${relations.filter(r=>r.type===t).length}`).join(" · "));
if(bad.length){ console.log("   ⚠️ 라벨이 1개가 아닌 개념:", bad.map(c=>c.node).join(", ")); process.exit(2); }
