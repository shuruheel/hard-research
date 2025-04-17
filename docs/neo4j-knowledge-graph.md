# Neo4j Knowledge Graph Cognitive Model Rules

## Overview

This project implements a sophisticated knowledge graph memory system using Neo4j. It provides tools for LLMs to build, maintain, and explore a comprehensive knowledge graph with cognitive neuroscience-inspired features.

## Node Type System

The system supports six specialized node types, each with tailored attributes:

1. **Entity**: People, organizations, products, physical objects
   - Required: name, entityType="Entity"
   - Optional: description, biography, keyContributions (array)
   - Cognitive dimensions: emotionalValence, emotionalArousal

2. **Event**: Time-bound occurrences with temporal attributes
   - Required: name, entityType="Event" 
   - Optional: description, startDate, endDate, location, participants (array), outcome
   - Cognitive dimensions: emotionalValence, emotionalArousal, causalPredecessors, causalSuccessors

3. **Concept**: Abstract ideas, theories, principles, frameworks
   - Required: name, entityType="Concept"
   - Optional: description, definition, domain, perspectives (array), historicalDevelopment (array)
   - Cognitive dimensions: emotionalValence, emotionalArousal, abstractionLevel, metaphoricalMappings

4. **ScientificInsight**: Research findings with supporting evidence
   - Required: name, entityType="ScientificInsight"
   - Optional: description, hypothesis, evidence (array), methodology, confidence, field, publications (array)
   - Cognitive dimensions: emotionalValence, emotionalArousal, evidenceStrength, scientificCounterarguments, applicationDomains, replicationStatus, surpriseValue

5. **Law**: Established principles, rules, or regularities
   - Required: name, entityType="Law"
   - Optional: description, content, legalDocument, legalDocumentJurisdiction, legalDocumentReference, entities (array), concepts (array)
   - Cognitive dimensions: emotionalValence, emotionalArousal, domainConstraints, historicalPrecedents, counterexamples, formalRepresentation

6. **Thought**: Analyses, interpretations, or reflections
   - Required: name, entityType="Thought"
   - Optional: description, thoughtContent, title
   - Cognitive dimensions: emotionalValence, emotionalArousal, evidentialBasis, thoughtCounterarguments, implications, thoughtConfidenceScore

## Relationship Guidelines

When creating relationships between nodes:

1. Use active voice verbs for relationTypes (e.g., ADVOCATES, PARTICIPATED_IN, RELATES_TO)
2. Ensure proper directionality (from → to) with meaningful connections
3. Always include a detailed context field (30-50 words) explaining how and why the nodes are related
4. Include confidence scores (0.0-1.0) when appropriate
5. Add citation sources when available for academic or factual claims
6. Assign relationship weights (0.0-1.0) to indicate strength/importance

## Primary Tools

1. **Knowledge Exploration**:
   - `explore_context`: Reveals the neighborhood around nodes with rich contextual information
   - `explore_weighted_context`: Prioritizes important connections based on relationship weights
   - `search_nodes`: Performs general searches across all node types
   
2. **Knowledge Creation**:
   - `create_nodes`: Adds new information to the graph with specialized node types
   - `create_relations`: Establishes meaningful connections between nodes with metadata
   - `create_thoughts`: Captures AI analysis and insights about the conversation

## Code Guidelines

1. When modifying the `node-creator.ts` file:
   - Ensure properties are properly typed with appropriate interfaces
   - Handle nullable values with proper COALESCE statements in Cypher queries
   - Always maintain the dateTime fields (createdAt, lastUpdated)
   - Use proper Neo4j labels for node types (Entity, Event, Concept, etc.)

2. When modifying the `node-retriever.ts` file:
   - Ensure robust error handling for graph exploration methods
   - Maintain the weighted relationship traversal logic in prioritizeRelationships
   - Handle null/undefined results for disconnected nodes
   - Process search results to properly convert Neo4j types to JavaScript objects

3. When modifying Cypher queries:
   - Use parameterized queries with the `$variable` syntax
   - Prefer MERGE over CREATE to avoid duplicate nodes
   - Use CASE statements for conditional setting of properties
   - Include proper indexing hints for performance optimization

4. When adding cognitive dimensions:
   - Provide appropriate range validation (e.g., emotionalValence between -1.0 and 1.0)
   - Include descriptive comments for each dimension
   - Ensure backwards compatibility with existing nodes

## Implementation Best Practices

1. **Error Handling Approach**: Always gracefully handle missing nodes or relationships
   ```typescript
   if (!result || result.records.length === 0) {
     console.error(`Node not found: ${nodeName}`);
     return { entities: [], relations: [] };
   }
   ```

2. **Cypher Query Performance**: Use LIMIT and efficient traversal patterns
   ```typescript
   // Good pattern for weighted traversal
   `MATCH (start:Memory {name: $nodeName})
    MATCH path = (start)-[r*1..$maxDepth]-(other)
    WHERE all(rel in r WHERE rel.weight >= $minWeight)
    RETURN path LIMIT 100`
   ```

3. **Type Safety**: Ensure correct type handling between Neo4j and TypeScript
   ```typescript
   // Properly handle Neo4j Integer types
   const intValue = neo4j.int(record.get('count')).toNumber();
   ```

## Neo4j AuraDB Cypher Query Guidelines

### Connecting to AuraDB

When connecting to Neo4j AuraDB, always use the secure connection string format:

```typescript
const driver = neo4j.driver(
  'neo4j+s://<instance-id>.databases.neo4j.io',
  neo4j.auth.basic('<username>', '<password>')
)
```

### AuraDB Query Optimization

1. **Use Parameterized Queries**: Always use parameters to prevent injection attacks and improve query caching
   ```typescript
   session.run(
     'MATCH (n:Entity {name: $name}) RETURN n',
     { name: 'Albert Einstein' }
   )
   ```

2. **Leverage Indexes**: AuraDB automatically creates indexes on labels and properties
   ```cypher
   // Explicit index creation for better performance
   CREATE INDEX entity_name FOR (n:Entity) ON (n.name)
   
   // Use indexes in queries
   MATCH (n:Entity) 
   WHERE n.name = 'Albert Einstein' 
   RETURN n
   ```

3. **Pagination for Large Results**: Use skip and limit to page through results
   ```cypher
   MATCH (n:Concept)
   RETURN n
   ORDER BY n.name
   SKIP $offset
   LIMIT $pageSize
   ```

4. **Profile Queries**: Use PROFILE to understand query execution plans
   ```cypher
   PROFILE MATCH (n:Concept)-[r]-(m:Entity)
   WHERE n.name = 'Artificial Intelligence'
   RETURN n, r, m
   ```

### Cognitive Dimension Queries

1. **Filtering by Cognitive Dimensions**:
   ```cypher
   // Find concepts with positive emotional valence
   MATCH (c:Concept)
   WHERE c.emotionalValence > 0.5
   RETURN c
   
   // Find scientific insights with strong evidence and high surprise value
   MATCH (s:ScientificInsight)
   WHERE s.evidenceStrength > 0.7 AND s.surpriseValue > 0.6
   RETURN s.name, s.evidenceStrength, s.surpriseValue
   ```

2. **Aggregating Cognitive Metrics**:
   ```cypher
   // Calculate average emotional response to a concept across related thoughts
   MATCH (c:Concept {name: $conceptName})<-[r]-(t:Thought)
   RETURN c.name, 
          AVG(t.emotionalValence) AS avgValence,
          AVG(t.emotionalArousal) AS avgArousal
   ```

3. **Dimensional Path Exploration**:
   ```cypher
   // Find paths between concepts that maximize cognitive connection relevance
   MATCH path = shortestPath((a:Concept {name: $source})-[*..5]-(b:Concept {name: $target}))
   WITH path, relationships(path) AS rels
   WITH path, 
        reduce(score = 0, r IN rels | score + coalesce(r.weight, 0.5) * coalesce(r.confidenceScore, 1.0)) AS pathRelevance
   RETURN path, pathRelevance
   ORDER BY pathRelevance DESC
   LIMIT 3
   ```

### AuraDB-Specific Features

1. **Full-Text Search**:
   ```cypher
   // Create a full-text index
   CREATE FULLTEXT INDEX entityDescription FOR (n:Entity) ON EACH [n.description]
   
   // Use full-text search
   CALL db.index.fulltext.queryNodes("entityDescription", "neural network") 
   YIELD node, score
   RETURN node.name, score
   ORDER BY score DESC
   ```

2. **Spatial Queries** (when location data is present):
   ```cypher
   // Create a point
   MATCH (e:Event {name: $eventName})
   SET e.location = point({latitude: $lat, longitude: $lon})
   
   // Query by distance
   MATCH (e:Event)
   WHERE point.distance(e.location, point({latitude: $lat, longitude: $lon})) < 50000 // 50km
   RETURN e.name, e.startDate
   ```

3. **Temporal Queries** (for events with timestamps):
   ```cypher
   // Query events within a time period
   MATCH (e:Event)
   WHERE datetime(e.startDate) >= datetime('2023-01-01') 
     AND datetime(e.startDate) <= datetime('2023-12-31')
   RETURN e.name, e.startDate
   ORDER BY e.startDate
   ```

4. **Using the HTTP Query API** (for serverless applications):
   Neo4j AuraDB provides a Query API for HTTPS access. Example of usage with fetch:
   
   ```typescript
   const response = await fetch('https://[instanceID].databases.neo4j.io/db/[database]/tx/commit', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': 'Basic ' + btoa('username:password')
     },
     body: JSON.stringify({
       statements: [{
         statement: 'MATCH (n:Entity {name: $name}) RETURN n',
         parameters: { name: 'Albert Einstein' }
       }]
     })
   });
   
   const result = await response.json();
   ```

### Recommended Pattern for Complex Cognitive Graph Queries

```cypher
// Finding conceptual bridges between domains
MATCH (c1:Concept)-[:RELATES_TO*1..2]-(bridge:Concept)-[:RELATES_TO*1..2]-(c2:Concept)
WHERE c1.domain = 'Neuroscience' AND c2.domain = 'Computer Science'
  AND c1 <> bridge AND c2 <> bridge AND c1 <> c2
  AND bridge.abstractionLevel > 0.6  // Higher abstraction concepts make better bridges
WITH bridge, collect(DISTINCT c1.name) AS domain1Concepts, 
     collect(DISTINCT c2.name) AS domain2Concepts
RETURN bridge.name, 
       bridge.abstractionLevel,
       bridge.emotionalValence,
       domain1Concepts,
       domain2Concepts
ORDER BY size(domain1Concepts) * size(domain2Concepts) DESC
LIMIT 5
```

## Documentation Requirements

When documenting Node Types, always include:

1. Required and optional fields
2. Cognitive dimensions with value ranges
3. Example use cases
4. Related node types and common relationships
5. Validation requirements 