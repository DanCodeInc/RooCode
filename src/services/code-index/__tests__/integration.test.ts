import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CodeIndexManager } from '../manager.new';
import { OpenAiEmbedder } from '../embedders';
import { QdrantVectorStore } from '../vector-stores';
import { DirectoryScanner, FileWatcher } from '../processors';

// Import test helpers
import {
    createMockExtensionContext,
    createOpenAiEmbedderMock,
    createQdrantVectorStoreMock,
    createDirectoryScannerMock,
    createFileWatcherMock
} from './test-helpers';

// Mock dependencies
jest.mock('vscode');
jest.mock('../embedders/openai-embedder', () => {
    return {
        OpenAiEmbedder: createOpenAiEmbedderMock()
    };
});
jest.mock('../vector-stores/qdrant-client', () => {
    return {
        QdrantVectorStore: createQdrantVectorStoreMock()
    };
});
jest.mock('../processors/scanner', () => {
    return {
        DirectoryScanner: createDirectoryScannerMock()
    };
});
jest.mock('../processors/file-watcher', () => {
    return {
        FileWatcher: createFileWatcherMock()
    };
});

describe('Code Index Integration', () => {
    let manager: CodeIndexManager;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        // Reset mocks
        jest.resetAllMocks();

        // Create mock context - use any to bypass type checking
        mockContext = createMockExtensionContext() as any;

        // Reset singleton instance
        (CodeIndexManager as any).instance = null;

        // Create manager
        manager = CodeIndexManager.getInstance('/test/workspace', mockContext);
    });

    describe('Integration with components', () => {
        it('should initialize embedder and vector store when starting indexing', async () => {
            // Arrange
            const mockEnabled = true;
            const mockOpenAiKey = 'test-key';
            const mockQdrantUrl = 'http://localhost:6333';

            // Mock global state
            (mockContext.globalState.get as jest.Mock)
                .mockImplementation((key: any, defaultValue: any) => {
                    if (key === 'codeIndexEnabled') return mockEnabled;
                    if (key === 'codeIndexOpenAiKey') return mockOpenAiKey;
                    if (key === 'codeIndexQdrantUrl') return mockQdrantUrl;
                    return defaultValue;
                });

            // Mock vector store initialize
            (QdrantVectorStore.prototype.initialize as any).mockResolvedValue(false);

            // Mock scanner
            (DirectoryScanner.prototype.scanDirectory as any).mockResolvedValue({
                codeBlocks: [],
                stats: { processed: 5, skipped: 2 }
            });

            // Act
            await manager.loadConfiguration();
            await manager.startIndexing();

            // Assert
            expect(OpenAiEmbedder).toHaveBeenCalledWith({ openAiNativeApiKey: mockOpenAiKey });
            expect(QdrantVectorStore).toHaveBeenCalledWith('/test/workspace', mockQdrantUrl);
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

            // Mock embedder
            (OpenAiEmbedder.prototype.createEmbeddings as any).mockResolvedValue({
                embeddings: [mockVector],
                usage: { prompt_tokens: 10, total_tokens: 20 }
            });

            // Mock vector store
            (QdrantVectorStore.prototype.search as any).mockResolvedValue(mockResults);

            // Act
            const results = await manager.searchIndex(query, limit);

            // Assert
            expect(OpenAiEmbedder.prototype.createEmbeddings).toHaveBeenCalledWith([query]);
            expect(QdrantVectorStore.prototype.search).toHaveBeenCalledWith(mockVector, limit);
            expect(results).toEqual(mockResults);
        });
    });
});
