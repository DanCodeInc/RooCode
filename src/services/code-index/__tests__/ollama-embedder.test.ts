import axios from "axios"
import { CodeIndexOllamaEmbedder } from "../ollama-embedder"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock axios
jest.mock("axios")
const mockedAxios = axios as jest.Mocked<typeof axios>

describe("CodeIndexOllamaEmbedder", () => {
	let embedder: CodeIndexOllamaEmbedder
	const defaultOptions: ApiHandlerOptions = {
		ollamaBaseUrl: "http://test-ollama:11434",
		ollamaModelId: "test-model",
	}

	beforeEach(() => {
		jest.clearAllMocks()
		embedder = new CodeIndexOllamaEmbedder(defaultOptions)
	})

	it("should initialize with the provided options", () => {
		// Test with custom options
		const customOptions: ApiHandlerOptions = {
			ollamaBaseUrl: "http://custom-ollama:11434",
			ollamaModelId: "custom-model",
		}
		const customEmbedder = new CodeIndexOllamaEmbedder(customOptions)

		// Use private property access for testing (not ideal but necessary)
		expect((customEmbedder as any).baseUrl).toBe("http://custom-ollama:11434")
		expect((customEmbedder as any).modelId).toBe("custom-model")
	})

	it("should initialize with default values when options are missing", () => {
		// Test with empty options
		const emptyOptions: ApiHandlerOptions = {}
		const defaultEmbedder = new CodeIndexOllamaEmbedder(emptyOptions)

		// Should use defaults
		expect((defaultEmbedder as any).baseUrl).toBe("http://localhost:11434")
		expect((defaultEmbedder as any).modelId).toBe("nomic-embed-text:latest")
	})

	it("should create embeddings using Ollama API", async () => {
		const texts = ["test text"]
		const mockResponse = {
			data: {
				embedding: [0.1, 0.2, 0.3],
				tokens: 5,
			},
		}

		mockedAxios.post.mockResolvedValue(mockResponse)

		const result = await embedder.createEmbeddings(texts)

		// Verify axios was called correctly
		expect(mockedAxios.post).toHaveBeenCalledWith("http://test-ollama:11434/api/embeddings", {
			model: "test-model",
			prompt: "test text",
		})

		// Verify the response structure
		expect(result.embeddings).toEqual([[0.1, 0.2, 0.3]])
		expect(result.totalTokens).toBe(5)
	})

	it("should handle multiple texts by making multiple API calls", async () => {
		const texts = ["text1", "text2"]

		mockedAxios.post
			.mockResolvedValueOnce({
				data: {
					embedding: [0.1, 0.2],
					tokens: 3,
				},
			})
			.mockResolvedValueOnce({
				data: {
					embedding: [0.3, 0.4],
					tokens: 4,
				},
			})

		const result = await embedder.createEmbeddings(texts)

		// Verify axios was called twice with different texts
		expect(mockedAxios.post).toHaveBeenCalledTimes(2)
		expect(mockedAxios.post).toHaveBeenNthCalledWith(1, "http://test-ollama:11434/api/embeddings", {
			model: "test-model",
			prompt: "text1",
		})
		expect(mockedAxios.post).toHaveBeenNthCalledWith(2, "http://test-ollama:11434/api/embeddings", {
			model: "test-model",
			prompt: "text2",
		})

		// Verify the response combines both results
		expect(result.embeddings).toEqual([
			[0.1, 0.2],
			[0.3, 0.4],
		])
		expect(result.totalTokens).toBe(7) // 3 + 4
	})

	it("should use token estimation when Ollama doesn't provide token count", async () => {
		const texts = ["test text without token count"]

		// Mock response without tokens field
		mockedAxios.post.mockResolvedValue({
			data: {
				embedding: [0.1, 0.2, 0.3],
				// No tokens field
			},
		})

		// Spy on the estimateTokens method
		jest.spyOn(embedder, "estimateTokens")

		const result = await embedder.createEmbeddings(texts)

		// Verify estimateTokens was called
		expect(embedder.estimateTokens).toHaveBeenCalledWith("test text without token count")

		// Verify the response uses the estimated token count
		expect(result.totalTokens).toBe(embedder.estimateTokens("test text without token count"))
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
		const errorMessage = "API connection failed"

		mockedAxios.post.mockRejectedValue(new Error(errorMessage))

		await expect(embedder.createEmbeddings(texts)).rejects.toThrow(errorMessage)
	})
})
