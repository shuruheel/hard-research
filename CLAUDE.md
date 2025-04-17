# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Lint/Test Commands
- Install: `npm install` or `pnpm install`
- Development: `npm run dev` or `pnpm dev`
- Build: `npm run build` or `pnpm build`
- Start: `npm run start` or `pnpm start`
- Lint: `npm run lint` or `pnpm lint`

## Code Style Guidelines
- **Imports**: Group imports by source (React, external libraries, internal components)
- **Types**: Use TypeScript with strict typing; prefer explicit types for props
- **Components**: Use functional components with React hooks
- **Naming**: Use PascalCase for components, camelCase for functions/variables
- **CSS**: Use Tailwind classes; prefer composition over custom CSS
- **State Management**: Use React hooks for local state
- **Error Handling**: Use try/catch for async operations
- **File Structure**: Place shared components in /components, page components in /app
- **Formatting**: Use 2-space indentation; semicolons required

## Project Objectives
- Integrate Neo4j graph database tools with the Vercel AI SDK 4.2
- Implement tools for querying and manipulating the semantic knowledge graph
- Create a Deep Research-like system with both web search and graph search
- Utilize OpenAI Responses API for web search capabilities
- Capture reasoning tokens and store reasoning chains in the graph
- Implement Message Parts for rich, multi-part content display

## Neo4j Integration Guidelines
- **Connection Management**: Implement a singleton pattern for Neo4j driver connection
- Define TypeScript interfaces for node types and relationship properties
- Create type-safe database access functions
- Use Neo4j driver: `neo4j-driver` and import Node, Relationship types
- Handle Neo4j-specific types properly (Integer, DateTime)
- Implement proper error handling with type guards

## AI SDK 4.2 Integration Guidelines
- Use OpenAI Responses API for web search capabilities
- Implement Message Parts rendering for multi-type content display
- Capture reasoning tokens from supported models
- Store reasoning chains and steps in Neo4j graph
- Track source URLs for proper attribution
- Implement useChat with Message Parts support

## Documentation Resources
- Neo4j graph schema: `docs/graph-schema.md`
- Neo4j tools implementation: `docs/aisdk-neo4j-tools.md`
- Agent implementation: `docs/aisdk-agents.md`
- OpenAI Responses integration: `docs/openai-responses-integration.md`
- Message Parts and Reasoning: `docs/aisdk-message-parts-reasoning.md`
- Implementation plan: `docs/implementation-plan.md`
- Sample Neo4j implementation: `docs/sample-neo4j-implementation.md`

## Key Implementation Patterns
- Use the singleton pattern for Neo4j driver connection
- Implement proper serialization for Neo4j objects
- Structure agents using the Orchestrator-Worker pattern
- Store reasoning tokens as ReasoningChain and ReasoningStep nodes
- Track source URLs as WebContent entities in the graph
- Render different message part types with specialized components