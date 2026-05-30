-- Deduplication Migration SQL
-- Run this to add deduplication fields to existing tables

-- Step 1: Add deduplication fields to paragraph_chunks table
ALTER TABLE paragraph_chunks ADD COLUMN IF NOT EXISTS paragraph_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_paragraph_hash ON paragraph_chunks(paragraph_hash);

ALTER TABLE paragraph_chunks ADD COLUMN IF NOT EXISTS simhash64 BIGINT;
CREATE INDEX IF NOT EXISTS idx_simhash64 ON paragraph_chunks(simhash64);

-- Step 2: Create paragraph_embeddings table for semantic deduplication
-- Note: Requires pgvector extension to be installed
-- CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS paragraph_embeddings (
    id SERIAL PRIMARY KEY,
    chunk_id INTEGER REFERENCES paragraph_chunks(id) ON DELETE CASCADE UNIQUE NOT NULL,
    book_id INTEGER REFERENCES books(id) NOT NULL,
    embedding vector(1536) NOT NULL,
    model_name VARCHAR(100) DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ivfflat index for cosine similarity search
CREATE INDEX IF NOT EXISTS idx_embedding_vector
ON paragraph_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Step 3: Add comment for documentation
COMMENT ON TABLE paragraph_embeddings IS 'Stores embeddings for semantic deduplication of paragraph chunks';
COMMENT ON COLUMN paragraph_embeddings.embedding IS 'OpenAI text-embedding-3-small (1536 dimensions) using pgvector';
