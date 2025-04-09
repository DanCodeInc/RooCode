import { OpenAiEmbedder } from '../embedders/openai-embedder';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock dependencies
jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
        embeddings: {
            create: jest.fn().mockImplementation(async () => ({
                data: [
                    { embedding: [0.1, 0.2, 0.3] },
                    { embedding: [0.4, 0.5, 0.6] }
                ],
                usage: {
                    prompt_tokens: 10,
                    total_tokens: 20
                }
            }))
        }
    }));
});

describe('OpenAiEmbedder', () => {
    let embedder: OpenAiEmbedder;
    
    beforeEach(() => {
        // Reset mocks
        jest.resetAllMocks();
        
        // Create embedder with mock options
        embedder = new OpenAiEmbedder({ openAiNativeApiKey: 'test-key' });
    });
    
    describe('createEmbeddings', () => {
        it('should create embeddings successfully', async () => {
            // Arrange
            const texts = ['test text 1', 'test text 2'];
            
            // Act
            const result = await embedder.createEmbeddings(texts);
            
            // Assert
            expect(result).toEqual({
                embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
                usage: {
                    prompt_tokens: 10,
                    total_tokens: 20
                }
            });
        });
        
        it('should handle API errors', async () => {
            // Arrange
            const texts = ['test text'];
            
            // Mock OpenAI client to throw an error
            const openaiInstance = require('openai');
            const mockCreate = openaiInstance().embeddings.create;
            mockCreate.mockRejectedValueOnce(new Error('API error'));
            
            // Mock console.error to avoid polluting test output
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            
            // Act & Assert
            await expect(embedder.createEmbeddings(texts)).rejects.toThrow('Failed to create embeddings');
            expect(consoleErrorSpy).toHaveBeenCalled();
            
            // Restore console.error
            consoleErrorSpy.mockRestore();
        });
        
        it('should use custom model if provided', async () => {
            // Arrange
            const texts = ['test text'];
            const customModel = 'text-embedding-ada-002';
            
            // Mock OpenAI client
            const openaiInstance = require('openai');
            const mockCreate = openaiInstance().embeddings.create;
            
            // Act
            await embedder.createEmbeddings(texts, customModel);
            
            // Assert
            expect(mockCreate).toHaveBeenCalledWith({
                input: texts,
                model: customModel
            });
        });
    });
});
