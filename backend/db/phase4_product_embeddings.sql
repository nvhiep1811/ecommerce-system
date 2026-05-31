-- Adds pgvector-backed semantic product search support for catalog-service.
-- Apply before deploying catalog-service changes that map products.embedding with ddl-auto=validate.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS embedding vector(3072);

CREATE INDEX IF NOT EXISTS idx_products_embedding_hnsw
  ON public.products USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL
    AND active = true
    AND published = true
    AND deleted_at IS NULL;
