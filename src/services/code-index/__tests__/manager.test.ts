import { CodeIndexManager } from '../manager';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as vscode from 'vscode';

// Define mocks locally to avoid circular dependencies
function createOpenAiEmbedderMock() {
    return jest.fn().mockImplementation(() => ({
        createEmbeddings: jest.fn().mockImplementation(() => {
            return {
                embeddings: [[0.1, 0.2, 0.3]],
                usage: { prompt_tokens: 10, total_tokens: 20 }
            };
        })
    }));
}

function createQdrantVectorStoreMock() {
    return jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockImplementation(() => Promise.resolve(false)),
        search: jest.fn().mockImplementation(() => {
            return [
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
        }),
        upsertPoints: jest.fn(),
        deletePointsByFilePath: jest.fn(),
        clearCollection: jest.fn()
    }));
}

function createDirectoryScannerMock() {
    return jest.fn().mockImplementation(() => ({
        scanDirectory: jest.fn().mockImplementation(() => {
            return {
                codeBlocks: [],
                stats: { processed: 5, skipped: 2 }
            };
        })
    }));
}

function createFileWatcherMock() {
    return jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockImplementation(() => Promise.resolve()),
        dispose: jest.fn(),
        onDidStartProcessing: jest.fn(),
        onDidFinishProcessing: jest.fn(),
        processFile: jest.fn()
    }));
}

function createMockExtensionContext() {
    return {
        globalState: {
            get: jest.fn(),
            update: jest.fn().mockImplementation(() => Promise.resolve()),
            setKeysForSync: jest.fn(),
            keys: jest.fn().mockReturnValue([''] as readonly string[])
        },
        subscriptions: [],
        workspaceState: {
            get: jest.fn(),
            update: jest.fn().mockImplementation(() => Promise.resolve()),
            setKeysForSync: jest.fn(),
            keys: jest.fn().mockReturnValue([''] as readonly string[])
        },
        extensionPath: '',
        storagePath: '',
        globalStoragePath: '',
        logPath: '',
        extensionUri: {} as any,
        globalStorageUri: {} as any,
        logUri: {} as any,
        storageUri: {} as any,
        asAbsolutePath: jest.fn().mockImplementation((path) => path),
        extensionMode: 1, // Development mode
        secrets: {
            get: jest.fn().mockImplementation(() => Promise.resolve('')),
            store: jest.fn().mockImplementation(() => Promise.resolve()),
            delete: jest.fn().mockImplementation(() => Promise.resolve()),
            onDidChange: { event: jest.fn(), dispose: jest.fn() } as any
        },
        environmentVariableCollection: {
            persistent: false,
            replace: jest.fn(),
            append: jest.fn(),
            prepend: jest.fn(),
            get: jest.fn(),
            forEach: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn()
        },
        extension: {
            id: 'test-extension',
            extensionUri: {} as any,
            extensionPath: '',
            isActive: true,
            packageJSON: {},
            exports: undefined,
            activate: jest.fn().mockImplementation(() => Promise.resolve())
        },
        languageModelAccessInformation: {
            current: {
                endpoint: '',
                authHeader: ''
            }
        }
    };
}

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
jest.mock('../scanner', () => {
    return {
        DirectoryScanner: createDirectoryScannerMock()
    };
});
jest.mock('../file-watcher', () => {
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
