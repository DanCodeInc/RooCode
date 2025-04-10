import * as vscode from "vscode"
// path is used in the implementation but not directly in tests
import { FileWatcher } from "../processors/file-watcher"
import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { mockLoadRequiredLanguageParsers } from "./mocks/tree-sitter-mock"
import { RooIgnoreController } from "../../../core/ignore/RooIgnoreController"
import { EmbeddingResponse } from "../interfaces" // Import EmbeddingResponse

// Define CodeBlock type locally for the mock
interface CodeBlock {
	file_path: string
	identifier: string
	type: string
	start_line: number
	end_line: number
	content: string
	fileHash: string
	segmentHash: string
}

// Mock dependencies
// Mock dependencies
let mockWatcherInstance: { dispose: jest.Mock<() => void> } // Variable to capture the watcher mock
jest.mock("vscode", () => {
	const mockDispose = jest.fn<() => void>()
	mockWatcherInstance = { dispose: mockDispose } // Capture the dispose mock
	return {
		workspace: {
			fs: {
				readFile: jest.fn<() => Promise<Buffer>>().mockResolvedValue(Buffer.from("{}")),
				writeFile: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
				stat: jest.fn<() => Promise<vscode.FileStat>>().mockResolvedValue({ size: 1000 } as vscode.FileStat), // Added type assertion
			},
			createFileSystemWatcher: jest.fn().mockReturnValue({
				onDidCreate: jest.fn(),
				onDidChange: jest.fn(),
				onDidDelete: jest.fn(),
				dispose: mockDispose, // Use the captured mock
			}),
			asRelativePath: jest.fn().mockImplementation(function (path) {
				return path
			}),
		},
		Uri: {
			file: jest.fn<(path: string) => vscode.Uri>().mockImplementation(function (path) {
				return { fsPath: path } as vscode.Uri
			}), // Fixed implementation
			joinPath: jest
				.fn<(base: vscode.Uri, path: string) => vscode.Uri>()
				.mockImplementation(function (base, pathSegment) {
					return { fsPath: `${base.fsPath}/${pathSegment}` } as vscode.Uri
				}), // Fixed implementation
		},
		EventEmitter: jest.fn().mockImplementation(() => ({
			event: jest.fn(),
			fire: jest.fn(),
			dispose: jest.fn(),
		})),
	}
})
jest.mock("../../../utils/path", () => ({
	getWorkspacePath: jest.fn<() => string>().mockReturnValue("/test/workspace"),
}))
jest.mock("../../../core/ignore/RooIgnoreController", () => {
	return {
		RooIgnoreController: jest.fn().mockImplementation(() => ({
			validateAccess: jest.fn<(filePath: string) => boolean>().mockReturnValue(true),
		})),
	}
})
jest.mock("../../tree-sitter/languageParser", () => ({
	loadRequiredLanguageParsers: mockLoadRequiredLanguageParsers,
}))
jest.mock("../processors/parser", () => ({
	codeParser: {
		parseFile: jest.fn<(filePath: string) => Promise<CodeBlock[]>>().mockResolvedValue([
			// Added type
			{
				file_path: "test.js",
				identifier: "testFunction",
				type: "function",
				start_line: 1,
				end_line: 5,
				content: "function testFunction() { return true; }",
				fileHash: "test-hash",
				segmentHash: "segment-hash",
			},
		]),
	},
}))

describe("FileWatcher", () => {
	let fileWatcher: FileWatcher
	let mockContext: any
	let mockEmbedder: any
	let mockVectorStore: any

	beforeEach(() => {
		// Reset mocks
		jest.resetAllMocks()

		// Create mock context
		mockContext = {
			globalStorageUri: { fsPath: "/test/storage" },
		}

		// Create mock embedder
		mockEmbedder = {
			createEmbeddings: jest.fn<(texts: string[]) => Promise<EmbeddingResponse>>().mockResolvedValue({
				// Added type
				embeddings: [[0.1, 0.2, 0.3]],
				usage: { prompt_tokens: 10, total_tokens: 20 },
			}),
		}

		// Create mock vector store
		mockVectorStore = {
			deletePointsByFilePath: jest.fn<(filePath: string) => Promise<void>>().mockResolvedValue(undefined), // Added type
			upsertPoints: jest
				.fn<(points: Array<{ id: string; vector: number[]; payload: Record<string, any> }>) => Promise<void>>()
				.mockResolvedValue(undefined), // Fixed type to match IVectorStore interface
		}

		// Create file watcher
		fileWatcher = new FileWatcher("/test/workspace", mockContext, mockEmbedder, mockVectorStore)
	})

	describe("initialize", () => {
		it("should initialize correctly", async () => {
			// Act
			await fileWatcher.initialize()

			// Assert
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled()
			expect(vscode.workspace.fs.readFile).toHaveBeenCalled()
		})
	})

	describe("processFile", () => {
		it("should process a file correctly", async () => {
			// Arrange
			await fileWatcher.initialize()

			// Act
			const result = await fileWatcher.processFile("/test/workspace/test.js")

			// Assert
			expect(result.status).toBe("success")
			expect(mockVectorStore.deletePointsByFilePath).toHaveBeenCalled()
			expect(mockEmbedder.createEmbeddings).toHaveBeenCalled()
			expect(mockVectorStore.upsertPoints).toHaveBeenCalled()
		})

		it("should skip ignored files", async () => {
			// Arrange
			await fileWatcher.initialize()

			// Mock RooIgnoreController to ignore the file
			;(RooIgnoreController as jest.Mock).mockImplementation(() => ({
				validateAccess: jest.fn().mockReturnValue(false),
			}))

			// Create a new file watcher with the mocked RooIgnoreController
			fileWatcher = new FileWatcher("/test/workspace", mockContext, mockEmbedder, mockVectorStore)
			await fileWatcher.initialize()

			// Act
			const result = await fileWatcher.processFile("/test/workspace/ignored.js")

			// Assert
			expect(result.status).toBe("skipped")
			expect(result.reason).toBe("File is ignored by .rooignore")
		})

		it("should skip files that are too large", async () => {
			// Arrange
			await fileWatcher.initialize()

			// Mock vscode.workspace.fs.stat to return a large file size
			;(vscode.workspace.fs.stat as jest.Mock<() => Promise<vscode.FileStat>>).mockResolvedValueOnce({
				size: 2 * 1024 * 1024,
			} as vscode.FileStat) // Added type assertion

			// Act
			const result = await fileWatcher.processFile("/test/workspace/large.js")

			// Assert
			expect(result.status).toBe("skipped")
			expect(result.reason).toBe("File is too large")
		})

		it("should handle errors during processing", async () => {
			// Arrange
			await fileWatcher.initialize()

			// Mock codeParser.parseFile to throw an error
			const mockParseFile = require("../processors/parser").codeParser.parseFile
			mockParseFile.mockRejectedValueOnce(new Error("Parse error"))

			// Act
			const result = await fileWatcher.processFile("/test/workspace/error.js")

			// Assert
			expect(result.status).toBe("error")
			expect(result.error).toBeInstanceOf(Error)
		})
	})

	describe("dispose", () => {
		it("should dispose correctly", async () => {
			// Arrange
			await fileWatcher.initialize()

			// Act
			fileWatcher.dispose()

			// Assert
			expect(mockWatcherInstance.dispose).toHaveBeenCalled() // Assert on the captured mock
		})
	})
})
