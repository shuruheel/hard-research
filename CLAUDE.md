# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project is a research assistant application that integrates Neo4j graph database capabilities with the Vercel AI SDK 4.2. The application leverages advanced AI features including reasoning capture, message parts, multi-step tool calling, and data streaming to create a knowledge graph-powered research system.

## Build/Lint/Test Commands
- Install: `npm install` or `pnpm install`
- Development: `npm run dev` or `pnpm dev --turbo`
- Build: `tsx lib/db/migrate && npm run build` or `tsx lib/db/migrate && pnpm build`
- Start: `npm run start` or `pnpm start`
- Lint: `npm run lint` or `pnpm lint`
- Format: `npm run format` or `pnpm format`
- Database:
  - Migration: `npm run db:migrate` or `pnpm db:migrate`
  - Studio: `npm run db:studio` or `pnpm db:studio`

## Code Style Guidelines
- **Imports**: Group imports by source (React, external libraries, internal components)
- **Types**: Use TypeScript with strict typing; prefer explicit types for props
- **Components**: Use functional components with React hooks
- **Naming**: Use PascalCase for components, camelCase for functions/variables
- **CSS**: Use Tailwind classes; prefer composition over custom CSS
- **State Management**: Use React hooks for local state
- **Error Handling**: Use try/catch for async operations
- **File Structure**: 
  - Place shared components in /components
  - Page components in /app
  - Tools in /lib/ai/tools
  - Neo4j integration in /lib/neo4j
  - Agent logic in /lib/agents
- **Formatting**: Use 2-space indentation; semicolons required; format with Biome

## Project Objectives
- Integrate Neo4j graph database tools with the Vercel AI SDK 4.2
- Implement tools for querying and manipulating the semantic knowledge graph
- Create a Deep Research system with both web search and graph search
- Utilize OpenAI Responses API for web search capabilities
- Capture reasoning tokens and store reasoning chains in the graph
- Implement Message Parts for rich, multi-part content display
- Create an agent-based system for orchestrated research

## Neo4j Integration Guidelines
- **Connection Management**: Implement a singleton pattern for Neo4j driver connection
- Define TypeScript interfaces for node types and relationship properties
- Create type-safe database access functions
- Use Neo4j driver: `neo4j-driver` and import Node, Relationship types
- Handle Neo4j-specific types properly (Integer, DateTime)
- Implement proper error handling with type guards
- Follow the graph schema defined in `docs/graph-schema.md`

## AI SDK 4.2 Integration Guidelines
- Use OpenAI Responses API for web search capabilities
- Leverage Message Parts rendering for multi-type content display
- Capture reasoning tokens from supported models with the sendReasoning option
- Store reasoning chains and steps in Neo4j graph
- Track source URLs for proper attribution
- Implement data streaming for rich content display
- Configure multi-step tool calling with maxSteps parameter
- Leverage reasoning tokens for better agent orchestration

## Documentation Resources
- Neo4j graph schema: `docs/graph-schema.md`
- Implementation plan: `docs/implementation-plan.md`
- AI SDK features:
  - Reasoning capture: `docs/aisdk-reasoning-capture.md` 
  - Message parts: `docs/aisdk-message-parts.md`
  - Tool calling: `docs/aisdk-tool-calling.md`
  - Data streaming: `docs/aisdk-data-streaming.md`
  - OpenAI Responses: `docs/aisdk-openai-responses.md`

## Key Implementation Patterns
- Use the singleton pattern for Neo4j driver connection
- Implement proper serialization for Neo4j objects
- Structure agents using the Orchestrator-Worker pattern
- Store reasoning tokens as ReasoningChain and ReasoningStep nodes
- Track source URLs as WebContent entities in the graph
- Render different message part types with specialized components
- Leverage data streaming for real-time updates
- Implement tool calling with proper error handling
- Manage application state for streaming data