import { z } from 'zod';
import { getEmbeddingForText } from '../embeddings';
import { getNeo4jDriver, neo4j } from '../../neo4j/driver';
import { serializeNeo4j } from '../../neo4j/serializer';
import { NodeType, SemanticSearchResult } from '../../neo4j/types';

// Map from node types to vector index names
const NODE_TYPE_TO_INDEX: Record<string, string> = {
  'Concept': 'concept-embeddings',
  'Entity': 'entity-embeddings',
  'Person': 'person-embeddings',
  'Proposition': 'proposition-embeddings',
  'ReasoningChain': 'reasoningchain-embeddings',
  'Thought': 'thought-embeddings'
};

interface SemanticRetrievalParams {
  queryText: string;
  nodeTypes?: Array<"Thought" | "ReasoningChain" | "Person" | "Concept" | "Entity" | "Proposition">;
  limit?: number;
}

export const semanticRetrieval = {
  description: "Retrieve semantically relevant nodes from the knowledge graph based on query text",
  parameters: z.object({
    queryText: z.string().describe("The text query to find relevant information"),
    nodeTypes: z.array(
      z.enum(["Thought", "ReasoningChain", "Person", "Concept", "Entity", "Proposition"])
    ).optional().describe("Types of nodes to search (defaults to all)"),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of results to return")
  }),
  execute: async function({ 
    queryText, 
    nodeTypes = ["Thought", "ReasoningChain", "Person", "Concept"], 
    limit = 10 
  }: SemanticRetrievalParams): Promise<SemanticSearchResult[]> {
    const session = getNeo4jDriver().session({ defaultAccessMode: neo4j.session.READ });
    
    try {
      // 1. Get embedding for query text
      const queryEmbedding = await getEmbeddingForText(queryText);
      
      // 2. Build query for each node type and union results
      const nodeQueries = nodeTypes
        .filter(nodeType => NODE_TYPE_TO_INDEX[nodeType]) // Only include node types with defined indexes
        .map(nodeType => {
          const indexName = NODE_TYPE_TO_INDEX[nodeType];
          
          return `
            CALL {
              CALL db.index.vector.queryNodes("${indexName}", $limit, $embedding)
              YIELD node, score
              RETURN node, score, "${nodeType}" AS nodeType
            }
          `;
        });
      
      if (nodeQueries.length === 0) {
        throw new Error("No valid node types specified for semantic search");
      }
      
      // 3. Execute combined query with UNION ALL
      const query = nodeQueries.join("\nUNION ALL\n") + "\nORDER BY score DESC LIMIT $finalLimit";
      
      const result = await session.run(query, {
        embedding: queryEmbedding,
        limit: neo4j.int(Math.ceil(limit / nodeTypes.length)), // Split limit across types
        finalLimit: neo4j.int(limit) // Final limit after union
      });
      
      // 4. Process and return results
      // @ts-ignore - Neo4j record type is handled correctly
      return result.records.map(record => {
        const node = record.get('node');
        const score = record.get('score');
        const nodeType = record.get('nodeType');
        
        // Base properties all nodes should have
        const baseProps: SemanticSearchResult = {
          id: node.properties.id,
          name: node.properties.name,
          nodeType: nodeType as NodeType,
          similarityScore: score
        };
        
        // Process node properties based on type
        const properties = serializeNeo4j(node.properties);
        
        // Add type-specific properties
        switch(nodeType) {
          case "Thought":
            return {
              ...baseProps,
              thoughtContent: properties.thoughtContent,
              confidence: properties.confidence
            };
          case "ReasoningChain":
            return {
              ...baseProps,
              description: properties.description,
              conclusion: properties.conclusion
            };
          case "Person":
            return {
              ...baseProps,
              biography: properties.biography,
              domain: properties.domain
            };
          case "Concept":
            return {
              ...baseProps,
              definition: properties.definition,
              domain: properties.domain
            };
          case "Entity":
            return {
              ...baseProps,
              type: properties.type,
              description: properties.description
            };
          case "Proposition":
            return {
              ...baseProps,
              content: properties.content,
              truth: properties.truth
            };
          default:
            return {
              ...baseProps,
              ...properties
            };
        }
      });
    } catch (error) {
      console.error("Semantic retrieval failed:", error);
      throw new Error(`Failed to retrieve semantic nodes: ${(error as Error).message}`);
    } finally {
      await session.close();
    }
  }
}; 