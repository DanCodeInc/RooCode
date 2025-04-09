import { QdrantVectorStore } from '../vector-stores/qdrant-client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QdrantClient } from '@qdrant/js-client-rest';

// Mock dependencies
jest.mock('@qdrant/js-client-rest');
jest.mock('../../../utils/path');

describe('QdrantVectorStore', () => {
    let vectorStore: QdrantVectorStore;
    
    beforeEach(() => {
        // Reset mocks
        jest.resetAllMocks();
        
        // Create vector store
        vectorStore = new QdrantVectorStore('/test/workspace');
    });
    
    describe('initialize', () => {
        it('should create a new collection if it does not exist', async () => {
            // Arrange
            const mockCollections = {
                collections: []
            };
            
            // Mock Qdrant client
            (QdrantClient.prototype.getCollections as jest.Mock).mockResolvedValue(mockCollections);
            (QdrantClient.prototype.createCollection as jest.Mock).mockResolvedValue({});
            
            // Act
            const result = await vectorStore.initialize();
            
            // Assert
            expect(result).toBe(true);
            expect(QdrantClient.prototype.getCollections).toHaveBeenCalled();
            expect(QdrantClient.prototype.createCollection).toHaveBeenCalled();
        });
        
        it('should not create a collection if it already exists', async () => {
            // Arrange
            const collectionName = (vectorStore as any).collectionName;
            const mockCollections = {
                collections: [{ name: collectionName }]
            };
            
            // Mock Qdrant client
            (QdrantClient.prototype.getCollections as jest.Mock).mockResolvedValue(mockCollections);
            
            // Act
            const result = await vectorStore.initialize();
            
            // Assert
            expect(result).toBe(false);
            expect(QdrantClient.prototype.getCollections).toHaveBeenCalled();
            expect(QdrantClient.prototype.createCollection).not.toHaveBeenCalled();
        });
        
        it('should handle initialization errors', async () => {
            // Arrange
            const error = new Error('Initialization error');
            
            // Mock Qdrant client
            (QdrantClient.prototype.getCollections as jest.Mock).mockRejectedValue(error);
            
            // Mock console.error to avoid polluting test output
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Act & Assert
            await expect(vectorStore.initialize()).rejects.toThrow(error);
            expect(consoleErrorSpy).toHaveBeenCalled();
            
            // Restore console.error
            consoleErrorSpy.mockRestore();
        });
    });
    
    describe('upsertPoints', () => {
        it('should upsert points successfully', async () => {
            // Arrange
            const points = [
                {
                    id: 'point1',
                    vector: [0.1, 0.2, 0.3],
                    payload: { filePath: 'test.js', codeChunk: 'code', startLine: 1, endLine: 10 }
                }
            ];
            
            // Mock Qdrant client
            (QdrantClient.prototype.upsert as jest.Mock).mockResolvedValue({});
            
            // Act
            await vectorStore.upsertPoints(points);
            
            // Assert
            expect(QdrantClient.prototype.upsert).toHaveBeenCalledWith(
                (vectorStore as any).collectionName,
                {
                    points,
                    wait: true
                }
            );
        });
        
        it('should handle upsert errors', async () => {
            // Arrange
            const points = [
                {
                    id: 'point1',
                    vector: [0.1, 0.2, 0.3],
                    payload: { filePath: 'test.js', codeChunk: 'code', startLine: 1, endLine: 10 }
                }
            ];
            const error = new Error('Upsert error');
            
            // Mock Qdrant client
            (QdrantClient.prototype.upsert as jest.Mock).mockRejectedValue(error);
            
            // Mock console.error to avoid polluting test output
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Act & Assert
            await expect(vectorStore.upsertPoints(points)).rejects.toThrow(error);
            expect(consoleErrorSpy).toHaveBeenCalled();
            
            // Restore console.error
            consoleErrorSpy.mockRestore();
        });
    });
    
    describe('search', () => {
        it('should search for similar vectors', async () => {
            // Arrange
            const queryVector = [0.1, 0.2, 0.3];
            const limit = 5;
            const mockResults = [
                {
                    id: 'point1',
                    score: 0.9,
                    payload: { filePath: 'test.js', codeChunk: 'code', startLine: 1, endLine: 10 }
                }
            ];
            
            // Mock Qdrant client
            (QdrantClient.prototype.search as jest.Mock).mockResolvedValue(mockResults);
            
            // Act
            const results = await vectorStore.search(queryVector, limit);
            
            // Assert
            expect(results).toEqual(mockResults);
            expect(QdrantClient.prototype.search).toHaveBeenCalledWith(
                (vectorStore as any).collectionName,
                {
                    vector: queryVector,
                    limit
                }
            );
        });
    });
});
