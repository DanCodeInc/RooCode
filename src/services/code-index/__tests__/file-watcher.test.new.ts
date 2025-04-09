import * as vscode from 'vscode';
import * as path from 'path';
import { FileWatcher } from '../processors/file-watcher';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockLoadRequiredLanguageParsers } from './mocks/tree-sitter-mock';
import { RooIgnoreController } from '../../../core/ignore/RooIgnoreController';

// Mock dependencies
jest.mock('vscode', () => {
    return {
        workspace: {
            fs: {
                readFile: jest.fn().mockImplementation(async () => Buffer.from('{}')),
                writeFile: jest.fn().mockImplementation(async () => {}),
                stat: jest.fn().mockImplementation(async () => ({ size: 1000 }))
            },
            createFileSystemWatcher: jest.fn().mockReturnValue({
                onDidCreate: jest.fn(),
                onDidChange: jest.fn(),
                onDidDelete: jest.fn(),
                dispose: jest.fn()
            }),
            asRelativePath: jest.fn().mockImplementation((path) => path)
        },
        Uri: {
            file: jest.fn().mockImplementation((path) => ({ fsPath: path })),
            joinPath: jest.fn().mockImplementation((uri, path) => ({ fsPath: `${uri.fsPath}/${path}` }))
        },
        EventEmitter: jest.fn().mockImplementation(() => ({
            event: jest.fn(),
            fire: jest.fn(),
            dispose: jest.fn()
        }))
    };
});
jest.mock('../../../utils/path', () => ({
    getWorkspacePath: jest.fn().mockReturnValue('/test/workspace')
}));
jest.mock('../../../core/ignore/RooIgnoreController', () => {
    return {
        RooIgnoreController: jest.fn().mockImplementation(() => ({
            validateAccess: jest.fn().mockReturnValue(true)
        }))
    };
});
jest.mock('../../tree-sitter/languageParser', () => ({
    loadRequiredLanguageParsers: mockLoadRequiredLanguageParsers
}));
jest.mock('../processors/parser', () => ({
    codeParser: {
        parseFile: jest.fn().mockResolvedValue([
            {
                file_path: 'test.js',
                identifier: 'testFunction',
                type: 'function',
                start_line: 1,
                end_line: 5,
                content: 'function testFunction() { return true; }',
                fileHash: 'test-hash',
                segmentHash: 'segment-hash'
            }
        ])
    }
}));

describe('FileWatcher', () => {
    let fileWatcher: FileWatcher;
    let mockContext: any;
    let mockEmbedder: any;
    let mockVectorStore: any;
    
    beforeEach(() => {
        // Reset mocks
        jest.resetAllMocks();
        
        // Create mock context
        mockContext = {
            globalStorageUri: { fsPath: '/test/storage' }
        };
        
        // Create mock embedder
        mockEmbedder = {
            createEmbeddings: jest.fn().mockResolvedValue({
                embeddings: [[0.1, 0.2, 0.3]],
                usage: { prompt_tokens: 10, total_tokens: 20 }
            })
        };
        
        // Create mock vector store
        mockVectorStore = {
            deletePointsByFilePath: jest.fn().mockResolvedValue(undefined),
            upsertPoints: jest.fn().mockResolvedValue(undefined)
        };
        
        // Create file watcher
        fileWatcher = new FileWatcher('/test/workspace', mockContext, mockEmbedder, mockVectorStore);
    });
    
    describe('initialize', () => {
        it('should initialize correctly', async () => {
            // Act
            await fileWatcher.initialize();
            
            // Assert
            expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
            expect(vscode.workspace.fs.readFile).toHaveBeenCalled();
        });
    });
    
    describe('processFile', () => {
        it('should process a file correctly', async () => {
            // Arrange
            await fileWatcher.initialize();
            
            // Act
            const result = await fileWatcher.processFile('/test/workspace/test.js');
            
            // Assert
            expect(result.status).toBe('success');
            expect(mockVectorStore.deletePointsByFilePath).toHaveBeenCalled();
            expect(mockEmbedder.createEmbeddings).toHaveBeenCalled();
            expect(mockVectorStore.upsertPoints).toHaveBeenCalled();
        });
        
        it('should skip ignored files', async () => {
            // Arrange
            await fileWatcher.initialize();
            
            // Mock RooIgnoreController to ignore the file
            (RooIgnoreController as jest.Mock).mockImplementation(() => ({
                validateAccess: jest.fn().mockReturnValue(false)
            }));
            
            // Create a new file watcher with the mocked RooIgnoreController
            fileWatcher = new FileWatcher('/test/workspace', mockContext, mockEmbedder, mockVectorStore);
            await fileWatcher.initialize();
            
            // Act
            const result = await fileWatcher.processFile('/test/workspace/ignored.js');
            
            // Assert
            expect(result.status).toBe('skipped');
            expect(result.reason).toBe('File is ignored by .rooignore');
        });
        
        it('should skip files that are too large', async () => {
            // Arrange
            await fileWatcher.initialize();
            
            // Mock vscode.workspace.fs.stat to return a large file size
            (vscode.workspace.fs.stat as jest.Mock).mockResolvedValueOnce({ size: 2 * 1024 * 1024 });
            
            // Act
            const result = await fileWatcher.processFile('/test/workspace/large.js');
            
            // Assert
            expect(result.status).toBe('skipped');
            expect(result.reason).toBe('File is too large');
        });
        
        it('should handle errors during processing', async () => {
            // Arrange
            await fileWatcher.initialize();
            
            // Mock codeParser.parseFile to throw an error
            const mockParseFile = require('../processors/parser').codeParser.parseFile;
            mockParseFile.mockRejectedValueOnce(new Error('Parse error'));
            
            // Act
            const result = await fileWatcher.processFile('/test/workspace/error.js');
            
            // Assert
            expect(result.status).toBe('error');
            expect(result.error).toBeInstanceOf(Error);
        });
    });
    
    describe('dispose', () => {
        it('should dispose correctly', async () => {
            // Arrange
            await fileWatcher.initialize();
            
            // Act
            fileWatcher.dispose();
            
            // Assert
            expect(vscode.workspace.createFileSystemWatcher().dispose).toHaveBeenCalled();
        });
    });
});
