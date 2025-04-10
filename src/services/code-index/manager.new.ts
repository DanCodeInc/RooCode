import * as vscode from 'vscode';
import * as path from 'path';
import { createHash } from 'crypto';
import { ApiHandlerOptions } from '../../shared/api';
import { getWorkspacePath } from '../../utils/path';
import { 
    ICodeIndexManager, 
    IndexingState, 
    QdrantSearchResult, 
    IEmbedder, 
    IVectorStore,
    IFileWatcher
} from './interfaces';
import { OpenAiEmbedder } from './embedders';
import { QdrantVectorStore } from './vector-stores';
import { DirectoryScanner, FileWatcher } from './processors';

/**
 * Implementation of the code index manager
 */
export class CodeIndexManager implements ICodeIndexManager {
    private static instance: CodeIndexManager | null = null;
    
    private _systemStatus: IndexingState = 'Standby';
    private _fileStatuses: Record<string, string> = {};
    private _progressEmitter = new vscode.EventEmitter<{
        systemStatus: IndexingState;
        fileStatuses: Record<string, string>;
        message?: string;
    }>();
    private _fileWatcher: IFileWatcher | null = null;
    private _fileWatcherSubscriptions: vscode.Disposable[] = [];
    private _isProcessing: boolean = false;
    
    // Dependencies
    private readonly workspacePath: string;
    private readonly context: vscode.ExtensionContext;
    private openAiOptions?: ApiHandlerOptions;
    private qdrantUrl?: string;
    private isEnabled: boolean = false;
    
    private _embedder?: IEmbedder;
    private _vectorStore?: IVectorStore;
    
    // Webview provider reference for status updates
    private webviewProvider?: { postMessage: (msg: any) => void };
    
    // Queue for state updates
    private updateQueue: Array<{ type: 'system' | 'file'; payload: any }> = [];
    private isProcessingQueue: boolean = false;
    private returnToIndexedTimer: NodeJS.Timeout | null = null;
    
    /**
     * Private constructor for singleton pattern
     * @param workspacePath Path to the workspace
     * @param context VS Code extension context
     */
    private constructor(workspacePath: string, context: vscode.ExtensionContext) {
        this.workspacePath = workspacePath;
        this.context = context;
    }
    
    /**
     * Gets the singleton instance
     * @param workspacePath Path to the workspace
     * @param context VS Code extension context
     * @returns Singleton instance
     */
    public static getInstance(workspacePath: string, context: vscode.ExtensionContext): CodeIndexManager {
        if (!CodeIndexManager.instance) {
            CodeIndexManager.instance = new CodeIndexManager(workspacePath, context);
        }
        return CodeIndexManager.instance;
    }
    
    /**
     * Event emitted when progress is updated
     */
    public readonly onProgressUpdate = this._progressEmitter.event;
    
    /**
     * Current state of the indexing process
     */
    public get state(): IndexingState {
        return this._systemStatus;
    }
    
    /**
     * Checks if the manager is configured
     * @returns Boolean indicating if the manager is configured
     */
    private isConfigured(): boolean {
        return !!(this.openAiOptions?.openAiNativeApiKey && this.qdrantUrl);
    }
    
    /**
     * Loads configuration from storage
     */
    public async loadConfiguration(): Promise<void> {
        console.log('[CodeIndexManager] Loading configuration...');
        
        const prevEnabled = this.isEnabled;
        const prevConfigured = this.isConfigured() ?? false;
        
        const enabled = this.context.globalState.get<boolean>('codeIndexEnabled', false);
        const openAiKey = this.context.globalState.get<string>('codeIndexOpenAiKey', '');
        const qdrantUrl = this.context.globalState.get<string>('codeIndexQdrantUrl', '');
        
        this.isEnabled = enabled;
        this.openAiOptions = { openAiNativeApiKey: openAiKey };
        this.qdrantUrl = qdrantUrl;
        
        const nowConfigured = this.isConfigured();
        
        // Determine if we need to restart indexing
        const shouldRestart = this.isEnabled && (
            !prevEnabled || // Was disabled, now enabled
            !prevConfigured || // Was not configured, now configured
            (prevConfigured && nowConfigured && this._systemStatus === 'Error') // Was in error state
        );
        
        if (shouldRestart) {
            this._embedder = new OpenAiEmbedder(this.openAiOptions!);
            this._vectorStore = new QdrantVectorStore(this.workspacePath, this.qdrantUrl);
            console.log('[CodeIndexManager] Configuration loaded. Starting indexing...');
            await this.startIndexing();
        } else {
            console.log('[CodeIndexManager] Configuration loaded. No restart needed.');
            // If already configured and enabled, ensure state reflects readiness if standby
            if (this._systemStatus === 'Standby') {
                this.enqueueStateUpdate({
                    type: 'system',
                    payload: { systemStatus: 'Standby', message: 'Configuration ready. Ready to index.' },
                });
            }
        }
    }
    
    /**
     * Updates configuration
     * @param config Configuration options
     */
    public updateConfiguration(config: {
        openAiOptions?: ApiHandlerOptions;
        qdrantUrl?: string;
    }): void {
        let configChanged = false;
        
        // Handle OpenAI options update if present
        if (config.openAiOptions) {
            const newKey = config.openAiOptions.openAiNativeApiKey;
            if (!this.openAiOptions || newKey !== this.openAiOptions.openAiNativeApiKey) {
                this.openAiOptions = config.openAiOptions;
                configChanged = true;
            }
        }
        
        // Handle Qdrant URL update if present
        if (config.qdrantUrl) {
            const newUrl = config.qdrantUrl;
            if (newUrl !== this.qdrantUrl) {
                this.qdrantUrl = newUrl;
                configChanged = true;
            }
        }
        
        // Save configuration to global state
        if (configChanged) {
            this.context.globalState.update('codeIndexOpenAiKey', this.openAiOptions?.openAiNativeApiKey || '');
            this.context.globalState.update('codeIndexQdrantUrl', this.qdrantUrl || '');
            
            console.log('[CodeIndexManager] Configuration updated.');
        }
    }
    
    /**
     * Starts the indexing process
     */
    public async startIndexing(): Promise<void> {
        if (!this.isConfigured()) {
            this.enqueueStateUpdate({
                type: 'system',
                payload: {
                    systemStatus: 'Standby',
                    message: 'Cannot start: Missing OpenAI or Qdrant configuration.',
                },
            });
            console.warn('[CodeIndexManager] Start rejected: Missing configuration.');
            return;
        }
        
        if (
            this._isProcessing ||
            (this._systemStatus !== 'Standby' && this._systemStatus !== 'Error' && this._systemStatus !== 'Indexed')
        ) {
            console.warn(`[CodeIndexManager] Start rejected: Already processing or in state ${this._systemStatus}.`);
            return;
        }
        
        this._isProcessing = true;
        
        // Stop existing watcher if any
        this.stopWatcher();
        
        // Initialize vector store
        try {
            // Ensure client is initialized
            if (!this._vectorStore) {
                if (this.isConfigured()) {
                    this._vectorStore = new QdrantVectorStore(this.workspacePath, this.qdrantUrl);
                } else {
                    throw new Error(
                        'Cannot initialize collection: Qdrant client cannot be initialized - configuration missing.',
                    );
                }
            }
            
            // Initialize embedder if needed
            if (!this._embedder && this.isConfigured()) {
                this._embedder = new OpenAiEmbedder(this.openAiOptions!);
            }
            
            const collectionCreated = await this._vectorStore.initialize();
            
            if (collectionCreated) {
                await this._resetCacheFile();
                console.log('[CodeIndexManager] Qdrant collection created; cache file emptied.');
            }
            
            this.enqueueStateUpdate({
                type: 'system',
                payload: { systemStatus: 'Indexing', message: 'Qdrant ready. Starting workspace scan...' },
            });
        } catch (initError: any) {
            console.error('[CodeIndexManager] Failed to initialize Qdrant client or collection:', initError);
            this.enqueueStateUpdate({
                type: 'system',
                payload: {
                    systemStatus: 'Error',
                    message: `Failed to initialize Qdrant: ${initError.message || 'Unknown error'}`,
                },
            });
            this._isProcessing = false;
            return;
        }
        
        // Scan directory
        try {
            const scanner = new DirectoryScanner(this.workspacePath, {
                embedder: this._embedder,
                vectorStore: this._vectorStore,
                context: this.context,
            });
            
            const { stats } = await scanner.scanDirectory({
                onError: (batchError: Error) => {
                    this.enqueueStateUpdate({
                        type: 'system',
                        payload: {
                            systemStatus: 'Error',
                            message: `Failed during initial scan batch: ${batchError.message}`,
                        },
                    });
                },
            });
            
            console.log(
                `[CodeIndexManager] Initial scan complete. Processed: ${stats.processed}, Skipped: ${stats.skipped}`,
            );
            
            await this._startWatcher();
            
            this.enqueueStateUpdate({
                type: 'system',
                payload: { systemStatus: 'Indexed', message: 'Workspace scan and watcher started.' },
            });
        } catch (error: any) {
            console.error('[CodeIndexManager] Error during indexing:', error);
            try {
                await this._vectorStore?.clearCollection();
            } catch (cleanupError) {
                console.error('[CodeIndexManager] Failed to clean up after error:', cleanupError);
            }
            
            // Attempt to clear cache file after scan error
            await this._resetCacheFile();
            console.log('[CodeIndexManager] Cleared cache file due to scan error.');
            
            this.enqueueStateUpdate({
                type: 'system',
                payload: {
                    systemStatus: 'Error',
                    message: `Failed during initial scan: ${error.message || 'Unknown error'}`,
                },
            });
            this.stopWatcher();
        } finally {
            this._isProcessing = false;
        }
    }
    
    /**
     * Stops the file watcher
     */
    public stopWatcher(): void {
        if (this._fileWatcher) {
            this._fileWatcher.dispose();
            this._fileWatcher = null;
        }
        
        // Dispose subscriptions
        for (const subscription of this._fileWatcherSubscriptions) {
            subscription.dispose();
        }
        this._fileWatcherSubscriptions = [];
    }
    
    /**
     * Clears the index
     */
    public async clearIndex(): Promise<void> {
        if (this._isProcessing) {
            console.warn('[CodeIndexManager] Clear rejected: Already processing.');
            return;
        }
        
        this._isProcessing = true;
        this.stopWatcher();
        
        this.enqueueStateUpdate({
            type: 'system',
            payload: { systemStatus: 'Indexing', message: 'Clearing index data...' },
        });
        
        try {
            // Clear Qdrant collection
            try {
                // Re-initialize client if needed
                if (!this._vectorStore && this.isConfigured()) {
                    this._vectorStore = new QdrantVectorStore(this.workspacePath, this.qdrantUrl);
                }
                
                if (this._vectorStore) {
                    await this._vectorStore.clearCollection();
                    console.log('[CodeIndexManager] Vector collection cleared.');
                } else {
                    console.warn('[CodeIndexManager] Qdrant client not available, skipping vector collection clear.');
                }
            } catch (error: any) {
                console.error('[CodeIndexManager] Failed to clear vector collection:', error);
                this.enqueueStateUpdate({
                    type: 'system',
                    payload: {
                        systemStatus: 'Error',
                        message: `Failed to clear vector collection: ${error.message}`,
                    },
                });
            }
            
            // Delete cache file
            await this._resetCacheFile();
            console.log('[CodeIndexManager] Cache file emptied.');
            
            // If no errors occurred during clearing, confirm success
            if (this._systemStatus !== 'Error') {
                this.enqueueStateUpdate({
                    type: 'system',
                    payload: {
                        systemStatus: 'Standby',
                        message: 'Index data cleared successfully.',
                    },
                });
                console.log('[CodeIndexManager] Code index data cleared successfully.');
            }
        } finally {
            this._isProcessing = false;
        }
    }
    
    /**
     * Searches the index
     * @param query Query string
     * @param limit Maximum number of results to return
     * @returns Promise resolving to search results
     */
    public async searchIndex(query: string, limit: number): Promise<QdrantSearchResult[]> {
        if (!this.isEnabled || !this.isConfigured()) {
            throw new Error('Code index feature is disabled or not configured.');
        }
        
        if (this._systemStatus !== 'Indexed' && this._systemStatus !== 'Indexing') {
            // Allow search during Indexing too
            throw new Error(`Code index is not ready for search. Current state: ${this._systemStatus}`);
        }
        
        if (!this._embedder || !this._vectorStore) {
            // Attempt to initialize if needed
            if (this.isConfigured()) {
                this._embedder = new OpenAiEmbedder(this.openAiOptions!);
                this._vectorStore = new QdrantVectorStore(this.workspacePath, this.qdrantUrl);
            } else {
                throw new Error('Code index components could not be initialized - configuration missing.');
            }
        }
        
        try {
            const embeddingResponse = await this._embedder.createEmbeddings([query]);
            const vector = embeddingResponse.embeddings[0];
            
            if (!vector) {
                throw new Error('Failed to generate embedding for query.');
            }
            
            const results = await this._vectorStore.search(vector, limit);
            return results;
        } catch (error) {
            console.error('[CodeIndexManager] Error during search:', error);
            this.enqueueStateUpdate({
                type: 'system',
                payload: { systemStatus: 'Error', message: `Search failed: ${(error as Error).message}` },
            });
            throw error;
        }
    }
    
    /**
     * Sets the webview provider for status updates
     * @param provider Webview provider
     */
    public setWebviewProvider(provider: { postMessage: (msg: any) => void }): void {
        this.webviewProvider = provider;
    }
    
    /**
     * Enqueues a state update
     * @param request Update request
     */
    private enqueueStateUpdate(request: { type: 'system' | 'file'; payload: any }): void {
        this.updateQueue.push(request);
        this.processUpdateQueue();
    }
    
    /**
     * Processes the update queue
     */
    private async processUpdateQueue(): Promise<void> {
        if (this.isProcessingQueue || this.updateQueue.length === 0) {
            return;
        }
        
        this.isProcessingQueue = true;
        
        try {
            while (this.updateQueue.length > 0) {
                const update = this.updateQueue.shift()!;
                
                if (update.type === 'system') {
                    this._systemStatus = update.payload.systemStatus;
                    
                    // Emit progress update
                    this._progressEmitter.fire({
                        systemStatus: this._systemStatus,
                        fileStatuses: this._fileStatuses,
                        message: update.payload.message,
                    });
                    
                    // Send to webview if available
                    if (this.webviewProvider) {
                        this.webviewProvider.postMessage({
                            command: 'indexing-status',
                            state: this._systemStatus,
                            message: update.payload.message || '',
                        });
                    }
                } else if (update.type === 'file') {
                    const { filePath, fileStatus, message } = update.payload;
                    
                    if (fileStatus === 'Processing') {
                        this._fileStatuses[filePath] = fileStatus;
                    } else {
                        // Remove completed files from status tracking
                        delete this._fileStatuses[filePath];
                    }
                    
                    // Emit progress update
                    this._progressEmitter.fire({
                        systemStatus: this._systemStatus,
                        fileStatuses: this._fileStatuses,
                        message,
                    });
                }
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }
    
    /**
     * Starts the file watcher
     */
    private async _startWatcher(): Promise<void> {
        if (this._fileWatcher) {
            console.log('[CodeIndexManager] File watcher already running.');
            return;
        }
        
        // Ensure embedder and client are initialized before starting watcher
        if (!this._embedder || !this._vectorStore) {
            if (this.isConfigured()) {
                this._embedder = new OpenAiEmbedder(this.openAiOptions!);
                this._vectorStore = new QdrantVectorStore(this.workspacePath, this.qdrantUrl);
            } else {
                this.enqueueStateUpdate({
                    type: 'system',
                    payload: { systemStatus: 'Error', message: 'Cannot start watcher: Configuration missing.' },
                });
                return;
            }
        }
        
        this.enqueueStateUpdate({
            type: 'system',
            payload: { systemStatus: 'Indexing', message: 'Initializing file watcher...' },
        });
        
        this._fileWatcher = new FileWatcher(
            this.workspacePath,
            this.context,
            this._embedder,
            this._vectorStore,
        );
        
        await this._fileWatcher.initialize();
        
        this._fileWatcherSubscriptions = [
            this._fileWatcher.onDidStartProcessing((filePath: string) => {
                if (this.returnToIndexedTimer) {
                    clearTimeout(this.returnToIndexedTimer);
                    this.returnToIndexedTimer = null;
                }
                
                this.updateQueue.push({
                    type: 'system',
                    payload: {
                        systemStatus: 'Indexing',
                        message: `Processing file change: ${filePath}`,
                    },
                });
                
                this.updateQueue.push({
                    type: 'file',
                    payload: {
                        filePath,
                        fileStatus: 'Processing',
                        message: `Processing file: ${path.basename(filePath)}`,
                    },
                });
                
                this.processUpdateQueue();
            }),
            
            this._fileWatcher.onDidFinishProcessing((result: { path: string; status: string; error?: Error }) => {
                // Remove from file statuses
                delete this._fileStatuses[result.path];
                
                // If there are no more files being processed, return to Indexed state
                if (Object.keys(this._fileStatuses).length === 0 && this._systemStatus === 'Indexing') {
                    // Use a small delay to avoid flickering if multiple files are processed in quick succession
                    if (this.returnToIndexedTimer) {
                        clearTimeout(this.returnToIndexedTimer);
                    }
                    
                    this.returnToIndexedTimer = setTimeout(() => {
                        this.enqueueStateUpdate({
                            type: 'system',
                            payload: {
                                systemStatus: 'Indexed',
                                message: 'All files processed.',
                            },
                        });
                        this.returnToIndexedTimer = null;
                    }, 500);
                }
                
                // If there was an error, log it
                if (result.status === 'error' && result.error) {
                    console.error(`[CodeIndexManager] Error processing file ${result.path}:`, result.error);
                }
            }),
        ];
    }
    
    /**
     * Resets the cache file
     */
    private async _resetCacheFile(): Promise<void> {
        const cacheKey = `code-index-cache-${createHash('sha256').update(this.workspacePath).digest('hex')}`;
        await this.context.globalState.update(cacheKey, {});
    }
}
