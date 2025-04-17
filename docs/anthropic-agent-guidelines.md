# Building Effective Agents: Anthropic Guidelines

This document provides guidelines and best practices for building effective agents based on Anthropic's recommendations, specifically tailored for our Neo4j knowledge graph integration project.

## Core Agent Design Principles

### 1. Clear Purpose and Scope

- Give each agent a well-defined role with clear responsibilities
- Avoid agents with overlapping capabilities that could create conflicts
- Define explicit boundaries between agents to minimize confusion

### 2. Structured Prompting

- Use consistent prompt formats for each agent type
- Include clear instructions at the beginning of prompts
- Provide examples of desired outputs and reasoning

### 3. Self-Reflection and Verification

- Implement verification steps where agents validate their own outputs
- Use explicit reasoning steps before taking actions
- Implement double-checking for critical operations (especially graph modifications)

### 4. Contextual Memory

- Maintain relevant context across interactions
- Prioritize recent and relevant information
- Implement mechanisms to access and update persistent memory

## Agent Implementation Patterns

### 1. Chain of Thought Prompting

Encourage agents to break down complex tasks into explicit reasoning steps:

```typescript
const researchPrompt = `
You are a Research Orchestrator Agent. Your task is to plan and coordinate research on the topic: "${query}"

Think through this problem step by step:
1. What key questions need to be answered about this topic?
2. What information might already exist in our knowledge graph?
3. What new information would we need to search for?
4. How should we prioritize different information sources?

For each step, explain your reasoning clearly.
`;
```

### 2. Tool Use Guidelines

Structure tool-using agents with clear patterns:

```typescript
const graphQueryAgent = `
You are a Knowledge Graph Worker specialized in Neo4j queries.

When querying the graph:
1. First, analyze what information is needed
2. Then, formulate the most efficient Cypher query
3. Review the query to ensure it will retrieve the needed information
4. Format the query with proper parameters

Only after these steps should you execute the query.
`;
```

### 3. Memory Integration Pattern

```typescript
const memoryPrompt = `
You are a Memory Updater Agent responsible for creating and updating knowledge in the graph.

When processing new information:
1. Determine if this information is novel or updates existing knowledge
2. Identify the correct node types and relationships
3. Structure the information according to our schema
4. Create new nodes/relationships or update existing ones
5. Verify the updated knowledge for consistency
`;
```

## Inter-Agent Communication

### 1. Structured Message Format

All agent communication should follow a consistent format:

```typescript
interface AgentMessage {
  requestId: string;          // Unique ID for the request
  timestamp: string;          // ISO timestamp
  sender: AgentType;          // Type of the sending agent
  recipient: AgentType;       // Type of the receiving agent
  messageType: MessageType;   // Type of message (QUERY, RESPONSE, ERROR, etc.)
  content: any;               // The actual message content
  context?: any;              // Additional context
  metadata?: Record<string, any>; // Optional metadata
}
```

### 2. Task Delegation Pattern

The orchestrator should delegate tasks with clear instructions:

```typescript
// Example delegation
orchestrator.delegate({
  to: "KnowledgeGraphWorker",
  task: "QUERY_ENTITIES",
  parameters: {
    entityType: "Concept",
    properties: { domain: "Physics" }
  },
  priority: "HIGH",
  contextId: currentContextId
});
```

### 3. Result Aggregation

When multiple agents contribute to a result:

```typescript
// Example aggregation
const results = await Promise.all([
  knowledgeGraphWorker.execute(graphTask),
  webSearchWorker.execute(searchTask)
]);

const aggregatedResults = analysisAgent.synthesize(results, {
  prioritizeRecent: true,
  resolveConflicts: true,
  formatForUserConsumption: true
});
```

## Agent Memory Patterns

### 1. Working Memory

Short-term, task-specific information:

```typescript
class AgentWorkingMemory {
  private items: Map<string, { value: any, timestamp: number }> = new Map();
  private ttl: number = 1000 * 60 * 10; // 10 minutes
  
  set(key: string, value: any) {
    this.items.set(key, { value, timestamp: Date.now() });
  }
  
  get(key: string) {
    const item = this.items.get(key);
    if (!item) return null;
    
    // Check expiration
    if (Date.now() - item.timestamp > this.ttl) {
      this.items.delete(key);
      return null;
    }
    
    return item.value;
  }
}
```

### 2. Long-Term Memory (Neo4j)

For persistent storage across sessions:

```typescript
// Create a thought node representing agent reasoning
async function storeReasoning(session, reasoning, context) {
  return session.run(`
    CREATE (t:Thought {
      name: $name,
      thoughtContent: $content,
      createdAt: datetime(),
      createdBy: $agent,
      confidence: $confidence
    })
    RETURN t
  `, {
    name: `Thought about ${context.topic}`,
    content: reasoning.summary,
    agent: reasoning.agent,
    confidence: reasoning.confidence
  });
}
```

### 3. Memory Retrieval

For contextual retrieval of relevant memories:

```typescript
async function retrieveRelevantMemories(session, context, limit = 5) {
  return session.run(`
    MATCH (t:Thought)
    WHERE t.thoughtContent CONTAINS $topic
    RETURN t
    ORDER BY t.createdAt DESC
    LIMIT $limit
  `, {
    topic: context.topic,
    limit: limit
  });
}
```

## Error Handling and Recovery

### 1. Graceful Degradation

Agents should degrade gracefully when components fail:

```typescript
try {
  // Try specialized approach
  return await complexGraphQuery(query);
} catch (error) {
  // Fall back to simpler approach
  console.warn("Complex query failed, falling back to simpler approach", error);
  return await simpleGraphQuery(query);
}
```

### 2. Self-Correction

Agents should detect and correct their own errors:

```typescript
// Example self-correction logic
function verifyCypherQuery(query, parameters) {
  const commonErrors = [
    { pattern: /CREATE\s+\(/i, check: () => parameters.mode !== 'write', message: 'Write operation not allowed in read mode' },
    { pattern: /MATCH\s+\(n\)\s+RETURN\s+n/i, check: () => true, message: 'Query too broad, may return too many results' }
  ];
  
  for (const error of commonErrors) {
    if (error.pattern.test(query) && error.check()) {
      throw new Error(`Invalid query: ${error.message}`);
    }
  }
  
  return query; // Query passes checks
}
```

## Agent Orchestration Strategies

### 1. Sequential Processing

For well-defined workflows:

```typescript
async function sequentialResearch(query) {
  // Step 1: Knowledge graph search
  const graphResults = await knowledgeGraphAgent.search(query);
  
  // Step 2: Identify gaps
  const gaps = await analysisAgent.identifyGaps(query, graphResults);
  
  // Step 3: Web search to fill gaps
  const webResults = await webSearchAgent.search(gaps.queryStrings);
  
  // Step 4: Update knowledge graph
  await memoryAgent.updateGraph(webResults);
  
  // Step 5: Final synthesis
  return await analysisAgent.synthesize(query, graphResults, webResults);
}
```

### 2. Dynamic Routing

For more flexible workflows:

```typescript
async function dynamicResearch(query) {
  // Analyze query to determine approach
  const strategy = await planningAgent.determineStrategy(query);
  
  // Execute dynamic workflow based on strategy
  const result = await workflowEngine.execute(strategy, { query });
  
  // Final processing
  return await postProcessingAgent.process(result);
}
```

## Performance Optimization

### 1. Parallel Processing

For independent subtasks:

```typescript
async function parallelResearch(query, aspects) {
  // Process multiple aspects in parallel
  const results = await Promise.all(
    aspects.map(aspect => researchAgent.investigate(query, aspect))
  );
  
  // Combine results
  return synthesisAgent.combine(results);
}
```

### 2. Caching

For repeated operations:

```typescript
class QueryCache {
  private cache = new Map<string, {result: any, timestamp: number}>();
  private ttl = 1000 * 60 * 60; // 1 hour
  
  async query(cypherQuery: string, params: any, executeQuery: Function) {
    const key = JSON.stringify({ query: cypherQuery, params });
    const cached = this.cache.get(key);
    
    if (cached && (Date.now() - cached.timestamp < this.ttl)) {
      return cached.result;
    }
    
    const result = await executeQuery(cypherQuery, params);
    this.cache.set(key, { result, timestamp: Date.now() });
    return result;
  }
}
```

## Learning From Usage

### 1. Performance Tracking

```typescript
function trackAgentPerformance(agentId, task, startTime) {
  const duration = Date.now() - startTime;
  metrics.record(agentId, {
    task,
    duration,
    timestamp: new Date().toISOString()
  });
  
  // Identify slow operations
  if (duration > thresholds[task]) {
    console.warn(`${agentId} took ${duration}ms to complete ${task}, exceeding threshold of ${thresholds[task]}ms`);
  }
}
```

### 2. Feedback Integration

```typescript
// Store user feedback for improvement
async function recordFeedback(session, feedback) {
  return session.run(`
    MATCH (t:Thought {id: $thoughtId})
    CREATE (f:Feedback {
      content: $feedback,
      createdAt: datetime(),
      rating: $rating
    })
    CREATE (f)-[:FEEDBACK_FOR]->(t)
    RETURN f
  `, {
    thoughtId: feedback.thoughtId,
    feedback: feedback.content,
    rating: feedback.rating
  });
}
```

## Conclusion

These guidelines provide a framework for implementing effective agents for our Neo4j knowledge graph integration. By following these patterns, we can create a system that builds on reasoning across sessions and combines the power of web search with graph database capabilities.