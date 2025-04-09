import { jest } from '@jest/globals';

/**
 * Creates a mock for the OpenAI embeddings.create method
 * @returns A jest mock function
 */
export function createOpenAIEmbeddingsMock() {
    return jest.fn().mockImplementation(() => {
        return {
            data: [
                { embedding: [0.1, 0.2, 0.3] },
                { embedding: [0.4, 0.5, 0.6] }
            ],
            usage: {
                prompt_tokens: 10,
                total_tokens: 20
            }
        };
    });
}

/**
 * Creates a mock for the QdrantClient methods
 * @returns An object with mock methods
 */
export function createQdrantClientMocks() {
    return {
        getCollections: jest.fn().mockImplementation(() => {
            return {
                collections: []
            };
        }),
        getCollection: jest.fn(),
        createCollection: jest.fn(),
        upsert: jest.fn(),
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
        delete: jest.fn()
    };
}

/**
 * Creates a mock for the VS Code ExtensionContext
 * @returns A mock ExtensionContext
 */
export function createMockExtensionContext() {
    return {
        globalState: {
            get: jest.fn(),
            update: jest.fn().mockImplementation(() => Promise.resolve()),
            setKeysForSync: jest.fn()
        },
        subscriptions: [],
        workspaceState: {
            get: jest.fn(),
            update: jest.fn().mockImplementation(() => Promise.resolve()),
            setKeysForSync: jest.fn()
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
        extensionMode: 1 // Development mode
    };
}

/**
 * Creates a mock for the DirectoryScanner
 * @returns A jest mock function
 */
export function createDirectoryScannerMock() {
    return jest.fn().mockImplementation(() => ({
        scanDirectory: jest.fn().mockImplementation(() => {
            return {
                codeBlocks: [],
                stats: { processed: 5, skipped: 2 }
            };
        })
    }));
}

/**
 * Creates a mock for the FileWatcher
 * @returns A jest mock function
 */
export function createFileWatcherMock() {
    return jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockImplementation(() => Promise.resolve()),
        dispose: jest.fn(),
        onDidStartProcessing: jest.fn(),
        onDidFinishProcessing: jest.fn(),
        processFile: jest.fn()
    }));
}

/**
 * Creates a mock for the OpenAiEmbedder
 * @returns A jest mock function
 */
export function createOpenAiEmbedderMock() {
    return jest.fn().mockImplementation(() => ({
        createEmbeddings: jest.fn().mockImplementation(() => {
            return {
                embeddings: [[0.1, 0.2, 0.3]],
                usage: { prompt_tokens: 10, total_tokens: 20 }
            };
        })
    }));
}

/**
 * Creates a mock for the QdrantVectorStore
 * @returns A jest mock function
 */
export function createQdrantVectorStoreMock() {
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
