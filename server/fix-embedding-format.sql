-- Create the pgvector extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS vector;

-- Test fix on a single email
WITH sample_email AS (
  SELECT id, subject
  FROM emails 
  WHERE embedding_vector IS NULL
  LIMIT 1
)
UPDATE emails
SET 
  embedding_vector = '[0.01,0.02,0.03]'::vector,
  metadata = jsonb_build_object(
    'embeddingGenerated', true,
    'embeddingDate', now(),
    'embeddingTest', true,
    'embeddingFixed', true
  )
WHERE id = (SELECT id FROM sample_email)
RETURNING id, subject;