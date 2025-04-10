import * as vscode from "vscode"
import { CodeIndexManager } from "../manager"
import { getWorkspacePath } from "../../../utils/path"

// Mock dependencies
jest.mock("vscode")
jest.mock("../../../utils/path")
jest.mock("../scanner")
jest.mock("../file-watcher")
jest.mock("../openai-embedder")
jest.mock("../qdrant-client")

describe("CodeIndexManager", () => {
	// Setup common mocks
	const mockWorkspacePath = "/test/workspace"
	const mockContext = {
		globalState: {
			get: jest.fn(),
			update: jest.fn(),
		},
		globalStorageUri: vscode.Uri.file("/test/storage"),
	} as unknown as vscode.ExtensionContext

	beforeEach(() => {
		jest.clearAllMocks()
		// Setup getWorkspacePath mock
		jest.mocked(getWorkspacePath).mockReturnValue(mockWorkspacePath)

		// Reset the singleton instance for each test
		// @ts-expect-error - Accessing private static property for testing
		CodeIndexManager.instances = new Map()
	})

	describe("Feature Enabled/Configured Properties", () => {
		it("should report feature as disabled when codeIndexEnabled is false", async () => {
			// Mock globalState.get to return disabled
			mockContext.globalState.get = jest.fn().mockImplementation((key) => {
				if (key === "codeIndexEnabled") return false
				if (key === "codeIndexOpenAiKey") return "test-key"
				if (key === "codeIndexQdrantUrl") return "http://test-qdrant"
				return undefined
			})

			const manager = CodeIndexManager.getInstance(mockContext)
			await manager.loadConfiguration()

			// Verify feature is reported as disabled
			expect(manager.isFeatureEnabled).toBe(false)
		})

		it("should report feature as enabled when codeIndexEnabled is true", async () => {
			// Mock globalState.get to return enabled
			mockContext.globalState.get = jest.fn().mockImplementation((key) => {
				if (key === "codeIndexEnabled") return true
				if (key === "codeIndexOpenAiKey") return "test-key"
				if (key === "codeIndexQdrantUrl") return "http://test-qdrant"
				return undefined
			})

			const manager = CodeIndexManager.getInstance(mockContext)
			await manager.loadConfiguration()

			// Verify feature is reported as enabled
			expect(manager.isFeatureEnabled).toBe(true)
		})

		it("should report feature as not configured when OpenAI key is missing", async () => {
			// Mock globalState.get to return enabled but missing OpenAI key
			mockContext.globalState.get = jest.fn().mockImplementation((key) => {
				if (key === "codeIndexEnabled") return true
				if (key === "codeIndexOpenAiKey") return ""
				if (key === "codeIndexQdrantUrl") return "http://test-qdrant"
				return undefined
			})

			const manager = CodeIndexManager.getInstance(mockContext)
			await manager.loadConfiguration()

			// Verify feature is reported as not configured
			expect(manager.isFeatureConfigured).toBe(false)
		})

		it("should report feature as not configured when Qdrant URL is missing", async () => {
			// Mock globalState.get to return enabled but missing Qdrant URL
			mockContext.globalState.get = jest.fn().mockImplementation((key) => {
				if (key === "codeIndexEnabled") return true
				if (key === "codeIndexOpenAiKey") return "test-key"
				if (key === "codeIndexQdrantUrl") return ""
				return undefined
			})

			const manager = CodeIndexManager.getInstance(mockContext)
			await manager.loadConfiguration()

			// Verify feature is reported as not configured
			expect(manager.isFeatureConfigured).toBe(false)
		})

		it("should report feature as configured when all required settings are present", async () => {
			// Mock globalState.get to return all required settings
			mockContext.globalState.get = jest.fn().mockImplementation((key) => {
				if (key === "codeIndexEnabled") return true
				if (key === "codeIndexOpenAiKey") return "test-key"
				if (key === "codeIndexQdrantUrl") return "http://test-qdrant"
				return undefined
			})

			const manager = CodeIndexManager.getInstance(mockContext)
			await manager.loadConfiguration()

			// Verify feature is reported as configured
			expect(manager.isFeatureConfigured).toBe(true)
		})
	})
})
