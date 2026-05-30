#!/usr/bin/env python3
"""기존 청크에 임베딩 배치 생성"""
import argparse
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from tqdm import tqdm
from python_services.packages.text_extract_ideas.src.db.connection import get_session
from python_services.packages.text_extract_ideas.src.db.models import ParagraphChunk, ParagraphEmbedding
from python_services.packages.text_extract_ideas.src.dedup.embedding_utils import compute_embeddings_batch

def main(book_id: int, batch_size: int = 100):
    session = get_session()

    existing_ids = session.query(ParagraphEmbedding.chunk_id).subquery()
    chunks = session.query(ParagraphChunk).filter(
        ParagraphChunk.book_id == book_id,
        ~ParagraphChunk.id.in_(existing_ids)
    ).all()

    print(f"대상: {len(chunks)}개 청크")

    for i in tqdm(range(0, len(chunks), batch_size)):
        batch = chunks[i:i+batch_size]
        texts = [c.body_text for c in batch]
        results = compute_embeddings_batch(texts)

        for chunk, result in zip(batch, results):
            session.add(ParagraphEmbedding(
                chunk_id=chunk.id,
                book_id=chunk.book_id,
                embedding=result.embedding,
                model_name=result.model,
            ))
        session.commit()

    session.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--book-id", type=int, required=True)
    parser.add_argument("--batch-size", type=int, default=100)
    args = parser.parse_args()
    main(args.book_id, args.batch_size)