import { z } from 'zod';
import { getNeo4jDriver, neo4j } from '../../neo4j/driver';
import { 
  ExtractedNode, 
  ExtractedRelationship, 
  ExtractionResult, 
  GraphNodeExtractionParams, 
  Message, 
  NodeType 
} from '../../neo4j/types';
import { nanoid } from 'nanoid';

// Model (using the model from existing implementations)
import { myProvider } from '../providers';

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
  execute: async function({ 
    messages, 
    extractionDepth = "standard" 
  }: GraphNodeExtractionParams): Promise<ExtractionResult> {
    try {
      // 1. Prepare conversation context for LLM analysis
      const conversationText = prepareConversationText(messages);
      
      // 2. Extract reasoning chains from reasoning tokens if available
      const reasoningChains = extractReasoningChains(messages);
      
      // 3. Use LLM to extract nodes based on schema
      const extractedNodes = await extractNodesWithLLM(conversationText, reasoningChains, extractionDepth);
      
      // 4. Save nodes and relationships to Neo4j
      const session = getNeo4jDriver().session({ defaultAccessMode: neo4j.session.WRITE });
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
      throw new Error(`Failed to extract graph nodes: ${(error as Error).message}`);
    }
  }
};

// Helper function to prepare conversation text
function prepareConversationText(messages: Message[]): string {
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
interface ReasoningChain {
  messageId: string;
  reasoning: string;
  steps: { content: string; index: number }[];
}

function extractReasoningChains(messages: Message[]): ReasoningChain[] {
  const chains: ReasoningChain[] = [];
  
  for (const msg of messages) {
    if (!msg.parts) continue;
    
    const reasoningParts = msg.parts.filter(part => 
      part.type === 'reasoning' && part.reasoning
    );
    
    for (const part of reasoningParts) {
      if (!part.reasoning) continue;
      
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
function parseReasoningSteps(reasoning: string): { content: string; index: number }[] {
  // Simple implementation to split reasoning into steps
  return reasoning.split('\n\n')
    .filter(step => step.trim().length > 0)
    .map((content, index) => ({ content, index }));
}

// Use LLM to extract nodes based on graph schema
async function extractNodesWithLLM(
  conversationText: string, 
  reasoningChains: ReasoningChain[], 
  extractionDepth: 'minimal' | 'standard' | 'deep'
): Promise<{ nodes: ExtractedNode[], relationships: ExtractedRelationship[] }> {
  // System prompt with schema information
  const systemPrompt = `
  Extract entities from the conversation according to this knowledge graph schema:
  - Entity: Physical objects, people, locations (id, name, type, description)
  - Concept: Abstract ideas and categories (id, name, definition, domain)
  - Thought: Subjective interpretations or analyses (id, name, thoughtContent, confidence)
  - Event: Time-bound occurrences (id, name, description, date)
  - Attribute: Properties of entities (id, name, value, type)
  - ReasoningChain: Sequences of logical reasoning (id, name, description, conclusion)
  
  For extraction depth=${extractionDepth}, focus on ${getExtractionFocusByDepth(extractionDepth)}.
  
  Format your response as a valid JSON object with "nodes" and "relationships" arrays:
  {
    "nodes": [
      {"id": "<unique-id>", "type": "Entity|Concept|Thought|...", "name": "...", ...other properties}
    ],
    "relationships": [
      {"source": "<node-id>", "target": "<node-id>", "type": "RELATED_TO|HAS_CONCEPT|..."}
    ]
  }
  
  Relationship types: RELATED_TO, HAS_CONCEPT, HAS_PART, REFERS_TO, CONTRADICTS, SUPPORTS, PRECEDES
  
  Generate unique IDs for each node. Ensure consistency in relationships by using these IDs.
  `;
  
  // Use an LLM to analyze the text
  const model = myProvider.languageModel('gpt-4o');
  const response = await model.invoke([
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
    
    // Ensure extracted data has the right structure
    if (!extracted.nodes || !Array.isArray(extracted.nodes) || 
        !extracted.relationships || !Array.isArray(extracted.relationships)) {
      throw new Error("Extracted data missing nodes or relationships arrays");
    }
    
    // Add missing IDs if needed
    extracted.nodes = extracted.nodes.map((node: ExtractedNode) => {
      if (!node.id) {
        node.id = `${node.type.toLowerCase()}-${nanoid(10)}`;
      }
      return node;
    });
    
    // Merge extracted nodes with reasoning chains
    return mergeWithReasoningChains(extracted, reasoningChains);
  } catch (error) {
    console.error("Failed to parse JSON from LLM response:", error);
    throw error;
  }
}

// Get extraction focus based on depth
function getExtractionFocusByDepth(depth: 'minimal' | 'standard' | 'deep'): string {
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
function mergeWithReasoningChains(
  extracted: { nodes: ExtractedNode[], relationships: ExtractedRelationship[] },
  reasoningChains: ReasoningChain[]
): { nodes: ExtractedNode[], relationships: ExtractedRelationship[] } {
  // Add reasoning chains as nodes if they're not already extracted
  // And link them to related entities and concepts
  
  const existingNodeIds = new Set(extracted.nodes.map(n => n.id));
  
  for (const chain of reasoningChains) {
    const chainId = `reasoning-${chain.messageId}`;
    
    if (!existingNodeIds.has(chainId)) {
      // Create reasoning chain node
      extracted.nodes.push({
        id: chainId,
        type: "ReasoningChain" as NodeType,
        name: `Reasoning from message ${chain.messageId}`,
        description: chain.reasoning.substring(0, 100) + '...',
        conclusion: extractConclusion(chain.reasoning),
        steps: chain.steps.length
      });
      
      existingNodeIds.add(chainId);
      
      // Create reasoning step nodes
      chain.steps.forEach((step, idx) => {
        const stepId = `reasoning-step-${chain.messageId}-${idx}`;
        extracted.nodes.push({
          id: stepId,
          type: "ReasoningStep" as NodeType,
          name: `Step ${idx+1}`,
          content: step.content,
          stepType: determineStepType(step.content, idx, chain.steps.length),
          order: idx
        });
        
        // Create relationship between chain and step
        extracted.relationships.push({
          source: chainId,
          target: stepId,
          type: "HAS_PART"
        });
        
        // Create relationship between consecutive steps
        if (idx > 0) {
          const prevStepId = `reasoning-step-${chain.messageId}-${idx-1}`;
          extracted.relationships.push({
            source: prevStepId,
            target: stepId,
            type: "PRECEDES"
          });
        }
      });
    }
  }
  
  return extracted;
}

// Save extracted nodes to Neo4j
async function saveNodesToNeo4j(
  session: neo4j.Session, 
  extractedData: { nodes: ExtractedNode[], relationships: ExtractedRelationship[] }
): Promise<Record<string, number>> {
  const { nodes, relationships } = extractedData;
  const stats: Record<string, number> = {};
  
  // Process nodes by type
  for (const node of nodes) {
    const nodeType = node.type;
    
    // Create a new properties object without the 'type' property
    const { type, ...nodeProperties } = { ...node };
    
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
    stats[nodeType] = (stats[nodeType] || 0) + 1;
  }
  
  // Process relationships
  let relationshipCount = 0;
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
    
    relationshipCount++;
  }
  
  stats['Relationship'] = relationshipCount;
  return stats;
}

// Extract conclusion from reasoning text
function extractConclusion(reasoning: string): string {
  // Simple heuristic: the last paragraph is often the conclusion
  const paragraphs = reasoning.split('\n\n');
  if (paragraphs.length === 0) return '';
  
  const lastParagraph = paragraphs[paragraphs.length - 1].trim();
  
  // Look for conclusion indicators
  if (lastParagraph.toLowerCase().includes('conclusion') || 
      lastParagraph.toLowerCase().includes('therefore') ||
      lastParagraph.toLowerCase().includes('thus') ||
      lastParagraph.toLowerCase().includes('in summary')) {
    return lastParagraph;
  }
  
  // Default to last paragraph if no indicators found
  return lastParagraph.length > 100 ? 
    lastParagraph.substring(0, 100) + '...' : 
    lastParagraph;
}

// Determine the type of a reasoning step
function determineStepType(content: string, index: number, totalSteps: number): 'premise' | 'inference' | 'conclusion' {
  if (index === 0) return 'premise';
  if (index === totalSteps - 1) return 'conclusion';
  return 'inference';
}

// Generate a summary of extraction results
function generateExtractionSummary(stats: Record<string, number>): string {
  const relationshipCount = stats['Relationship'] || 0;
  
  // Create a new object without the 'Relationship' property
  const { Relationship, ...nodeStats } = { ...stats };
  
  const nodeTypes = Object.entries(nodeStats)
    .map(([type, count]) => `${count} ${type}${count !== 1 ? 's' : ''}`)
    .join(', ');
    
  return `Extracted ${nodeTypes} and ${relationshipCount} relationships from the conversation.`;
} 