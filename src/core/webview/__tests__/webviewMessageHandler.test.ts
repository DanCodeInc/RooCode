import * as vscode from "vscode"
import { webviewMessageHandler } from "../webviewMessageHandler"
import { ClineProvider } from "../ClineProvider"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import { CodeIndexManager } from "../../../services/code-index/manager"

// Mock dependencies
jest.mock("vscode")
jest.mock("../../../services/code-index/manager")

describe("webviewMessageHandler", () => {
	let mockProvider: ClineProvider
	let mockCodeIndexManager: jest.Mocked<CodeIndexManager>
	let mockContextProxy: any
	let globalState: Map<string, any>

	beforeEach(() => {
		jest.clearAllMocks()

		// Setup mock context proxy
		globalState = new Map()
		mockContextProxy = {
			getValue: jest.fn((key: string) => globalState.get(key)),
			setValue: jest.fn((key: string, value: any) => {
				globalState.set(key, value)
				return Promise.resolve()
			}),
		}

		// Setup mock code index manager
		mockCodeIndexManager = {
			loadConfiguration: jest.fn().mockResolvedValue(undefined),
			getCurrentStatus: jest.fn().mockReturnValue({
				systemStatus: "Standby",
				message: "Ready",
			}),
			clearIndexData: jest.fn().mockResolvedValue(undefined),
		} as any

		// Setup mock provider
		mockProvider = {
			contextProxy: mockContextProxy,
			codeIndexManager: mockCodeIndexManager,
			postMessageToWebview: jest.fn(),
			postStateToWebview: jest.fn(),
			log: jest.fn(),
		} as any
	})

	describe("Code Index Settings Messages", () => {
		it("should handle codeIndexEnabled message", async () => {
			const message: WebviewMessage = {
				type: "codeIndexEnabled",
				bool: true,
			}

			await webviewMessageHandler(mockProvider, message)

			// Verify state was updated
			expect(mockContextProxy.setValue).toHaveBeenCalledWith("codeIndexEnabled", true)

			// Verify configuration was reloaded
			expect(mockCodeIndexManager.loadConfiguration).toHaveBeenCalled()

			// Verify state was posted back to webview
			expect(mockProvider.postStateToWebview).toHaveBeenCalled()
		})

		it("should handle codeIndexQdrantUrl message", async () => {
			const message: WebviewMessage = {
				type: "codeIndexQdrantUrl",
				text: "http://test-qdrant:6333",
			}

			await webviewMessageHandler(mockProvider, message)

			// Verify state was updated
			expect(mockContextProxy.setValue).toHaveBeenCalledWith("codeIndexQdrantUrl", "http://test-qdrant:6333")

			// Verify configuration was reloaded
			expect(mockCodeIndexManager.loadConfiguration).toHaveBeenCalled()

			// Verify state was posted back to webview
			expect(mockProvider.postStateToWebview).toHaveBeenCalled()
		})

		it("should handle codeIndexEmbedderType message", async () => {
			const message: WebviewMessage = {
				type: "codeIndexEmbedderType",
				text: "ollama",
			}

			await webviewMessageHandler(mockProvider, message)

			// Verify state was updated
			expect(mockContextProxy.setValue).toHaveBeenCalledWith("codeIndexEmbedderType", "ollama")

			// Verify configuration was reloaded
			expect(mockCodeIndexManager.loadConfiguration).toHaveBeenCalled()

			// Verify state was posted back to webview
			expect(mockProvider.postStateToWebview).toHaveBeenCalled()
		})

		it("should handle codeIndexOllamaBaseUrl message", async () => {
			const message: WebviewMessage = {
				type: "codeIndexOllamaBaseUrl",
				text: "http://custom-ollama:11434",
			}

			await webviewMessageHandler(mockProvider, message)

			// Verify state was updated
			expect(mockContextProxy.setValue).toHaveBeenCalledWith(
				"codeIndexOllamaBaseUrl",
				"http://custom-ollama:11434",
			)

			// Verify configuration was reloaded
			expect(mockCodeIndexManager.loadConfiguration).toHaveBeenCalled()

			// Verify state was posted back to webview
			expect(mockProvider.postStateToWebview).toHaveBeenCalled()
		})

		it("should handle codeIndexOllamaModelId message", async () => {
			const message: WebviewMessage = {
				type: "codeIndexOllamaModelId",
				text: "custom-model",
			}

			await webviewMessageHandler(mockProvider, message)

			// Verify state was updated
			expect(mockContextProxy.setValue).toHaveBeenCalledWith("codeIndexOllamaModelId", "custom-model")

			// Verify configuration was reloaded
			expect(mockCodeIndexManager.loadConfiguration).toHaveBeenCalled()

			// Verify state was posted back to webview
			expect(mockProvider.postStateToWebview).toHaveBeenCalled()
		})

		it("should handle requestIndexingStatus message", async () => {
			const message: WebviewMessage = {
				type: "requestIndexingStatus",
			}

			await webviewMessageHandler(mockProvider, message)

			// Verify status was requested
			expect(mockCodeIndexManager.getCurrentStatus).toHaveBeenCalled()

			// Verify status was posted to webview
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "indexingStatusUpdate",
				values: {
					systemStatus: "Standby",
					message: "Ready",
				},
			})
		})

		it("should handle clearIndexData message", async () => {
			const message: WebviewMessage = {
				type: "clearIndexData",
			}

			await webviewMessageHandler(mockProvider, message)

			// Verify index was cleared
			expect(mockCodeIndexManager.clearIndexData).toHaveBeenCalled()

			// Verify success message was posted to webview
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "indexCleared",
				values: { success: true },
			})
		})

		it("should handle clearIndexData error", async () => {
			const errorMessage = "Failed to clear index"
			mockCodeIndexManager.clearIndexData.mockRejectedValue(new Error(errorMessage))

			const message: WebviewMessage = {
				type: "clearIndexData",
			}

			await webviewMessageHandler(mockProvider, message)

			// Verify error was logged
			expect(mockProvider.log).toHaveBeenCalled()

			// Verify error message was posted to webview
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "indexCleared",
				values: {
					success: false,
					error: errorMessage,
				},
			})
		})
	})
})
