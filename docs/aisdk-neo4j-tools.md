# Neo4j Tool Implementation Guide for AI SDK

This guide focuses on implementing custom tools for the Vercel AI SDK that interface with our Neo4j semantic knowledge graph.

## Fundamental Tool Structure

Each tool should follow this basic pattern:

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import Neo4jDriverSingleton from '../lib/neo4j-driver';

export const knowledgeGraphTool = tool({
  description: '[Clear description of tool purpose]',
  parameters: z.object({
    // Zod schema for parameters
  }),
  execute: async (params) => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();
    
    try {
      // Neo4j query execution
      return /* query results */;
    } catch (error) {
      // Error handling
    } finally {
      await session.close();
    }
  }
});
```

## Essential Tools to Implement

Based on our semantic graph schema (see `docs/graph-schema.md`), we should implement these core tools:

### 1. Entity Query Tool

Purpose: Search for entities (nodes) matching specific criteria

```typescript
parameters: z.object({
  name: z.string().optional(),
  nodeType: z.string().optional(),
  properties: z.record(z.any()).optional(),
  limit: z.number().default(10)
})
```

### 2. Relationship Query Tool

Purpose: Find relationships between nodes

```typescript
parameters: z.object({
  sourceNodeId: z.string().optional(),
  targetNodeId: z.string().optional(),
  relationshipType: z.string().optional(),
  direction: z.enum(['OUTGOING', 'INCOMING', 'BOTH']).default('BOTH'),
  limit: z.number().default(10)
})
```

### 3. Path Finding Tool

Purpose: Discover paths between entities

```typescript
parameters: z.object({
  startNodeId: z.string(),
  endNodeId: z.string(),
  relationshipTypes: z.array(z.string()).optional(),
  maxDepth: z.number().default(3)
})
```

### 4. Knowledge Exploration Tool

Purpose: Expand from a starting node to explore connected concepts

```typescript
parameters: z.object({
  nodeId: z.string(),
  nodeTypes: z.array(z.string()).optional(),
  relationshipTypes: z.array(z.string()).optional(),
  maxNodes: z.number().default(10),
  depth: z.number().default(1)
})
```

### 5. Entity Creation Tool

Purpose: Create new entity nodes in the graph

```typescript
parameters: z.object({
  nodeType: z.string(),
  properties: z.record(z.any()),
  relationships: z.array(z.object({
    targetNodeId: z.string().optional(),
    targetNodeProperties: z.record(z.any()).optional(),
    relationshipType: z.string(),
    relationshipProperties: z.record(z.any()).optional()
  })).optional()
})
```

## Multi-Step Tool Usage Pattern

Configure for sequential tool execution with `maxSteps`:

```typescript
const result = await streamText({
  model: openai('gpt-4o'),
  prompt: 'Find all statements believed by Einstein about quantum mechanics',
  tools: [
    entityQueryTool, 
    relationshipQueryTool, 
    pathFindingTool,
    knowledgeExplorationTool
  ],
  maxSteps: 5,
});
```

This enables complex cognitive workflows:
1. Find the Einstein entity
2. Explore BELIEVES relationships
3. Filter results for quantum mechanics connections
4. Analyze and synthesize findings
5. Return human-readable results

## Neo4j Driver Singleton Implementation

```typescript
// lib/neo4j-driver.ts
import neo4j, { Driver } from 'neo4j-driver';

class Neo4jDriverSingleton {
  private static instance: Driver | null = null;
  
  private constructor() {}
  
  public static getInstance(): Driver {
    if (!Neo4jDriverSingleton.instance) {
      const uri = process.env.NEO4J_URI!;
      const user = process.env.NEO4J_USERNAME!;
      const password = process.env.NEO4J_PASSWORD!;
      
      Neo4jDriverSingleton.instance = neo4j.driver(
        uri,
        neo4j.auth.basic(user, password)
      );
    }
    
    return Neo4jDriverSingleton.instance;
  }
}

export default Neo4jDriverSingleton;
```

## Serialization Helper Function

For converting Neo4j objects to JSON-serializable values:

```typescript
function serializeNeo4jValue(value: any): any {
  if (value === null || value === undefined) return value;
  
  if (neo4j.isInt(value)) return value.toNumber();
  
  if (value.labels && value.properties) {
    return {
      id: serializeNeo4jValue(value.identity),
      labels: value.labels,
      properties: Object.fromEntries(
        Object.entries(value.properties).map(([k, v]) => 
          [k, serializeNeo4jValue(v)]
        )
      )
    };
  }
  
  if (Array.isArray(value)) return value.map(serializeNeo4jValue);
  
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serializeNeo4jValue(v)])
    );
  }
  
  return value;
}
```

## Integration with API Route

```typescript
// app/(preview)/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  entityQueryTool,
  relationshipQueryTool,
  pathFindingTool,
  knowledgeExplorationTool,
  entityCreationTool
} from '@/lib/neo4j-tools';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = await streamText({
    model: openai('gpt-4o'),
    messages,
    tools: [
      entityQueryTool,
      relationshipQueryTool,
      pathFindingTool,
      knowledgeExplorationTool,
      entityCreationTool
    ],
    maxSteps: 5,
  });
  
  return result.toResponse();
}
```