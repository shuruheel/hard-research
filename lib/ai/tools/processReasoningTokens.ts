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
    .filter(step => step.trim().length > 0);
  
  // If we have very few steps, try splitting by numbered patterns
  if (steps.length < 3) {
    const numberedStepPattern = /\s*(\d+[\)\.])?\s*(.*?)(?=\n\s*\d+[\)\.]\s*|$)/gs;
    const numberedSteps = [];
    let match;
    
    while ((match = numberedStepPattern.exec(reasoning)) !== null) {
      if (match[2] && match[2].trim().length > 0) {
        numberedSteps.push(match[2].trim());
      }
    }
    
    if (numberedSteps.length > steps.length) {
      steps = numberedSteps;
    }
  }
  
  // If still few steps, try splitting by single newlines for simple reasoning
  if (steps.length < 2 && reasoning.includes('\n')) {
    steps = reasoning.split('\n')
      .filter(step => step.trim().length > 0);
  }
  
  // If we still have no steps, use the whole reasoning as one step
  if (steps.length === 0) {
    steps = [reasoning];
  }
  
  return steps.map((content, index) => ({ content, index }));
}

/**
 * Determine the type of a reasoning step
 */
function determineStepType(
  content: string, 
  index: number, 
  totalSteps: number
): 'premise' | 'inference' | 'evidence' | 'counterargument' | 'conclusion' {
  const lowerContent = content.toLowerCase();
  
  if (index === 0) {
    return 'premise';
  }
  
  if (index === totalSteps - 1) {
    if (lowerContent.includes('conclusion') || 
        lowerContent.includes('therefore') || 
        lowerContent.includes('thus') || 
        lowerContent.includes('in summary') ||
        lowerContent.includes('to summarize')) {
      return 'conclusion';
    }
  }
  
  if (lowerContent.includes('evidence') || 
      lowerContent.includes('data shows') || 
      lowerContent.includes('according to')) {
    return 'evidence';
  }
  
  if (lowerContent.includes('however') || 
      lowerContent.includes('on the other hand') || 
      lowerContent.includes('counterargument') ||
      lowerContent.includes('contrary to')) {
    return 'counterargument';
  }
  
  return 'inference';
}

/**
 * Extract a conclusion from reasoning
 */
function extractConclusion(
  reasoning: string, 
  steps: { content: string; index: number }[]
): string {
  // Look for explicit conclusion markers
  const conclusionMarkers = [
    'conclusion:', 
    'therefore,', 
    'thus,', 
    'in conclusion,', 
    'to summarize,'
  ];
  
  const lowerReasoning = reasoning.toLowerCase();
  
  for (const marker of conclusionMarkers) {
    const index = lowerReasoning.indexOf(marker);
    if (index !== -1) {
      return reasoning.substring(index).trim();
    }
  }
  
  // If no explicit markers, use the last step if it looks like a conclusion
  if (steps.length > 0) {
    const lastStep = steps[steps.length - 1];
    if (determineStepType(lastStep.content, lastStep.index, steps.length) === 'conclusion') {
      return lastStep.content;
    }
  }
  
  // Extract the last sentence(s) if we can't find a conclusion otherwise
  const sentences = reasoning.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length > 0) {
    return sentences.slice(-2).join(' ').trim();
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: `Extract key concepts and entities from the given reasoning text.
          
          For concepts, provide:
          - name: The concept name
          - definition: A clear, concise definition (1-2 sentences)
          - domain: The knowledge domain this concept belongs to (optional)
          
          For entities, provide:
          - name: The entity name
          - type: The entity type (Person, Organization, Location, Product, etc.)
          - description: A brief description of the entity (optional)
          
          Return results as valid JSON in this format:
          {
            "concepts": [
              {"name": "...", "definition": "...", "domain": "..."}
            ],
            "entities": [
              {"name": "...", "type": "...", "description": "..."}
            ]
          }
          
          Focus on the most important concepts and entities (maximum 5 of each).`
        },
        { role: "user", content: reasoning }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0].message.content;
    if (!content) {
      return { concepts: [], entities: [] };
    }
    
    const extracted = JSON.parse(content);
    
    // Validate structure
    if (!extracted.concepts || !Array.isArray(extracted.concepts) ||
        !extracted.entities || !Array.isArray(extracted.entities)) {
      console.error("Invalid extraction result structure:", extracted);
      return { concepts: [], entities: [] };
    }
    
    return {
      concepts: extracted.concepts,
      entities: extracted.entities
    };
  } catch (error) {
    console.error("Failed to extract concepts and entities:", error);
    return { concepts: [], entities: [] };
  }
}

/**
 * Create concept nodes and link to reasoning chain
 */
async function createConcepts(
  session: Session,
  concepts: Array<{ name: string; definition: string; domain?: string }>,
  chainId: string
): Promise<number> {
  let count = 0;
  
  for (const concept of concepts) {
    try {
      // Generate embedding for the concept
      const embedding = await getEmbeddingForText(`${concept.name}: ${concept.definition}`);
      
      // Create or update concept
      await session.run(`
        MERGE (c:Concept {name: $name})
        ON CREATE SET 
          c.id = $id, 
          c.definition = $definition,
          c.domain = $domain,
          c.embedding = $embedding,
          c.createdAt = datetime()
        ON MATCH SET 
          c.definition = CASE 
            WHEN c.definition IS NULL OR SIZE(c.definition) < SIZE($definition) 
            THEN $definition 
            ELSE c.definition 
          END,
          c.embedding = $embedding,
          c.updatedAt = datetime()
        
        WITH c
        MATCH (r:ReasoningChain {id: $chainId})
        MERGE (r)-[:HAS_CONCEPT]->(c)
        
        RETURN c
      `, {
        id: `concept-${nanoid(10)}`,
        name: concept.name,
        definition: concept.definition,
        domain: concept.domain || null,
        embedding: embedding,
        chainId
      });
      
      count++;
    } catch (error) {
      console.error(`Failed to create concept ${concept.name}:`, error);
    }
  }
  
  return count;
}

/**
 * Create entity nodes and link to reasoning chain
 */
async function createEntities(
  session: Session,
  entities: Array<{ name: string; type: string; description?: string }>,
  chainId: string
): Promise<number> {
  let count = 0;
  
  for (const entity of entities) {
    try {
      // Handle Person entities differently
      const nodeLabel = entity.type === 'Person' ? 'Person' : 'Entity';
      
      // Generate embedding for the entity
      const embedding = await getEmbeddingForText(`${entity.name}: ${entity.description || entity.type}`);
      
      // Create or update entity
      await session.run(`
        MERGE (e:${nodeLabel} {name: $name})
        ON CREATE SET 
          e.id = $id, 
          e.type = $type,
          e.description = $description,
          e.embedding = $embedding,
          e.createdAt = datetime()
        ON MATCH SET 
          e.description = CASE 
            WHEN e.description IS NULL OR SIZE(e.description) < SIZE($description) 
            THEN $description 
            ELSE e.description 
          END,
          e.embedding = $embedding,
          e.updatedAt = datetime()
        
        WITH e
        MATCH (r:ReasoningChain {id: $chainId})
        MERGE (r)-[:REFERS_TO]->(e)
        
        RETURN e
      `, {
        id: `${nodeLabel.toLowerCase()}-${nanoid(10)}`,
        name: entity.name,
        type: entity.type,
        description: entity.description || null,
        embedding: embedding,
        chainId
      });
      
      count++;
    } catch (error) {
      console.error(`Failed to create entity ${entity.name}:`, error);
    }
  }
  
  return count;
} 