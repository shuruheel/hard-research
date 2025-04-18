# Updated Neo4j Integration Implementation Plan (v3)

This document outlines a refined implementation plan for integrating Neo4j knowledge graph tools with the AI chatbot codebase, focusing first on semantic retrieval and message extraction tools.

## Overview

The implementation plan is divided into three phases with refined priorities:
1. **Neo4j Core Integration & Initial Tools**: Setting up the driver and implementing the two highest-priority tools
2. **Advanced Graph Analysis Tools**: Implementing tools for network analysis and semantic exploration
3. **UI & Visualization**: Developing components to display graph data and analysis results

## Phase 1: Neo4j Core Integration & Initial Tools

### Step 1: Setup Neo4j Connection (1-2 hours)

1. Create Neo4j driver singleton:
   - Create file: `lib/neo4j/driver.ts`
   - Implement singleton pattern for connection management
   - Add environment variable validation
   - Handle Integer and DateTime type conversions

### Step 2: Create Core Utility Functions (2-3 hours)

1. Create serialization helpers:
   - Create file: `lib/neo4j/serializer.ts`
   - Implement functions to convert Neo4j objects to JSON
   - Handle special Neo4j types (Integer, DateTime)
   - Add specific serializers for each node type

2. Create Cypher query builder:
   - Create file: `lib/neo4j/cypher-builder.ts`
   - Implement functions for common query patterns
   - Include parameterization support
   - Add methods for pagination (SKIP/LIMIT)

3. Create type definitions:
   - Create file: `lib/neo4j/types.ts`
   - Define TypeScript interfaces for node types and relationships based on `docs/graph-schema.md`
   - Define interfaces for query results and pagination

### Step 3: Implement Semantic Retrieval Tool (3-4 hours)

1. Create vector-based retrieval tool:
   - Create file: `lib/ai/tools/semanticRetrieval.ts`
   - Implement a tool that takes a query text, embeds it using OpenAI's text-embedding-3-large model (3072 dimensions), and uses that embedding to search vector indexes
   - Support querying across multiple node types (Thought, ReasoningChain, Person, Concept)
   - Use existing vector indexes in Neo4j that are configured for OpenAI's text-embedding-3-large model (3072 dimensions)
   - Ensure dimension compatibility between query embeddings and stored node embeddings
   - Use the correct vector index names as defined in the system:

```typescript
const NODE_TYPE_TO_INDEX: Record<string, string> = {
  'Concept': 'concept-embeddings',
  'Entity': 'entity-embeddings',
  'Person': 'person-embeddings', // Person is a subType of Entity
  'Proposition': 'proposition-embeddings',
  'ReasoningChain': 'reasoningchain-embeddings',
  'Thought': 'thought-embeddings'
};
```

```typescript
export const semanticRetrieval = {
  description: "Retrieve semantically relevant nodes from the knowledge graph based on query text",
  parameters: z.object({
    queryText: z.string().describe("The text query to find relevant information"),
    nodeTypes: z.array(
      z.enum(["Thought", "ReasoningChain", "Person", "Concept"])
    ).optional().describe("Types of nodes to search (defaults to all)"),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of results to return")
  }),
  execute: async function({ queryText, nodeTypes = ["Thought", "ReasoningChain", "Person", "Concept"], limit = 10 }) {
    const session = neo4jDriver.session({ defaultAccessMode: neo4j.session.READ });
    
    try {
      // 1. Get embedding for query text (using OpenAI or existing embeddings service)
      const queryEmbedding = await getEmbeddingForText(queryText);
      
      // 2. Build query for each node type and union results
      const nodeQueries = nodeTypes.map(nodeType => {
        // Use the correct index name for each node type
        let indexName;
        switch(nodeType) {
          case "Person": indexName = "person-embeddings"; break;
          case "Concept": indexName = "concept-embeddings"; break;
          case "Thought": indexName = "thought-embeddings"; break;
          case "ReasoningChain": indexName = "reasoningchain-embeddings"; break;
          case "Entity": indexName = "entity-embeddings"; break;
          case "Proposition": indexName = "proposition-embeddings"; break;
          default: indexName = null; // Should never happen with our enum
        }
        
        return `
          CALL {
            CALL db.index.vector.queryNodes("${indexName}", $limit, $embedding)
            YIELD node, score
            RETURN node, score, "${nodeType}" AS nodeType
          }
        `;
      });
      
      // 3. Execute combined query with UNION ALL
      const query = nodeQueries.join("\nUNION ALL\n") + "\nORDER BY score DESC LIMIT $finalLimit";
      
      const result = await session.run(query, {
        embedding: queryEmbedding,
        limit: neo4j.int(Math.ceil(limit / nodeTypes.length)), // Split limit across types
        finalLimit: neo4j.int(limit) // Final limit after union
      });
      
      // 4. Process and return results
      return result.records.map(record => {
        const node = record.get('node');
        const score = record.get('score');
        const nodeType = record.get('nodeType');
        
        // Base properties all nodes should have
        const baseProps = {
          id: node.properties.id,
          name: node.properties.name,
          nodeType: nodeType,
          similarityScore: score
        };
        
        // Add type-specific properties
        switch(nodeType) {
          case "Thought":
            return {
              ...baseProps,
              thoughtContent: node.properties.thoughtContent,
              confidence: neo4j.isInt(node.properties.confidence) 
                ? neo4j.integer.toNumber(node.properties.confidence) 
                : node.properties.confidence
            };
          case "ReasoningChain":
            return {
              ...baseProps,
              description: node.properties.description,
              conclusion: node.properties.conclusion
            };
          case "Person":
            return {
              ...baseProps,
              biography: node.properties.biography
            };
          case "Concept":
            return {
              ...baseProps,
              definition: node.properties.definition,
              domain: node.properties.domain
            };
          default:
            return baseProps;
        }
      });
    } catch (error) {
      console.error("Semantic retrieval failed:", error);
      throw new Error(`Failed to retrieve semantic nodes: ${error.message}`);
    } finally {
      await session.close();
    }
  }
};

// Helper function to get embeddings using OpenAI's text-embedding-3-large model
async function getEmbeddingForText(text) {
  // Implementation using OpenAI embedding model
  // Use OpenAI's embedding API or AI SDK's embedding functionality
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
    dimensions: 3072 // Explicitly specify 3072 dimensions
  });
  
  return response.data[0].embedding; // 3072-dimensional vector
}
```

2. Create unit tests for semantic retrieval:
   - Create file: `tests/unit/semantic-retrieval.test.ts`
   - Test with different query texts and node types
   - Mock the embedding service

3. Integrate with API route:
   - Add tool to `app/(chat)/api/chat/route.ts`

### Step 4: Implement Message Extraction Tool (4-5 hours)

1. Create node extraction tool:
   - Create file: `lib/ai/tools/extractGraphNodes.ts`
   - Implement a tool that extracts entities, concepts, and other node types from message content
   - Use LLM to analyze message parts and reasoning tokens
   - Create relationships between extracted nodes

```typescript
export const extractGraphNodes = {
  description: "Extract knowledge graph nodes from conversation messages and reasoning tokens",
  parameters: z.object({
    messages: z.array(z.object({
      id: z.string(),
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().optional(),
      parts: z.array(z.object({
        type: z.string(),
        text: z.string().optional(),
        reasoning: z.string().optional(),
        toolInvocation: z.any().optional()
      })).optional()
    })),
    extractionDepth: z.enum(["minimal", "standard", "deep"]).default("standard")
      .describe("Level of detail for extraction: minimal (core entities only), standard (entities, concepts, basic relationships), deep (all node types and relationships)")
  }),
  execute: async function({ messages, extractionDepth = "standard" }) {
    try {
      // 1. Prepare conversation context for LLM analysis
      const conversationText = prepareConversationText(messages);
      
      // 2. Extract reasoning chains from reasoning tokens if available
      const reasoningChains = extractReasoningChains(messages);
      
      // 3. Use LLM to extract nodes based on schema
      const extractedNodes = await extractNodesWithLLM(conversationText, reasoningChains, extractionDepth);
      
      // 4. Save nodes and relationships to Neo4j
      const session = neo4jDriver.session({ defaultAccessMode: neo4j.session.WRITE });
      try {
        const nodesCreated = await saveNodesToNeo4j(session, extractedNodes);
        return {
          success: true,
          nodesCreated: nodesCreated,
          summary: generateExtractionSummary(nodesCreated)
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      console.error("Graph node extraction failed:", error);
      throw new Error(`Failed to extract graph nodes: ${error.message}`);
    }
  }
};

// Helper function to prepare conversation text
function prepareConversationText(messages) {
  // Combine message content and parts for LLM analysis
  return messages.map(msg => {
    const role = msg.role.toUpperCase();
    let content = msg.content || '';
    
    // Add content from parts if available
    if (msg.parts && msg.parts.length > 0) {
      content += msg.parts
        .filter(part => part.type === 'text' && part.text)
        .map(part => part.text)
        .join('\n');
    }
    
    return `${role}: ${content}`;
  }).join('\n\n');
}

// Extract reasoning chains from reasoning tokens
function extractReasoningChains(messages) {
  const chains = [];
  
  for (const msg of messages) {
    if (!msg.parts) continue;
    
    const reasoningParts = msg.parts.filter(part => 
      part.type === 'reasoning' && part.reasoning
    );
    
    for (const part of reasoningParts) {
      chains.push({
        messageId: msg.id,
        reasoning: part.reasoning,
        steps: parseReasoningSteps(part.reasoning)
      });
    }
  }
  
  return chains;
}

// Parse reasoning text into structured steps
function parseReasoningSteps(reasoning) {
  // Simple implementation to split reasoning into steps
  return reasoning.split('\n\n')
    .filter(step => step.trim().length > 0)
    .map((content, index) => ({ content, index }));
}

// Use LLM to extract nodes based on graph schema
async function extractNodesWithLLM(conversationText, reasoningChains, extractionDepth) {
  // System prompt with schema information
  const systemPrompt = `
  Extract entities from the conversation according to this knowledge graph schema:
  - Entity: Physical objects, people, locations
  - Concept: Abstract ideas and categories
  - Thought: Subjective interpretations or analyses
  - Event: Time-bound occurrences
  - Attribute: Properties of entities
  - ReasoningChain: Sequences of logical reasoning
  
  For each entity, extract relevant properties based on type.
  For extraction depth=${extractionDepth}, focus on ${getExtractionFocusByDepth(extractionDepth)}.
  
  Format your response as a valid JSON object with "nodes" and "relationships" arrays.
  `;
  
  // Use an LLM to analyze the text (specific implementation depends on chosen LLM)
  const response = await model.generateContent([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: conversationText }
  ]);
  
  const content = response.content.toString();
  
  // Extract JSON from response
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                    content.match(/{[\s\S]*}/);
                    
  if (!jsonMatch) {
    throw new Error("Failed to extract valid JSON from LLM response");
  }
  
  try {
    const extracted = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    
    // Merge extracted nodes with reasoning chains
    return mergeWithReasoningChains(extracted, reasoningChains);
  } catch (error) {
    console.error("Failed to parse JSON from LLM response:", error);
    throw error;
  }
}

// Get extraction focus based on depth
function getExtractionFocusByDepth(depth) {
  switch(depth) {
    case "minimal":
      return "key entities and people only";
    case "standard":
      return "entities, concepts, and their direct relationships";
    case "deep":
      return "all node types including abstract concepts, thoughts, and complex relationships";
    default:
      return "entities, concepts, and their direct relationships";
  }
}

// Merge LLM-extracted nodes with reasoning chains
function mergeWithReasoningChains(extracted, reasoningChains) {
  // Add reasoning chains as nodes if they're not already extracted
  // And link them to related entities and concepts
  
  const existingNodeIds = new Set(extracted.nodes.map(n => n.id));
  
  for (const chain of reasoningChains) {
    if (!existingNodeIds.has(`reasoning-${chain.messageId}`)) {
      // Create reasoning chain node
      extracted.nodes.push({
        id: `reasoning-${chain.messageId}`,
        type: "ReasoningChain",
        name: `Reasoning from message ${chain.messageId}`,
        description: chain.reasoning.substring(0, 100) + '...',
        steps: chain.steps.length
      });
      
      // Create reasoning step nodes
      chain.steps.forEach((step, idx) => {
        const stepId = `reasoning-step-${chain.messageId}-${idx}`;
        extracted.nodes.push({
          id: stepId,
          type: "ReasoningStep",
          name: `Step ${idx+1}`,
          content: step.content,
          stepType: "inference" // Default, could be refined
        });
        
        // Create relationship between chain and step
        extracted.relationships.push({
          source: `reasoning-${chain.messageId}`,
          target: stepId,
          type: "HAS_PART"
        });
      });
    }
  }
  
  return extracted;
}

// Save extracted nodes to Neo4j
async function saveNodesToNeo4j(session, extractedData) {
  const { nodes, relationships } = extractedData;
  const stats = { nodes: {}, relationships: 0 };
  
  // Process nodes by type
  for (const node of nodes) {
    const nodeType = node.type;
    const nodeProperties = { ...node };
    delete nodeProperties.type; // Remove type property as it's used for the label
    
    // Convert array properties to Neo4j arrays if needed
    for (const [key, value] of Object.entries(nodeProperties)) {
      if (Array.isArray(value)) {
        nodeProperties[key] = value; // Neo4j driver handles arrays properly
      }
    }
    
    // Create node with properties
    const query = `
      MERGE (n:${nodeType} {id: $id})
      SET n += $properties
      RETURN n
    `;
    
    await session.run(query, { 
      id: node.id, 
      properties: nodeProperties 
    });
    
    // Update stats
    stats.nodes[nodeType] = (stats.nodes[nodeType] || 0) + 1;
  }
  
  // Process relationships
  for (const rel of relationships) {
    const query = `
      MATCH (source {id: $sourceId})
      MATCH (target {id: $targetId})
      MERGE (source)-[r:${rel.type}]->(target)
      RETURN r
    `;
    
    await session.run(query, { 
      sourceId: rel.source, 
      targetId: rel.target 
    });
    
    stats.relationships++;
  }
  
  return stats;
}

// Generate a summary of extraction results
function generateExtractionSummary(stats) {
  const nodeTypes = Object.entries(stats.nodes)
    .map(([type, count]) => `${count} ${type}${count !== 1 ? 's' : ''}`)
    .join(', ');
    
  return `Extracted ${nodeTypes} and ${stats.relationships} relationships from the conversation.`;
}
```

2. Create unit tests for node extraction:
   - Create file: `tests/unit/extract-graph-nodes.test.ts`
   - Test with different message structures
   - Mock the LLM service

3. Create embedding service:
   - Create file: `lib/ai/embeddings.ts`
   - Implement function to get embeddings for text
   - Cache embeddings for performance

4. Integrate with API route:
   - Add tool to `app/(chat)/api/chat/route.ts`

### Step 5: Create Graph Schema Initialization (1-2 hours)

1. Create schema initialization script:
   - Create file: `scripts/initialize-graph-schema.ts`
   - Define Cypher queries to create node constraints and indexes
   - Set up vector indexes for each node type
   - Create unique constraints for node IDs

```typescript
// scripts/initialize-graph-schema.ts
import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Create Neo4j driver
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

async function initializeSchema() {
  const session = driver.session();
  try {
    console.log('Initializing Neo4j schema...');
    
    // 1. Create constraints for unique IDs
    const nodeTypes = [
      'Entity', 'Person', 'Event', 'Concept', 'Attribute', 
      'Proposition', 'Thought', 'ReasoningChain', 'ReasoningStep'
    ];
    
    for (const nodeType of nodeTypes) {
      await session.run(
        `CREATE CONSTRAINT IF NOT EXISTS FOR (n:${nodeType}) REQUIRE n.id IS UNIQUE`
      );
      console.log(`Created constraint for ${nodeType}.id`);
    }
    
    // 2. Vector indexes for semantic search (already created in the database)
    // Just verifying these indexes exist, not creating them
    const vectorIndexes = [
      { name: 'concept-embeddings', label: 'Concept', property: 'embedding', dimensions: 3072 },
      { name: 'entity-embeddings', label: 'Entity', property: 'embedding', dimensions: 3072 },
      { name: 'person-embeddings', label: 'Person', property: 'embedding', dimensions: 3072 },
      { name: 'proposition-embeddings', label: 'Proposition', property: 'embedding', dimensions: 3072 },
      { name: 'reasoningchain-embeddings', label: 'ReasoningChain', property: 'embedding', dimensions: 3072 },
      { name: 'thought-embeddings', label: 'Thought', property: 'embedding', dimensions: 3072 }
    ];
    
    for (const idx of vectorIndexes) {
      try {
        // Check if index exists
        const existingIndexes = await session.run(
          `SHOW INDEXES WHERE name = $indexName`,
          { indexName: idx.name }
        );
        
        if (existingIndexes.records.length === 0) {
          await session.run(
            `CALL db.index.vector.createNodeIndex(
              $indexName, 
              $nodeLabel, 
              $propertyName, 
              $dimensions, 
              'cosine'
            )`,
            { 
              indexName: idx.name, 
              nodeLabel: idx.label, 
              propertyName: idx.property, 
              dimensions: neo4j.int(idx.dimensions)
            }
          );
          console.log(`Created vector index ${idx.name} for ${idx.label}.${idx.property}`);
        } else {
          console.log(`Vector index ${idx.name} already exists`);
        }
      } catch (error) {
        console.error(`Error creating vector index ${idx.name}:`, error);
      }
    }
    
    // 3. Create text indexes for name properties
    for (const nodeType of nodeTypes) {
      try {
        await session.run(
          `CREATE TEXT INDEX ${nodeType.toLowerCase()}_name_idx IF NOT EXISTS FOR (n:${nodeType}) ON (n.name)`
        );
        console.log(`Created text index for ${nodeType}.name`);
      } catch (error) {
        console.error(`Error creating text index for ${nodeType}.name:`, error);
      }
    }
    
    console.log('Schema initialization completed');
  } catch (error) {
    console.error('Schema initialization failed:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run initialization
initializeSchema()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
```

2. Add script to package.json:
   ```json
   "scripts": {
     "neo4j:init": "tsx scripts/initialize-graph-schema.ts"
   }
   ```

3. Create documentation for schema initialization

## Phase 2: Advanced Graph Analysis Tools

### Step 6: Implement Network Analysis Tools (3-4 hours)

1. Create Person Centrality Tool:
   - Create file: `lib/ai/tools/analyzePersonCentrality.ts`
   - Implement tool for degree, betweenness, and clustering coefficient analysis
   - Follow implementation from deep research results
   - Add proper Neo4j integer handling

2. Create Community Detection Tool:
   - Create file: `lib/ai/tools/findCommunityBridges.ts`
   - Detect communities using Louvain algorithm
   - Find weak ties between communities
   - Support filtering by community size

### Step 7: Implement Advanced Semantic Tools (3-4 hours)

1. Create Bridging Concepts Tool:
   - Create file: `lib/ai/tools/findBridgingConcepts.ts`
   - Find concepts that connect different domains
   - Use vector manipulation to find intermediate concepts
   - Return concepts with similarity scores

2. Create Concept Neighborhood Tool:
   - Create file: `lib/ai/tools/exploreConceptSubgraph.ts`
   - Find related concepts, thoughts, and nodes
   - Support filtering by relationship type
   - Return a structured subgraph for visualization

### Step 8: Implement Reasoning Chain Tools (2-3 hours)

1. Create Reasoning Chain Exploration Tool:
   - Create file: `lib/ai/tools/exploreReasoningChain.ts`
   - Implement detailed chain retrieval with steps and related concepts
   - Add similarity search for related chains
   - Return structured data for visualization

2. Create Concept-Reasoning Connection Tool:
   - Create file: `lib/ai/tools/connectReasoningToConcepts.ts`
   - Find reasoning chains related to specific concepts
   - Analyze conceptual connections
   - Support two-way exploration (concepts related to reasoning)

## Phase 3: UI & Visualization Components

### Step 9: Implement Network Visualization (4-5 hours)

1. Create core visualization components following the recommendations in the deep research results
2. Implement custom displays for different node types
3. Add interactive features for exploration

### Step 10: Implement Semantic Visualization (3-4 hours)

1. Create similarity visualization components
2. Implement concept map visualizations
3. Add interactive filtering and search

### Step 11: Implement Reasoning Visualization (3-4 hours)

1. Create reasoning chain flowchart components
2. Implement similarity connection displays
3. Add interactive reasoning exploration features

## Timeline and Priority Adjustments

1. Phase 1 (Core Integration & Initial Tools): 11-16 hours (HIGHEST PRIORITY)
   - Focus on semantic retrieval and node extraction tools first
   - Complete schema initialization and basic utility functions

2. Phase 2 (Advanced Analysis Tools): 8-11 hours (MEDIUM PRIORITY)
   - Implement centrality and community analysis after initial tools
   - Add bridging concepts and advanced semantic tools

3. Phase 3 (UI & Visualization): 10-13 hours (LOWER PRIORITY)
   - Implement visualization components after core functionality
   - Focus on network visualization first, then reasoning visualization

Total estimated time: 29-40 hours

## References

For detailed implementation examples, refer to:
- `docs/deep-research-results.md` - Comprehensive tools and visualization recommendations
- `docs/graph-schema.md` - Neo4j graph schema definition
- `docs/aisdk-tool-calling.md` - AI SDK tool integration patterns