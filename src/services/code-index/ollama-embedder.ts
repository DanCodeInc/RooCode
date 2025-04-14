import axios from "axios"
import { ApiHandlerOptions } from "../../shared/api"
import { CodeIndexEmbedderInterface, EmbeddingResponse } from "./embedder-interface"

/**
 * Ollama embedder implementation for code indexing
 */
export class CodeIndexOllamaEmbedder implements CodeIndexEmbedderInterface {
	private baseUrl: string
	private modelId: string

	constructor(options: ApiHandlerOptions) {
		this.baseUrl = options.ollamaBaseUrl || "http://localhost:11434"
		this.modelId = options.ollamaModelId || "nomic-embed-text:latest"
	}

	/**
	 * Creates embeddings for the given texts using Ollama API.
	 * @param texts Array of text strings to create embeddings for
	 * @param model Optional model ID to use for embeddings (overrides the default)
	 * @returns Promise resolving to an EmbeddingResponse
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		const modelToUse = model || this.modelId
		const embeddings: number[][] = []
		let totalTokens = 0

		try {
			// Process each text sequentially to avoid overwhelming the Ollama server
			for (const text of texts) {
				const response = await axios.post(`${this.baseUrl}/api/embeddings`, {
					model: modelToUse,
					prompt: text,
				})

				if (response.data && response.data.embedding) {
					embeddings.push(response.data.embedding)
					// If token count is provided by Ollama, add it
					if (response.data.tokens) {
						totalTokens += response.data.tokens
					} else {
						// Otherwise use estimation
						totalTokens += this.estimateTokens(text)
					}
				}
			}

			return {
				embeddings,
				totalTokens,
			}
		} catch (error) {
			console.error("Error creating embeddings with Ollama:", error)
			throw error
		}
	}

	/**
	 * Estimates the number of tokens in the given text.
	 * This is a simple estimation for Ollama models.
	 * @param text Text to estimate token count for
	 * @returns Estimated number of tokens
	 */
	estimateTokens(text: string): number {
		// Simple estimation: ~4 characters per token for English text
		// This is a rough approximation and may vary by model
		return Math.ceil(text.length / 4)
	}
}
