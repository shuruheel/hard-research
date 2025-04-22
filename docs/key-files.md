
# Key Files Technical Documentation

## Tools

### 1. deepResearch.ts 

**Purpose**: Implements an orchestrator-worker pattern for comprehensive multi-step research by breaking down complex queries into manageable sub-queries.

**Key Components**:
- `DeepResearchParams`: Interface defining input parameters (query, maxSteps, chatId)
- `DeepResearchResult`: Interface for structured research results
- `deepResearch`: Main export with description, parameters schema, and execute function
- `researchProgressEmitter`: Event emitter for tracking research progress

**Core Functionality**:
1. **Sub-query Generation**: Uses OpenAI to decompose complex queries into focused sub-questions
2. **Knowledge Graph Integration**: Queries Neo4j database for relevant information
3. **Web Search**: Integrates with webSearchWorker for retrieving web information
4. **Reasoning Chain Generation**: Produces detailed reasoning for each sub-query
5. **Result Synthesis**: Combines individual findings into a comprehensive answer

**Flow**:
1. Generate sub-queries from main research question
2. For each sub-query:
   - Query knowledge graph for relevant information
   - Perform web search for additional context
   - Generate reasoning chain based on retrieved information
   - Extract concise result from reasoning
3. Synthesize final comprehensive answer from all results

**Notable Features**:
- Progress tracking via event emitter
- Structured citations and references section
- Intelligent handling of large data sets with auto-summarization

### 2. semanticRetrieval.ts

**Purpose**: Provides semantic search capabilities against a Neo4j knowledge graph using vector embeddings.

**Key Components**:
- `NODE_TYPE_TO_INDEX`: Maps node types to corresponding vector index names
- `ALL_NODE_TYPES`: Constant defining supported node types
- `semanticRetrieval`: Main export with description, parameters schema, and execute function

**Core Functionality**:
1. **Embedding Generation**: Converts query text to vector embeddings
2. **Vector Search**: Performs similarity search using Neo4j vector indexes
3. **Multi-type Search**: Supports querying across multiple node types (Thought, ReasoningChain, Person, etc.)
4. **Result Processing**: Serializes and structures Neo4j results based on node type

**Flow**:
1. Generate embedding for input query text
2. Build combined Neo4j query for all specified node types
3. Execute query with proper UNION structure
4. Process results based on node type, adding type-specific properties
5. Return structured search results with similarity scores

**Notable Features**:
- Type-specific property handling for different knowledge entities
- Exclusion of embedding data from returned results
- Proper Neo4j session management with explicit closing

### 3. webSearchWorker.ts

**Purpose**: Performs web searches using OpenAI's web search capabilities and formats results for research use.

**Key Components**:
- `WebSearchWorkerParams`: Interface defining input parameters
- `webSearchWorker`: Main function that performs search and formats results
- Helper functions for performing searches and getting detailed content

**Core Functionality**:
1. **Web Search**: Uses OpenAI's Responses API with web search preview tool
2. **Source Formatting**: Structures web sources in a readable format
3. **Citation Generation**: Creates academic-style citations for references
4. **Detailed Content Analysis**: Optionally performs deeper analysis on top results

**Flow**:
1. Perform web search using OpenAI's tool
2. Format sources and citations for better readability
3. Optionally retrieve detailed content for top results
4. Combine all information into structured output

**Notable Features**:
- Academic citation formatting for references
- Domain extraction from URLs
- Structured sections for search results, sources, and citations

## Agents

### researchOrchestrator.ts

**Purpose**: Orchestrates deep research across multiple sub-queries with integrated knowledge graph and web search capabilities.

**Key Components**:
- `ResearchOrchestratorOptions`: Interface defining configuration options
- `ResearchOrchestrator`: Main class that manages the research process
- Multiple private methods handling different aspects of the research flow

**Core Functionality**:
1. **Research Planning**: Breaks down main query into focused sub-queries
2. **Context Retrieval**: Gathers information from knowledge graph and web
3. **Reasoning**: Uses specialized models to process retrieved information
4. **Progress Streaming**: Provides real-time updates during research
5. **Result Synthesis**: Combines findings into comprehensive answer

**Flow**:
1. Initialize tools and determine if clarification is needed
2. Generate sub-queries for main research question
3. For each sub-query:
   - Retrieve context from knowledge graph and web
   - Process with reasoning model
   - Stream partial results
4. Synthesize final response from all findings
5. Stream complete results to client

**Notable Features**:
- Support for different models (standard and reasoning)
- Real-time progress updates via data streaming
- Structured partial results and reasoning chains
- Fallback mechanisms at each processing stage

## API Chat Route

### route.ts

**Purpose**: Handles API requests for chat functionality, integrating AI models, tools, and database operations.

**Key Components**:
- `POST` function: Handles new message submissions
- `DELETE` function: Manages chat deletion
- Configuration for different chat modes (standard, deep research, wander)

**Core Functionality**:
1. **Authentication**: Verifies user session and permissions
2. **Message Processing**: Extracts query from user messages
3. **Chat Management**: Creates or retrieves chat sessions
4. **AI Integration**: Configures and streams AI responses
5. **Tool Configuration**: Sets up semantic retrieval and deep research tools
6. **Response Storage**: Saves assistant responses to database

**Flow**:
1. Authenticate user request
2. Extract user message and determine chat mode
3. Create or retrieve chat session
4. Save user message to database
5. Configure AI stream with appropriate tools and models
6. Stream response to client
7. Save assistant message on completion

**Notable Features**:
- Extended timeout for deep research mode (5 minutes)
- Streaming response with word-level chunking
- Tool integration based on selected chat mode
- Error handling with appropriate status codes

---

The system implements a sophisticated research capability with a tiered architecture:
- **Tools**: Specialized components for specific tasks (deepResearch, semanticRetrieval, webSearchWorker)
- **Agents**: Orchestrators that coordinate tool usage (researchOrchestrator)
- **API Routes**: Client-facing interface managing requests and responses

This architecture enables complex research workflows with real-time streaming updates, integration with knowledge graphs, web search, and advanced reasoning capabilities.
