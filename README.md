# Deep Research System

A powerful AI research assistant built with Next.js, Neo4j graph database, and advanced AI capabilities that helps you conduct comprehensive research with knowledge graph integration.

## Features

- **Dual Research Modes**:
  - **Wander Mode**: Standard chat interface with graph-enhanced memory
  - **Deep Research Mode**: Multi-step orchestrated research with web search and knowledge graph integration
  
- **Advanced AI Capabilities**:
  - Reasoning token capture and storage in Neo4j graph database
  - Message parts for rich, multi-type content display
  - Multi-step tool calling with maxSteps parameter
  - Real-time research progress tracking

- **Knowledge Graph Integration**:
  - Neo4j-powered semantic retrieval and storage
  - Vector embeddings for concept and entity relationships
  - Extraction of concepts, entities, and propositions from reasoning
  - Persistent knowledge building across research sessions

- **UI/UX Features**:
  - Real-time research progress indicator
  - Document creation with research results
  - Responsive design with mobile support

  ## Known Issues
  - Reasoning token capture and storage in Neo4j hasn't been tested yet (we need to make better use of the OpenAI Responses API and Anthropic thinking tokens)
  - Support for spreadsheet artifacts based on the Neo4j graph database hasn't been tested yet
  - 

## System Architecture

The system leverages an orchestrator-worker pattern for research:

1. **Orchestrator**: Breaks down complex queries into manageable sub-questions
2. **Knowledge Graph Worker**: Searches the Neo4j database for relevant information
3. **Web Search Worker**: Retrieves up-to-date information from the web
4. **Reasoning Processor**: Generates and captures reasoning for each sub-question
5. **Synthesis Engine**: Combines all findings into a comprehensive research report

## How It Works

When in Deep Research mode, the system:

1. Analyzes the research query and breaks it into sub-questions
2. For each sub-question:
   - Searches the knowledge graph for relevant concepts and propositions
   - Performs web searches for up-to-date information
   - Generates detailed reasoning with citations
   - Extracts key findings
3. Synthesizes all results into a comprehensive research report
4. Saves the research as a document and updates the knowledge graph

Throughout this process, a real-time progress indicator shows the current step and status.

## Deployment

### Prerequisites

- Node.js 18+ and npm/pnpm
- Neo4j database (local or cloud)
- OpenAI API key for embeddings and XAI key for generation
- Vercel account (optional, for deployment)

### Environment Variables

Create a `.env` file with the following variables:

```
# Auth
AUTH_SECRET=your-auth-secret

# Database
DATABASE_URL=your-postgresql-url
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Neo4j
NEO4J_URI=your-neo4j-uri
NEO4J_USERNAME=your-neo4j-username
NEO4J_PASSWORD=your-neo4j-password

# OpenAI
OPENAI_API_KEY=your-openai-api-key
XAI_API_KEY=your-xai-api-key
```

### Installation

```bash
# Install dependencies
pnpm install

# Set up database
pnpm db:migrate

# Initialize Neo4j schema
pnpm setup:neo4j

# Start development server
pnpm dev
```

### Production Deployment

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

Or deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-username%2Fdeep-research-system)

## Usage Guide

1. Create an account or sign in
2. Choose a research mode:
   - **Wander Mode**: For casual exploration and chat
   - **Deep Research Mode**: For comprehensive research
3. Enter your research query
4. Monitor real-time research progress
5. Review the comprehensive research report
6. Create documents from research findings
7. Build a cumulative knowledge graph for future research

## Architecture and Technical Details

The system leverages several advanced technologies:

- **Next.js App Router**: Server-side rendering and API routes
- **Vercel AI SDK**: Streaming, tool calling, and reasoning capture
- **Neo4j Graph Database**: Knowledge storage and semantic retrieval
- **OpenAI Embeddings**: Vector similarity search (text-embedding-3-large)
- **XAI Models**: Advanced language model capabilities
- **SSE (Server-Sent Events)**: Real-time research progress updates

## License

[MIT License](LICENSE)