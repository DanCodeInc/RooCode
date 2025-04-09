import * as vscode from 'vscode';
import { CodeIndexManager } from '../manager.new';
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

describe('CodeIndexManager', () => {
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
    
    describe('getInstance', () => {
        it('should return the same instance when called multiple times', () => {
            // Act
            const instance1 = CodeIndexManager.getInstance('/test/workspace', mockContext as any);
            const instance2 = CodeIndexManager.getInstance('/test/workspace', mockContext as any);
            
            // Assert
            expect(instance1).toBe(instance2);
        });
    });
    
    describe('loadConfiguration', () => {
        it('should load configuration from global state', async () => {
            // Act
            await manager.loadConfiguration();
            
            // Assert
            expect(mockContext.globalState.get).toHaveBeenCalledWith('codeIndexEnabled', false);
            expect(mockContext.globalState.get).toHaveBeenCalledWith('codeIndexOpenAiKey', '');
            expect(mockContext.globalState.get).toHaveBeenCalledWith('codeIndexQdrantUrl', '');
            expect((manager as any).isEnabled).toBe(true);
            expect((manager as any).openAiOptions).toEqual({ openAiNativeApiKey: 'test-key' });
            expect((manager as any).qdrantUrl).toBe('http://localhost:6333');
        });
    });
    
    describe('updateConfiguration', () => {
        it('should update configuration and save to global state', () => {
            // Arrange
            const newOpenAiOptions = { openAiNativeApiKey: 'new-key' };
            const newQdrantUrl = 'http://new-url:6333';
            
            // Act
            manager.updateConfiguration({
                openAiOptions: newOpenAiOptions,
                qdrantUrl: newQdrantUrl
            });
            
            // Assert
            expect((manager as any).openAiOptions).toEqual(newOpenAiOptions);
            expect((manager as any).qdrantUrl).toBe(newQdrantUrl);
            expect(mockContext.globalState.update).toHaveBeenCalledWith('codeIndexOpenAiKey', 'new-key');
            expect(mockContext.globalState.update).toHaveBeenCalledWith('codeIndexQdrantUrl', newQdrantUrl);
        });
        
        it('should not update if values are the same', () => {
            // Arrange
            const openAiOptions = { openAiNativeApiKey: 'key' };
            const qdrantUrl = 'http://url:6333';
            
            // Set initial values
            (manager as any).openAiOptions = openAiOptions;
            (manager as any).qdrantUrl = qdrantUrl;
            
            // Act
            manager.updateConfiguration({
                openAiOptions,
                qdrantUrl
            });
            
            // Assert
            expect(mockContext.globalState.update).not.toHaveBeenCalled();
        });
    });
    
    describe('searchIndex', () => {
        it('should throw error if not enabled or configured', async () => {
            // Arrange
            (manager as any).isEnabled = false;
            
            // Act & Assert
            await expect(manager.searchIndex('query', 10)).rejects.toThrow(
                'Code index feature is disabled or not configured.'
            );
        });
        
        it('should throw error if not in correct state', async () => {
            // Arrange
            (manager as any).isEnabled = true;
            (manager as any).openAiOptions = { openAiNativeApiKey: 'key' };
            (manager as any).qdrantUrl = 'url';
            (manager as any)._systemStatus = 'Standby';
            
            // Act & Assert
            await expect(manager.searchIndex('query', 10)).rejects.toThrow(
                'Code index is not ready for search. Current state: Standby'
            );
        });
        
        it('should search the index successfully', async () => {
            // Arrange
            (manager as any).isEnabled = true;
            (manager as any).openAiOptions = { openAiNativeApiKey: 'key' };
            (manager as any).qdrantUrl = 'url';
            (manager as any)._systemStatus = 'Indexed';
            (manager as any)._embedder = {
                createEmbeddings: jest.fn().mockResolvedValue({
                    embeddings: [[0.1, 0.2, 0.3]],
                    usage: { prompt_tokens: 10, total_tokens: 20 }
                })
            };
            (manager as any)._vectorStore = {
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
                ])
            };
            
            // Act
            const results = await manager.searchIndex('query', 10);
            
            // Assert
            expect(results).toHaveLength(1);
            expect(results[0].score).toBe(0.9);
            expect((manager as any)._embedder.createEmbeddings).toHaveBeenCalledWith(['query']);
            expect((manager as any)._vectorStore.search).toHaveBeenCalledWith([0.1, 0.2, 0.3], 10);
        });
    });
});
