import { CodeIndexManager } from '../manager.new';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as vscode from 'vscode';

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

describe('CodeIndexManager', () => {
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

    describe('getInstance', () => {
        it('should return the same instance when called multiple times', () => {
            // Act
            const instance1 = CodeIndexManager.getInstance('/test/workspace', mockContext);
            const instance2 = CodeIndexManager.getInstance('/test/workspace', mockContext);

            // Assert
            expect(instance1).toBe(instance2);
        });
    });

    describe('loadConfiguration', () => {
        it('should load configuration from global state', async () => {
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

            // Mock startIndexing
            (manager as any).startIndexing = jest.fn().mockImplementation(() => Promise.resolve());

            // Act
            await manager.loadConfiguration();

            // Assert
            expect(mockContext.globalState.get).toHaveBeenCalledWith('codeIndexEnabled', false);
            expect(mockContext.globalState.get).toHaveBeenCalledWith('codeIndexOpenAiKey', '');
            expect(mockContext.globalState.get).toHaveBeenCalledWith('codeIndexQdrantUrl', '');
            expect((manager as any).isEnabled).toBe(mockEnabled);
            expect((manager as any).openAiOptions).toEqual({ openAiNativeApiKey: mockOpenAiKey });
            expect((manager as any).qdrantUrl).toBe(mockQdrantUrl);
            expect((manager as any).startIndexing).toHaveBeenCalled();
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
    });
});
