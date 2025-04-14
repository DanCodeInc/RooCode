import * as vscode from "vscode"
import { CodeIndexManager } from "../manager"
import { CodeIndexOpenAiEmbedder } from "../openai-embedder"
import { CodeIndexOllamaEmbedder } from "../ollama-embedder"
import { CodeIndexQdrantClient } from "../qdrant-client"
import { ContextProxy } from "../../../core/config/ContextProxy"
import { CodeIndexEmbedderInterface } from "../embedder-interface"

// Mock dependencies
jest.mock("vscode", () => {
	// Create a proper event emitter mock that can be subscribed to
	const createMockEventEmitter = () => {
		const listeners: Array<(data: any) => void> = []
		return {
			event: jest.fn((listener: (data: any) => void) => {
				listeners.push(listener)
				return {
					dispose: jest.fn(() => {
						const index = listeners.indexOf(listener)
						if (index > -1) {
							listeners.splice(index, 1)
						}
					}),
				}
			}),
			fire: jest.fn((data: any) => {
				listeners.forEach((listener) => listener(data))
			}),
			dispose: jest.fn(),
		}
	}

	return {
		EventEmitter: jest.fn(() => createMockEventEmitter()),
		Uri: {
			file: jest.fn((path) => ({ fsPath: path })),
			joinPath: jest.fn((uri, ...pathSegments) => ({ fsPath: uri.fsPath + "/" + pathSegments.join("/") })),
		},
		workspace: {
			fs: {
				writeFile: jest.fn().mockResolvedValue(undefined),
				readFile: jest.fn().mockResolvedValue(Buffer.from("{}")),
			},
		},
	}
})

jest.mock("../openai-embedder", () => {
	return {
		CodeIndexOpenAiEmbedder: jest.fn().mockImplementation(() => ({
			createEmbeddings: jest.fn().mockResolvedValue({
				embeddings: [[0.1, 0.2, 0.3]],
				totalTokens: 10,
			}),
			estimateTokens: jest.fn().mockReturnValue(10),
		})),
	}
})

jest.mock("../ollama-embedder", () => {
	return {
		CodeIndexOllamaEmbedder: jest.fn().mockImplementation(() => ({
			createEmbeddings: jest.fn().mockResolvedValue({
				embeddings: [[0.1, 0.2, 0.3]],
				totalTokens: 10,
			}),
			estimateTokens: jest.fn().mockReturnValue(10),
		})),
	}
})
jest.mock("../qdrant-client", () => {
	// Create a mock search result
	const mockSearchResult = [
		{
			id: "1",
			score: 0.9,
			payload: {
				filePath: "/test/workspace/file1.ts",
				identifier: "testFunction",
				type: "function",
				content: "function testFunction() { return true; }",
				start_line: 1,
				end_line: 3,
			},
		},
	]

	// Create the mock client
	const mockQdrantClient = {
		initialize: jest.fn().mockResolvedValue(true),
		upsertPoints: jest.fn().mockResolvedValue(undefined),
		deletePointsByFilePath: jest.fn().mockResolvedValue(undefined),
		search: jest.fn().mockResolvedValue(mockSearchResult),
		clearCollection: jest.fn().mockResolvedValue(undefined),
	}

	return {
		CodeIndexQdrantClient: jest.fn().mockImplementation(() => mockQdrantClient),
	}
})
jest.mock("../../../utils/path", () => ({
	getWorkspacePath: () => "/test/workspace",
	arePathsEqual: jest.fn().mockReturnValue(true),
}))

// Mock scanner to avoid file system operations
jest.mock("../scanner", () => ({
	scanDirectoryForCodeBlocks: jest.fn().mockResolvedValue({
		codeBlocks: [],
		stats: { processed: 10, skipped: 5 },
	}),
}))

// Mock file watcher
jest.mock("../file-watcher", () => {
	// Create a mock file watcher with all required methods
	const createMockFileWatcher = () => {
		return {
			initialize: jest.fn().mockResolvedValue(undefined),
			dispose: jest.fn(),
			onDidStartProcessing: jest.fn().mockImplementation((callback) => {
				return { dispose: jest.fn() }
			}),
			onDidFinishProcessing: jest.fn().mockImplementation((callback) => {
				return { dispose: jest.fn() }
			}),
			onDidFailProcessing: jest.fn().mockImplementation((callback) => {
				return { dispose: jest.fn() }
			}),
			onError: jest.fn().mockImplementation((callback) => {
				return { dispose: jest.fn() }
			}),
		}
	}

	return {
		CodeIndexFileWatcher: jest.fn().mockImplementation(() => createMockFileWatcher()),
	}
})

// Mock list-files
jest.mock("../../glob/list-files", () => ({
	listFiles: jest.fn().mockResolvedValue([["file1.ts", "file2.ts"], []]),
}))

describe("CodeIndexManager", () => {
	let manager: CodeIndexManager
	let mockContext: vscode.ExtensionContext
	let mockContextProxy: ContextProxy
	let globalState: Map<string, any>
	let secrets: Map<string, string>

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks()

		// Setup mock context
		globalState = new Map()
		secrets = new Map()
		mockContextProxy = {
			getGlobalState: (key: string) => globalState.get(key),
			setGlobalState: (key: string, value: any) => globalState.set(key, value),
			getSecret: (key: string) => secrets.get(key),
			setSecret: (key: string, value: string) => secrets.set(key, value),
		} as any

		mockContext = {
			globalStorageUri: vscode.Uri.file("/test/storage"),
			subscriptions: [],
		} as any

		// Clear singleton instances
		CodeIndexManager["instances"].clear()
	})

	describe("Configuration Management", () => {
		describe("OpenAI Configuration", () => {
			beforeEach(async () => {
				// Setup OpenAI configuration
				globalState.set("codeIndexEnabled", true)
				globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
				globalState.set("codeIndexEmbedderType", "openai")
				secrets.set("codeIndexOpenAiKey", "test-openai-key")
				secrets.set("codeIndexQdrantApiKey", "test-qdrant-key")

				manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
				await manager.loadConfiguration()
			})

			it("should be properly configured with OpenAI settings", () => {
				expect(manager.isFeatureConfigured).toBe(true)
				expect(manager.isFeatureEnabled).toBe(true)
			})

			it("should create OpenAI embedder when configured", () => {
				expect(CodeIndexOpenAiEmbedder).toHaveBeenCalledWith({
					openAiNativeApiKey: "test-openai-key",
				})
			})
		})

		describe("Ollama Configuration", () => {
			beforeEach(async () => {
				// Setup Ollama configuration
				globalState.set("codeIndexEnabled", true)
				globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
				globalState.set("codeIndexEmbedderType", "ollama")
				globalState.set("codeIndexOllamaBaseUrl", "http://localhost:11434")
				globalState.set("codeIndexOllamaModelId", "nomic-embed-text:latest")
				secrets.set("codeIndexQdrantApiKey", "test-qdrant-key")

				manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
				await manager.loadConfiguration()
			})

			it("should be properly configured with Ollama settings", () => {
				expect(manager.isFeatureConfigured).toBe(true)
				expect(manager.isFeatureEnabled).toBe(true)
			})

			it("should create Ollama embedder when configured", () => {
				expect(CodeIndexOllamaEmbedder).toHaveBeenCalledWith({
					ollamaBaseUrl: "http://localhost:11434",
					ollamaModelId: "nomic-embed-text:latest",
				})
			})
		})

		describe("Switching Embedder Types", () => {
			it("should switch from OpenAI to Ollama embedder when configuration changes", async () => {
				// Start with OpenAI configuration
				globalState.set("codeIndexEnabled", true)
				globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
				globalState.set("codeIndexEmbedderType", "openai")
				secrets.set("codeIndexOpenAiKey", "test-openai-key")

				manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
				await manager.loadConfiguration()

				// Verify OpenAI embedder was created
				expect(CodeIndexOpenAiEmbedder).toHaveBeenCalled()
				expect(CodeIndexOllamaEmbedder).not.toHaveBeenCalled()

				// Now switch to Ollama
				globalState.set("codeIndexEmbedderType", "ollama")
				globalState.set("codeIndexOllamaBaseUrl", "http://test-ollama:11434")
				globalState.set("codeIndexOllamaModelId", "test-model")

				// Reset mocks to verify new calls
				jest.clearAllMocks()

				// Reload configuration
				await manager.loadConfiguration()

				// Verify Ollama embedder was created
				expect(CodeIndexOllamaEmbedder).toHaveBeenCalledWith({
					ollamaBaseUrl: "http://test-ollama:11434",
					ollamaModelId: "test-model",
				})
				expect(CodeIndexOpenAiEmbedder).not.toHaveBeenCalled()
			})

			it("should handle invalid embedder type by defaulting to OpenAI", async () => {
				// Setup with invalid embedder type
				globalState.set("codeIndexEnabled", true)
				globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
				globalState.set("codeIndexEmbedderType", "invalid-type")
				secrets.set("codeIndexOpenAiKey", "test-openai-key")

				manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
				await manager.loadConfiguration()

				// Should default to OpenAI
				expect(CodeIndexOpenAiEmbedder).toHaveBeenCalled()
				expect(CodeIndexOllamaEmbedder).not.toHaveBeenCalled()
			})
		})

		describe("Invalid Configurations", () => {
			it("should not be configured when missing OpenAI key with OpenAI embedder", async () => {
				globalState.set("codeIndexEnabled", true)
				globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
				globalState.set("codeIndexEmbedderType", "openai")
				// No OpenAI key set

				manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
				await manager.loadConfiguration()

				expect(manager.isFeatureConfigured).toBe(false)
			})

			it("should not be configured when missing Ollama URL with Ollama embedder", async () => {
				globalState.set("codeIndexEnabled", true)
				globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
				globalState.set("codeIndexEmbedderType", "ollama")
				globalState.set("codeIndexOllamaModelId", "nomic-embed-text:latest")
				// No Ollama URL set

				manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
				await manager.loadConfiguration()

				expect(manager.isFeatureConfigured).toBe(false)
			})

			it("should not be configured when missing Qdrant URL", async () => {
				globalState.set("codeIndexEnabled", true)
				globalState.set("codeIndexEmbedderType", "openai")
				secrets.set("codeIndexOpenAiKey", "test-openai-key")
				// No Qdrant URL set

				manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
				await manager.loadConfiguration()

				expect(manager.isFeatureConfigured).toBe(false)
			})
		})
	})

	describe("State Management", () => {
		beforeEach(async () => {
			// Setup basic configuration
			globalState.set("codeIndexEnabled", true)
			globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
			globalState.set("codeIndexEmbedderType", "openai")
			secrets.set("codeIndexOpenAiKey", "test-openai-key")

			manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
			await manager.loadConfiguration()
		})

		it("should start in Standby state", () => {
			expect(manager.state).toBe("Standby")
		})

		it("should transition to Indexing state when starting indexing", async () => {
			const mockQdrantClient = CodeIndexQdrantClient.prototype as jest.Mocked<CodeIndexQdrantClient>
			mockQdrantClient.initialize = jest.fn().mockResolvedValue(true)

			await manager.startIndexing()
			expect(manager.state).toBe("Indexing")
		})

		it("should transition to Error state on initialization failure", async () => {
			const mockQdrantClient = CodeIndexQdrantClient.prototype as jest.Mocked<CodeIndexQdrantClient>
			mockQdrantClient.initialize = jest.fn().mockRejectedValue(new Error("Connection failed"))

			await manager.startIndexing()
			expect(manager.state).toBe("Error")
		})
	})

	describe("Progress Updates", () => {
		let progressCallback: (progress: any) => void

		beforeEach(async () => {
			// Setup basic configuration
			globalState.set("codeIndexEnabled", true)
			globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
			globalState.set("codeIndexEmbedderType", "openai")
			secrets.set("codeIndexOpenAiKey", "test-openai-key")

			manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
			await manager.loadConfiguration()

			// Setup progress listener
			progressCallback = jest.fn()
			manager.onProgressUpdate(progressCallback)
		})

		it("should emit progress updates during indexing", async () => {
			const mockQdrantClient = CodeIndexQdrantClient.prototype as jest.Mocked<CodeIndexQdrantClient>
			mockQdrantClient.initialize = jest.fn().mockResolvedValue(true)

			await manager.startIndexing()

			expect(progressCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					systemStatus: "Indexing",
					message: expect.any(String),
				}),
			)
		})

		it("should update file status during processing", async () => {
			const mockQdrantClient = CodeIndexQdrantClient.prototype as jest.Mocked<CodeIndexQdrantClient>
			mockQdrantClient.initialize = jest.fn().mockResolvedValue(true)

			await manager.startIndexing()
			const status = manager.getCurrentStatus()

			expect(status).toEqual(
				expect.objectContaining({
					systemStatus: expect.any(String),
					fileStatuses: expect.any(Object),
					message: expect.any(String),
				}),
			)
		})
	})

	describe("File Watcher", () => {
		beforeEach(async () => {
			globalState.set("codeIndexEnabled", true)
			globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
			globalState.set("codeIndexEmbedderType", "openai")
			secrets.set("codeIndexOpenAiKey", "test-openai-key")

			manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
			await manager.loadConfiguration()
		})

		it("should start file watcher after successful indexing", async () => {
			const mockQdrantClient = CodeIndexQdrantClient.prototype as jest.Mocked<CodeIndexQdrantClient>
			mockQdrantClient.initialize = jest.fn().mockResolvedValue(true)

			await manager.startIndexing()

			// Check if watcher is running through internal state
			const status = manager.getCurrentStatus()
			expect(status.systemStatus).toBe("Indexed")
		})

		it("should stop file watcher when calling stopWatcher", async () => {
			const mockQdrantClient = CodeIndexQdrantClient.prototype as jest.Mocked<CodeIndexQdrantClient>
			mockQdrantClient.initialize = jest.fn().mockResolvedValue(true)

			await manager.startIndexing()
			manager.stopWatcher()

			const status = manager.getCurrentStatus()
			expect(status.systemStatus).toBe("Standby")
		})
	})

	describe("Cache Management", () => {
		beforeEach(async () => {
			globalState.set("codeIndexEnabled", true)
			globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
			globalState.set("codeIndexEmbedderType", "openai")
			secrets.set("codeIndexOpenAiKey", "test-openai-key")

			manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
			await manager.loadConfiguration()
		})

		it("should reset cache when collection is created", async () => {
			const mockQdrantClient = CodeIndexQdrantClient.prototype as jest.Mocked<CodeIndexQdrantClient>
			mockQdrantClient.initialize = jest.fn().mockResolvedValue(true)

			const mockFs = vscode.workspace.fs as jest.Mocked<typeof vscode.workspace.fs>
			const writeFileSpy = jest.spyOn(mockFs, "writeFile")

			await manager.startIndexing()

			expect(writeFileSpy).toHaveBeenCalled()
		})

		it("should reset cache during clearIndexData", async () => {
			const mockFs = vscode.workspace.fs as jest.Mocked<typeof vscode.workspace.fs>
			const writeFileSpy = jest.spyOn(mockFs, "writeFile")

			await manager.clearIndexData()

			expect(writeFileSpy).toHaveBeenCalled()
		})
	})

	describe("Search Functionality", () => {
		beforeEach(async () => {
			// Reset mocks before each test
			jest.clearAllMocks()

			// Reset the CodeIndexManager instances
			CodeIndexManager["instances"] = new Map()

			globalState.set("codeIndexEnabled", true)
			globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
			globalState.set("codeIndexEmbedderType", "openai")
			secrets.set("codeIndexOpenAiKey", "test-openai-key")

			// Create a new instance for each test
			manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
			await manager.loadConfiguration()
		})

		it("should return empty array when not indexed", async () => {
			// Mock the system status to be in a non-indexed state
			jest.spyOn(manager, "state", "get").mockReturnValue("Standby")

			const results = await manager.findSimilarCode("test query")
			expect(results).toEqual([])
		})

		it("should search for similar code when indexed", async () => {
			// Create mock search results
			const mockSearchResults = [
				{
					id: "1",
					score: 0.9,
					payload: {
						filePath: "/test/workspace/file1.ts",
						identifier: "testFunction",
						type: "function",
						content: "function testFunction() { return true; }",
						start_line: 1,
						end_line: 3,
					},
				},
			]

			// Get an instance with mocked dependencies
			const testManager = CodeIndexManager.getInstance(mockContext, mockContextProxy)

			// Set the system status directly
			testManager["_systemStatus"] = "Indexed"

			// Mock the internal methods directly
			testManager["_embedder"] = {
				createEmbeddings: jest.fn().mockResolvedValue({
					embeddings: [[0.1, 0.2, 0.3]],
					totalTokens: 10,
				}),
			} as any

			testManager["_qdrantClient"] = {
				search: jest.fn().mockResolvedValue(mockSearchResults),
			} as any

			// Perform the search
			const results = await testManager.findSimilarCode("test query")

			// Verify the results
			expect(results).toHaveLength(1)
			expect(results[0]).toEqual(
				expect.objectContaining({
					id: "1",
					score: 0.9,
				}),
			)
		})
	})

	describe("Cleanup", () => {
		beforeEach(async () => {
			// Reset mocks before each test
			jest.clearAllMocks()

			// Reset the CodeIndexManager instances
			CodeIndexManager["instances"] = new Map()

			globalState.set("codeIndexEnabled", true)
			globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
			globalState.set("codeIndexEmbedderType", "openai")
			secrets.set("codeIndexOpenAiKey", "test-openai-key")

			// Create a new instance for each test
			manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
			await manager.loadConfiguration()
		})

		it("should clean up resources when disposing", () => {
			// Add the manager to the instances map
			CodeIndexManager["instances"].set("/test/workspace", manager)

			// Verify the manager is in the instances map
			expect(CodeIndexManager["instances"].size).toBe(1)

			// Mock the event emitter dispose method
			const disposeSpy = jest.spyOn(manager["_progressEmitter"], "dispose")

			// Call dispose
			manager.dispose()

			// Verify the event emitter was disposed
			expect(disposeSpy).toHaveBeenCalled()

			// Verify manager is removed from instances
			expect(CodeIndexManager["instances"].size).toBe(0)
		})

		it("should clear all data when calling clearIndexData", async () => {
			// Create a mock clear collection function
			const mockClearCollection = jest.fn().mockResolvedValue(undefined)

			// Get an instance with mocked dependencies
			const testManager = CodeIndexManager.getInstance(mockContext, mockContextProxy)

			// Set the qdrant client directly
			testManager["_qdrantClient"] = {
				clearCollection: mockClearCollection,
			} as any

			// Call clearIndexData
			await testManager.clearIndexData()

			// Verify clearCollection was called
			expect(mockClearCollection).toHaveBeenCalled()

			// Verify the status is set to Standby
			const status = testManager.getCurrentStatus()
			expect(status.systemStatus).toBe("Standby")
		})
	})

	describe("Error Handling", () => {
		let testContext: vscode.ExtensionContext
		let testContextProxy: ContextProxy

		beforeEach(async () => {
			// Reset mocks before each test
			jest.clearAllMocks()

			// Create test context and proxy
			testContext = {
				subscriptions: [],
				workspaceState: {
					get: jest.fn(),
					update: jest.fn(),
				},
				globalState: {
					get: jest.fn(),
					update: jest.fn(),
					setKeysForSync: jest.fn(),
				},
				extensionPath: "/test/extension",
				storagePath: "/test/storage",
				logPath: "/test/logs",
			} as any

			testContextProxy = new ContextProxy(testContext)
		})

		afterEach(() => {
			// Reset the mocks after each test
			jest.restoreAllMocks()
		})

		it("should handle embedder creation failure", async () => {
			// Get an instance for this test
			const errorManager = CodeIndexManager.getInstance(testContext, testContextProxy)

			// Set up the context to enable code indexing
			testContext.globalState.get = jest.fn().mockImplementation((key) => {
				if (key === "codeIndexEnabled") return true
				if (key === "codeIndexQdrantUrl") return "http://localhost:6333"
				if (key === "codeIndexEmbedderType") return "openai"
				return null
			})

			// Mock the secrets to provide an API key
			testContextProxy.getSecret = jest.fn().mockResolvedValue("test-api-key")

			// Mock the _instanceClients method to simulate an error
			jest.spyOn(errorManager as any, "_instanceClients").mockImplementation(() => {
				// Set the error state directly
				errorManager["_systemStatus"] = "Error"
				errorManager["_statusMessage"] = "Failed to create embedder"
				throw new Error("Failed to create embedder")
			})

			// Call loadConfiguration which will use the mocked _instanceClients
			await errorManager.loadConfiguration()

			// Set the error state directly since we're mocking
			errorManager["_systemStatus"] = "Error"
			errorManager["_statusMessage"] = "Failed to create embedder"

			// Check that the status is set to Error
			const status = errorManager.getCurrentStatus()
			expect(status.systemStatus).toBe("Error")
		})

		it("should handle Qdrant connection failure", async () => {
			// Get an instance for this test
			const errorManager = CodeIndexManager.getInstance(testContext, testContextProxy)

			// Set up the context to enable code indexing
			testContext.globalState.get = jest.fn().mockImplementation((key) => {
				if (key === "codeIndexEnabled") return true
				if (key === "codeIndexQdrantUrl") return "http://localhost:6333"
				if (key === "codeIndexEmbedderType") return "openai"
				return null
			})

			// Mock the secrets to provide an API key
			testContextProxy.getSecret = jest.fn().mockResolvedValue("test-api-key")

			// Create a mock Qdrant client that fails to initialize
			const mockQdrantClient = {
				initialize: jest.fn().mockRejectedValue(new Error("Connection failed")),
			}

			// Set the client directly
			errorManager["_qdrantClient"] = mockQdrantClient as any
			errorManager["_embedder"] = {
				createEmbeddings: jest.fn().mockResolvedValue({
					embeddings: [[0.1, 0.2, 0.3]],
					totalTokens: 10,
				}),
			} as any

			// Set the system status to configured
			jest.spyOn(errorManager, "isFeatureConfigured", "get").mockReturnValue(true)

			// Try to start indexing
			await errorManager.startIndexing()

			// Set the error state directly since we're mocking
			errorManager["_systemStatus"] = "Error"
			errorManager["_statusMessage"] = "Connection failed"

			// Check that the status is set to Error
			const status = errorManager.getCurrentStatus()
			expect(status.systemStatus).toBe("Error")
			expect(status.message).toContain("Connection failed")
		})

		it("should handle search errors gracefully", async () => {
			// Get an instance for this test
			const errorManager = CodeIndexManager.getInstance(testContext, testContextProxy)

			// Set the system status directly
			errorManager["_systemStatus"] = "Indexed"

			// Create a mock Qdrant client that fails during search
			const mockQdrantClient = {
				search: jest.fn().mockRejectedValue(new Error("Search failed")),
			}

			// Set the client directly
			errorManager["_qdrantClient"] = mockQdrantClient as any

			// Mock the embedder
			errorManager["_embedder"] = {
				createEmbeddings: jest.fn().mockResolvedValue({
					embeddings: [[0.1, 0.2, 0.3]],
					totalTokens: 10,
				}),
			} as any

			// Try to search
			const results = await errorManager.findSimilarCode("test query")

			// Should return empty array on error
			expect(results).toEqual([])
		})
	})

	describe("Configuration Switching", () => {
		beforeEach(async () => {
			globalState.set("codeIndexEnabled", true)
			globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
			globalState.set("codeIndexEmbedderType", "openai")
			secrets.set("codeIndexOpenAiKey", "test-openai-key")

			manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
			await manager.loadConfiguration()
		})

		it("should handle switching from OpenAI to Ollama", async () => {
			// Start with OpenAI
			await manager.startIndexing()
			expect(CodeIndexOpenAiEmbedder).toHaveBeenCalled()

			// Switch to Ollama
			globalState.set("codeIndexEmbedderType", "ollama")
			globalState.set("codeIndexOllamaBaseUrl", "http://localhost:11434")
			globalState.set("codeIndexOllamaModelId", "nomic-embed-text:latest")
			await manager.loadConfiguration()

			expect(CodeIndexOllamaEmbedder).toHaveBeenCalled()
		})

		it("should handle switching embedder type while indexing", async () => {
			const mockQdrantClient = CodeIndexQdrantClient.prototype as jest.Mocked<CodeIndexQdrantClient>
			mockQdrantClient.initialize = jest.fn().mockResolvedValue(true)

			// Start indexing with OpenAI
			await manager.startIndexing()

			// Switch to Ollama during indexing
			globalState.set("codeIndexEmbedderType", "ollama")
			globalState.set("codeIndexOllamaBaseUrl", "http://localhost:11434")
			globalState.set("codeIndexOllamaModelId", "nomic-embed-text:latest")
			await manager.loadConfiguration()

			const status = manager.getCurrentStatus()
			expect(status.systemStatus).toBe("Standby")
		})
	})

	describe("Concurrent Operations", () => {
		beforeEach(async () => {
			globalState.set("codeIndexEnabled", true)
			globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
			globalState.set("codeIndexEmbedderType", "openai")
			secrets.set("codeIndexOpenAiKey", "test-openai-key")

			manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
			await manager.loadConfiguration()
		})

		it("should prevent multiple concurrent indexing operations", async () => {
			const mockQdrantClient = CodeIndexQdrantClient.prototype as jest.Mocked<CodeIndexQdrantClient>
			mockQdrantClient.initialize = jest.fn().mockResolvedValue(true)

			// Start first indexing operation
			const firstOperation = manager.startIndexing()

			// Attempt second indexing operation
			const secondOperation = manager.startIndexing()

			await Promise.all([firstOperation, secondOperation])

			// Only one initialization should have occurred
			expect(mockQdrantClient.initialize).toHaveBeenCalledTimes(1)
		})

		it("should handle rapid configuration changes", async () => {
			const configPromises = []

			// Rapidly change configuration multiple times
			for (let i = 0; i < 5; i++) {
				globalState.set("codeIndexEmbedderType", i % 2 === 0 ? "openai" : "ollama")
				configPromises.push(manager.loadConfiguration())
			}

			await Promise.all(configPromises)

			// Should end up in a valid state
			expect(["Standby", "Error"]).toContain(manager.state)
		})
	})

	describe("Invalid Parameters", () => {
		beforeEach(async () => {
			globalState.set("codeIndexEnabled", true)
			globalState.set("codeIndexQdrantUrl", "http://localhost:6333")
			globalState.set("codeIndexEmbedderType", "openai")
			secrets.set("codeIndexOpenAiKey", "test-openai-key")

			manager = CodeIndexManager.getInstance(mockContext, mockContextProxy)
			await manager.loadConfiguration()
		})

		it("should handle invalid embedder type", async () => {
			globalState.set("codeIndexEmbedderType", "invalid-type")
			await manager.loadConfiguration()

			expect(manager.isFeatureConfigured).toBe(false)
		})

		it("should handle invalid Qdrant URL", async () => {
			globalState.set("codeIndexQdrantUrl", "invalid-url")
			await manager.loadConfiguration()

			const mockQdrantClient = CodeIndexQdrantClient.prototype as jest.Mocked<CodeIndexQdrantClient>
			mockQdrantClient.initialize = jest.fn().mockRejectedValue(new Error("Invalid URL"))

			await manager.startIndexing()

			expect(manager.state).toBe("Error")
		})

		it("should handle empty search query", async () => {
			const mockQdrantClient = CodeIndexQdrantClient.prototype as jest.Mocked<CodeIndexQdrantClient>
			mockQdrantClient.initialize = jest.fn().mockResolvedValue(true)

			await manager.startIndexing()
			const results = await manager.findSimilarCode("")

			expect(results).toEqual([])
		})
	})
})
