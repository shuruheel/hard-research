import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache for embeddings to improve performance
const embeddingCache = new Map<string, number[]>();

/**
 * Get an embedding for text using OpenAI's text-embedding-3-large model
 * @param text The text to embed
 * @param dimensions The number of dimensions for the embedding (default: 3072)
 * @param useCache Whether to use cache for embeddings (default: true)
 * @returns Array of embedding values
 */
export async function getEmbeddingForText(
  text: string, 
  dimensions: number = 3072,
  useCache: boolean = true
): Promise<number[]> {
  // Create a cache key based on text and dimensions
  const cacheKey = `${text}-${dimensions}`;
  
  // Check cache first to avoid redundant API calls
  if (useCache && embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }
  
  try {
    // Ensure text is clean and not too long
    const cleanText = prepareTextForEmbedding(text);
    
    // Get embedding from OpenAI
    const response = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: cleanText,
      dimensions: dimensions
    });
    
    const embedding = response.data[0].embedding;
    
    // Cache the result
    if (useCache) {
      embeddingCache.set(cacheKey, embedding);
    }
    
    return embedding;
  } catch (error) {
    console.error("Error getting embedding:", error);
    throw new Error(`Failed to generate embedding: ${(error as Error).message}`);
  }
}

/**
 * Calculate cosine similarity between two embeddings
 * @param embedding1 First embedding vector
 * @param embedding2 Second embedding vector
 * @returns Cosine similarity score (0-1)
 */
export function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same dimensions');
  }
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Get embeddings for multiple texts with batching
 * @param texts Array of texts to embed
 * @param dimensions The number of dimensions for the embedding (default: 3072)
 * @param batchSize The batch size for API calls (default: 10)
 * @returns Array of embedding arrays
 */
export async function getEmbeddingsForTexts(
  texts: string[], 
  dimensions: number = 3072,
  batchSize: number = 10
): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  // Process in batches to avoid rate limiting
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchPromises = batch.map(text => getEmbeddingForText(text, dimensions));
    
    const batchEmbeddings = await Promise.all(batchPromises);
    embeddings.push(...batchEmbeddings);
  }
  
  return embeddings;
}

/**
 * Clear the embedding cache
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

/**
 * Get the current size of the embedding cache
 * @returns Number of items in the cache
 */
export function getEmbeddingCacheSize(): number {
  return embeddingCache.size;
}

/**
 * Prepare text for embedding by cleaning and truncating
 * @param text Text to prepare
 * @param maxTokens Approximate maximum tokens (default: 8000)
 * @returns Cleaned and truncated text
 */
function prepareTextForEmbedding(text: string, maxTokens: number = 8000): string {
  if (!text || text.trim() === '') {
    return '';
  }
  
  // Clean the text of excessive whitespace
  let cleanText = text.trim().replace(/\s+/g, ' ');
  
  // Very rough approximation: 4 chars ~= 1 token
  // This is a simplification; actual tokenization depends on the model
  const approximateTokens = cleanText.length / 4;
  
  if (approximateTokens > maxTokens) {
    // Truncate to approximate token limit
    cleanText = cleanText.substring(0, maxTokens * 4);
  }
  
  return cleanText;
} 