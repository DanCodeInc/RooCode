/**
 * Interface for code index embedders.
 * This interface is implemented by both OpenAI and Ollama embedders.
 */
export interface CodeIndexEmbedderInterface {
	/**
	 * Creates embeddings for the given texts.
	 * @param texts Array of text strings to create embeddings for
	 * @param model Optional model ID to use for embeddings
	 * @returns Promise resolving to an EmbeddingResponse
	 */
	createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse>

	/**
	 * Estimates the number of tokens in the given text.
	 * @param text Text to estimate token count for
	 * @returns Estimated number of tokens
	 */
	estimateTokens(text: string): number
}

/**
 * Response structure for embedding operations.
 */
export interface EmbeddingResponse {
	/**
	 * Array of embedding vectors
	 */
	embeddings: number[][]

	/**
	 * Total tokens used in the embedding operation
	 */
	totalTokens: number
}
