import * as vscode from 'vscode';
import { CodeIndexManager } from '../manager.new';
import { OpenAiEmbedder } from '../embedders';
import { QdrantVectorStore } from '../vector-stores';
import { DirectoryScanner, FileWatcher } from '../processors';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock dependencies
jest.mock('vscode', () => {
    const EventEmitter = jest.fn().mockImplementation(() => ({
        event: jest.fn(),
        fire: jest.fn(),
        dispose: jest.fn()
    }));
    
    return {
        EventEmitter,
        workspace: {
            workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
        }
    };
});
jest.mock('../embedders/openai-embedder', () => {
    return {
        OpenAiEmbedder: jest.fn().mockImplementation(() => ({
            createEmbeddings: jest.fn().mockResolvedValue({
                embeddings: [[0.1, 0.2, 0.3]],
                usage: { prompt_tokens: 10, total_tokens: 20 }
            })
        }))
    };
});
jest.mock('../vector-stores/qdrant-client', () => {
    return {
        QdrantVectorStore: jest.fn().mockImplementation(() => ({
            initialize: jest.fn().mockResolvedValue(false),
            search: jest.fn().mockResolvedValue([
                {
                    id: 'point1',
                    score: 0.9,
                    payload: {
                        filePath: '/test/file.js',
                        codeChunk: 'function test() {}',
                        startLine: 1,
                        endLine: 3
                    }
                }
            ]),
            upsertPoints: jest.fn().mockResolvedValue(undefined),
            deletePointsByFilePath: jest.fn().mockResolvedValue(undefined),
            clearCollection: jest.fn().mockResolvedValue(undefined)
        }))
    };
});
jest.mock('../processors/scanner', () => {
    return {
        DirectoryScanner: jest.fn().mockImplementation(() => ({
            scanDirectory: jest.fn().mockResolvedValue({
                codeBlocks: [],
                stats: { processed: 5, skipped: 2 }
            })
        }))
    };
});
jest.mock('../processors/file-watcher', () => {
    return {
        FileWatcher: jest.fn().mockImplementation(() => ({
            initialize: jest.fn().mockResolvedValue(undefined),
            dispose: jest.fn(),
            onDidStartProcessing: jest.fn(),
            onDidFinishProcessing: jest.fn(),
            processFile: jest.fn().mockResolvedValue({ status: 'success', path: '/test/file.js' })
        }))
    };
});

describe('Code Index Integration', () => {
    let manager: CodeIndexManager;
    let mockContext: any;
    
    beforeEach(() => {
        // Reset mocks
        jest.resetAllMocks();
        
        // Create mock context
        mockContext = {
            globalState: {
                get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
                    if (key === 'codeIndexEnabled') return true;
                    if (key === 'codeIndexOpenAiKey') return 'test-key';
                    if (key === 'codeIndexQdrantUrl') return 'http://localhost:6333';
                    return defaultValue;
                }),
                update: jest.fn().mockImplementation(() => Promise.resolve())
            }
        };
        
        // Reset singleton instance
        (CodeIndexManager as any).instance = null;
        
        // Create manager
        manager = CodeIndexManager.getInstance('/test/workspace', mockContext as any);
    });
    
    describe('Integration with components', () => {
        it('should initialize embedder and vector store when starting indexing', async () => {
            // Act
            await manager.loadConfiguration();
            await manager.startIndexing();
            
            // Assert
            expect(OpenAiEmbedder).toHaveBeenCalledWith({ openAiNativeApiKey: 'test-key' });
            expect(QdrantVectorStore).toHaveBeenCalledWith('/test/workspace', 'http://localhost:6333');
            expect(QdrantVectorStore.prototype.initialize).toHaveBeenCalled();
            expect(DirectoryScanner).toHaveBeenCalled();
            expect(DirectoryScanner.prototype.scanDirectory).toHaveBeenCalled();
            expect(FileWatcher).toHaveBeenCalled();
            expect(FileWatcher.prototype.initialize).toHaveBeenCalled();
        });
        
        it('should search the index using embedder and vector store', async () => {
            // Arrange
            const query = 'test query';
            const limit = 5;
            const mockVector = [0.1, 0.2, 0.3];
            const mockResults = [
                {
                    id: 'point1',
                    score: 0.9,
                    payload: {
                        filePath: '/test/file.js',
                        codeChunk: 'function test() {}',
                        startLine: 1,
                        endLine: 3
                    }
                }
            ];
            
            // Set up manager
            (manager as any).isEnabled = true;
            (manager as any).openAiOptions = { openAiNativeApiKey: 'test-key' };
            (manager as any).qdrantUrl = 'http://localhost:6333';
            (manager as any)._systemStatus = 'Indexed';
            (manager as any)._embedder = {
                createEmbeddings: jest.fn().mockResolvedValue({
                    embeddings: [mockVector],
                    usage: { prompt_tokens: 10, total_tokens: 20 }
                })
            };
            (manager as any)._vectorStore = {
                search: jest.fn().mockResolvedValue(mockResults)
            };
            
            // Act
            const results = await manager.searchIndex(query, limit);
            
            // Assert
            expect((manager as any)._embedder.createEmbeddings).toHaveBeenCalledWith([query]);
            expect((manager as any)._vectorStore.search).toHaveBeenCalledWith(mockVector, limit);
            expect(results).toEqual(mockResults);
        });
        
        it('should clear the index when requested', async () => {
            // Arrange
            (manager as any)._vectorStore = {
                clearCollection: jest.fn().mockResolvedValue(undefined)
            };
            (manager as any)._fileWatcher = {
                dispose: jest.fn()
            };
            
            // Act
            await manager.clearIndex();
            
            // Assert
            expect((manager as any)._vectorStore.clearCollection).toHaveBeenCalled();
            expect((manager as any)._fileWatcher.dispose).toHaveBeenCalled();
            expect((manager as any)._systemStatus).toBe('Standby');
        });
    });
});
