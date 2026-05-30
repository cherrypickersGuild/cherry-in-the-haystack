"""Deduplication module for text_extract_ideas.

Provides multi-stage deduplication:
1. SHA256 hash exact matching
2. SimHash fuzzy matching
3. Embedding-based semantic matching
"""

from python_services.packages.text_extract_ideas.src.dedup.hash_utils import (
    compute_paragraph_hash,
    compute_simhash64,
    hamming_distance,
    is_fuzzy_duplicate,
    compute_hashes,
)
from python_services.packages.text_extract_ideas.src.dedup.dedup_service import (
    DeduplicationService,
    DeduplicationResult,
)
from python_services.packages.text_extract_ideas.src.dedup.embedding_utils import (
    compute_embedding,
    compute_embeddings_batch,
    cosine_similarity,
    is_semantic_duplicate,
    EmbeddingResult,
)

__all__ = [
    "compute_paragraph_hash",
    "compute_simhash64",
    "hamming_distance",
    "is_fuzzy_duplicate",
    "compute_hashes",
    "DeduplicationService",
    "DeduplicationResult",
    "compute_embedding",
    "compute_embeddings_batch",
    "cosine_similarity",
    "is_semantic_duplicate",
    "EmbeddingResult",
]
