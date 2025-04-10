# Code Index Service

The Code Index Service provides code indexing and searching functionality for the Roo Code extension. It uses OpenAI embeddings and Qdrant vector database to index and search code.

## Architecture

The service is organized into the following components:

### Interfaces

- `IEmbedder`: Interface for embedding providers
- `IVectorStore`: Interface for vector database clients
- `ICodeParser`: Interface for code file parsers
- `IDirectoryScanner`: Interface for directory scanners
- `IFileWatcher`: Interface for file watchers
- `ICodeIndexManager`: Interface for the code index manager

### Embedders

- `OpenAiEmbedder`: OpenAI implementation of the embedder interface

### Vector Stores

- `QdrantVectorStore`: Qdrant implementation of the vector store interface

### Processors

- `CodeParser`: Implementation of the code parser interface
- `DirectoryScanner`: Implementation of the directory scanner interface
- `FileWatcher`: Implementation of the file watcher interface

### Manager

- `CodeIndexManager`: Main manager class that orchestrates the indexing process

## Usage

```typescript
import { CodeIndexManager } from '../services/code-index';

// Get the singleton instance
const manager = CodeIndexManager.getInstance(workspacePath, context);

// Load configuration
await manager.loadConfiguration();

// Start indexing
await manager.startIndexing();

// Search the index
const results = await manager.searchIndex('function calculateTotal', 10);
```

## Testing

The service includes unit tests for each component. Run the tests with:

```bash
npm test -- --testPathPattern=src/services/code-index
```

## Dependencies

- OpenAI API for embeddings
- Qdrant for vector storage
- Tree-sitter for code parsing

## Configuration

The service requires the following configuration:

- OpenAI API key
- Qdrant URL

These can be set via the `updateConfiguration` method on the manager.
