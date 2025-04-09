import { listFiles } from '../../glob/list-files';
import { RooIgnoreController } from '../../../core/ignore/RooIgnoreController';
import { stat } from 'fs/promises';
import * as path from 'path';
import { getWorkspacePath } from '../../../utils/path';
import { extensions } from '../../tree-sitter';
import { ApiHandlerOptions } from '../../../shared/api';
import * as vscode from 'vscode';
import { createHash } from 'crypto';
import { v5 as uuidv5 } from 'uuid';
import { IDirectoryScanner, CodeBlock, IEmbedder, IVectorStore } from '../interfaces';
import { codeParser } from './parser';

const QDRANT_CODE_BLOCK_NAMESPACE = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
const BATCH_SIZE = 50;
const MAX_BATCH_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Implementation of the directory scanner interface
 */
export class DirectoryScanner implements IDirectoryScanner {
    private embedder?: IEmbedder;
    private vectorStore?: IVectorStore;
    private context?: vscode.ExtensionContext;
    private ignoreController: RooIgnoreController;
    
    /**
     * Creates a new directory scanner
     * @param directoryPath Path to the directory to scan
     * @param options Optional scanner options
     */
    constructor(
        private directoryPath: string,
        options?: {
            embedder?: IEmbedder;
            vectorStore?: IVectorStore;
            context?: vscode.ExtensionContext;
            ignoreController?: RooIgnoreController;
        }
    ) {
        this.embedder = options?.embedder;
        this.vectorStore = options?.vectorStore;
        this.context = options?.context;
        this.ignoreController = options?.ignoreController || new RooIgnoreController(directoryPath);
    }
    
    /**
     * Scans a directory for code blocks
     * @param options Optional scanning options
     * @returns Promise resolving to scan results
     */
    async scanDirectory(options?: {
        onProgress?: (processed: number, total: number) => void;
        onError?: (error: Error) => void;
    }): Promise<{
        codeBlocks: CodeBlock[];
        stats: {
            processed: number;
            skipped: number;
        };
    }> {
        // Initialize vector store if needed
        if (this.vectorStore) {
            await this.vectorStore.initialize();
        }
        
        // Get all files in the directory
        const files = await listFiles(this.directoryPath, {
            ignoreController: this.ignoreController,
            includePatterns: Object.keys(extensions).map(ext => `**/*${ext}`),
        });
        
        // Initialize cache
        const cacheKey = `code-index-cache-${createHash('sha256').update(this.directoryPath).digest('hex')}`;
        const fileHashes: Record<string, string> = this.context?.globalState.get(cacheKey, {}) || {};
        const newHashes: Record<string, string> = {};
        
        // Process files
        const stats = { processed: 0, skipped: 0 };
        const allCodeBlocks: CodeBlock[] = [];
        
        // Process files in batches
        const batches: string[][] = [];
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            batches.push(files.slice(i, i + BATCH_SIZE));
        }
        
        let batchIndex = 0;
        for (const batch of batches) {
            // Process batch
            const batchFileInfos: { filePath: string; fileHash: string }[] = [];
            const batchBlocks: CodeBlock[] = [];
            const batchTexts: string[] = [];
            
            // Process each file in the batch
            for (const filePath of batch) {
                try {
                    // Check file size
                    const fileStat = await stat(filePath);
                    if (fileStat.size > MAX_FILE_SIZE_BYTES) {
                        stats.skipped++;
                        continue;
                    }
                    
                    // Parse file
                    const blocks = await codeParser.parseFile(filePath);
                    
                    if (blocks.length > 0) {
                        const fileHash = blocks[0].fileHash;
                        
                        // Check if file has changed
                        if (fileHashes[filePath] === fileHash) {
                            stats.skipped++;
                            newHashes[filePath] = fileHash;
                            continue;
                        }
                        
                        // Add blocks to batch
                        batchBlocks.push(...blocks);
                        batchTexts.push(...blocks.map(block => block.content));
                        batchFileInfos.push({ filePath, fileHash });
                        
                        // Add blocks to result
                        allCodeBlocks.push(...blocks);
                        stats.processed++;
                    } else {
                        stats.skipped++;
                    }
                } catch (error) {
                    console.error(`Error processing file ${filePath}:`, error);
                    stats.skipped++;
                    
                    if (options?.onError) {
                        options.onError(error as Error);
                    }
                }
            }
            
            // Update progress
            if (options?.onProgress) {
                options.onProgress((batchIndex + 1) * BATCH_SIZE, files.length);
            }
            
            // Process batch with embedder and vector store
            if (this.embedder && this.vectorStore && batchBlocks.length > 0) {
                let success = false;
                let attempts = 0;
                let lastError: Error | null = null;
                
                while (attempts < MAX_BATCH_RETRIES && !success) {
                    attempts++;
                    try {
                        // Delete existing points
                        const uniqueFilePaths = [...new Set(batchFileInfos.map(info => info.filePath))];
                        for (const filePath of uniqueFilePaths) {
                            await this.vectorStore.deletePointsByFilePath(filePath);
                        }
                        
                        // Create embeddings
                        const { embeddings } = await this.embedder.createEmbeddings(batchTexts);
                        
                        // Prepare points
                        const points = batchBlocks.map((block, index) => {
                            const workspaceRoot = getWorkspacePath();
                            const absolutePath = path.resolve(workspaceRoot, block.file_path);
                            const normalizedAbsolutePath = path.normalize(absolutePath);
                            
                            const stableName = `${normalizedAbsolutePath}:${block.start_line}`;
                            const pointId = uuidv5(stableName, QDRANT_CODE_BLOCK_NAMESPACE);
                            
                            return {
                                id: pointId,
                                vector: embeddings[index],
                                payload: {
                                    filePath: normalizedAbsolutePath,
                                    codeChunk: block.content,
                                    startLine: block.start_line,
                                    endLine: block.end_line,
                                },
                            };
                        });
                        
                        // Upsert points
                        await this.vectorStore.upsertPoints(points);
                        
                        // Update hashes
                        for (const fileInfo of batchFileInfos) {
                            newHashes[fileInfo.filePath] = fileInfo.fileHash;
                        }
                        
                        success = true;
                    } catch (error) {
                        lastError = error as Error;
                        console.error(`Error processing batch (attempt ${attempts}):`, error);
                        
                        if (attempts < MAX_BATCH_RETRIES) {
                            const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempts - 1);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    }
                }
                
                if (!success && lastError && options?.onError) {
                    options.onError(lastError);
                }
            }
            
            batchIndex++;
        }
        
        // Update cache
        if (this.context) {
            await this.context.globalState.update(cacheKey, newHashes);
        }
        
        return { codeBlocks: allCodeBlocks, stats };
    }
}
