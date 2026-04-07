# Writer Agent DoD Setup

## Goal
Implement a Writer Agent that queries GraphDB + Evidence DB and generates a Cherry
page in the same format as the existing template.

## DoD-driven setup checklist
- [ ] Manually rebuild ontology (book ch.3-4) and map instances to the tree.
- [ ] GraphDB query succeeds for 1 topic and returns related concepts/relations.
- [ ] Evidence DB query succeeds and returns >= `EVIDENCE_DB_MIN_RESULTS` chunks.
- [ ] Writer Agent runs end-to-end once (topic -> query -> draft -> output).
- [ ] Output matches template sections (Overview, Key Concepts, Details, References).
- [ ] References: no duplicates; B includes content not already in A.
- [ ] Run 3 tests (easy, ambiguous, evidence-rich) and share results.
- [ ] Write 1 real page using the agent after tests pass.

## Local config (.env)
Fill in `dev/apps/agent/writer_agent/.env` with:
- GraphDB endpoint
- Evidence DB connection URL
- OpenAI key (vector DB initialization when description is missing)
- Evidence query minimum result count
- Evidence query template (optional override)

## GraphDB setup
From the ontology package:
```bash
cd dev/packages/ontology
uv sync
./setup_graphdb.sh
```

- GraphDB UI: `http://localhost:7200`
- SPARQL endpoint: `http://localhost:7200/repositories/llm-ontology`

Vector DB init (loads TTL and fills missing descriptions with LLM):
```bash
python src/scripts/initialize_vector_db.py
```

Container lifecycle:
```bash
docker stop graphdb-ontology
docker start graphdb-ontology
docker rm -f graphdb-ontology
```

### Evidence DB via SSH tunnel
Create a local tunnel to the remote Postgres:
```bash
ssh -N -L 5433:localhost:5432 cherry@13.239.18.76
```

Then set:
```
DATABASE_URL=postgresql://postgres:cherry251110!@localhost:5433/cherry_db
```

Check tunnel:
```bash
lsof -nP -iTCP:5433 -sTCP:LISTEN
```

Stop tunnel:
```bash
ps aux | rg "ssh -N -L 5433"
kill <PID>
```

## DB connection tests
GraphDB:
```bash
python dev/apps/agent/writer_agent/test_graphdb_connection.py
```

Evidence DB:
```bash
python dev/apps/agent/writer_agent/test_evidence_db_connection.py
```

## GraphDB structure inspection
```bash
python dev/apps/agent/writer_agent/inspect_graphdb.py
```

## Agents SDK multi-agent run
This setup uses three agents:
- Writer (Cherry page generator)
- OntologyJudge (concept selection from GraphDB)
- EvidenceSummarizer (evidence synthesis)

Run:
```bash
python dev/apps/agent/writer_agent/run_writer_agent.py "LLM twin"
```

Optional env:
- `OPENAI_MODEL` (default: `gpt-4.1-mini`)
- `WRITER_OUTPUT_DIR` to save `topic.md` + `topic.json`
- `EVIDENCE_QUERY_TEMPLATE` to override the default SQL

## JSON output schema (draft)
```json
{
  "topic": "LLM twin",
  "summary": "...",
  "why_it_matters": "...",
  "evidence": [
    {
      "chunk_id": 1,
      "body_text": "...",
      "book_id": 1,
      "book_title": "LLM Engineers Handbook",
      "book_author": "Unknown",
      "page_number": null,
      "chapter_id": 1,
      "section_id": null
    }
  ],
  "related_concepts": [
    "Agent",
    "RAG"
  ],
  "references": [
    {
      "source": "LLM Engineers Handbook",
      "claims": [
        "..."
      ]
    }
  ]
}
```

## Manual ontology workflow (current constraint)
1) Read core ideas from Evidence DB exports.
2) Extract repeated key concepts.
3) Build a tree (Evaluation -> subtopics -> leaf concepts).
4) Map new instances to the tree when evidence grows.

## Output artifacts (per run)
- Cherry page markdown
- Related concept list (graph query)
- Evidence list (chunks + metadata)
- References list (deduped, unique points per source)

## Notes
- Ontology is currently unreliable; prioritize manual tree over auto graph links.
- Keep citations and paraphrasing explicit in generated sections.
