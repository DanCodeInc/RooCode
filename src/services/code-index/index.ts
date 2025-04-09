/**
 * Code Index Service
 * 
 * This service provides code indexing and searching functionality.
 * It uses OpenAI embeddings and Qdrant vector database to index and search code.
 */

// Export interfaces
export * from './interfaces';

// Export embedders
export * from './embedders';

// Export vector stores
export * from './vector-stores';

// Export processors
export * from './processors';

// Export manager
export { CodeIndexManager } from './manager.new';

// Re-export the singleton instance for backward compatibility
import { CodeIndexManager } from './manager.new';
export { CodeIndexManager as default };
