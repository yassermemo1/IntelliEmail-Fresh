/**
 * Utility functions for working with vector embeddings
 */

/**
 * Fetches a semantic embedding from the server for the given text
 * 
 * @param text - The text to generate an embedding for
 * @returns A Promise that resolves to an array of numbers (the embedding vector)
 */
export async function fetchSemanticEmbedding(text: string): Promise<number[]> {
  try {
    // Request an embedding from the server
    const response = await fetch('/api/embedding/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate embedding');
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * @param a - First vector
 * @param b - Second vector
 * @returns A number between -1 and 1, where 1 means identical, 0 means orthogonal, and -1 means opposite
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must be of the same length');
  }

  let dotProduct = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    aMagnitude += a[i] * a[i];
    bMagnitude += b[i] * b[i];
  }

  aMagnitude = Math.sqrt(aMagnitude);
  bMagnitude = Math.sqrt(bMagnitude);

  if (aMagnitude === 0 || bMagnitude === 0) {
    return 0;
  }

  return dotProduct / (aMagnitude * bMagnitude);
}

/**
 * Normalize a vector to unit length
 * 
 * @param vector - The vector to normalize
 * @returns A new vector with unit length
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude === 0) {
    return new Array(vector.length).fill(0);
  }
  
  return vector.map(val => val / magnitude);
}