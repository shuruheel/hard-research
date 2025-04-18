# OpenAI Deep Research Prompt: Neo4j Knowledge Graph Tools and Cypher Queries

## Research Task

Research and provide detailed implementations for Neo4j tools and Cypher queries that would be optimal for our semantic knowledge graph application. Focus on two main areas:

1. Network analysis for Person nodes (centrality metrics, structural properties)
2. Concept exploration with vector embeddings (similarity search, subgraph exploration)

## Background Context

We're building a research assistant application that integrates Neo4j with the Vercel AI SDK 4.2. The system captures reasoning chains from AI models and stores them in a knowledge graph alongside entities, concepts, events, and their relationships. Our application needs tools to:

1. Query the graph effectively
2. Analyze network properties
3. Find semantic relationships
4. Explore subgraphs around concepts
5. Identify connections between reasoning chains and entities

## Graph Schema Details

Our Neo4j database implements a rich semantic knowledge graph with the following key node types:

- **Entity**: Concrete objects, people, places
  - Person entities have detailed psychological profiles, values, cognitive styles
- **Event**: Time-bound occurrences with participants
- **Concept**: Abstract ideas and categories with definitions
- **Thought**: Subjective interpretations and analyses
- **ReasoningChain**: Sequences of logical steps captured from AI reasoning
- **ReasoningStep**: Individual steps within reasoning chains

Key relationship types include:
- Hierarchical: IS_A, INSTANCE_OF, SUB_CLASS_OF
- Causal: CAUSES, INFLUENCED_BY
- Social: KNOWS, MENTORED_BY, COLLABORATES_WITH
- Cognitive: BELIEVES, EXHIBITS_TRAIT, VALUES
- Reasoning: PART_OF, SUPPORTS, CONTRADICTS

Full schema details are available at: https://github.com/username/knowledge-graph-schema

## Specific Research Questions

### 1. Person Network Analysis

- What are the most efficient Cypher queries to calculate betweenness centrality and degree centrality for Person nodes?
- How can we identify influential persons based on their network position?
- What queries would identify clustering coefficients most efficiently?
- How can we detect "weak ties" that connect otherwise disparate groups?
- What visualizations would best represent these network properties?

### 2. Concept and Reasoning Exploration

- How can we leverage Neo4j's vector indexes for semantic similarity search?
- What Cypher queries efficiently find subgraphs of related concepts, thoughts, and reasoning chains?
- How can we measure conceptual distance in the knowledge graph?
- What queries would identify bridging concepts that connect different domains?
- How can we extract the most relevant reasoning chains related to a specific query?

### 3. Tool Implementation

For each identified capability, provide:
- A TypeScript implementation of the tool following our pattern:
```typescript
// Example pattern for our tools
export const queryEntity = {
  description: "Query entity nodes in the knowledge graph",
  parameters: z.object({
    query: z.string().describe("The search query"),
    filters: z.record(z.any()).optional()
      .describe("Optional filters to apply")
  }),
  execute: async function({ query, filters = {} }) {
    // Implementation
    return result;
  }
}
```

- Error handling strategies for Neo4j queries
- Performance optimization techniques
- Visualization recommendations

## Technical Constraints

- Neo4j version: 5.x
- Neo4j driver: neo4j-driver 5.x for Node.js
- TypeScript/JavaScript implementation
- Need to support pagination for large result sets
- Queries should be optimized for performance with large graphs (100K+ nodes)
- Should support visualization in React components
- Must handle Neo4j-specific types (Integer, DateTime) properly

## Desired Output

1. For each analysis capability:
   - Optimized Cypher query with explanation
   - TypeScript implementation as an AI SDK tool
   - Performance considerations and optimizations
   - Example usage and expected output

2. Visualization recommendations:
   - Appropriate visualization techniques for each analysis
   - React component design suggestions
   - Data transformation patterns for visualization

3. Implementation guidance:
   - Best practices for Neo4j driver usage
   - Error handling strategies
   - Query optimization techniques
   - Index recommendations

Please provide comprehensive, production-ready implementations and explain the rationale behind your recommendations. Include academic references where appropriate for network analysis techniques.

## Additional Information

The Neo4j database will store reasoning chains captured from AI models, which need to be connected to relevant entities and concepts. These reasoning chains form a critical part of our knowledge graph and should be incorporated into the analysis tools.

Our system also needs to track sources (e.g., from web searches) and connect them to extracted information, enabling provenance tracking for facts and concepts in the graph.