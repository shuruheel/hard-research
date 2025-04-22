# Deep Research Implementation

This document provides a comprehensive overview of the deep research implementation with knowledge graph integration, web search capabilities, and progress tracking.

## Overview

The deep research functionality combines several powerful capabilities:

1. **Knowledge Graph Integration** - Uses Neo4j for semantic search and storage of research findings
2. **Multi-step Research Orchestration** - Breaks complex queries into simpler sub-queries
3. **Web Search Integration** - Adds web search capabilities using Brave Search and Firecrawl APIs
4. **Reasoning Capture** - Stores reasoning steps as structured data in the knowledge graph
5. **Progress Tracking** - Provides real-time feedback on research progress using Server-Sent Events (SSE)

## Architecture

The system follows an orchestrator-worker pattern:

```
┌─────────────────────┐     ┌───────────────────┐
│                     │     │                   │
│     Chat API        │     │  Progress Events  │
│     Orchestrator    │◄────┤  (SSE Updates)    │
│                     │     │                   │
└─────────┬───────────┘     └───────────────────┘
          │
          ▼
┌─────────────────────┐
│                     │
│   Deep Research     │
│   Orchestrator      │
│                     │
└─────────┬───────────┘
          │
          ▼
┌─────────┴───────────┐     ┌───────────────────┐
│                     │     │                   │
│  Worker Processes   ├────►│  Knowledge Graph  │
│  • Graph Search     │     │  (Neo4j)          │
│  • Web Search       │     │                   │
│  • Reasoning        │     └───────────────────┘
│                     │
└─────────────────────┘
```

## File Structure

```
lib/
  └── ai/
      └── tools/
          ├── deepResearch.ts           (Orchestrates the research process)
          ├── semanticRetrieval.ts      (Handles graph database search)
          ├── processReasoningTokens.ts (Processes reasoning into graph nodes)
          └── webSearchWorker.ts        (New: Web search implementation)
lib/
  └── agents/
      └── researchOrchestrator.ts     (Manages research modes and execution)
components/
  ├── chat.tsx                        (Updated: Added progress display logic)
  ├── message-reasoning.tsx           (Visualizes reasoning tokens)
  ├── research-progress.tsx           (New: Progress UI component)
  └── ui/
      ├── progress.tsx                (New: Progress bar component)
      └── card.tsx                    (New: Card component for progress display)
app/
  ├── (chat)/api/chat/route.ts        (Main API route handling chat and research modes)
  └── api/
      └── research-progress/
          └── route.ts                (New: SSE API endpoint for progress updates)
```

## Core Components

### 1. Research Orchestration

**File: `lib/ai/tools/deepResearch.ts`**

The central orchestrator that:
1. Breaks down complex research queries into sub-queries
2. Gathers information from the knowledge graph
3. Integrates web search results
4. Generates detailed reasoning for each sub-query
5. Synthesizes a final comprehensive answer

```typescript
// Core process flow
export const deepResearch = {
  // ...
  execute: async ({ query, maxSteps = 10, chatId }: DeepResearchParams) => {
    try {
      // Step 1: Generate sub-queries using LLM
      const subQueries = await generateSubQueries(query, maxSteps);
      
      // Step 2: Process each sub-query
      for (let i = 0; i < subQueries.length; i++) {
        // Step 2.1: Check knowledge graph for relevant information
        const graphResults = await knowledgeGraphWorker(subQuery);
        
        // Step 2.2: Perform web search for additional context
        const webResults = await webSearchWorker({...});
        
        // Step 2.3: Generate reasoning for this sub-query
        const reasoning = await generateReasoningForSubQuery(...);
        
        // Step 2.4: Extract a result from the reasoning
        const result = await extractResultFromReasoning(reasoning, subQuery);
      }
      
      // Step 3: Generate a final synthesized answer
      const finalResult = await synthesizeFinalResult(query, combinedResults, reasoningChains);
      
      return {
        result: finalResult,
        reasoningChains: reasoningChains
      };
    } catch (error) {
      // Error handling...
    }
  }
};
```

### 2. Semantic Knowledge Graph Search

**File: `lib/ai/tools/semanticRetrieval.ts`**

Performs vector-based semantic search in the Neo4j database to find relevant information.

```typescript
export const semanticRetrieval = {
  description: "Retrieve semantically relevant nodes from the knowledge graph based on query text",
  parameters: z.object({
    queryText: z.string().describe("The text query to find relevant information"),
    nodeTypes: z.array(
      z.enum(ALL_NODE_TYPES)
    ).optional().describe("Types of nodes to search"),
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
      
      // 2. Query vector indexes in Neo4j
      // ... code to build and execute vector search query ...
      
      // 3. Return semantically similar nodes
      return result.records.map(record => {
        // ... processing of result records ...
      });
    } catch (error) {
      // Error handling...
    } finally {
      await session.close();
    }
  }
};
```

### 3. Reasoning Token Processing

**File: `lib/ai/tools/processReasoningTokens.ts`**

Takes reasoning text from LLMs and processes it into structured knowledge graph nodes.

```typescript
export const processReasoningTokens = {
  description: "Process reasoning tokens into knowledge graph",
  parameters: z.object({
    reasoning: z.string().describe("The reasoning text to process"),
    messageId: z.string().describe("The message ID this reasoning is associated with"),
    queryContext: z.string().describe("The query context for this reasoning"),
    processInBackground: z.boolean().optional().default(false)
      .describe("Whether to process asynchronously in the background"),
  }),
  execute: async function({
    reasoning,
    messageId,
    queryContext,
    processInBackground = false
  }: ProcessReasoningParams) {
    if (processInBackground) {
      // Start processing in background
      processReasoningInBackground(reasoning, messageId, queryContext);
      return { status: "Processing started in background" };
    } else {
      // Process synchronously
      try {
        // Extract entities, concepts, and build connections in the knowledge graph
        const result = await processReasoningInternal(reasoning, messageId, queryContext);
        return result;
      } catch (error) {
        // Error handling...
      }
    }
  }
};
```

### 4. Research Agent

**File: `lib/agents/researchOrchestrator.ts`**

Manages research modes ("Wander" vs. "Go Deep") and orchestrates the entire research process.

```typescript
export class ResearchOrchestrator {
  // ...properties
  
  /**
   * Execute research based on mode
   */
  public async executeResearch(mode: ResearchMode): Promise<ResearchResult> {
    try {
      if (mode === 'wander') {
        return this.executeWanderMode();
      } else {
        return this.executeDeepMode();
      }
    } catch (error: unknown) {
      // Error handling...
    }
  }
  
  // Mode implementations
  private async executeWanderMode(): Promise<ResearchResult> {
    // Quick exploration with efficient responses
  }
  
  private async executeDeepMode(): Promise<ResearchResult> {
    // Comprehensive research with multiple steps and detailed reasoning
  }
}
```

### 5. Web Search Worker (New Addition)

**File: `lib/ai/tools/webSearchWorker.ts`**

Implements web search functionality using Brave Search API and Firecrawl for content extraction.

```typescript
export const webSearchWorker = async ({
  query,
  maxResults = 5,
  needsDetailedContent = false
}: WebSearchWorkerParams): Promise<string> => {
  try {
    // Step 1: Perform initial search using Brave Search
    const searchResults = await performBraveSearch(query, maxResults);
    
    // Step 2: If detailed content is needed, use Firecrawl to scrape key pages
    let detailedContent = "";
    if (needsDetailedContent && searchResults.relevantUrls && searchResults.relevantUrls.length > 0) {
      const topUrls = searchResults.relevantUrls.slice(0, 2);
      detailedContent = await scrapeUrlsWithFirecrawl(topUrls);
    }
    
    // Step 3: Combine search results with detailed content
    return combinedResults;
  } catch (error) {
    // Error handling...
  }
};
```

### 6. Progress Tracking System (New Addition)

**File: `lib/ai/tools/deepResearch.ts` (additions)**

Added event-based progress tracking to provide real-time updates on research status.

```typescript
import { EventEmitter } from 'events';
export const researchProgressEmitter = new EventEmitter();

// In execute function
if (chatId) {
  emitProgress(chatId, 0, maxSteps, 'starting', 'Initializing deep research');
}

// Progress tracking function
function emitProgress(
  chatId: string, 
  currentStep: number, 
  totalSteps: number, 
  status: ProgressUpdate['status'], 
  message: string
) {
  const progressUpdate: ProgressUpdate = {
    chatId,
    currentStep,
    totalSteps,
    status,
    message
  };
  
  researchProgressEmitter.emit('progress', progressUpdate);
}
```

## API Route Integration

### Chat API Route

**File: `app/(chat)/api/chat/route.ts`**

The main API route that handles chat operations and dispatches research requests based on selected mode.

```typescript
export async function POST(request: Request) {
  try {
    // Extract request parameters
    const { id, messages, selectedChatModel, chatId } = await request.json();
    
    // Determine which mode we're using
    const isGoDeepMode = selectedChatModel === 'deep-research-mode';
    const isWanderMode = selectedChatModel === 'wander-mode';
    
    // Configure maximum tool steps based on selected mode
    const maxSteps = isGoDeepMode ? 15 : 5;
    
    // Configure tools based on mode
    const tools = isGoDeepMode
      ? [semanticRetrieval, deepResearch, processReasoningTokens]
      : [semanticRetrieval];
    
    // For Go Deep mode, execute the deep research tool directly
    if (isGoDeepMode && userQuery) {
      deepResearchPromise = deepResearch.execute({
        query: userQuery,
        maxSteps,
        chatId,
      });
    }
    
    // Stream results back to client
    // ...streaming configuration
    
    // Process reasoning tokens differently based on mode
    if (reasoningText) {
      await processReasoningTokens.execute({
        reasoning: reasoningText,
        messageId: assistantId,
        queryContext: userQuery || "Research query",
        processInBackground: isWanderMode, // Only process in background for Wander mode
        chatId,
      });
    }
  } catch (error) {
    // Error handling...
  }
}
```

## UI Components

### Message Reasoning Component

**File: `components/message-reasoning.tsx`**

Displays reasoning chains with different styles for each research mode.

```typescript
export function MessageReasoning({ 
  reasoning, 
  chatMode 
}: { 
  reasoning: string;
  chatMode: string;
}) {
  const [expanded, setExpanded] = useState(false);
  
  // Different styling for Go Deep vs Wander modes
  const isDeepResearch = chatMode === 'deep-research-mode';
  
  // Calculate reasoning statistics
  const stats = useMemo(() => {
    // ... calculate word count, duration, etc. ...
    return { wordCount, duration, complexity };
  }, [reasoning]);
  
  return (
    <div className={cn("reasoning-container", isDeepResearch ? "deep-research" : "wander-mode")}>
      {/* Toggle for expanding/collapsing reasoning */}
      <button onClick={() => setExpanded(!expanded)}>
        {expanded ? "Hide Reasoning" : "Show Reasoning"}
      </button>
      
      {/* Reasoning statistics */}
      <div className="reasoning-stats">
        <span>{stats.wordCount} words</span>
        <span>{stats.duration} to generate</span>
      </div>
      
      {/* Reasoning content */}
      {expanded && (
        <div className="reasoning-content">
          {/* Format and display reasoning text */}
        </div>
      )}
    </div>
  );
}
```

### Research Progress Component (New Addition)

**File: `components/research-progress.tsx`**

Displays real-time progress of research operations.

```typescript
export function ResearchProgress({ chatId, isVisible }: ResearchProgressProps) {
  const [progress, setProgress] = useState<ProgressState>({
    // ... initial state ...
  });

  useEffect(() => {
    if (!isVisible || !chatId) return;
    
    // Setup EventSource for SSE updates
    const eventSource = new EventSource(`/api/research-progress?chatId=${chatId}`);
    
    eventSource.onmessage = (event) => {
      // ... process progress updates ...
    };
    
    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [chatId, isVisible]);

  // Render progress UI
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deep Research in Progress</CardTitle>
        <CardDescription>
          {/* Status description */}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={progress.percent} />
        <p>{progress.message}</p>
      </CardContent>
    </Card>
  );
}
```

## Integration Flow

The complete deep research flow operates as follows:

1. **User submits a query** in the chat interface, selecting either "Wander" or "Go Deep" mode
2. **Chat API route** receives the request and processes it based on the selected mode
3. **Deep research orchestrator**:
   - Breaks down the query into sub-queries
   - For each sub-query:
     - Performs semantic search in the knowledge graph
     - Executes web search through the web search worker
     - Generates comprehensive reasoning based on all sources
   - Synthesizes a final answer from all gathered information
4. **Progress tracking system** provides real-time updates during this process
5. **Reasoning tokens** are processed and stored in the Neo4j graph database
6. **Results are returned** to the user with a UI option to explore the reasoning

## Modes Comparison

| Feature | "Wander" Mode | "Go Deep" Mode |
|---------|--------------|---------------|
| **Purpose** | Quick exploration | Comprehensive research |
| **Query Processing** | Single-stage | Multi-step with sub-queries |
| **Reasoning Display** | Hidden by default | Available for exploration |
| **Graph Storage** | Background processing | Immediate processing |
| **Progress Tracking** | No visible indicator | Real-time progress bar |
| **Web Search** | Limited | Comprehensive with content extraction |
| **Response Time** | Faster | Slower, more thorough |

## Troubleshooting

### Common Issues

1. **Progress Updates Not Showing**
   - Check that `chatId` is being passed to the API route
   - Verify EventSource connection in browser console
   - Ensure `researchProgressEmitter` is emitting events properly

2. **Web Search Not Working**
   - Check browser console for Brave Search API errors
   - Verify Firecrawl API connection and responses
   - Check for CORS issues with external APIs

3. **Knowledge Graph Issues**
   - Verify Neo4j connection settings
   - Check vector indexes are properly created
   - Ensure proper error handling in Cypher queries

4. **Reasoning Processing Failures**
   - Check Neo4j constraints and schema
   - Monitor background processing task completion
   - Verify token counts and truncation settings

### Debugging Tips

- The `researchProgressEmitter` emits events with a `chatId`, which can be monitored in the server logs
- All components include detailed error logging to the console
- Check Neo4j browser console for query performance and errors
- Monitor memory usage for large reasoning chain processing 