import { QdrantVectorStore } from "../vector-stores/qdrant-client"
import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { QdrantClient } from "@qdrant/js-client-rest"
import { QdrantSearchResult } from "../interfaces/types" // Added import

// Mock dependencies
jest.mock("@qdrant/js-client-rest", () => {
	return {
		QdrantClient: jest.fn().mockImplementation(() => ({
			getCollections: jest.fn<() => Promise<any>>().mockResolvedValue({ collections: [] }), // Added type
			getCollection: jest.fn<() => Promise<any>>().mockResolvedValue({}), // Added type
			createCollection: jest.fn<() => Promise<any>>().mockResolvedValue({}), // Added type
			upsert: jest.fn<() => Promise<any>>().mockResolvedValue({}), // Added type
			search: jest.fn<() => Promise<QdrantSearchResult[]>>().mockResolvedValue([
				// Added type
				{
					id: "point1",
					score: 0.9,
					payload: {
						filePath: "/test/file.js",
						codeChunk: "function test() {}",
						startLine: 1,
						endLine: 3,
					},
				},
			]),
			delete: jest.fn<() => Promise<any>>().mockResolvedValue({}), // Added type
		})),
	}
})
jest.mock("../../../utils/path", () => ({
	getWorkspacePath: jest.fn().mockReturnValue("/test/workspace"),
}))

describe("QdrantVectorStore", () => {
	let vectorStore: QdrantVectorStore

	beforeEach(() => {
		// Reset mocks
		jest.resetAllMocks()

		// Create vector store
		vectorStore = new QdrantVectorStore("/test/workspace")
	})

	describe("initialize", () => {
		it("should create a new collection if it does not exist", async () => {
			// Arrange
			const mockCollections = {
				collections: [],
			}

			// Mock Qdrant client
			;(QdrantClient.prototype.getCollections as any).mockResolvedValue(mockCollections)

			// Act
			const result = await vectorStore.initialize()

			// Assert
			expect(result).toBe(true)
			expect(QdrantClient.prototype.getCollections).toHaveBeenCalled()
			expect(QdrantClient.prototype.createCollection).toHaveBeenCalled()
		})

		it("should not create a collection if it already exists", async () => {
			// Arrange
			const collectionName = (vectorStore as any).collectionName
			const mockCollections = {
				collections: [{ name: collectionName }],
			}

			// Mock Qdrant client
			;(QdrantClient.prototype.getCollections as any).mockResolvedValue(mockCollections)

			// Act
			const result = await vectorStore.initialize()

			// Assert
			expect(result).toBe(false)
			expect(QdrantClient.prototype.getCollections).toHaveBeenCalled()
			expect(QdrantClient.prototype.createCollection).not.toHaveBeenCalled()
		})

		it("should handle initialization errors", async () => {
			// Arrange
			const error = new Error("Initialization error")

			// Mock Qdrant client
			;(QdrantClient.prototype.getCollections as any).mockRejectedValue(error)

			// Mock console.error to avoid polluting test output
			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

			// Act & Assert
			await expect(vectorStore.initialize()).rejects.toThrow(error)
			expect(consoleErrorSpy).toHaveBeenCalled()

			// Restore console.error
			consoleErrorSpy.mockRestore()
		})
	})

	describe("upsertPoints", () => {
		it("should upsert points successfully", async () => {
			// Arrange
			const points = [
				{
					id: "point1",
					vector: [0.1, 0.2, 0.3],
					payload: { filePath: "test.js", codeChunk: "code", startLine: 1, endLine: 10 },
				},
			]

			// Act
			await vectorStore.upsertPoints(points)

			// Assert
			expect(QdrantClient.prototype.upsert).toHaveBeenCalledWith((vectorStore as any).collectionName, {
				points,
				wait: true,
			})
		})

		it("should handle upsert errors", async () => {
			// Arrange
			const points = [
				{
					id: "point1",
					vector: [0.1, 0.2, 0.3],
					payload: { filePath: "test.js", codeChunk: "code", startLine: 1, endLine: 10 },
				},
			]
			const error = new Error("Upsert error")

			// Mock Qdrant client
			;(QdrantClient.prototype.upsert as any).mockRejectedValue(error)

			// Mock console.error to avoid polluting test output
			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

			// Act & Assert
			await expect(vectorStore.upsertPoints(points)).rejects.toThrow(error)
			expect(consoleErrorSpy).toHaveBeenCalled()

			// Restore console.error
			consoleErrorSpy.mockRestore()
		})
	})

	describe("search", () => {
		it("should search for similar vectors", async () => {
			// Arrange
			const queryVector = [0.1, 0.2, 0.3]
			const limit = 5
			const mockResults = [
				{
					id: "point1",
					score: 0.9,
					payload: { filePath: "test.js", codeChunk: "code", startLine: 1, endLine: 10 },
				},
			]

			// Mock Qdrant client
			;(QdrantClient.prototype.search as any).mockResolvedValue(mockResults)

			// Act
			const results = await vectorStore.search(queryVector, limit)

			// Assert
			expect(results).toEqual(mockResults)
			expect(QdrantClient.prototype.search).toHaveBeenCalledWith((vectorStore as any).collectionName, {
				vector: queryVector,
				limit,
			})
		})
	})
})
