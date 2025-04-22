# Reasoning Token Extraction and Neo4j Integration Guide

This guide explains how to implement the reasoning token extraction capabilities in a Next.js application using the Vercel AI SDK and Neo4j. This implementation allows capturing, processing, and storing AI model reasoning steps in a structured knowledge graph.

## 1. Setup Dependencies

First, ensure you have the necessary dependencies:

```bash
# Vercel AI SDK for model integration
npm install ai

# Neo4j JavaScript driver
npm install neo4j-driver

# For embedding generation
npm install @ai-sdk/openai

# Utility libraries
npm install zod nanoid
```

## 2. Configure the AI Model with Reasoning Middleware

The extractReasoningMiddleware captures reasoning tokens enclosed in XML-like tags:

```typescript
// lib/ai/providers.ts
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { openai } from '@ai-sdk/openai';

export const myProvider = customProvider({
  languageModels: {
    'standard-mode': openai('gpt-4o'),
    'reasoning-mode': wrapLanguageModel({
      model: openai('gpt-4o'),
      middleware: extractReasoningMiddleware({ 
        tagName: 'reasoning',
        separator: '\n' 
      }),
    }),
  },
});
```

The middleware will extract content between `<reasoning>` and `</reasoning>` tags in the model's response.

## 3. Create Neo4j Database Schema

Set up your Neo4j database with an appropriate schema to store reasoning chains:

```cypher
// Create constraints for unique IDs
CREATE CONSTRAINT FOR (r:ReasoningChain) REQUIRE r.id IS UNIQUE;
CREATE CONSTRAINT FOR (s:ReasoningStep) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT FOR (c:Concept) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT FOR (e:Entity) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT FOR (p:Proposition) REQUIRE p.id IS UNIQUE;

// Create vector index for semantic search if using embeddings
CREATE VECTOR INDEX reasoningVectorIndex IF NOT EXISTS
FOR (r:ReasoningChain) 
ON r.embedding
OPTIONS {indexConfig: {
  `vector.dimensions`: 3072,
  `vector.similarity_function`: 'cosine'
}};
```

## 4. Implement a Neo4j Driver Utility

Create a Neo4j driver utility for database connection:

```typescript
// lib/neo4j/driver.ts
import neo4j from 'neo4j-driver';

let driver: neo4j.Driver;

export function getNeo4jDriver(): neo4j.Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || 'neo4j://localhost:7687';
    const username = process.env.NEO4J_USERNAME || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'password';
    
    driver = neo4j.driver(
      uri,
      neo4j.auth.basic(username, password),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 30000,
      }
    );
  }
  
  return driver;
}

// Re-export neo4j for types
export { neo4j };
```

## 5. Create a Tool for Processing Reasoning Tokens

Implement a function to process reasoning tokens and store them in Neo4j:

```typescript
// lib/ai/tools/processReasoningTokens.ts
import { z } from 'zod';
import { getNeo4jDriver, neo4j } from '../../neo4j/driver';
import { nanoid } from 'nanoid';
import { getEmbeddingForText } from '../embeddings';

export const processReasoningTokens = {
  description: "Process reasoning tokens into the knowledge graph",
  parameters: z.object({
    reasoning: z.string().describe("The reasoning tokens to process"),
    messageId: z.string().optional().describe("ID of the message containing this reasoning"),
    queryContext: z.string().optional().describe("Original query that triggered this reasoning"),
    processInBackground: z.boolean().default(false).describe("Whether to process asynchronously")
  }),
  execute: async function({ 
    reasoning, 
    messageId, 
    queryContext, 
    processInBackground = false 
  }) {
    if (processInBackground) {
      // Start processing in background and return immediately
      processReasoningInBackground(reasoning, messageId, queryContext);
      return { success: true, message: "Background processing started" };
    }
    
    try {
      // Process reasoning synchronously
      const session = getNeo4jDriver().session({ defaultAccessMode: neo4j.session.WRITE });
      
      try {
        // Create reasoning chain node
        const chainId = `reasoning-${messageId || nanoid(10)}`;
        const chainName = queryContext 
          ? `Reasoning about: ${queryContext.substring(0, 50)}${queryContext.length > 50 ? '...' : ''}`
          : `Reasoning chain ${chainId}`;
        
        // Optional: Create embedding for semantic search
        const embedding = await getEmbeddingForText(reasoning);
        
        // Create the chain node
        await session.run(`
          CREATE (r:ReasoningChain {
            id: $id,
            name: $name,
            description: $description,
            messageId: $messageId,
            embedding: $embedding,
            createdAt: datetime()
          })
          RETURN r
        `, {
          id: chainId,
          name: chainName,
          description: reasoning.substring(0, 200) + (reasoning.length > 200 ? '...' : ''),
          messageId: messageId || null,
          embedding
        });
        
        // Parse reasoning into steps
        const steps = parseReasoningIntoSteps(reasoning);
        
        // Create nodes for each step
        for (let i = 0; i < steps.length; i++) {
          const stepId = `${chainId}-step-${i+1}`;
          
          // Determine step type (premise, inference, conclusion, etc.)
          const stepType = determineStepType(steps[i], i, steps.length);
          
          // Create step node and connect to chain
          await session.run(`
            MATCH (r:ReasoningChain {id: $chainId})
            CREATE (s:ReasoningStep {
              id: $id,
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
            content: steps[i],
            stepType,
            order: i + 1
          });
          
          // Create relationships between consecutive steps
          if (i > 0) {
            await session.run(`
              MATCH (prev:ReasoningStep {id: $prevId})
              MATCH (curr:ReasoningStep {id: $currId})
              CREATE (prev)-[:PRECEDES]->(curr)
            `, {
              prevId: `${chainId}-step-${i}`,
              currId: stepId
            });
          }
        }
        
        return { 
          success: true, 
          reasoningChainId: chainId,
          stepsCount: steps.length
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      console.error("Error processing reasoning tokens:", error);
      throw new Error(`Failed to process reasoning: ${(error as Error).message}`);
    }
  }
};

// Helper functions
function parseReasoningIntoSteps(reasoning: string): string[] {
  // Split by double newlines for paragraph-based steps
  let steps = reasoning.split('\n\n').filter(s => s.trim().length > 0);
  
  // If few steps found, try numbered patterns
  if (steps.length < 3) {
    const numberedPattern = /\s*(\d+[\)\.])?\s*(.*?)(?=\n\s*\d+[\)\.]\s*|$)/gs;
    const numberedSteps = [];
    let match;
    
    while ((match = numberedPattern.exec(reasoning)) !== null) {
      if (match[2] && match[2].trim().length > 0) {
        numberedSteps.push(match[2].trim());
      }
    }
    
    if (numberedSteps.length > steps.length) {
      steps = numberedSteps;
    }
  }
  
  return steps;
}

function determineStepType(content: string, index: number, totalSteps: number): string {
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

// Background processing function
async function processReasoningInBackground(
  reasoning: string,
  messageId?: string,
  queryContext?: string
): Promise<void> {
  try {
    // Process reasoning in background
    await processReasoningTokens.execute({
      reasoning,
      messageId,
      queryContext,
      processInBackground: false
    });
  } catch (error) {
    console.error("Background reasoning processing failed:", error);
  }
}
```

## 6. Create an Embedding Utility for Semantic Search

If you want to enable semantic search over reasoning chains:

```typescript
// lib/ai/embeddings.ts
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getEmbeddingForText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text.substring(0, 8000), // Truncate to model limits
    dimensions: 3072,
  });
  
  return response.data[0].embedding;
}
```

## 7. Update API Routes to Use Reasoning Extraction

Modify your API routes to process the reasoning tokens:

```typescript
// app/api/chat/route.ts
import { streamText, createDataStreamResponse } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { processReasoningTokens } from '@/lib/ai/tools/processReasoningTokens';
import { extractReasoningMiddleware } from 'ai';

export async function POST(request: Request) {
  const { messages, mode } = await request.json();
  
  // Determine if reasoning mode is active
  const isReasoningMode = mode === 'reasoning-mode';
  
  return createDataStreamResponse({
    execute: (dataStream) => {
      const result = streamText({
        model: myProvider.languageModel(isReasoningMode ? 'reasoning-mode' : 'standard-mode'),
        messages,
        system: "Your system message here",
        onFinish: async ({ response, reasoning }) => {
          // If reasoning is available, store it
          if (reasoning && response.messages[0]?.id) {
            try {
              await processReasoningTokens.execute({
                reasoning,
                messageId: response.messages[0].id,
                queryContext: messages[messages.length - 1].content,
                processInBackground: !isReasoningMode
              });
            } catch (error) {
              console.error("Failed to process reasoning:", error);
            }
          }
        }
      });
      
      // Configure stream data options
      const streamOptions = {
        sendReasoning: true, // Send reasoning to the client
        metadata: { isReasoningMode }
      };
      
      // @ts-ignore - Extended options
      result.mergeIntoDataStream(dataStream, streamOptions);
    }
  });
}
```

## 8. Create a UI Component to Display Reasoning

Build a component to display the extracted reasoning:

```tsx
// components/MessageReasoning.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Markdown } from './Markdown'; // Your markdown component

interface MessageReasoningProps {
  isLoading: boolean;
  reasoning: string;
  isReasoningMode?: boolean;
}

export function MessageReasoning({
  isLoading,
  reasoning,
  isReasoningMode = false,
}: MessageReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(isReasoningMode);

  // Auto-expand for reasoning mode
  useEffect(() => {
    setIsExpanded(isReasoningMode);
  }, [isReasoningMode]);

  // Animation variants
  const variants = {
    collapsed: { height: 0, opacity: 0, marginTop: 0 },
    expanded: { height: 'auto', opacity: 1, marginTop: '1rem' },
  };
  
  // Calculate stats about reasoning
  const reasoningStats = {
    wordCount: reasoning.split(/\s+/).length,
    stepCount: reasoning.split(/\n\n/).filter(s => s.trim().length > 0).length,
    duration: Math.max(Math.round(reasoning.length / 100), 1) // Rough estimate
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-3">
      <div className="flex justify-between items-center">
        <div>
          <span className="font-medium">
            {isLoading ? "Thinking..." : `AI Reasoning (${reasoningStats.stepCount} steps)`}
          </span>
        </div>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full"
          aria-label={isExpanded ? "Collapse reasoning" : "Expand reasoning"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>
      
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={variants}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-l border-gray-200 dark:border-gray-700 pl-4 mt-2"
          >
            <Markdown>{reasoning}</Markdown>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

## 9. Update Message Component to Show Reasoning

Modify your message component to display reasoning:

```tsx
// components/Message.tsx
import { MessageReasoning } from './MessageReasoning';

export function Message({ message, isLoading }) {
  return (
    <div className="message">
      {/* Regular message content */}
      <div className="content">
        {message.content}
      </div>
      
      {/* Show reasoning if available */}
      {(message.reasoning || isLoading) && (
        <MessageReasoning
          isLoading={isLoading}
          reasoning={message.reasoning || ''}
          isReasoningMode={message.metadata?.isReasoningMode}
        />
      )}
    </div>
  );
}
```

## 10. Create Neo4j Query Utilities for Retrieving Reasoning

Implement utilities to fetch reasoning from Neo4j:

```typescript
// lib/neo4j/queries.ts
import { getNeo4jDriver } from './driver';

export async function getReasoningForMessage(messageId: string) {
  const session = getNeo4jDriver().session();
  
  try {
    const result = await session.run(`
      MATCH (rc:ReasoningChain {messageId: $messageId})
      OPTIONAL MATCH (rc)-[:HAS_STEP]->(rs:ReasoningStep)
      RETURN rc, rs
      ORDER BY rs.order
    `, { messageId });
    
    if (result.records.length === 0) {
      return null;
    }
    
    const chain = result.records[0].get('rc').properties;
    const steps = result.records
      .filter(record => record.get('rs'))
      .map(record => record.get('rs').properties);
      
    return {
      id: chain.id,
      name: chain.name,
      description: chain.description,
      steps: steps.map(step => ({
        id: step.id,
        content: step.content,
        stepType: step.stepType,
        order: step.order
      }))
    };
  } finally {
    await session.close();
  }
}

export async function searchReasoningChains(query: string, limit = 5) {
  const embedding = await getEmbeddingForText(query);
  const session = getNeo4jDriver().session();
  
  try {
    const result = await session.run(`
      MATCH (rc:ReasoningChain)
      WHERE rc.embedding IS NOT NULL
      WITH rc, vector.similarity.cosine(rc.embedding, $embedding) AS score
      WHERE score > 0.7
      RETURN rc, score
      ORDER BY score DESC
      LIMIT $limit
    `, { 
      embedding, 
      limit: neo4j.int(limit) 
    });
    
    return result.records.map(record => ({
      ...record.get('rc').properties,
      score: record.get('score')
    }));
  } finally {
    await session.close();
  }
}
```

## Usage Instructions

1. **Configure your model prompt**:
   Instruct your model to use the reasoning tags:
   
   ```
   When solving complex problems, first use <reasoning>...</reasoning> tags to show your step-by-step thinking process before providing your final answer.
   ```

2. **Invoke reasoning mode**:
   Set the model explicitly to reasoning mode when needed:
   
   ```typescript
   const response = await fetch('/api/chat', {
     method: 'POST',
     body: JSON.stringify({
       messages,
       mode: 'reasoning-mode' // Enable reasoning extraction
     })
   });
   ```

3. **Query the knowledge graph**:
   Use Neo4j to search through reasoning chains:
   
   ```typescript
   const relatedReasoning = await searchReasoningChains(
     "How do solar panels work?",
     3 // Limit to top 3 results
   );
   ```

## Best Practices

1. **Optimize database operations**:
   - Use batch operations for multiple nodes
   - Ensure proper indexes for frequently queried properties
   - Close Neo4j sessions in finally blocks

2. **Error handling**:
   - Implement retry logic for database operations
   - Log detailed error information for debugging
   - Use try/catch blocks around all async operations

3. **Processing performance**:
   - Process complex reasoning in background for better user experience
   - Implement a queue system for high-volume processing
   - Consider database connection pooling for concurrent operations

4. **Embedding optimization**:
   - Cache embeddings for frequently used texts
   - Use dimensionality reduction for larger embedding collections
   - Consider chunking very long reasoning texts for more accurate embeddings 