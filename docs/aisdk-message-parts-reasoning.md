# AI SDK 4.2 Message Parts and Reasoning Tokens

This document outlines how to use Message Parts and Reasoning Tokens in AI SDK 4.2 for our Neo4j knowledge graph integration project.

## Message Parts Overview

Message Parts allow for handling multiple output types in a single message, making it possible to create more structured and interactive AI responses.

### Supported Part Types

- **Text**: Standard text content
- **Sources**: Citations and references to external content
- **Reasoning**: Detailed reasoning steps from the AI model
- **Tool Invocations**: Records of tool usage
- **Files**: Any file attachments

## Implementing useChat with Message Parts

```tsx
// components/chat.tsx
import { useChat } from 'ai/react';

function Chat() {
  const { messages } = useChat();
  
  return (
    <div className="flex flex-col gap-4">
      {messages.map((message) => (
        <div key={message.id} className="message">
          {message.parts.map((part, i) => {
            switch (part.type) {
              case "text":
                return <p key={i} className="text-content">{part.text}</p>;
                
              case "source":
                return (
                  <div key={i} className="source-citation">
                    <a href={part.source.url} target="_blank" rel="noopener noreferrer">
                      {part.source.title}
                    </a>
                    <p className="text-sm text-gray-500">{part.source.extract}</p>
                  </div>
                );
                
              case "reasoning":
                return (
                  <div key={i} className="reasoning-steps">
                    <h4>Reasoning Process:</h4>
                    <p>{part.reasoning}</p>
                  </div>
                );
                
              // Handle other part types as needed
              default:
                return null;
            }
          })}
        </div>
      ))}
    </div>
  );
}
```

## Reasoning Tokens

Reasoning tokens provide access to a model's internal reasoning process, which is particularly valuable for capturing the thought process and storing it in our knowledge graph.

### Implementing with Anthropic Models

```typescript
// Example of capturing reasoning tokens with Anthropic
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const { text, reasoning } = await generateText({
  model: anthropic('claude-3-7-sonnet-20250219'),
  prompt: 'What is the significance of quantum entanglement?'
});

console.log(text); // The final response
console.log(reasoning); // The step-by-step reasoning process
```

## Storing Reasoning in Neo4j

### 1. Creating a Reasoning Chain

```typescript
// lib/neo4j-tools/reasoning-chain.ts
export const storeReasoningTokens = async (session, query, reasoning) => {
  // Create a ReasoningChain node
  const chainResult = await session.run(`
    CREATE (rc:ReasoningChain {
      name: $name,
      description: $description,
      conclusion: $conclusion,
      confidenceScore: 0.9,
      creator: "AI",
      methodology: "deductive",
      createdAt: datetime(),
      numberOfSteps: $numberOfSteps
    })
    RETURN rc
  `, {
    name: `Reasoning about: ${query.substring(0, 50)}${query.length > 50 ? '...' : ''}`,
    description: `AI reasoning process for query: "${query}"`,
    conclusion: extractConclusion(reasoning),
    numberOfSteps: extractReasoningSteps(reasoning).length
  });
  
  const chainId = chainResult.records[0].get('rc').identity;
  
  // Create ReasoningStep nodes
  const steps = extractReasoningSteps(reasoning);
  for (let i = 0; i < steps.length; i++) {
    await session.run(`
      CREATE (rs:ReasoningStep {
        name: $name,
        content: $content,
        stepType: $stepType,
        confidence: $confidence,
        createdAt: datetime()
      })
      WITH rs
      MATCH (rc:ReasoningChain) WHERE id(rc) = $chainId
      CREATE (rc)-[r:HAS_STEP {order: $order}]->(rs)
      RETURN rs
    `, {
      name: `Step ${i+1}: ${steps[i].title || 'Reasoning step'}`,
      content: steps[i].content,
      stepType: determineStepType(steps[i].content, i, steps.length),
      confidence: 0.9,
      chainId: chainId,
      order: i
    });
  }
  
  return chainId;
};

// Helper function to extract steps from reasoning text
function extractReasoningSteps(reasoning) {
  // Basic implementation - in practice, you'd use a more sophisticated parser
  const steps = [];
  const lines = reasoning.split('\n');
  let currentStep = { title: '', content: '' };
  
  for (const line of lines) {
    if (line.match(/^Step \d+:/i) || line.match(/^\d+\./)) {
      if (currentStep.content) {
        steps.push({ ...currentStep });
      }
      currentStep = { 
        title: line.trim(),
        content: ''
      };
    } else if (currentStep.title) {
      currentStep.content += line + '\n';
    }
  }
  
  if (currentStep.content) {
    steps.push(currentStep);
  }
  
  return steps;
}

// Determine the step type based on content and position
function determineStepType(content, index, totalSteps) {
  if (index === 0) return 'premise';
  if (index === totalSteps - 1) return 'conclusion';
  if (content.includes('therefore') || content.includes('thus')) return 'inference';
  if (content.includes('however') || content.includes('but')) return 'counterargument';
  if (content.includes('example') || content.includes('instance')) return 'evidence';
  return 'inference';
}

// Extract the conclusion from reasoning
function extractConclusion(reasoning) {
  // Simple implementation - extract the last paragraph or sentences containing conclusion markers
  const conclusionMarkers = ['in conclusion', 'therefore', 'thus', 'so', 'as a result'];
  const paragraphs = reasoning.split('\n\n');
  
  // Check the last paragraph first
  const lastParagraph = paragraphs[paragraphs.length - 1];
  if (lastParagraph && lastParagraph.length > 0) {
    return lastParagraph;
  }
  
  // Look for conclusion markers
  for (const marker of conclusionMarkers) {
    const regex = new RegExp(`(.*${marker}.*\\.)`);
    const match = reasoning.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Default to last 200 characters if no conclusion is found
  return reasoning.substring(Math.max(0, reasoning.length - 200));
}
```

### 2. Linking to Sources and Entities

```typescript
// Link reasoning chains to sources and entities
export const linkReasoningToEntities = async (session, reasoningChainId, entities, sources) => {
  // Link to entity nodes
  const entityPromises = entities.map(entity => {
    return session.run(`
      MATCH (rc:ReasoningChain), (e:Entity)
      WHERE id(rc) = $chainId AND id(e) = $entityId
      CREATE (rc)-[r:REFERENCES]->(e)
      RETURN r
    `, {
      chainId: reasoningChainId,
      entityId: entity.id
    });
  });
  
  // Link to source URLs
  const sourcePromises = sources.map((source, index) => {
    return session.run(`
      MATCH (rc:ReasoningChain)
      WHERE id(rc) = $chainId
      MERGE (s:Entity {
        name: $title,
        source: $url,
        nodeType: "Entity",
        subType: "WebContent"
      })
      ON CREATE SET s.retrievedAt = datetime()
      CREATE (rc)-[r:CITES {order: $order}]->(s)
      RETURN r
    `, {
      chainId: reasoningChainId,
      title: source.title,
      url: source.url,
      order: index
    });
  });
  
  return Promise.all([...entityPromises, ...sourcePromises]);
};
```

## Creating a Message Parts Renderer Component

```tsx
// components/message-parts-renderer.tsx
import React from 'react';
import { Markdown } from './markdown';
import { MermaidDiagram } from './mermaid-diagram';

interface MessagePartRendererProps {
  parts: Array<{
    type: string;
    [key: string]: any;
  }>;
}

export const MessagePartRenderer: React.FC<MessagePartRendererProps> = ({ parts }) => {
  if (!parts || parts.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {parts.map((part, index) => (
        <div key={index}>
          {renderPart(part)}
        </div>
      ))}
    </div>
  );
};

function renderPart(part: { type: string; [key: string]: any }) {
  switch (part.type) {
    case 'text':
      return <Markdown>{part.text}</Markdown>;
      
    case 'source':
      return renderSource(part.source);
      
    case 'reasoning':
      return renderReasoning(part.reasoning);
      
    case 'tool_result':
      return renderToolResult(part.name, part.result);
      
    default:
      return <div>Unknown part type: {part.type}</div>;
  }
}

function renderSource(source: { url: string; title: string; extract?: string }) {
  return (
    <div className="border-l-4 border-blue-400 pl-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded">
      <h4 className="font-medium">Source</h4>
      <a 
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:underline"
      >
        {source.title}
      </a>
      {source.extract && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {source.extract}
        </p>
      )}
    </div>
  );
}

function renderReasoning(reasoning: string) {
  // Generate a Mermaid diagram for the reasoning steps
  const steps = reasoning.split(/\n(?:Step \d+:|(?:\d+)\.)/).filter(Boolean);
  const mermaidCode = generateReasoningDiagram(steps);
  
  return (
    <div className="border-l-4 border-purple-400 pl-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded">
      <h4 className="font-medium mb-2">Reasoning Process</h4>
      <div className="mb-4">
        <Markdown>{reasoning}</Markdown>
      </div>
      {mermaidCode && (
        <div className="mt-4">
          <h5 className="font-medium mb-2">Reasoning Diagram</h5>
          <MermaidDiagram content={mermaidCode} />
        </div>
      )}
    </div>
  );
}

function renderToolResult(toolName: string, result: any) {
  if (toolName.includes('entity') || toolName.includes('Entity')) {
    return renderEntityResult(result);
  }
  
  if (toolName.includes('relationship') || toolName.includes('Relationship')) {
    return renderRelationshipResult(result);
  }
  
  if (toolName.includes('path') || toolName.includes('Path')) {
    return renderPathResult(result);
  }
  
  // Default rendering for other tool results
  return (
    <div className="border-l-4 border-gray-400 pl-4 py-2 bg-gray-50 dark:bg-gray-900/20 rounded">
      <h4 className="font-medium">Tool Result: {toolName}</h4>
      <pre className="text-xs overflow-auto p-2 bg-gray-100 dark:bg-gray-800 rounded mt-2">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}

// Helper function to generate a Mermaid diagram from reasoning steps
function generateReasoningDiagram(steps: string[]) {
  if (steps.length <= 1) return null;
  
  let mermaidCode = 'graph TD\n';
  
  for (let i = 0; i < steps.length; i++) {
    const stepId = `step${i}`;
    const stepTitle = steps[i].split('\n')[0].trim().substring(0, 30) + (steps[i].split('\n')[0].length > 30 ? '...' : '');
    mermaidCode += `  ${stepId}["${stepTitle}"]\n`;
    
    if (i > 0) {
      mermaidCode += `  step${i-1} --> ${stepId}\n`;
    }
  }
  
  return mermaidCode;
}

// Implement rendering functions for Neo4j entities, relationships, and paths
// ...
```

## Integrating Message Parts with the API Route

```typescript
// app/(preview)/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { entityQueryTool, relationshipQueryTool, thoughtRecordingTool } from '@/lib/neo4j-tools';

export async function POST(req: Request) {
  const { messages, model: modelName = 'openai' } = await req.json();
  
  // Choose model based on modelName parameter
  const model = modelName === 'anthropic' 
    ? anthropic('claude-3-7-sonnet-20250219') // For reasoning tokens
    : openai.responses('gpt-4o'); // For web search
  
  const result = await streamText({
    model,
    messages,
    tools: {
      // Neo4j tools
      queryEntities: entityQueryTool,
      findRelationships: relationshipQueryTool,
      recordThought: thoughtRecordingTool,
      
      // Web search (only for OpenAI Responses API)
      ...(modelName === 'openai' ? {
        web_search: openai.tools.webSearchPreview({
          searchContextSize: 'high'
        })
      } : {})
    },
    maxSteps: 5,
  });
  
  // If using Anthropic model, store reasoning in Neo4j
  if (modelName === 'anthropic' && result.reasoning) {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();
    
    try {
      // Extract the last user message as the query
      const query = messages.filter(m => m.role === 'user').pop()?.content || '';
      
      // Store reasoning in Neo4j
      await storeReasoningTokens(session, query, result.reasoning);
    } catch (error) {
      console.error('Error storing reasoning:', error);
    } finally {
      await session.close();
    }
  }
  
  return result.toResponse();
}
```

## Benefits for Knowledge Graph Integration

1. **Enhanced Reasoning Capture**:
   - Store the AI's reasoning process as structured ReasoningChain and ReasoningStep nodes
   - Link reasoning to entities and sources in the knowledge graph
   - Create explicit representations of thought processes

2. **Improved User Interface**:
   - Display sources with proper attribution
   - Show reasoning steps when available
   - Visualize reasoning processes with Mermaid diagrams

3. **Better Knowledge Building**:
   - Track sources of information to maintain provenance
   - Create more structured knowledge representation
   - Enable tracking of how knowledge evolves over time

4. **Integration with Graph Query Results**:
   - Render different types of content appropriately
   - Link web sources to relevant graph entities
   - Visualize connections between sources, reasoning, and existing knowledge

## Implementation Strategy

1. First prioritize capturing and storing the data (reasoning tokens, sources)
2. Then implement the UI components to render message parts
3. Finally, integrate reasoning visualization with the Mermaid diagram component

This approach allows us to build a system that not only answers questions but stores its reasoning process and sources in a structured knowledge graph that can be queried and visualized.