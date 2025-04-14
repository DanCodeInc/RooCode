import { CodeIndexEmbedderInterface, EmbeddingResponse } from "../embedder-interface"

// Create a mock implementation of the interface for testing
class MockEmbedder implements CodeIndexEmbedderInterface {
	createEmbeddings = jest.fn().mockResolvedValue({
		embeddings: [[0.1, 0.2, 0.3]],
		totalTokens: 10,
	})
	estimateTokens = jest.fn().mockReturnValue(10)
}

describe("CodeIndexEmbedderInterface", () => {
	let mockEmbedder: MockEmbedder

	beforeEach(() => {
		mockEmbedder = new MockEmbedder()
		jest.clearAllMocks()
	})

	it("should define the required interface methods", () => {
		// Verify the interface has the expected methods
		expect(typeof mockEmbedder.createEmbeddings).toBe("function")
		expect(typeof mockEmbedder.estimateTokens).toBe("function")
	})

	it("should create embeddings with the expected structure", async () => {
		const texts = ["test text"]
		const result = await mockEmbedder.createEmbeddings(texts)

		// Verify the mock was called with the right arguments
		expect(mockEmbedder.createEmbeddings).toHaveBeenCalledWith(texts)

		// Verify the response structure
		expect(result).toHaveProperty("embeddings")
		expect(result).toHaveProperty("totalTokens")
		expect(Array.isArray(result.embeddings)).toBe(true)
		expect(Array.isArray(result.embeddings[0])).toBe(true)
		expect(typeof result.totalTokens).toBe("number")
	})

	it("should estimate tokens for a given text", () => {
		const text = "test text"
		const result = mockEmbedder.estimateTokens(text)

		// Verify the mock was called with the right arguments
		expect(mockEmbedder.estimateTokens).toHaveBeenCalledWith(text)

		// Verify the response is a number
		expect(typeof result).toBe("number")
	})
})
