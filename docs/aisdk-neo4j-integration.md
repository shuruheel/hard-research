# AI SDK Neo4j Integration Guide

This document provides focused guidance on integrating Neo4j graph database tools with the Vercel AI SDK (v4.2+).

## Tool Definition Fundamentals

Tools in the Vercel AI SDK are defined using the `tool` function, which requires three main components:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const graphQueryTool = tool({
  // 1. Description of what the tool does
  description: 'Query the knowledge graph database for information',
  
  // 2. Parameters schema using Zod
  parameters: z.object({
    query: z.string().describe('Cypher query to execute'),
    parameters: z.record(z.any()).optional().describe('Query parameters')
  }),
  
  // 3. Execute function that performs the action
  execute: async ({ query, parameters = {} }) => {
    // Neo4j database connection and query execution logic here
    return { /* query results */ };
  }
});
```

## Multi-Step Tool Calls

The `maxSteps` parameter allows sequential tool execution, ideal for complex graph operations:

```typescript
const result = await streamText({
  model: yourModel,
  tools: [graphQueryTool, nodePropertiesTool, relationshipTool],
  maxSteps: 5, // Allow up to 5 sequential steps
  prompt: 'Find all connections between Person nodes "Alice" and "Bob"'
});
```

This enables workflows like:
1. Query the graph for Alice's node
2. Examine node properties
3. Find relationships to other nodes
4. Identify paths to Bob's node
5. Generate human-readable summary of connections

## Neo4j Singleton Pattern Implementation

For efficient connection management with Neo4j:

```typescript
// neo4j-driver.ts
import neo4j, { Driver } from 'neo4j-driver';

class Neo4jDriverSingleton {
  private static instance: Driver | null = null;
  
  private constructor() {}
  
  public static getInstance(): Driver {
    if (!Neo4jDriverSingleton.instance) {
      // Ensure environment variables are available
      const uri = process.env.NEO4J_URI;
      const user = process.env.NEO4J_USERNAME;
      const password = process.env.NEO4J_PASSWORD;
      
      if (!uri || !user || !password) {
        throw new Error('Missing Neo4j connection details');
      }
      
      Neo4jDriverSingleton.instance = neo4j.driver(
        uri,
        neo4j.auth.basic(user, password),
        { maxConnectionPoolSize: 50 }
      );
    }
    
    return Neo4jDriverSingleton.instance;
  }
  
  public static closeConnection(): Promise<void> {
    if (Neo4jDriverSingleton.instance) {
      const driver = Neo4jDriverSingleton.instance;
      Neo4jDriverSingleton.instance = null;
      return driver.close();
    }
    return Promise.resolve();
  }
}

export default Neo4jDriverSingleton;
```

## Example Neo4j Tools Implementation

### Basic Query Tool

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import Neo4jDriverSingleton from '../lib/neo4j-driver';

export const executeQueryTool = tool({
  description: 'Execute a Cypher query against the knowledge graph',
  parameters: z.object({
    query: z.string().describe('Cypher query to execute'),
    parameters: z.record(z.any()).optional().describe('Query parameters')
  }),
  execute: async ({ query, parameters = {} }) => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();
    
    try {
      const result = await session.run(query, parameters);
      return {
        records: result.records.map(record => {
          // Convert Neo4j result format to JSON-serializable format
          const obj: Record<string, any> = {};
          record.keys.forEach(key => {
            obj[key] = serializeNeo4jValue(record.get(key));
          });
          return obj;
        }),
        summary: {
          counters: result.summary.counters.updates()
        }
      };
    } catch (error) {
      throw new Error(`Graph query error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await session.close();
    }
  }
});

// Helper function to convert Neo4j values to JSON-serializable format
function serializeNeo4jValue(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }
  
  // Handle Neo4j integers
  if (neo4j.isInt(value)) {
    return value.toNumber();
  }
  
  // Handle Neo4j nodes
  if (value.labels && value.properties) {
    return {
      id: serializeNeo4jValue(value.identity),
      labels: value.labels,
      properties: Object.fromEntries(
        Object.entries(value.properties).map(([k, v]) => [k, serializeNeo4jValue(v)])
      )
    };
  }
  
  // Handle Neo4j relationships
  if (value.type && value.properties) {
    return {
      id: serializeNeo4jValue(value.identity),
      type: value.type,
      properties: Object.fromEntries(
        Object.entries(value.properties).map(([k, v]) => [k, serializeNeo4jValue(v)])
      ),
      start: serializeNeo4jValue(value.start),
      end: serializeNeo4jValue(value.end)
    };
  }
  
  // Handle Neo4j paths
  if (value.segments) {
    return {
      segments: value.segments.map((segment: any) => ({
        start: serializeNeo4jValue(segment.start),
        relationship: serializeNeo4jValue(segment.relationship),
        end: serializeNeo4jValue(segment.end)
      }))
    };
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(serializeNeo4jValue);
  }
  
  // Handle objects
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serializeNeo4jValue(v)])
    );
  }
  
  return value;
}
```

### Specialized Knowledge Graph Tools

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import Neo4jDriverSingleton from '../lib/neo4j-driver';

// Entity search tool
export const findEntityTool = tool({
  description: 'Find entities in the knowledge graph that match specific criteria',
  parameters: z.object({
    name: z.string().optional().describe('Name to search for (supports partial matches)'),
    labels: z.array(z.string()).optional().describe('Entity types to filter by'),
    properties: z.record(z.any()).optional().describe('Properties to match'),
    limit: z.number().int().min(1).max(100).default(10).describe('Maximum number of results')
  }),
  execute: async ({ name, labels = [], properties = {}, limit }) => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();
    
    try {
      let query = 'MATCH (entity)';
      const params: Record<string, any> = { limit };
      
      // Add label filtering if specified
      if (labels.length > 0) {
        query += ` WHERE entity:${labels.join(' OR entity:')}`;
      }
      
      // Add name filtering
      if (name) {
        const nameCondition = labels.length > 0 ? ' AND' : ' WHERE';
        query += `${nameCondition} entity.name =~ $namePattern`;
        params.namePattern = `(?i).*${name}.*`;
      }
      
      // Add property filtering
      if (Object.keys(properties).length > 0) {
        const propCondition = (labels.length > 0 || name) ? ' AND' : ' WHERE';
        query += propCondition;
        
        const propConditions = Object.entries(properties).map(([key, value], index) => {
          params[`prop${index}`] = value;
          return ` entity.${key} = $prop${index}`;
        });
        
        query += propConditions.join(' AND');
      }
      
      query += ' RETURN entity LIMIT $limit';
      
      const result = await session.run(query, params);
      return result.records.map(record => serializeNeo4jValue(record.get('entity')));
    } finally {
      await session.close();
    }
  }
});

// Path finding tool
export const findPathTool = tool({
  description: 'Find paths between two entities in the knowledge graph',
  parameters: z.object({
    startNodeId: z.string().describe('ID of the starting node'),
    endNodeId: z.string().describe('ID of the ending node'),
    relationshipTypes: z.array(z.string()).optional().describe('Types of relationships to consider'),
    maxDepth: z.number().int().min(1).max(10).default(4).describe('Maximum path length')
  }),
  execute: async ({ startNodeId, endNodeId, relationshipTypes = [], maxDepth }) => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();
    
    try {
      let query = 'MATCH path = shortestPath((start)-[';
      
      // Add relationship type filtering
      if (relationshipTypes.length > 0) {
        query += `:${relationshipTypes.join('|')}`;
      }
      
      query += `*1..${maxDepth}]->(end))
                WHERE id(start) = $startId AND id(end) = $endId
                RETURN path`;
      
      const result = await session.run(query, {
        startId: Number(startNodeId),
        endId: Number(endNodeId)
      });
      
      if (result.records.length === 0) {
        return { found: false, message: 'No path found between the specified nodes' };
      }
      
      return {
        found: true,
        path: serializeNeo4jValue(result.records[0].get('path'))
      };
    } finally {
      await session.close();
    }
  }
});
```

## Usage with AI SDK

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { executeQueryTool, findEntityTool, findPathTool } from '../lib/neo4j-tools';

export async function POST(req: Request) {
  const { prompt } = await req.json();
  
  const result = await streamText({
    model: openai('gpt-4o'),
    prompt,
    tools: [executeQueryTool, findEntityTool, findPathTool],
    maxSteps: 5, // Allow multiple sequential tool calls
    temperature: 0.7,
  });
  
  return result.toResponse();
}
```

## Error Handling Best Practices

When implementing Neo4j tools, follow these error handling guidelines:

1. Categorize errors (connection, query syntax, not found)
2. Provide clear error messages that don't expose sensitive information
3. Include proper cleanup in finally blocks
4. Handle Neo4j-specific errors like constraint violations
5. Consider retry logic for transient failures

## Performance Optimization

1. Use parameterized queries to prevent injection and improve performance
2. Keep connection pool size appropriate for your application
3. Implement query timeout mechanisms
4. Consider caching for frequently requested graph patterns
5. Use efficient Cypher patterns (e.g., OPTIONAL MATCH instead of multiple queries)

## Security Considerations

1. Sanitize and validate all user inputs before executing Cypher queries
2. Use parameterized queries to prevent injection attacks
3. Restrict access to sensitive node properties
4. Implement access control at the database level
5. Avoid exposing internal node IDs in responses when possible