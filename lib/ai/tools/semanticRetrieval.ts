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

// Define all supported node types in a constant to ensure consistency
export const ALL_NODE_TYPES = ["Thought", "ReasoningChain", "Person", "Concept", "Entity", "Proposition"] as const;
export type SupportedNodeType = typeof ALL_NODE_TYPES[number];

interface SemanticRetrievalParams {
  queryText: string;
  nodeTypes?: Array<SupportedNodeType>;
  limit?: number;
}

export const semanticRetrieval = {
  description: "Retrieve semantically relevant nodes from the knowledge graph based on query text",
  parameters: z.object({
    queryText: z.string().describe("The text query to find relevant information"),
    nodeTypes: z.array(
      z.enum(ALL_NODE_TYPES)
    ).optional().describe("Types of nodes to search (defaults to all node types)"),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of results to return")
  }),
  execute: async function({ 
    queryText, 
    nodeTypes = [...ALL_NODE_TYPES], 
    limit = 10 
  }: SemanticRetrievalParams): Promise<SemanticSearchResult[]> {
    const session = getNeo4jDriver().session({ defaultAccessMode: neo4j.session.READ });
    
    try {
      // 1. Get embedding for query text
      const queryEmbedding = await getEmbeddingForText(queryText);
      
      // 2. Build query for each node type and union results
      const validNodeTypes = nodeTypes.filter(nodeType => NODE_TYPE_TO_INDEX[nodeType]);
      
      if (validNodeTypes.length === 0) {
        throw new Error("No valid node types specified for semantic search");
      }
      
      // Build the query with proper UNION structure
      const nodeQueries = validNodeTypes.map(nodeType => {
        const indexName = NODE_TYPE_TO_INDEX[nodeType];
        
        return `
          CALL db.index.vector.queryNodes("${indexName}", $limit, $embedding)
          YIELD node, score
          RETURN node, score, "${nodeType}" AS nodeType
        `;
      });
      
      // 3. Execute combined query with UNION ALL
      const query = nodeQueries.join("\nUNION ALL\n") + "\nORDER BY score DESC LIMIT $finalLimit";
      
      const result = await session.run(query, {
        embedding: queryEmbedding,
        limit: neo4j.int(Math.ceil(limit / validNodeTypes.length)), // Split limit across types
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
        
        // Exclude embedding property to avoid sending it to the LLM
        const { embedding, ...propertiesWithoutEmbedding } = properties;
        
        // Add type-specific properties
        switch(nodeType) {
          case "Thought":
            return {
              ...baseProps,
              ...propertiesWithoutEmbedding,
              thoughtContent: properties.thoughtContent,
              references: properties.references,
              confidence: properties.confidence,
              source: properties.source,
              createdBy: properties.createdBy,
              tags: properties.tags,
              impact: properties.impact,
              emotionalValence: properties.emotionalValence,
              emotionalArousal: properties.emotionalArousal,
              evidentialBasis: properties.evidentialBasis,
              thoughtCounterarguments: properties.thoughtCounterarguments,
              implications: properties.implications,
              thoughtConfidenceScore: properties.thoughtConfidenceScore,
              reasoningChains: properties.reasoningChains
            };
          case "ReasoningChain":
            return {
              ...baseProps,
              ...propertiesWithoutEmbedding,
              description: properties.description,
              conclusion: properties.conclusion,
              confidenceScore: properties.confidenceScore,
              creator: properties.creator,
              methodology: properties.methodology,
              domain: properties.domain,
              tags: properties.tags,
              sourceThought: properties.sourceThought,
              numberOfSteps: properties.numberOfSteps,
              alternativeConclusionsConsidered: properties.alternativeConclusionsConsidered,
              relatedPropositions: properties.relatedPropositions
            };
          case "Person":
            return {
              ...baseProps,
              ...propertiesWithoutEmbedding,
              biography: properties.biography,
              domain: properties.domain,
              aliases: properties.aliases,
              personalityTraits: properties.personalityTraits,
              cognitiveStyle: properties.cognitiveStyle,
              emotionalDisposition: properties.emotionalDisposition,
              emotionalTriggers: properties.emotionalTriggers,
              interpersonalStyle: properties.interpersonalStyle,
              powerDynamics: properties.powerDynamics,
              loyalties: properties.loyalties,
              coreValues: properties.coreValues,
              ethicalFramework: properties.ethicalFramework,
              psychologicalDevelopment: properties.psychologicalDevelopment,
              narrativeTreatment: properties.narrativeTreatment,
              modelConfidence: properties.modelConfidence,
              personEvidenceStrength: properties.personEvidenceStrength
            };
          case "Concept":
            return {
              ...baseProps,
              ...propertiesWithoutEmbedding,
              definition: properties.definition,
              description: properties.description,
              domain: properties.domain,
              examples: properties.examples,
              relatedConcepts: properties.relatedConcepts,
              significance: properties.significance,
              perspectives: properties.perspectives,
              historicalDevelopment: properties.historicalDevelopment,
              emotionalValence: properties.emotionalValence,
              emotionalArousal: properties.emotionalArousal,
              abstractionLevel: properties.abstractionLevel,
              metaphoricalMappings: properties.metaphoricalMappings
            };
          case "Entity":
            return {
              ...baseProps,
              ...propertiesWithoutEmbedding,
              type: properties.type,
              description: properties.description,
              observations: properties.observations,
              subType: properties.subType,
              confidence: properties.confidence,
              source: properties.source,
              biography: properties.biography,
              keyContributions: properties.keyContributions,
              emotionalValence: properties.emotionalValence,
              emotionalArousal: properties.emotionalArousal,
              personDetails: properties.personDetails
            };
          case "Proposition":
            return {
              ...baseProps,
              ...propertiesWithoutEmbedding,
              content: properties.content,
              statement: properties.statement,
              status: properties.status,
              confidence: properties.confidence,
              truthValue: properties.truthValue,
              truth: properties.truth,
              sources: properties.sources,
              domain: properties.domain,
              emotionalValence: properties.emotionalValence,
              emotionalArousal: properties.emotionalArousal,
              evidenceStrength: properties.evidenceStrength,
              counterEvidence: properties.counterEvidence
            };
          default:
            return {
              ...baseProps,
              ...propertiesWithoutEmbedding
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