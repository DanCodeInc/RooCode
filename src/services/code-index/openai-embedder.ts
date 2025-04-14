import { OpenAI } from "openai"
import { ApiHandlerOptions } from "../../shared/api"
import { CodeIndexEmbedderInterface, EmbeddingResponse } from "./embedder-interface"

/**
 * OpenAI embedder implementation for code indexing
 */
export class CodeIndexOpenAiEmbedder implements CodeIndexEmbedderInterface {
	private embeddingsClient: OpenAI

	constructor(options: ApiHandlerOptions) {
		const apiKey = options.openAiNativeApiKey ?? "not-provided"
		this.embeddingsClient = new OpenAI({ apiKey })
	}

	async createEmbeddings(texts: string[], model: string = "text-embedding-3-small"): Promise<EmbeddingResponse> {
		try {
			const response = await this.embeddingsClient.embeddings.create({
				input: texts,
				model,
			})

			// Extract embeddings from response
			const embeddings = response.data.map((item) => item.embedding)

			return {
				embeddings,
				totalTokens: response.usage?.total_tokens || 0,
			}
		} catch (error) {
			console.error("Error creating embeddings:", error)
			throw error
		}
	}

	/**
	 * Estimates the number of tokens in the given text.
	 * This is a simple estimation for OpenAI models.
	 * @param text Text to estimate token count for
	 * @returns Estimated number of tokens
	 */
	estimateTokens(text: string): number {
		// Simple estimation: ~4 characters per token for English text
		return Math.ceil(text.length / 4)
	}
}
