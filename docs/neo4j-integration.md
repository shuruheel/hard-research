# Neo4j Integration

This document provides information on how to use the Neo4j integration in this project.

## Setup

### Environment Variables

Add the following environment variables to your `.env.local` file:

```
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
```

### Initialize Schema

Before using the Neo4j tools, you need to initialize the graph schema with necessary constraints and indexes:

```bash
npm run neo4j:init
# or
pnpm neo4j:init
```

This script creates:
- Unique constraints for node IDs across all node types
- Vector indexes for semantic search (with dimensions=3072 for OpenAI embeddings)
- Text indexes for name properties to speed up lookups

## Available Tools

### Semantic Retrieval

The `semanticRetrieval` tool allows you to find semantically relevant nodes in the knowledge graph based on a text query.

Example:
```typescript
const results = await semanticRetrieval.execute({
  queryText: "What are the ethical implications of artificial intelligence?",
  nodeTypes: ["Thought", "Concept", "Person"],
  limit: 5
});
```

### Graph Node Extraction

The `extractGraphNodes` tool extracts knowledge graph nodes from conversation messages, including reasoning tokens.

Example:
```typescript
const extraction = await extractGraphNodes.execute({
  messages: conversation.messages,
  extractionDepth: "standard" // "minimal", "standard", or "deep"
});
```

## Type Definitions

The Neo4j integration includes TypeScript type definitions for all node types and relationships:

- `Entity`, `Person`, `Concept`, `Thought`, `ReasoningChain`, `ReasoningStep`, etc.
- Relationship types like `RELATED_TO`, `HAS_CONCEPT`, `REFERS_TO`, etc.

## Neo4j Connection

The Neo4j driver is implemented as a singleton for efficient connection management:

```typescript
import { getNeo4jDriver } from '@/lib/neo4j/driver';

// Get a session
const session = getNeo4jDriver().session();

try {
  // Use the session...
} finally {
  // Always close the session
  await session.close();
}
```

## Serialization

The integration includes utilities for serializing Neo4j objects to JSON-compatible formats:

```typescript
import { serializeNeo4j } from '@/lib/neo4j/serializer';

// Serialize a Neo4j result
const serialized = serializeNeo4j(result);
```

## Cypher Query Building

The `cypher-builder.ts` utilities help construct Cypher queries with proper parameterization:

```typescript
import { matchNode, buildQuery, paginate } from '@/lib/neo4j/cypher-builder';

const query = buildQuery([
  matchNode('Person', { name: 'John' }, 'p'),
  'RETURN p',
  paginate(0, 10)
]);
```

## Troubleshooting

If you encounter connection issues:

1. Verify your Neo4j instance is running
2. Check your environment variables
3. Ensure you have the proper access permissions
4. Check that vector indexes are properly created with the correct dimensions (3072) 