# Neo4j TypeScript Integration Rules

## Overview

This file provides guidelines for using TypeScript with the Neo4j knowledge graph project. TypeScript adds static type checking, enabling you to catch errors during development rather than at runtime. For Neo4j operations, this is particularly valuable when dealing with complex cognitive data structures.

## Neo4j TypeScript Type Definitions

### Basic Neo4j Types

When working with Neo4j in TypeScript, use the imported types from the driver:

```typescript
import neo4j, { Node, Relationship, Integer, Record } from 'neo4j-driver'
```

### Node Type Definitions

Define TypeScript interfaces for node properties that align with Neo4j node labels:

```typescript
// Entity node properties
interface EntityProperties {
  name: string;
  description?: string;
  biography?: string;
  keyContributions?: string[];
  emotionalValence?: number; // -1.0 to 1.0
  emotionalArousal?: number; // 0.0 to 3.0
  createdAt: Date;
  lastUpdated: Date;
}

// Define the complete Entity node type
type Entity = Node<Integer, EntityProperties>;
```

### Relationship Type Definitions

Define TypeScript interfaces for relationship properties:

```typescript
interface RelationProperties {
  relationType: string;
  context?: string;
  confidenceScore?: number; // 0.0 to 1.0
  weight?: number; // 0.0 to 1.0
  sources?: string[];
  createdAt: Date;
  lastUpdated: Date;
}

type Relation = Relationship<Integer, RelationProperties>;
```

## Cypher Query Result Typing

### Result Record Interfaces

For each Cypher query, define an interface that maps the returned columns:

```typescript
// For query: MATCH (e:Entity)-[r:RELATES_TO]->(c:Concept) RETURN e, r, c
interface EntityRelatesConcept {
  e: Entity;
  r: Relation;
  c: Node<Integer, ConceptProperties>;
}

// Use the interface with session.run()
const result = await session.run<EntityRelatesConcept>(
  `MATCH (e:Entity)-[r:RELATES_TO]->(c:Concept)
   RETURN e, r, c`,
  { /* parameters */ }
);

// Type-safe access to properties
result.records.forEach(record => {
  const entity = record.get('e');
  const relation = record.get('r');
  const concept = record.get('c');
  
  // TypeScript knows the types and provides intellisense
  console.log(entity.properties.name);
  console.log(relation.properties.weight);
  console.log(concept.properties.abstractionLevel);
});
```

### Handling Collections

For queries returning collections, use array types in the interface:

```typescript
interface ConceptRelations {
  conceptName: string;
  relatedEntities: Node<Integer, EntityProperties>[];
}

const result = await session.run<ConceptRelations>(
  `MATCH (c:Concept {name: $name})-[r]->(e:Entity)
   RETURN c.name AS conceptName, collect(e) AS relatedEntities`,
  { name: 'Artificial Intelligence' }
);
```

## Type-Safe Helper Functions

### Creating Type-Safe Database Access Functions

```typescript
// Generic read function with type parameter
async function readNodes<T>(
  cypher: string, 
  params: Record<string, any> = {}
): Promise<T[]> {
  const session = driver.session();
  try {
    const result = await session.executeRead(tx => 
      tx.run<T>(cypher, params)
    );
    return result.records.map(record => record.toObject() as T);
  } finally {
    await session.close();
  }
}

// Usage example
const entities = await readNodes<{entity: Entity}>(
  'MATCH (entity:Entity) RETURN entity LIMIT 10'
);
```

### Type-Safe Node Creation

```typescript
// Type-safe function to create an Entity node
async function createEntity(
  entityProps: Omit<EntityProperties, 'createdAt' | 'lastUpdated'>
): Promise<Entity> {
  const session = driver.session();
  try {
    const now = new Date();
    const result = await session.executeWrite(tx => 
      tx.run<{entity: Entity}>(
        `CREATE (entity:Entity)
         SET entity = $props,
             entity.createdAt = datetime(),
             entity.lastUpdated = datetime()
         RETURN entity`,
        { 
          props: {
            ...entityProps,
            createdAt: now,
            lastUpdated: now
          } 
        }
      )
    );
    
    if (result.records.length === 0) {
      throw new Error('Failed to create entity');
    }
    
    return result.records[0].get('entity');
  } finally {
    await session.close();
  }
}
```

## Type-Safe Cognitive Dimension Processing

### Processing Cognitive Dimensions with Type Safety

```typescript
// Type-safe function to calculate emotional metrics
async function calculateEmotionalMetrics<T extends { emotionalValence: number, emotionalArousal: number }>(
  nodeArray: T[]
): Promise<{ avgValence: number, avgArousal: number, emotionalImpact: number }> {
  if (nodeArray.length === 0) {
    return { avgValence: 0, avgArousal: 0, emotionalImpact: 0 };
  }
  
  const totalValence = nodeArray.reduce((sum, node) => sum + (node.emotionalValence || 0), 0);
  const totalArousal = nodeArray.reduce((sum, node) => sum + (node.emotionalArousal || 0), 0);
  
  const avgValence = totalValence / nodeArray.length;
  const avgArousal = totalArousal / nodeArray.length;
  const emotionalImpact = Math.abs(avgValence) * avgArousal;
  
  return { avgValence, avgArousal, emotionalImpact };
}
```

## Best Practices for Neo4j TypeScript Integration

1. **Define Types For All Entities**:
   - Create interfaces for all node types in your knowledge graph
   - Include cognitive dimensions in these interfaces
   - Document value ranges as comments

2. **Type-Safe Query Execution**:
   - Always define interfaces for query results
   - Use generics with `session.run<T>()` for type checking
   - Access record properties using typed getters (`record.get('property')`)

3. **Handle Neo4j-Specific Types**:
   - Convert Neo4j `Integer` to JavaScript numbers when needed: `neo4j.int(value).toNumber()`
   - For dates, convert between Neo4j's datetime and JavaScript Date objects

4. **Error Handling with Type Guards**:
   ```typescript
   function isNeo4jError(error: any): error is neo4j.Neo4jError {
     return error instanceof neo4j.Neo4jError;
   }
   
   try {
     // Neo4j operations
   } catch (error) {
     if (isNeo4jError(error)) {
       // Handle Neo4j-specific errors with type support
       console.error(`Neo4j error code ${error.code}: ${error.message}`);
     } else {
       // Handle other errors
       console.error('Unknown error:', error);
     }
   }
   ```

5. **Environment Variable Type Safety**:
   ```typescript
   // Define types for required environment variables
   interface Neo4jEnv {
     NEO4J_URI: string;
     NEO4J_USERNAME: string;
     NEO4J_PASSWORD: string;
   }
   
   // Type guard for environment variables
   function validateNeo4jEnv(): asserts process.env is NodeJS.ProcessEnv & Neo4jEnv {
     const requiredVars = ['NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD'];
     const missingVars = requiredVars.filter(v => !process.env[v]);
     
     if (missingVars.length > 0) {
       throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
     }
   }
   
   // Usage
   validateNeo4jEnv();
   const driver = neo4j.driver(
     process.env.NEO4J_URI,
     neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
   );
   ```

## Advanced Type Patterns for Neo4j

### Union Types for Polymorphic Queries

```typescript
// Define a union type for different node returns
type KnowledgeNode = 
  | { type: 'Entity', node: Entity }
  | { type: 'Concept', node: Node<Integer, ConceptProperties> }
  | { type: 'Event', node: Node<Integer, EventProperties> };

// Process based on node type
function processKnowledgeNode(node: KnowledgeNode): string {
  switch (node.type) {
    case 'Entity':
      return `Entity: ${node.node.properties.name}`;
    case 'Concept':
      return `Concept: ${node.node.properties.name} (Abstraction: ${node.node.properties.abstractionLevel})`;
    case 'Event':
      return `Event: ${node.node.properties.name} (Date: ${node.node.properties.startDate})`;
  }
}
```

### Generic Cognitive Type Factory

```typescript
// Function to create a typed cognitive node factory
function createCognitiveNodeFactory<T extends object>() {
  return (properties: T & {
    emotionalValence?: number;
    emotionalArousal?: number;
  }) => {
    // Validate cognitive dimensions
    if (properties.emotionalValence !== undefined && 
        (properties.emotionalValence < -1 || properties.emotionalValence > 1)) {
      throw new Error('Emotional valence must be between -1 and 1');
    }
    
    if (properties.emotionalArousal !== undefined && 
        (properties.emotionalArousal < 0 || properties.emotionalArousal > 3)) {
      throw new Error('Emotional arousal must be between 0 and 3');
    }
    
    return properties;
  };
}

// Usage
const createConcept = createCognitiveNodeFactory<{
  name: string;
  definition: string;
  abstractionLevel?: number;
}>();

const aiConcept = createConcept({
  name: 'Artificial Intelligence',
  definition: 'The simulation of human intelligence in machines',
  abstractionLevel: 0.8,
  emotionalValence: 0.2,
  emotionalArousal: 1.5
});
```

## Resources for Neo4j TypeScript Development

- [Building Neo4j Applications with TypeScript course](https://graphacademy.neo4j.com/courses/app-typescript/)
- [Neo4j JavaScript Driver API Documentation](https://neo4j.com/docs/api/javascript-driver/current/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/) 