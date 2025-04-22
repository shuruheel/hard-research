import { z } from 'zod';
import { getEmbeddingForText } from '../embeddings';
import { getNeo4jDriver } from '../../neo4j/driver';
import OpenAI from 'openai';
import { semanticRetrieval } from './semanticRetrieval';
import { nanoid } from 'nanoid';
import { webSearchWorker } from './webSearchWorker';

// Event emitter for progress tracking
import { EventEmitter } from 'events';
export const researchProgressEmitter = new EventEmitter();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface DeepResearchParams {
  query: string;
  maxSteps?: number;
  chatId?: string; // For tracking progress
}

export interface DeepResearchResult {
  result: string;
  reasoningChains: string[];
  graphResults?: Array<{query: string, results: string}>;
  webResults?: Array<{query: string, results: string}>;
}

interface ProgressUpdate {
  chatId: string;
  currentStep: number;
  totalSteps: number;
  status: 'starting' | 'generating-queries' | 'processing-query' | 'finalizing' | 'complete' | 'error';
  message: string;
}

/**
 * Deep Research Tool
 * 
 * Implements the orchestrator-worker pattern for comprehensive multi-step research.
 * Manages a series of sub-queries and aggregates the results using both 
 * graph database and web search tools.
 */
export const deepResearch = {
  description: "Perform deep research by breaking down a complex query into sub-queries and aggregating results",
  parameters: z.object({
    query: z.string().describe("The main research query to investigate"),
    maxSteps: z.number().optional().default(10).describe("Maximum number of steps to perform"),
    chatId: z.string().optional().describe("Chat ID for tracking progress")
  }),
  execute: async ({ query, maxSteps = 10, chatId }: DeepResearchParams): Promise<DeepResearchResult> => {
    try {
      // Initialize collections for all search results
      const allGraphResults: Array<{query: string, results: string}> = [];
      const allWebResults: Array<{query: string, results: string}> = [];
      
      // Track progress if chatId is provided
      if (chatId) {
        emitProgress(chatId, 0, maxSteps, 'starting', 'Initializing deep research');
      }
      
      // Step 1: Generate sub-queries using LLM
      if (chatId) {
        emitProgress(chatId, 0, maxSteps, 'generating-queries', 'Breaking down research into manageable questions');
      }
      
      const subQueries = await generateSubQueries(query, maxSteps);
      
      // Step 2: Collect a reasoning chain for each sub-query
      const reasoningChains: string[] = [];
      let combinedResults = "";
      
      // Process each sub-query
      for (let i = 0; i < subQueries.length; i++) {
        // Get sub-query
        const subQuery = subQueries[i];
        
        if (chatId) {
          emitProgress(
            chatId, 
            i + 1, 
            subQueries.length, 
            'processing-query', 
            `Researching: ${subQuery.substring(0, 50)}${subQuery.length > 50 ? '...' : ''}`
          );
        }
        
        // Step 2.1: First check the knowledge graph for relevant information
        const graphResults = await knowledgeGraphWorker(subQuery);
        
        // Store graph results
        allGraphResults.push({
          query: subQuery,
          results: graphResults
        });
        
        // Step 2.2: Perform web search for additional context
        const webResults = await webSearchWorker({
          query: subQuery,
          maxResults: 3,
          needsDetailedContent: true
        });
        
        // Store web results
        allWebResults.push({
          query: subQuery,
          results: webResults
        });
        
        // Step 2.3: Generate a reasoning for this sub-query using both knowledge graph and web results
        const reasoning = await generateReasoningForSubQuery(
          subQuery, 
          graphResults,
          webResults,
          query, // Original query for context
          i + 1,  // Current step 
          subQueries.length // Total steps
        );
        
        // Add to our collection
        reasoningChains.push(reasoning);
        
        // Step 2.4: Extract a result from the reasoning
        const result = await extractResultFromReasoning(reasoning, subQuery);
        combinedResults += `\n\n${result}`;
      }
      
      // Step 3: Generate a final synthesized answer
      if (chatId) {
        emitProgress(chatId, subQueries.length, subQueries.length, 'finalizing', 'Synthesizing final answer');
      }
      
      const finalResult = await synthesizeFinalResult(query, combinedResults, reasoningChains, allGraphResults, allWebResults);
      
      if (chatId) {
        emitProgress(chatId, subQueries.length, subQueries.length, 'complete', 'Research complete');
      }
      
      return {
        result: finalResult,
        reasoningChains,
        graphResults: allGraphResults,
        webResults: allWebResults
      };
    } catch (error) {
      console.error("Deep research failed:", error);
      
      // Emit error progress if chatId is provided
      if (chatId) {
        emitProgress(chatId, 0, 0, 'error', `Research error: ${(error as Error).message}`);
      }
      
      throw new Error(`Deep research failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Emit progress update to clients
 */
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

/**
 * Generate sub-queries from a main research query
 */
async function generateSubQueries(query: string, maxSteps: number): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a research planning assistant. Break down complex research questions into 
                    a series of smaller, focused sub-questions that would help thoroughly investigate the 
                    main question. Generate up to ${maxSteps} sub-questions, but only as many as truly needed.`
        },
        {
          role: "user",
          content: `Main research question: "${query}"
                   
                   Break this down into smaller sub-questions that would help answer the main question thoroughly.
                   Return ONLY the list of sub-questions as a JSON array of strings, with no additional text.`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0].message.content;
    if (!content) {
      return [query]; // Fallback to using the original query
    }
    
    try {
      const parsedResponse = JSON.parse(content);
      if (Array.isArray(parsedResponse.sub_questions) && parsedResponse.sub_questions.length > 0) {
        return parsedResponse.sub_questions.slice(0, maxSteps);
      } else if (Array.isArray(parsedResponse) && parsedResponse.length > 0) {
        return parsedResponse.slice(0, maxSteps);
      }
    } catch (parseError) {
      console.error("Error parsing sub-queries:", parseError);
    }
    
    // Fallback: simply return the original query
    return [query];
  } catch (error) {
    console.error("Error generating sub-queries:", error);
    return [query]; // Fallback to using the original query
  }
}

/**
 * Query the knowledge graph and return relevant information
 */
async function knowledgeGraphWorker(query: string): Promise<string> {
  try {
    // Use the semanticRetrieval tool to get information from the graph
    const retrievalResult = await semanticRetrieval.execute({
      queryText: query,
      nodeTypes: ["Thought", "ReasoningChain", "Person", "Concept", "Entity", "Proposition"],
      limit: 5
    });
    
    if (retrievalResult && retrievalResult.length > 0) {
      // Format the graph results into a readable string
      return retrievalResult.map(node => {
        return `${node.nodeType} "${node.name}": ${node.description || node.definition || ""}`;
      }).join('\n\n');
    }
    
    return "No relevant information found in the knowledge graph.";
  } catch (error) {
    console.error("Knowledge graph query failed:", error);
    return "Failed to retrieve information from the knowledge graph.";
  }
}

/**
 * Generate reasoning for a specific sub-query
 */
async function generateReasoningForSubQuery(
  subQuery: string,
  graphContext: string,
  webContext: string,
  originalQuery: string,
  currentStep: number,
  totalSteps: number
): Promise<string> {
  try {
    // Use OpenAI to generate reasoning
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a research assistant creating a comprehensive reasoning chain for a research sub-question.
                    Show your detailed step-by-step reasoning process. Make sure to:
                    1. Consider the evidence from both the knowledge graph and web search
                    2. Apply critical thinking and logical analysis
                    3. Evaluate multiple perspectives
                    4. Identify any gaps in evidence
                    5. Cite sources when using information from web search
                    
                    This is step ${currentStep} of ${totalSteps} in answering the main question.`
        },
        {
          role: "user",
          content: `Main question: "${originalQuery}"
                    
                    Sub-question: "${subQuery}"
                    
                    Knowledge graph information:
                    ${graphContext}
                    
                    Web search information:
                    ${webContext}
                    
                    Provide your detailed reasoning chain for answering this sub-question. 
                    Be thorough and explicit in your reasoning steps.
                    When using information from web search, cite the source.`
        }
      ]
    });
    
    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error generating reasoning:", error);
    return `Failed to generate reasoning for sub-query: ${subQuery}`;
  }
}

/**
 * Extract a concise result from reasoning text
 */
async function extractResultFromReasoning(reasoning: string, query: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Extract a concise, focused result from the detailed reasoning provided."
        },
        {
          role: "user",
          content: `Based on this detailed reasoning about "${query}":
                    
                    ${reasoning.substring(0, 8000)}
                    
                    Extract a clear, concise result (1-2 paragraphs maximum) that directly addresses the question.`
        }
      ]
    });
    
    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error extracting result:", error);
    return "Failed to extract a result from the reasoning.";
  }
}

/**
 * Synthesize the final comprehensive answer
 */
async function synthesizeFinalResult(
  originalQuery: string, 
  combinedResults: string,
  reasoningChains: string[],
  allGraphResults?: Array<{query: string, results: string}>,
  allWebResults?: Array<{query: string, results: string}>
): Promise<string> {
  try {
    // Get total reasoning length for truncation
    const totalReasoningLength = reasoningChains.join('\n\n').length;
    
    // Create a condensed version of the reasoning for context
    let reasoningContext = "";
    if (totalReasoningLength > 10000) {
      // If reasoning is very long, use an extraction process to get key points
      reasoningContext = await extractKeyPointsFromReasoning(reasoningChains);
    } else {
      // Use the reasoning chains with moderate truncation
      reasoningContext = reasoningChains.join('\n\n').substring(0, 6000);
    }
    
    // Define the type for search contexts
    interface SearchContext {
      subQuery: string;
      content: string;
      source: string;
    }
    
    // Process search results more effectively by chunking and prioritizing
    let graphSearchContexts: SearchContext[] = [];
    let webSearchContexts: SearchContext[] = [];
    
    // Process graph search results - create focused chunks
    if (allGraphResults && allGraphResults.length > 0) {
      // Preserve original query relationship
      graphSearchContexts = allGraphResults.map(item => ({
        subQuery: item.query,
        content: item.results.substring(0, 800), // More content per item
        source: "Knowledge Graph"
      }));
    }
    
    // Process web search results - create focused chunks with citation references
    let webReferences: string[] = [];
    if (allWebResults && allWebResults.length > 0) {
      webSearchContexts = allWebResults.map(item => {
        // Extract citation references section if available
        const citationMatch = item.results.match(/=== Citation References ===\s*([\s\S]*?)(?=\s*===|$)/);
        if (citationMatch && citationMatch[1]) {
          // Clean up and add to references
          const citationText = citationMatch[1].trim();
          if (citationText && citationText !== "No citation references available.") {
            webReferences.push(citationText);
          }
        }
        
        return {
          subQuery: item.query,
          content: item.results.substring(0, 800), // More content per item
          source: "Web Search"
        };
      });
    }
    
    // Combine all contexts and sort by relevance
    const allSearchContexts: SearchContext[] = [...graphSearchContexts, ...webSearchContexts];
    
    // Create a more structured context format
    const structuredSearchContext = allSearchContexts.map(ctx => 
      `SOURCE: ${ctx.source}
      SUB-QUESTION: "${ctx.subQuery}"
      FINDINGS: ${ctx.content}`
    ).join('\n\n---\n\n');
    
    // Collect all website references for the References section
    const uniqueReferences = new Set<string>();
    webReferences.forEach(refSet => {
      refSet.split('\n\n').forEach(ref => {
        if (ref.trim()) uniqueReferences.add(ref.trim());
      });
    });
    const referencesSection = Array.from(uniqueReferences).join('\n\n');
    
    // Use a separate call to extract key insights from search results if they're too large
    const searchInsights = structuredSearchContext.length > 10000
      ? await extractKeyInsightsFromSearchResults(structuredSearchContext, originalQuery)
      : structuredSearchContext;
    
    // Make a more explicit prompt to use all data sources
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are creating a comprehensive research report that synthesizes information from multiple sources.
                    Your task is to integrate ALL available evidence into a cohesive, well-structured report.
                    
                    IMPORTANT REQUIREMENTS:
                    1. Include insights from BOTH knowledge graph data AND web search results
                    2. Cite specific sources where appropriate
                    3. Present information in a structured, logical flow
                    4. Include a summary of key findings at the beginning
                    5. Address contradictions or gaps in the evidence
                    6. Use appropriate headings and organization
                    7. Include a "References" section at the end that ONLY lists web sources
                    8. DO NOT include reasoning chains or knowledge graph sources in the References section
                    9. Format the References section with proper academic citations`
        },
        {
          role: "user",
          content: `RESEARCH QUESTION: "${originalQuery}"
                    
                    PRELIMINARY FINDINGS FROM SUB-QUESTIONS:
                    ${combinedResults}
                    
                    REASONING AND ANALYSIS:
                    ${reasoningContext}
                    
                    EVIDENCE FROM RESEARCH SOURCES:
                    ${searchInsights}
                    
                    WEB REFERENCES TO INCLUDE:
                    ${referencesSection}
                    
                    Please create a comprehensive research report that thoroughly answers the main question.
                    Your report should synthesize all the information provided above, with special attention
                    to the evidence from knowledge graph and web search results.
                    
                    IMPORTANT: Add a "References" section at the end that ONLY includes the web sources.
                    DO NOT include reasoning chains or knowledge graph sources in the References section.
                    Use the provided web references for the References section.`
        }
      ]
    });
    
    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error synthesizing final result:", error);
    return `I investigated "${originalQuery}" but encountered an error synthesizing the final result. Here are the partial findings:\n\n${combinedResults}`;
  }
}

/**
 * Helper function to extract key insights when search results are too large
 */
async function extractKeyInsightsFromSearchResults(searchResults: string, originalQuery: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Extract and summarize the most relevant information from these search results."
        },
        {
          role: "user",
          content: `For the research question: "${originalQuery}"
                    
                    Extract the most important facts, evidence, and insights from these search results:
                    
                    ${searchResults.substring(0, 20000)}
                    
                    Organize your summary by sub-question and source type. Preserve specific evidence and findings
                    that will be valuable for creating a comprehensive research report.`
        }
      ]
    });
    
    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error extracting key insights from search results:", error);
    return "Failed to extract key insights from search results.";
  }
}

/**
 * Extract key points from long reasoning chains
 */
async function extractKeyPointsFromReasoning(reasoningChains: string[]): Promise<string> {
  try {
    // Join the first part of each reasoning chain
    const truncatedChains = reasoningChains.map(chain => 
      chain.substring(0, Math.min(1500, chain.length))
    ).join('\n\n---\n\n');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Extract the key points and most important insights from these reasoning chains."
        },
        {
          role: "user",
          content: `Extract only the most important 5-10 insights from these reasoning chains:
                    
                    ${truncatedChains}
                    
                    Provide just the key points in a concise format.`
        }
      ]
    });
    
    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error extracting key points:", error);
    return "Error extracting key points from reasoning chains.";
  }
} 