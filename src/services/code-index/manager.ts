import * as vscode from "vscode"
import * as path from "path"
import { createHash } from "crypto"
import { scanDirectoryForCodeBlocks } from "./scanner"
import { CodeIndexFileWatcher, FileProcessingResult } from "./file-watcher"
import { ApiHandlerOptions } from "../../shared/api"
import { getWorkspacePath } from "../../utils/path"
import { CodeIndexOpenAiEmbedder } from "./openai-embedder"
import { CodeIndexOllamaEmbedder } from "./ollama-embedder"
import { CodeIndexQdrantClient } from "./qdrant-client"
import { QdrantSearchResult } from "./types"
import { ContextProxy } from "../../core/config/ContextProxy"
import { CodeIndexEmbedderInterface } from "./embedder-interface"

export type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error"

// Define the structure for progress updates
export interface IndexProgressUpdate {
	systemStatus: IndexingState
	message?: string // For details like error messages or current activity
}

export class CodeIndexManager {
	private _statusMessage: string = ""
	// --- Singleton Implementation ---
	private static instances = new Map<string, CodeIndexManager>() // Map workspace path to instance

	public static getInstance(context: vscode.ExtensionContext, contextProxy?: ContextProxy): CodeIndexManager {
		const workspacePath = getWorkspacePath() // Assumes single workspace for now
		if (!workspacePath) {
			throw new Error("Cannot get CodeIndexManager instance without an active workspace.")
		}

		if (!CodeIndexManager.instances.has(workspacePath) && contextProxy) {
			CodeIndexManager.instances.set(workspacePath, new CodeIndexManager(workspacePath, context, contextProxy))
		}
		return CodeIndexManager.instances.get(workspacePath)!
	}

	public static disposeAll(): void {
		CodeIndexManager.instances.forEach((instance) => instance.dispose())
		CodeIndexManager.instances.clear()
	}

	private _systemStatus: IndexingState = "Standby"
	private _fileStatuses: Record<string, string> = {}
	private _progressEmitter = new vscode.EventEmitter<{
		systemStatus: IndexingState
		fileStatuses: Record<string, string>
		message?: string
	}>()
	private _fileWatcher: CodeIndexFileWatcher | null = null
	private _isProcessing: boolean = false // Flag to track active work (scan or watch event)
	private _fileWatcherSubscriptions: vscode.Disposable[] = []

	// Dependencies
	private readonly workspacePath: string
	private readonly context: vscode.ExtensionContext
	private readonly contextProxy: ContextProxy | undefined
	private openAiOptions?: ApiHandlerOptions // Configurable
	private ollamaOptions?: ApiHandlerOptions // Configurable for Ollama
	private qdrantUrl?: string // Configurable
	private qdrantApiKey?: string // Configurable
	private isEnabled: boolean = false // New: enabled flag
	private embedderType: string = "openai" // Default to OpenAI embedder

	private _embedder?: CodeIndexEmbedderInterface
	private _qdrantClient?: CodeIndexQdrantClient

	// Webview provider reference for status updates
	private webviewProvider?: { postMessage: (msg: any) => void }

	// --- State Management ---
	private _setSystemState(newState: IndexingState, message?: string): void {
		const stateChanged =
			newState !== this._systemStatus || (message !== undefined && message !== this._statusMessage)

		if (stateChanged) {
			this._systemStatus = newState
			if (message !== undefined) {
				this._statusMessage = message
			}
			this.postStatusUpdate()
			this._progressEmitter.fire({
				systemStatus: this._systemStatus,
				fileStatuses: this._fileStatuses,
				message: this._statusMessage,
			})
			console.log(
				`[CodeIndexManager] System state changed to: ${this._systemStatus}${message ? ` (${message})` : ""}`,
			)
		}
	}

	// Private constructor for singleton pattern
	private constructor(workspacePath: string, context: vscode.ExtensionContext, contextProxy: ContextProxy) {
		this.workspacePath = workspacePath
		this.context = context
		this.contextProxy = contextProxy
		// Initial state is set implicitly or via loadConfiguration
	}

	// --- Public API ---

	public readonly onProgressUpdate = this._progressEmitter.event

	public get state(): IndexingState {
		return this._systemStatus
	}

	public get isFeatureEnabled(): boolean {
		return this.isEnabled
	}

	public get isFeatureConfigured(): boolean {
		return this.isConfigured()
	}

	_instanceClients() {
		console.log("[CodeIndexManager] Recreating clients...")

		if (this.isConfigured() && this.isEnabled) {
			// Create the appropriate embedder based on embedderType configuration
			if (this.embedderType === "ollama" && this.ollamaOptions) {
				this._embedder = new CodeIndexOllamaEmbedder(this.ollamaOptions)
			} else if (this.openAiOptions) {
				this._embedder = new CodeIndexOpenAiEmbedder(this.openAiOptions)
			}
			this._qdrantClient = new CodeIndexQdrantClient(this.workspacePath, this.qdrantUrl, this.qdrantApiKey)
			this.startIndexing()
		}
	}

	/**
	 * Loads persisted configuration from globalState.
	 */
	public async loadConfiguration(): Promise<void> {
		console.log("[CodeIndexManager] Loading configuration...")

		const prevEnabled = this.isEnabled
		const prevConfigured = this.isConfigured?.() ?? false

		const prevOpenAiKey = this.openAiOptions?.openAiNativeApiKey
		const prevQdrantUrl = this.qdrantUrl
		const prevQdrantApiKey = this.qdrantApiKey
		const prevEmbedderType = this.embedderType

		// Fetch settings directly using getGlobalState
		const codeIndexEnabled = this.contextProxy?.getGlobalState("codeIndexEnabled") ?? false
		const codeIndexQdrantUrl = this.contextProxy?.getGlobalState("codeIndexQdrantUrl") ?? ""
		const codeIndexEmbedderType = this.contextProxy?.getGlobalState("codeIndexEmbedderType") ?? "openai"
		const codeIndexOllamaBaseUrl =
			this.contextProxy?.getGlobalState("codeIndexOllamaBaseUrl") ?? "http://localhost:11434"
		const codeIndexOllamaModelId =
			this.contextProxy?.getGlobalState("codeIndexOllamaModelId") ?? "nomic-embed-text:latest"

		const openAiKey = this.contextProxy?.getSecret("codeIndexOpenAiKey") ?? ""
		const qdrantApiKey = this.contextProxy?.getSecret("codeIndexQdrantApiKey") ?? ""

		console.log("KEYS", openAiKey, qdrantApiKey)

		this.isEnabled = codeIndexEnabled
		this.qdrantUrl = codeIndexQdrantUrl
		this.qdrantApiKey = qdrantApiKey ?? ""
		this.openAiOptions = { openAiNativeApiKey: openAiKey }
		this.ollamaOptions = {
			ollamaBaseUrl: codeIndexOllamaBaseUrl as string,
			ollamaModelId: codeIndexOllamaModelId as string,
		}
		this.embedderType = codeIndexEmbedderType as string

		const nowConfigured = this.isConfigured()

		if (!this.isEnabled) {
			this.stopWatcher()
			this._embedder = undefined
			this._qdrantClient = undefined
			console.log("[CodeIndexManager] Code Indexing Disabled.")
			this._setSystemState("Standby", "Code Indexing Disabled.")
			return
		}

		if (!nowConfigured) {
			this.stopWatcher()
			this._embedder = undefined
			this._qdrantClient = undefined
			console.log("[CodeIndexManager] Missing configuration.")
			this._setSystemState("Standby", "Missing configuration.")
			return
		}

		// Only recreate embedder/client and restart indexing if transitioning from disabled/unconfigured to enabled+configured or if api keys change
		const shouldRestart =
			((!prevEnabled || !prevConfigured) && codeIndexEnabled && nowConfigured) ||
			prevOpenAiKey !== this.openAiOptions?.openAiNativeApiKey ||
			(prevQdrantApiKey !== this.qdrantApiKey && prevQdrantUrl !== this.qdrantUrl) ||
			prevEmbedderType !== this.embedderType

		if (shouldRestart && nowConfigured) {
			await this._instanceClients()
		} else {
			console.log("[CodeIndexManager] Configuration loaded. No restart needed.")
			// If already configured and enabled, ensure state reflects readiness if standby
			if (this._systemStatus === "Standby") {
				this._setSystemState("Standby", "Configuration ready. Ready to index.")
			}
		}
	}

	private async _resetCacheFile(): Promise<void> {
		try {
			const cacheFileName = `roo-index-cache-${createHash("sha256").update(this.workspacePath).digest("hex")}.json`
			const cachePath = vscode.Uri.joinPath(this.context.globalStorageUri, cacheFileName)

			try {
				await vscode.workspace.fs.writeFile(cachePath, Buffer.from("{}", "utf-8"))
				console.log(`[CodeIndexManager] Cache file reset (emptied) at ${cachePath.fsPath}`)
			} catch (error) {
				console.error("[CodeIndexManager] Failed to reset (empty) cache file:", error)
			}
		} catch (error) {
			console.error("[CodeIndexManager] Unexpected error during cache file reset:", error)
		}
	}

	/**
	 * Initiates the indexing process (initial scan and starts watcher).
	 */

	public async startIndexing(): Promise<void> {
		if (!this.isConfigured()) {
			this._setSystemState("Standby", "Cannot start: Missing OpenAI or Qdrant configuration.")
			console.warn("[CodeIndexManager] Start rejected: Missing configuration.")
			return
		}

		if (
			this._isProcessing ||
			(this._systemStatus !== "Standby" && this._systemStatus !== "Error" && this._systemStatus !== "Indexed")
		) {
			console.warn(`[CodeIndexManager] Start rejected: Already processing or in state ${this._systemStatus}.`)
			return
		}

		this._isProcessing = true
		this._setSystemState("Indexing", "Initializing Qdrant connection and collection...")

		try {
			// Ensure client is initialized before calling initialize
			if (!this._qdrantClient) {
				throw new Error(
					"Cannot initialize collection: Qdrant client cannot be initialized - configuration missing.",
				)
			}
			const collectionCreated = await this._qdrantClient.initialize() // Call the existing initialize method

			if (collectionCreated) {
				await this._resetCacheFile()
				console.log("[CodeIndexManager] Qdrant collection created; cache file emptied.")
			}

			this._setSystemState("Indexing", "Qdrant ready. Starting workspace scan...")
		} catch (initError: any) {
			console.error("[CodeIndexManager] Failed to initialize Qdrant client or collection:", initError)
			this._setSystemState("Error", `Failed to initialize Qdrant: ${initError.message || "Unknown error"}`)
			this._isProcessing = false // Stop processing on critical error
			return // Exit if initialization fails
		}

		try {
			const { stats } = await scanDirectoryForCodeBlocks(
				this.workspacePath,
				this._embedder!,
				this._qdrantClient!,
				undefined, // Let scanner create its own ignore controller
				this.context,
				(batchError: Error) => {
					this._setSystemState("Error", `Failed during initial scan batch: ${batchError.message}`)
				},
			)

			console.log(
				`[CodeIndexManager] Initial scan complete. Processed: ${stats.processed}, Skipped: ${stats.skipped}`,
			)

			await this._startWatcher()

			this._setSystemState("Indexed", "Workspace scan and watcher started.")
		} catch (error: any) {
			console.error("[CodeIndexManager] Error during indexing:", error)
			try {
				await this._qdrantClient?.clearCollection()
			} catch (cleanupError) {
				console.error("[CodeIndexManager] Failed to clean up after error:", cleanupError)
			}

			// Attempt to clear cache file after scan error
			await this._resetCacheFile()
			console.log("[CodeIndexManager] Cleared cache file due to scan error.")

			this._setSystemState("Error", `Failed during initial scan: ${error.message || "Unknown error"}`)
			this.stopWatcher() // Clean up watcher if it started
		} finally {
			this._isProcessing = false
		}
	}

	/**
	 * Stops the file watcher and potentially cleans up resources.
	 */
	public stopWatcher(): void {
		if (this._fileWatcher) {
			this._fileWatcher.dispose()
			this._fileWatcher = null
			this._fileWatcherSubscriptions.forEach((sub) => sub.dispose())
			this._fileWatcherSubscriptions = []
			console.log("[CodeIndexManager] File watcher stopped.")
			// Transition state appropriately only if not already in Error state
			if (this.state !== "Error") {
				this._setSystemState("Standby", "File watcher stopped.") // Return to standby if stopped manually
			}
		}
		this._isProcessing = false // Ensure processing flag is reset
	}

	/**
	 * Cleans up the manager instance.
	 */
	public dispose(): void {
		this.stopWatcher()
		this._progressEmitter.dispose()
		console.log(`[CodeIndexManager] Disposed for workspace: ${this.workspacePath}`)
	}

	/**
	 * Clears all index data by stopping the watcher, clearing the Qdrant collection,
	 * and deleting the cache file.
	 */
	public async clearIndexData(): Promise<void> {
		console.log("[CodeIndexManager] Clearing code index data...")
		this._isProcessing = true

		try {
			// Stop the watcher if running
			await this.stopWatcher() // stopWatcher already sets state to Standby if not Error

			// Clear Qdrant collection
			try {
				// Re-initialize client if needed (might have been cleared by stopWatcher)
				if (!this._qdrantClient && this.isConfigured()) {
					this._qdrantClient = new CodeIndexQdrantClient(this.workspacePath, this.qdrantUrl)
				}
				if (this._qdrantClient) {
					await this._qdrantClient.clearCollection()
					console.log("[CodeIndexManager] Vector collection cleared.")
				} else {
					console.warn("[CodeIndexManager] Qdrant client not available, skipping vector collection clear.")
				}
			} catch (error) {
				console.error("[CodeIndexManager] Failed to clear vector collection:", error)
				this._setSystemState("Error", `Failed to clear vector collection: ${error.message}`)
				// Don't re-throw, attempt cache deletion
			}

			// Delete cache file
			await this._resetCacheFile()
			console.log("[CodeIndexManager] Cache file emptied.")

			// If no errors occurred during clearing, confirm success
			if (this._systemStatus !== "Error") {
				this._setSystemState("Standby", "Index data cleared successfully.")
				console.log("[CodeIndexManager] Code index data cleared successfully.")
			}
		} finally {
			this._isProcessing = false
		}
	}

	// --- Private Helpers ---

	// File status update helper
	private _updateFileStatus(filePath: string, fileStatus: string, message?: string): void {
		if (!this.isConfigured()) {
			console.warn("[CodeIndexManager] Ignoring file status update because system is not properly configured.")
			return
		}

		let stateChanged = false

		if (this._fileStatuses[filePath] !== fileStatus) {
			this._fileStatuses[filePath] = fileStatus
			stateChanged = true
		}

		// Update overall message ONLY if indexing and message is provided
		if (message && this._systemStatus === "Indexing" && message !== this._statusMessage) {
			this._statusMessage = message
			stateChanged = true
			console.log(`[CodeIndexManager] Status message updated during indexing: ${this._statusMessage}`)
		}

		if (stateChanged) {
			this.postStatusUpdate()
			this._progressEmitter.fire({
				systemStatus: this._systemStatus,
				fileStatuses: this._fileStatuses,
				message: this._statusMessage,
			})
		}
	}

	public getCurrentStatus() {
		return {
			systemStatus: this._systemStatus,
			fileStatuses: this._fileStatuses,
			message: this._statusMessage,
		}
	}

	/**
	 * Posts the current status update to the webview if available.
	 */
	private postStatusUpdate() {
		if (this.webviewProvider) {
			this.webviewProvider.postMessage({
				type: "indexingStatusUpdate",
				values: {
					systemStatus: this._systemStatus,
					message: this._statusMessage,
					// Optionally include fileStatuses if the webview needs it
					// fileStatuses: this._fileStatuses
				},
			})
		}
	}

	private isConfigured(): boolean {
		const hasOpenAiCredentials = !!this.openAiOptions?.openAiNativeApiKey
		const hasOllamaConfig = !!this.ollamaOptions?.ollamaBaseUrl && !!this.ollamaOptions?.ollamaModelId
		const hasQdrantEndpoint = !!this.qdrantUrl

		// Check configuration based on the selected embedder type
		if (this.embedderType === "ollama") {
			return hasOllamaConfig && hasQdrantEndpoint
		} else {
			return hasOpenAiCredentials && hasQdrantEndpoint
		}
	}

	private async _startWatcher(): Promise<void> {
		if (this._fileWatcher) {
			console.log("[CodeIndexManager] File watcher already running.")
			return
		}

		// Ensure embedder and client are initialized before starting watcher
		if (!this._embedder || !this._qdrantClient) {
			throw new Error("Cannot start watcher: Clients not initialized.")
		}

		this._setSystemState("Indexing", "Initializing file watcher...")

		this._fileWatcher = new CodeIndexFileWatcher(
			this.workspacePath,
			this.context,
			this._embedder, // Pass initialized embedder
			this._qdrantClient, // Pass initialized client
		)
		await this._fileWatcher.initialize()

		this._fileWatcherSubscriptions = [
			this._fileWatcher.onDidStartProcessing((filePath: string) => {
				this._updateFileStatus(filePath, "Processing", `Processing file: ${path.basename(filePath)}`)
			}),
			this._fileWatcher.onDidFinishProcessing((event: FileProcessingResult) => {
				if (event.error) {
					this._updateFileStatus(event.path, "Error")
					console.error(`[CodeIndexManager] Error processing file ${event.path}:`, event.error)
				} else {
					this._updateFileStatus(
						event.path,
						"Indexed",
						`Finished processing ${path.basename(event.path)}. Index up-to-date.`,
					)
				}

				if (this._systemStatus === "Indexing") {
					this._setSystemState("Indexed", "Index up-to-date.")
				}
			}),
			this._fileWatcher.onError((error: Error) => {
				console.error("[CodeIndexManager] File watcher encountered an error:", error)
				this._setSystemState("Error", `File watcher error: ${error.message}`)
			}),
		]

		console.log("[CodeIndexManager] File watcher started.")
	}

	/**
	 * Finds code blocks by similarity to the input query.
	 * @param query The search query text.
	 * @param limit Optional maximum number of results to return.
	 * @returns Promise<QdrantSearchResult[]> Array of search results, or empty array if query fails.
	 */
	public async findSimilarCode(query: string, limit: number = 10): Promise<QdrantSearchResult[]> {
		if (!this._embedder || !this._qdrantClient || this._systemStatus !== "Indexed") {
			console.log("[CodeIndexManager] Cannot search: embedder, client missing or index not ready.")
			return []
		}

		try {
			// Check if more than one model is available via Ollama
			const embedderResponse = await this._embedder.createEmbeddings([query])
			if (!embedderResponse || !embedderResponse.embeddings || !embedderResponse.embeddings[0]) {
				throw new Error("Failed to create embeddings for search query")
			}

			// Get the vector embedding for the query
			const vector = embedderResponse.embeddings[0]

			// Execute the similarity search
			const results = await this._qdrantClient.search(vector, limit)
			return results
		} catch (error) {
			console.error("[CodeIndexManager] Search error:", error)
			return []
		}
	}
}
