import { z } from 'zod';
import { getNeo4jDriver, neo4j } from '../../neo4j/driver';
import { nanoid } from 'nanoid';
import { getEmbeddingForText } from '../embeddings';
import OpenAI from 'openai';
import type { Session } from 'neo4j-driver';

// Initialize OpenAI client for concept extraction
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ProcessReasoningParams {
  reasoning: string;
  messageId?: string;
  queryContext?: string;
  processInBackground?: boolean;
}

export const processReasoningTokens = {
  description: "Process reasoning tokens into the knowledge graph as ReasoningChain and related nodes",
  parameters: z.object({
    reasoning: z.string().describe("The reasoning tokens to process"),
    messageId: z.string().optional().describe("ID of the message containing this reasoning"),
    queryContext: z.string().optional().describe("Original query that triggered this reasoning"),
    processInBackground: z.boolean().default(false).describe("Whether to process asynchronously in the background")
  }),
  execute: async ({ 
    reasoning, 
    messageId, 
    queryContext, 
    processInBackground = false 
  }: ProcessReasoningParams) => {
    // If background processing is requested, start async and return immediately
    if (processInBackground) {
      // Fire and forget - we'll do the processing in the background
      processReasoningInBackground(reasoning, messageId, queryContext);
      return { 
        success: true, 
        message: "Reasoning tokens processing started in background" 
      };
    }
    
    // Otherwise process synchronously
    try {
      const result = await processReasoningCore(reasoning, messageId, queryContext);
      return { 
        success: true, 
        ...result 
      };
    } catch (error) {
      console.error("Reasoning token processing failed:", error);
      throw new Error(`Failed to process reasoning tokens: ${(error as Error).message}`);
    }
  }
};

/**
 * Process reasoning tokens in the background
 */
async function processReasoningInBackground(
  reasoning: string, 
  messageId?: string, 
  queryContext?: string
): Promise<void> {
  try {
    await processReasoningCore(reasoning, messageId, queryContext);
    console.log("Background reasoning processing completed successfully");
  } catch (error) {
    console.error("Background reasoning processing failed:", error);
  }
}

/**
 * Core implementation of reasoning token processing
 */
async function processReasoningCore(
  reasoning: string, 
  messageId?: string, 
  queryContext?: string
) {
  // Skip empty reasoning
  if (!reasoning || reasoning.trim() === '') {
    return { 
      message: "No reasoning to process",
      nodesCreated: {}
    };
  }
  
  // Initialize counting objects
  const nodesCreated: Record<string, number> = {};
  
  // Get Neo4j session
  const session = getNeo4jDriver().session({ defaultAccessMode: neo4j.session.WRITE });
  
  try {
    // 1. Create ReasoningChain node
    const chainId = `reasoning-${messageId || nanoid(10)}`;
    const chainName = queryContext 
      ? `Reasoning about: ${queryContext.substring(0, 50)}${queryContext.length > 50 ? '...' : ''}`
      : `Reasoning chain ${chainId}`;
    const chainDescription = reasoning.substring(0, 200) + (reasoning.length > 200 ? '...' : '');
    
    // Create embedding for reasoningChain
    const reasoningEmbedding = await getEmbeddingForText(reasoning);
    
    // Create the ReasoningChain node
    const chainResult = await session.run(`
      MERGE (r:ReasoningChain {id: $id})
      SET r.name = $name,
          r.description = $description, 
          r.embedding = $embedding,
          r.messageId = $messageId,
          r.createdAt = datetime()
      RETURN r
    `, {
      id: chainId,
      name: chainName,
      description: chainDescription,
      embedding: reasoningEmbedding,
      messageId: messageId || null
    });
    
    // Update counts
    nodesCreated.ReasoningChain = 1;
    
    // 2. Extract reasoning steps
    const steps = parseReasoningSteps(reasoning);
    nodesCreated.ReasoningStep = steps.length;
    
    // 3. Create nodes for each step and connect to chain
    for (let i = 0; i < steps.length; i++) {
      const stepId = `${chainId}-step-${i+1}`;
      const stepType = determineStepType(steps[i].content, i, steps.length);
      
      await session.run(`
        MATCH (r:ReasoningChain {id: $chainId})
        CREATE (s:ReasoningStep {
          id: $id,
          name: $name,
          content: $content,
          stepType: $stepType,
          order: $order,
          chainId: $chainId,
          createdAt: datetime()
        })
        CREATE (r)-[:HAS_STEP]->(s)
      `, {
        chainId,
        id: stepId,
        name: `Step ${i+1}`,
        content: steps[i].content,
        stepType: stepType,
        order: i + 1
      });
      
      // Create order relationships between steps
      if (i > 0) {
        await session.run(`
          MATCH (prev:ReasoningStep {id: $prevId})
          MATCH (curr:ReasoningStep {id: $currId})
          MERGE (prev)-[:PRECEDES]->(curr)
        `, {
          prevId: `${chainId}-step-${i}`,
          currId: stepId
        });
      }
    }
    
    // 4. Extract key concepts and entities from reasoning
    const conceptsAndEntities = await extractConceptsAndEntities(reasoning);
    
    // Count for new nodes
    const conceptsCount = await createConcepts(session, conceptsAndEntities.concepts, chainId);
    const entitiesCount = await createEntities(session, conceptsAndEntities.entities, chainId);
    
    // Update counts
    nodesCreated.Concept = conceptsCount;
    nodesCreated.Entity = entitiesCount;
    
    // 5. Extract the conclusion into a separate Proposition node if the reasoning is substantial
    if (reasoning.length > 200) {
      const conclusion = extractConclusion(reasoning, steps);
      if (conclusion && conclusion.length > 0) {
        const propositionId = `proposition-${nanoid(10)}`;
        
        await session.run(`
          MATCH (r:ReasoningChain {id: $chainId})
          CREATE (p:Proposition {
            id: $id,
            name: $name,
            statement: $statement,
            status: "derived",
            confidence: 0.8,
            createdAt: datetime()
          })
          CREATE (r)-[:SUPPORTS]->(p)
        `, {
          chainId,
          id: propositionId,
          name: conclusion.substring(0, 50) + (conclusion.length > 50 ? '...' : ''),
          statement: conclusion
        });
        
        // Update count
        nodesCreated.Proposition = 1;
      }
    }
    
    return {
      message: "Reasoning tokens processed successfully",
      nodesCreated,
      reasoningChainId: chainId
    };
  } catch (error) {
    console.error("Error in processing reasoning tokens:", error);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Parse reasoning text into structured steps
 */
function parseReasoningSteps(reasoning: string): { content: string; index: number }[] {
  // Simple implementation to split reasoning into steps
  // First try to split by double newlines
  let steps = reasoning.split('\n\n')
    .filter(step => step.trim().length > 0)
    .map((content, index) => ({ content, index }));
  
  // If we have very few steps, try splitting by numbered patterns
  if (steps.length < 3) {
    const numberedStepPattern = /\s*(\d+[\)\.])?\s*(.*?)(?=\n\s*\d+[\)\.]\s*|$)/gs;
    const numberedSteps = [];
    let match;
    
    while ((match = numberedStepPattern.exec(reasoning)) !== null) {
      if (match[2] && match[2].trim().length > 0) {
        numberedSteps.push({ content: match[2].trim(), index: numberedSteps.length });
      }
    }
    
    if (numberedSteps.length > steps.length) {
      steps = numberedSteps;
    }
  }
  
  return steps;
}

/**
 * Determine the type of reasoning step based on content and position
 */
function determineStepType(
  content: string, 
  index: number, 
  totalSteps: number
): 'premise' | 'inference' | 'evidence' | 'counterargument' | 'conclusion' {
  const lowerContent = content.toLowerCase();
  
  // First step is usually a premise
  if (index === 0) return 'premise';
  
  // Last step is usually a conclusion
  if (index === totalSteps - 1) return 'conclusion';
  
  // Detect evidence
  if (lowerContent.includes('evidence') || 
      lowerContent.includes('according to') || 
      lowerContent.includes('research shows')) {
    return 'evidence';
  }
  
  // Detect counterarguments
  if (lowerContent.includes('however') || 
      lowerContent.includes('on the other hand') || 
      lowerContent.includes('counter')) {
    return 'counterargument';
  }
  
  // Default to inference for middle steps
  return 'inference';
}

/**
 * Extract a conclusion from reasoning text
 */
function extractConclusion(
  reasoning: string, 
  steps: { content: string; index: number }[]
): string {
  // Check if there are explicit conclusion markers
  const conclusionMarkers = [
    "in conclusion", 
    "to conclude", 
    "therefore", 
    "thus", 
    "in summary", 
    "overall"
  ];
  
  // Look for conclusion markers in the text
  for (const marker of conclusionMarkers) {
    const markerIndex = reasoning.toLowerCase().indexOf(marker);
    if (markerIndex >= 0) {
      return reasoning.substring(markerIndex);
    }
  }
  
  // If no explicit markers, use the last step
  if (steps.length > 0) {
    return steps[steps.length - 1].content;
  }
  
  return '';
}

/**
 * Extract concepts and entities from reasoning text using LLM
 */
async function extractConceptsAndEntities(reasoning: string): Promise<{
  concepts: Array<{ name: string; definition: string; domain?: string }>;
  entities: Array<{ name: string; type: string; description?: string }>;
}> {
  try {
    // Create a prompt for concept and entity extraction
    const prompt = `
    Extract key concepts and entities from this reasoning text:
    
    "${reasoning.substring(0, 4000)}"
    
    Format your response as valid JSON with 'concepts' and 'entities' arrays:
    {
      "concepts": [
        {"name": "Concept name", "definition": "Brief definition", "domain": "optional domain/field"}
      ],
      "entities": [
        {"name": "Entity name", "type": "person|organization|location|other", "description": "optional description"}
      ]
    }
    
    Only extract concepts that are explicitly discussed or central to understanding the reasoning.
    Extract named entities that are specifically mentioned.
    `;
    
    // Call LLM for extraction
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a precise entity and concept extraction assistant." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });
    
    // Parse the response
    const content = response.choices[0].message.content;
    if (!content) {
      return { concepts: [], entities: [] };
    }
    
    const extractedData = JSON.parse(content);
    
    return {
      concepts: Array.isArray(extractedData.concepts) ? extractedData.concepts : [],
      entities: Array.isArray(extractedData.entities) ? extractedData.entities : []
    };
  } catch (error) {
    console.error("Error extracting concepts and entities:", error);
    return { concepts: [], entities: [] };
  }
}

/**
 * Create concept nodes and connect them to reasoning chain
 */
async function createConcepts(
  session: Session,
  concepts: Array<{ name: string; definition: string; domain?: string }>,
  chainId: string
): Promise<number> {
  if (!concepts.length) return 0;
  
  let count = 0;
  
  for (const concept of concepts) {
    try {
      const conceptId = `concept-${nanoid(10)}`;
      
      await session.run(`
        MATCH (r:ReasoningChain {id: $chainId})
        MERGE (c:Concept {name: $name})
        ON CREATE SET 
          c.id = $id,
          c.definition = $definition,
          c.domain = $domain,
          c.createdAt = datetime()
        ON MATCH SET
          c.definition = CASE WHEN c.definition IS NULL OR size(c.definition) < size($definition) 
                         THEN $definition ELSE c.definition END,
          c.domain = CASE WHEN c.domain IS NULL THEN $domain ELSE c.domain END
        CREATE (r)-[:REFERENCES]->(c)
        RETURN c
      `, {
        chainId,
        id: conceptId,
        name: concept.name,
        definition: concept.definition,
        domain: concept.domain || null
      });
      
      count++;
    } catch (error) {
      console.error(`Error creating concept ${concept.name}:`, error);
    }
  }
  
  return count;
}

/**
 * Create entity nodes and connect them to reasoning chain
 */
async function createEntities(
  session: Session,
  entities: Array<{ name: string; type: string; description?: string }>,
  chainId: string
): Promise<number> {
  if (!entities.length) return 0;
  
  let count = 0;
  
  for (const entity of entities) {
    try {
      const entityId = `entity-${nanoid(10)}`;
      
      await session.run(`
        MATCH (r:ReasoningChain {id: $chainId})
        MERGE (e:Entity {name: $name})
        ON CREATE SET 
          e.id = $id,
          e.type = $type,
          e.description = $description,
          e.createdAt = datetime()
        ON MATCH SET
          e.type = CASE WHEN e.type IS NULL THEN $type ELSE e.type END,
          e.description = CASE WHEN e.description IS NULL OR size(e.description) < size($description) 
                         THEN $description ELSE e.description END
        CREATE (r)-[:MENTIONS]->(e)
        RETURN e
      `, {
        chainId,
        id: entityId,
        name: entity.name,
        type: entity.type,
        description: entity.description || null
      });
      
      count++;
    } catch (error) {
      console.error(`Error creating entity ${entity.name}:`, error);
    }
  }
  
  return count;
} 