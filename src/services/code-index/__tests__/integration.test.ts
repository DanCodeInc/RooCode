import * as vscode from "vscode"
import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { CodeIndexManager } from "../manager"
import { OpenAiEmbedder } from "../embedders/openai-embedder"
import { QdrantVectorStore } from "../vector-stores/qdrant-client"
import { DirectoryScanner, FileWatcher } from "../processors" // Corrected import paths
import { EmbeddingResponse } from "../interfaces" // Added import
import { QdrantSearchResult } from "../interfaces/types" // Added import

// Define local type for scanDirectory mock result
interface ScanResult {
	codeBlocks: any[] // Using any[] for simplicity
	stats: {
		processed: number
		skipped: number
	}
}

// Define mocks locally to avoid circular dependencies
function createOpenAiEmbedderMock() {
	return jest.fn().mockImplementation(() => ({
		// Added type annotation for the mock function
		createEmbeddings: jest.fn<() => Promise<EmbeddingResponse>>().mockImplementation(async () => {
			return {
				embeddings: [[0.1, 0.2, 0.3]],
				usage: { prompt_tokens: 10, total_tokens: 20 },
			}
		}),
	}))
}

function createQdrantVectorStoreMock() {
	return jest.fn().mockImplementation(() => ({
		initialize: jest.fn<() => Promise<boolean>>().mockResolvedValue(false), // Added type
		// Added type annotation for the mock function
		search: jest.fn<() => Promise<QdrantSearchResult[]>>().mockImplementation(async () => {
			return [
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
			]
		}),
		upsertPoints: jest.fn<() => Promise<void>>().mockResolvedValue(undefined), // Added type
		deletePointsByFilePath: jest.fn<() => Promise<void>>().mockResolvedValue(undefined), // Added type
		clearCollection: jest.fn<() => Promise<void>>().mockResolvedValue(undefined), // Added type
	}))
}

function createDirectoryScannerMock() {
	return jest.fn().mockImplementation(() => ({
		// Added type annotation for the mock function
		scanDirectory: jest.fn<() => Promise<ScanResult>>().mockImplementation(async () => {
			return {
				codeBlocks: [],
				stats: { processed: 5, skipped: 2 },
			}
		}),
	}))
}

function createFileWatcherMock() {
	return jest.fn().mockImplementation(() => ({
		initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined), // Added type
		dispose: jest.fn(),
		onDidStartProcessing: jest.fn(),
		onDidFinishProcessing: jest.fn(),
		processFile: jest
			.fn<() => Promise<{ status: string; path: string }>>()
			.mockResolvedValue({ status: "success", path: "/test/file.js" }), // Added type
	}))
}

function createMockExtensionContext() {
	return {
		globalState: {
			get: jest.fn(),
			update: jest.fn().mockImplementation(() => Promise.resolve()),
			setKeysForSync: jest.fn(),
			keys: jest.fn().mockReturnValue([""] as readonly string[]),
		},
		subscriptions: [],
		workspaceState: {
			get: jest.fn(),
			update: jest.fn().mockImplementation(() => Promise.resolve()),
			setKeysForSync: jest.fn(),
			keys: jest.fn().mockReturnValue([""] as readonly string[]),
		},
		extensionPath: "",
		storagePath: "",
		globalStoragePath: "",
		logPath: "",
		extensionUri: {} as any,
		globalStorageUri: {} as any,
		logUri: {} as any,
		storageUri: {} as any,
		asAbsolutePath: jest.fn().mockImplementation((path) => path),
		extensionMode: 1, // Development mode
		secrets: {
			get: jest.fn().mockImplementation(() => Promise.resolve("")),
			store: jest.fn().mockImplementation(() => Promise.resolve()),
			delete: jest.fn().mockImplementation(() => Promise.resolve()),
			onDidChange: { event: jest.fn(), dispose: jest.fn() } as any,
		},
		environmentVariableCollection: {
			persistent: false,
			replace: jest.fn(),
			append: jest.fn(),
			prepend: jest.fn(),
			get: jest.fn(),
			forEach: jest.fn(),
			delete: jest.fn(),
			clear: jest.fn(),
		},
		extension: {
			id: "test-extension",
			extensionUri: {} as any,
			extensionPath: "",
			isActive: true,
			packageJSON: {},
			exports: undefined,
			activate: jest.fn().mockImplementation(() => Promise.resolve()),
		},
		languageModelAccessInformation: {
			current: {
				endpoint: "",
				authHeader: "",
			},
		},
	}
}

// Mock dependencies
jest.mock("vscode")
jest.mock("../embedders/openai-embedder", () => {
	return {
		OpenAiEmbedder: createOpenAiEmbedderMock(),
	}
})
jest.mock("../vector-stores/qdrant-client", () => {
	return {
		QdrantVectorStore: createQdrantVectorStoreMock(),
	}
})
// Corrected mock path
jest.mock("../processors", () => {
	return {
		// Need to export both from the same mock path
		DirectoryScanner: createDirectoryScannerMock(),
		FileWatcher: createFileWatcherMock(),
	}
})

describe("Code Index Integration", () => {
	let manager: CodeIndexManager
	let mockContext: vscode.ExtensionContext

	beforeEach(() => {
		// Reset mocks
		jest.resetAllMocks()

		// Create mock context - use any to bypass type checking
		mockContext = createMockExtensionContext() as any

		// Reset singleton instance
		;(CodeIndexManager as any).instance = null

		// Create manager
		manager = CodeIndexManager.getInstance("/test/workspace", mockContext)
	})

	describe("Integration with components", () => {
		it("should initialize embedder and vector store when starting indexing", async () => {
			// Arrange
			const mockEnabled = true
			const mockOpenAiKey = "test-key"
			const mockQdrantUrl = "http://localhost:6333"

			// Mock global state
			;(mockContext.globalState.get as jest.Mock).mockImplementation((key: any, defaultValue: any) => {
				if (key === "codeIndexEnabled") return mockEnabled
				if (key === "codeIndexOpenAiKey") return mockOpenAiKey
				if (key === "codeIndexQdrantUrl") return mockQdrantUrl
				return defaultValue
			})

			// Create mock instances
			const mockQdrantInstance = {
				initialize: jest.fn<() => Promise<boolean>>().mockResolvedValue(false), // Added type
				search: jest.fn<() => Promise<QdrantSearchResult[]>>(), // Added type
				upsertPoints: jest.fn<() => Promise<void>>(), // Added type
				deletePointsByFilePath: jest.fn<() => Promise<void>>(), // Added type
				clearCollection: jest.fn<() => Promise<void>>(), // Added type
			}

			const mockEmbedderInstance = {
				createEmbeddings: jest.fn<() => Promise<EmbeddingResponse>>().mockResolvedValue({
					// Added type
					embeddings: [[0.1, 0.2, 0.3]],
					usage: { prompt_tokens: 10, total_tokens: 20 },
				}),
			}

			const mockScannerInstance = {
				scanDirectory: jest.fn<() => Promise<ScanResult>>().mockResolvedValue({
					// Added type
					codeBlocks: [],
					stats: { processed: 5, skipped: 2 },
				}),
			}

			const mockWatcherInstance = {
				initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined), // Added type
				dispose: jest.fn(),
				onDidStartProcessing: jest.fn(),
				onDidFinishProcessing: jest.fn(),
				processFile: jest.fn(),
			}

			// Mock constructors to return our instances
			;(QdrantVectorStore as jest.Mock).mockImplementation(() => mockQdrantInstance)
			;(OpenAiEmbedder as jest.Mock).mockImplementation(() => mockEmbedderInstance)
			;(DirectoryScanner as jest.Mock).mockImplementation(() => mockScannerInstance)
			;(FileWatcher as jest.Mock).mockImplementation(() => mockWatcherInstance)

			// Scanner is already mocked above

			// Act
			await manager.loadConfiguration()
			await manager.startIndexing()

			// Assert
			expect(OpenAiEmbedder).toHaveBeenCalledWith({ openAiNativeApiKey: mockOpenAiKey })
			expect(QdrantVectorStore).toHaveBeenCalledWith("/test/workspace", mockQdrantUrl)
			expect(mockQdrantInstance.initialize).toHaveBeenCalled()
			expect(DirectoryScanner).toHaveBeenCalled()
			expect(mockScannerInstance.scanDirectory).toHaveBeenCalled()
			expect(FileWatcher).toHaveBeenCalled()
			expect(mockWatcherInstance.initialize).toHaveBeenCalled()
		})

		it("should search the index using embedder and vector store", async () => {
			// Arrange
			const query = "test query"
			const limit = 5
			const mockVector = [0.1, 0.2, 0.3]
			const mockResults = [
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
			]

			// Set up manager
			;(manager as any).isEnabled = true
			;(manager as any).openAiOptions = { openAiNativeApiKey: "test-key" }
			;(manager as any).qdrantUrl = "http://localhost:6333"
			;(manager as any)._systemStatus = "Indexed"

			// Create mock instances
			const mockEmbedderInstance = {
				createEmbeddings: jest.fn<() => Promise<EmbeddingResponse>>().mockResolvedValue({
					// Added type
					embeddings: [mockVector],
					usage: { prompt_tokens: 10, total_tokens: 20 },
				}),
			}

			const mockQdrantInstance = {
				search: jest.fn<() => Promise<QdrantSearchResult[]>>().mockResolvedValue(mockResults), // Added type
				initialize: jest.fn(),
				upsertPoints: jest.fn(),
				deletePointsByFilePath: jest.fn(),
				clearCollection: jest.fn(),
			}

			// Mock constructors to return our instances
			;(OpenAiEmbedder as jest.Mock).mockImplementation(() => mockEmbedderInstance)
			;(QdrantVectorStore as jest.Mock).mockImplementation(() => mockQdrantInstance)

			// Set up manager's internal instances
			;(manager as any).embedder = mockEmbedderInstance
			;(manager as any).vectorStore = mockQdrantInstance

			// Act
			const results = await manager.searchIndex(query, limit)

			// Assert
			expect(mockEmbedderInstance.createEmbeddings).toHaveBeenCalledWith([query])
			expect(mockQdrantInstance.search).toHaveBeenCalledWith(mockVector, limit)
			expect(results).toEqual(mockResults)
		})
	})
})
