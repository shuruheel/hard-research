# Implementation Plan: Deep Research with Vercel AI SDK and Neo4j Graph

## Overview

This document outlines a comprehensive implementation plan to enhance the existing multi-modal chat interface for generative models using Vercel AI SDK. The enhancements will integrate multi-tool use, combining the benefits of graph retrieval and web search to conduct deep research with proper reasoning capture.

The existing option to choose between "Chat model" and "Reasoning model" will be replaced by two primary modes: "Wander" for quick explorations and "Go Deep" for comprehensive research, similar to OpenAI's Deep Research functionality.

## Key Requirements

1. Properly separate reasoning/thinking tokens from final output in both modes
2. Retrieve all supported node types in semantic retrieval (not just Entity and Concept)
3. Before making an API call to a reasoning model, use a non-reasoning model with tools to retrieve context using web and graph search tools
4. After getting an API response from a reasoning model and showing the final response to the user, transform the reasoning tokens into nodes and relationships in our Neo4j graph schema
5. Implement two distinct modes: "Wander" and "Go Deep"
6. For "Go Deep" mode, capture reasoning tokens from all sub-query requests and process them into the Neo4j graph database

## Technical Approach

We'll leverage Vercel AI SDK's capabilities including:
- Multi-step tool calling with standard LLMs (non-reasoning models)
- Context retrieval using the semanticRetrieval tool (enhanced to retrieve all node types)
- Context retrieval using the built-in web search tool that comes with OpenAI Responses API
- Reasoning model processing of retrieved context
- Data persistence for reasoning chains
- Orchestrator-worker pattern for Deep Research functionality
- Instead of creating a new frontend component to select between different modes, let's adapt the existing component that is used to select models

## Implementation Plan

### Phase 1: Tool Enhancements

1. **Update semanticRetrieval Tool**
   - Modify the default `nodeTypes` parameter to include all supported types
   - Current implementation defaults to: `["Thought", "ReasoningChain", "Person", "Concept"]`
   - Update to include all types: `["Thought", "ReasoningChain", "Person", "Concept", "Entity", "Proposition"]`
   - Test vector search across all node types to ensure proper functioning

3. **Implement Reasoning Token Processor**
   - Create a utility that processes reasoning tokens into Neo4j graph nodes
   - Extract key concepts, relationships, and insights from reasoning chains
   - Map these to appropriate graph schema node types
   - Implement batch processing to handle multiple reasoning chains efficiently
   - Add proper error handling and logging

### Phase 2: Agent Architecture Implementation

1. **Research Orchestrator Agent**
   - Implement using the orchestrator-worker pattern
   - Create core logic to break down research queries into sub-queries
   - Build prioritization logic for determining search approaches (graph vs. web)
   - Implement progress tracking and result aggregation
   - Add clarification question generation for research refinement

2. **Knowledge Graph Worker**
   - Develop a specialized agent for formulating optimal Cypher queries
   - Implement logic to understand the graph schema
   - Create handlers for interpreting graph results and extracting insights
   - Add functions to identify knowledge gaps based on query needs
   - Integrate with the orchestrator agent

3. **Web Search Worker**
   - Implement an agent specialized in formulating efficient web search queries
   - Create parsers for processing web search results
   - Implement source tracking and attribution
   - Add functions to extract key information from search results
   - Integrate with the orchestrator agent

4. **Memory Updater Agent**
   - Create an agent responsible for updating the Neo4j knowledge graph
   - Implement functions to create new nodes from search results
   - Build logic to establish relationships between new and existing knowledge
   - Add validation to ensure data consistency
   - Create pruning strategies for memory management

### Phase 3: UI Updates and Mode Implementation

1. **Mode Selection Interface**
   - Update the UI to replace "Chat model" / "Reasoning model" with "Wander" / "Go Deep"
   - Create descriptive tooltips explaining each mode
   - Implement mode-specific styling and indicators
   - Add visual feedback during processing to show progress

2. **"Wander" Mode Implementation**
   - Configure for quick, seamless tool usage
   - Implement background tool use for efficient responses
   - Configure reasoning token capture but hide from final output
   - Optimize for response speed and user experience
   - Add light processing of reasoning tokens for graph storage

3. **"Go Deep" Mode Implementation**
   - Configure for comprehensive multi-step research
   - Implement clarification question flow before starting research
   - Create progress indicators for the multi-step process
   - Add support for long-running operations (up to 10 minutes)
   - Configure detailed reasoning capture and visualization
   - Implement comprehensive reasoning token processing into Neo4j

4. **Reasoning Token Visualization**
   - Create a toggle to show/hide reasoning in both modes
   - Implement collapsible sections for reasoning steps
   - Add syntax highlighting for reasoning tokens
   - Create visual indicators for different reasoning step types
   - Implement a graph visualization for reasoning chains

### Phase 4: Integration and Testing

1. **API Route Updates**
   - Update `/api/chat/route.ts` to support both modes
   - Implement mode-specific configurations for the AI SDK
   - Add support for streaming responses with reasoning tokens
   - Configure proper error handling and recovery
   - Implement timeout handling for long-running operations

2. **Component Integration**
   - Update chat components to support the new modes
   - Implement progress indicators for research operations
   - Create specialized message rendering for research results
   - Add support for displaying source attributions
   - Implement graph visualization components for Neo4j data

3. **Comprehensive Testing**
   - Create test suite for both modes across various query types
   - Test performance and response times in different scenarios
   - Validate proper reasoning token capture and processing
   - Test Neo4j integration and data consistency
   - Perform user experience testing for both modes

4. **Optimization**
   - Identify performance bottlenecks in the implementation
   - Optimize database queries and API calls
   - Implement caching strategies for frequent operations
   - Add concurrent processing where appropriate
   - Fine-tune model parameters for optimal performance