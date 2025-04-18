# Neo4j Knowledge Graph Integration

This document provides an overview of the Neo4j knowledge graph integration implemented for the AI chatbot application. The integration allows for semantic retrieval of nodes from the knowledge graph and automatic extraction of entities and concepts from conversations.

## Core Components

1. **Neo4j Driver**: Singleton pattern implementation for managing database connections
2. **Semantic Retrieval Tool**: A tool that uses vector-based embeddings to find relevant information in the graph
3. **Graph Node Extraction Tool**: A tool that analyzes conversations and extracts knowledge graph nodes
4. **Schema Initialization Script**: A utility for setting up constraints and indexes in Neo4j

## Setup Instructions

### Prerequisites

- Neo4j Database (v4.4+ recommended)
- Neo4j Vector Index Support (for semantic search)
- OpenAI API Key (for embeddings generation)

### Configuration

1. Copy the environment variables to your `.env.local` file:
   ```
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=your-password
   OPENAI_API_KEY=your-api-key
   ```

2. Initialize the database schema:
   ```bash
   npm run neo4j:init
   ```
   This will create necessary constraints and indexes in the Neo4j database.

## Data Schema

The knowledge graph uses the following node types:

- **Entity**: Physical objects, people, locations (`Entity`, `Person` subtypes)
- **Concept**: Abstract ideas and categories
- **Thought**: Subjective interpretations or analyses
- **ReasoningChain**: Sequences of logical reasoning
- **ReasoningStep**: Individual steps in a reasoning chain

Relationships include:
- `RELATED_TO`: General relationship between nodes
- `HAS_CONCEPT`: Links entities to concepts
- `HAS_PART`: Hierarchical relationship (e.g., chain to steps)
- `REFERS_TO`: Reference relationship
- `CONTRADICTS`: Contradiction relationship
- `SUPPORTS`: Support or evidence relationship
- `PRECEDES`: Sequential relationship

## Usage Examples

### Semantic Retrieval

The `semanticRetrieval` tool allows finding semantically relevant nodes from the knowledge graph:

```javascript
// Example API call
const results = await semanticRetrieval({
  queryText: "climate change impact on agriculture",
  nodeTypes: ["Concept", "Thought"],
  limit: 5
});
```

### Graph Node Extraction

The `extractGraphNodes` tool can analyze conversations and extract knowledge graph elements:

```javascript
// Example API call
const extraction = await extractGraphNodes({
  messages: conversationMessages,
  extractionDepth: "standard"
});
```

## Tooling Overview

1. **semanticRetrieval.ts**: Semantic search across node types using vectors
2. **extractGraphNodes.ts**: Knowledge graph population from conversational data
3. **driver.ts**: Neo4j connection management
4. **serializer.ts**: Data serialization utilities
5. **types.ts**: TypeScript interfaces for nodes and relations
6. **cypher-builder.ts**: Helper functions for building Cypher queries
7. **embeddings.ts**: OpenAI embedding generation and caching

## Next Steps and Future Improvements

1. **Advanced Graph Analysis Tools**: Network analysis tools for centrality, community detection
2. **UI Visualization Components**: Interactive graph visualization components
3. **Improved Schema**: Enhanced schema with additional node types and relationships
4. **Bidirectional Integration**: Better integration between knowledge graph and reasoning process 