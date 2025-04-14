import { OpenAI } from "openai"
import { CodeIndexOpenAiEmbedder } from "../openai-embedder"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock OpenAI
jest.mock("openai")
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>

describe("CodeIndexOpenAiEmbedder", () => {
	let embedder: CodeIndexOpenAiEmbedder
	const defaultOptions: ApiHandlerOptions = {
		openAiNativeApiKey: "test-api-key",
	}

	beforeEach(() => {
		jest.clearAllMocks()

		// Setup mock implementation for OpenAI embeddings.create
		MockedOpenAI.prototype.embeddings = {
			create: jest.fn().mockResolvedValue({
				data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
				usage: {
					prompt_tokens: 8,
					total_tokens: 8,
				},
			}),
		} as any

		embedder = new CodeIndexOpenAiEmbedder(defaultOptions)
	})

	it("should initialize with the provided API key", () => {
		// Verify OpenAI was initialized with the correct API key
		expect(MockedOpenAI).toHaveBeenCalledWith({ apiKey: "test-api-key" })
	})

	it("should use a default API key if none is provided", () => {
		// Test with empty options
		const emptyOptions: ApiHandlerOptions = {}
		new CodeIndexOpenAiEmbedder(emptyOptions)

		// Should use "not-provided" as default
		expect(MockedOpenAI).toHaveBeenCalledWith({ apiKey: "not-provided" })
	})

	it("should create embeddings using OpenAI API", async () => {
		const texts = ["text1", "text2"]
		const result = await embedder.createEmbeddings(texts)

		// Verify OpenAI API was called correctly
		expect(MockedOpenAI.prototype.embeddings.create).toHaveBeenCalledWith({
			input: texts,
			model: "text-embedding-3-small", // Default model
		})

		// Verify the response structure
		expect(result.embeddings).toEqual([
			[0.1, 0.2, 0.3],
			[0.4, 0.5, 0.6],
		])
		expect(result.totalTokens).toBe(8)
	})

	it("should use the specified model when provided", async () => {
		const texts = ["test text"]
		const customModel = "text-embedding-ada-002"

		await embedder.createEmbeddings(texts, customModel)

		// Verify the custom model was used
		expect(MockedOpenAI.prototype.embeddings.create).toHaveBeenCalledWith({
			input: texts,
			model: customModel,
		})
	})

	it("should handle missing usage information", async () => {
		// Mock response without usage information
		MockedOpenAI.prototype.embeddings.create = jest.fn().mockResolvedValue({
			data: [{ embedding: [0.1, 0.2, 0.3] }],
			// No usage field
		}) as any

		const texts = ["test text"]
		const result = await embedder.createEmbeddings(texts)

		// Should default to 0 tokens
		expect(result.totalTokens).toBe(0)
	})

	it("should estimate tokens based on text length", () => {
		const text = "This is a test text with 40 characters."
		const result = embedder.estimateTokens(text)

		// Simple estimation: ~4 characters per token
		const expected = Math.ceil(text.length / 4)
		expect(result).toBe(expected)
	})

	it("should handle API errors gracefully", async () => {
		const texts = ["test text"]
		const errorMessage = "API key invalid"

		// Mock API error
		MockedOpenAI.prototype.embeddings.create = jest.fn().mockRejectedValue(new Error(errorMessage)) as any

		await expect(embedder.createEmbeddings(texts)).rejects.toThrow()
	})
})
