# OpenAI Responses API Integration

This document provides guidance on integrating the OpenAI Responses API with our Neo4j knowledge graph project, focusing on leveraging the built-in web search capabilities.

## Overview

The OpenAI Responses API, available in AI SDK 4.2+, provides several advantages for our knowledge graph integration:

1. Built-in web search with the `webSearchPreview` tool
2. Persistent chat history
3. Simplified conversation management
4. Citation of sources

## Basic Implementation

```typescript
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { 
  entityQueryTool, 
  relationshipQueryTool, 
  pathFindingTool,
  entityCreationTool 
} from '@/lib/neo4j-tools';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = await streamText({
    model: openai.responses('gpt-4o'),
    messages,
    tools: {
      // Neo4j tools
      queryEntities: entityQueryTool,
      findRelationships: relationshipQueryTool,
      findPaths: pathFindingTool,
      createEntity: entityCreationTool,
      
      // Built-in web search
      web_search: openai.tools.webSearchPreview({
        searchContextSize: 'high',
        userLocation: {
          type: 'approximate',
          city: 'San Francisco',
          region: 'California'
        }
      })
    },
    maxSteps: 5,
  });
  
  return result.toResponse();
}
```

## Web Search Configuration Options

The `webSearchPreview` tool accepts several configuration options:

```typescript
openai.tools.webSearchPreview({
  // Amount of context to include in search results
  // Options: 'low', 'medium', 'high'
  searchContextSize: 'high',
  
  // Optional user location for contextual searches
  userLocation: {
    type: 'approximate',
    city: 'San Francisco',
    region: 'California'
  }
})
```

## Processing Web Search Results

When the OpenAI model uses the web search tool, you'll get both the generated text and the sources used:

```typescript
// Response will contain:
{
  text: "The detailed answer about your query...",
  sources: [
    {
      url: "https://example.com/relevant-page",
      title: "Relevant Page Title",
      extract: "Relevant text extracted from the page..."
    },
    // Additional sources...
  ]
}
```

## Storing Web Search Results in Neo4j

To preserve knowledge across sessions, we should store the web search results in our Neo4j graph:

```typescript
// Example function to store web search results
async function storeWebSearchResults(session, searchResults, queryContext) {
  // Create a Thought node to represent this search operation
  const thoughtResult = await session.run(`
    CREATE (t:Thought {
      name: $name,
      thoughtContent: $content,
      createdAt: datetime(),
      createdBy: "WebSearchAgent",
      confidence: 0.85
    })
    RETURN t
  `, {
    name: `Web search for "${queryContext.query}"`,
    content: `Search results for query: "${queryContext.query}"`
  });
  
  const thoughtId = thoughtResult.records[0].get('t').identity;
  
  // Create Entity nodes for each search result
  const sourcePromises = searchResults.map((source, index) => {
    return session.run(`
      CREATE (e:Entity {
        name: $title,
        description: $extract,
        nodeType: "Entity",
        subType: "WebContent",
        source: $url,
        retrievedAt: datetime()
      })
      WITH e
      MATCH (t:Thought) WHERE id(t) = $thoughtId
      CREATE (t)-[r:CITES {order: $order}]->(e)
      RETURN e
    `, {
      title: source.title,
      extract: source.extract,
      url: source.url,
      thoughtId: thoughtId,
      order: index
    });
  });
  
  return Promise.all(sourcePromises);
}
```

## Combining Web Search and Graph Search

A typical workflow combining web search with our Neo4j knowledge graph:

```typescript
// Example research orchestrator logic
async function orchestrateResearch(query) {
  // Step 1: Check if we already have knowledge in the graph
  const graphResults = await knowledgeGraphWorker.searchKnowledge(query);
  
  // Step 2: If insufficient knowledge, use web search
  if (graphResults.confidence < 0.7) {
    // Web search happens automatically via the OpenAI Responses API
    // We just need to handle storing the results
    
    // Step 3: Store web search results in the graph
    await memoryUpdater.storeWebSearchResults(response.sources, {
      query: query,
      relatedEntities: graphResults.entities
    });
    
    // Step 4: Create connections between new and existing knowledge
    await memoryUpdater.connectKnowledge({
      newSources: response.sources,
      existingEntities: graphResults.entities
    });
    
    // Step 5: Return combined knowledge
    return analysisAgent.synthesize({
      query: query,
      graphResults: graphResults,
      webResults: response.sources
    });
  } else {
    // Sufficient knowledge exists in the graph
    return graphResults;
  }
}
```

## Displaying Web Search Results in the UI

Update the Message component to display web search sources:

```tsx
// Example UI component for web search results
interface WebSourceProps {
  sources: Array<{
    url: string;
    title: string;
    extract: string;
  }>;
}

const WebSources: React.FC<WebSourceProps> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;
  
  return (
    <div className="mt-4 border-t pt-2 border-zinc-200 dark:border-zinc-700">
      <h4 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
        Sources:
      </h4>
      <div className="space-y-2">
        {sources.map((source, index) => (
          <div key={index} className="text-xs">
            <a 
              href={source.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline font-medium"
            >
              {source.title}
            </a>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              {source.extract}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Inside the Message component
{content && (
  <div className="text-zinc-800 dark:text-zinc-300 flex flex-col gap-4">
    <Markdown>{content as string}</Markdown>
    {/* Display web sources if available */}
    {toolInvocations?.some(t => t.toolName === 'web_search' && t.state === 'result') && (
      <WebSources sources={
        toolInvocations
          .find(t => t.toolName === 'web_search' && t.state === 'result')
          ?.result.sources
      } />
    )}
  </div>
)}
```

## Benefits of OpenAI Responses API for Our Project

1. **Simplicity**: No need to build a custom web search tool
2. **Reliability**: Built-in tool maintained by OpenAI
3. **Quality**: Well-formatted results with relevant sources
4. **Integration**: Works seamlessly with our custom Neo4j tools
5. **Scalability**: OpenAI handles the web search infrastructure

## Limitations and Considerations

1. The web search is limited to what the OpenAI API provides
2. We have less control over specific search parameters
3. We need to handle rate limits and quotas from the OpenAI API
4. Results might not be as specialized as a custom search solution

## Next Steps

1. Implement the API route with OpenAI Responses API
2. Create functions to process and store web search results
3. Update the UI to display sources
4. Test the integration with various queries