#!/usr/bin/env python3
"""Export key_ideas from SQLite to JSONL for ontology pipeline input."""
import json, sqlite3, sys, os
from pathlib import Path

db_path = sys.argv[1] if len(sys.argv) > 1 else "local_dev.db"
output_path = sys.argv[2] if len(sys.argv) > 2 else "concepts_export.jsonl"

if not os.path.exists(db_path):
    print(f"DB not found: {db_path}")
    sys.exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("""
    SELECT ki.core_idea_text, pc.section_id, s.title as section_title,
           pc.body_text as chunk_text, c.title as chapter_title, c.id as chapter_id
    FROM key_ideas ki
    JOIN paragraph_chunks pc ON ki.chunk_id = pc.id
    JOIN sections s ON pc.section_id = s.id
    JOIN chapters c ON s.chapter_id = c.id
""")

rows = cursor.fetchall()
with open(output_path, "w", encoding="utf-8") as f:
    for row in rows:
        entry = {
            "concept": row[0],
            "section_id": row[1],
            "section_title": row[2] or "",
            "chunk_text": row[3] or "",
            "chapter_title": row[4] or "",
            "chapter_id": row[5],
        }
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

print(f"Exported {len(rows)} concepts → {output_path}")
conn.close()
