import { createDataStream, streamText } from 'ai';
import type { CoreUserMessage, CoreSystemMessage, CoreAssistantMessage, CoreToolMessage } from 'ai';
import { nanoid } from 'nanoid';
import { semanticRetrieval } from '../tools/semanticRetrieval';
import { extractGraphNodes } from '../tools/extractGraphNodes';
import { processReasoningTokens } from '../tools/processReasoningTokens';
import OpenAI from 'openai';
import { openai as aiSdkOpenai } from '@ai-sdk/openai';
import { z } from 'zod';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Models for orchestration
const DEFAULT_STANDARD_MODEL = 'gpt-4o';
const DEFAULT_REASONING_MODEL = 'claude-3-7-sonnet-20250219';

interface ResearchOrchestratorOptions {
  query: string;
  userId?: string;
  chatId?: string;
  maxSteps?: number;
  maxSubQueries?: number;
  standardModel?: string;
  reasoningModel?: string;
  shouldStreamReasoningTokens?: boolean;
}

/**
 * Orchestrates deep research across multiple sub-queries 
 * with knowledge graph and web search integration
 */
export class ResearchOrchestrator {
  private query: string;
  private userId?: string;
  private chatId?: string;
  private maxSteps: number;
  private maxSubQueries: number;
  private standardModel: string;
  private reasoningModel: string;
  public shouldStreamReasoningTokens: boolean;
  private subQueries: string[] = [];
  private finalResults: string[] = [];
  private researchProgress: number = 0;
  private streamOptions: any = {}; // Using any for stream options
  private tools: Record<string, any> = {};
  private finalResponse: string = '';
  
  constructor({
    query,
    userId,
    chatId,
    maxSteps = 5,
    maxSubQueries = 3,
    standardModel = DEFAULT_STANDARD_MODEL,
    reasoningModel = DEFAULT_REASONING_MODEL,
    shouldStreamReasoningTokens = true,
  }: ResearchOrchestratorOptions) {
    this.query = query;
    this.userId = userId;
    this.chatId = chatId;
    this.maxSteps = maxSteps;
    this.maxSubQueries = maxSubQueries;
    this.standardModel = standardModel;
    this.reasoningModel = reasoningModel;
    this.shouldStreamReasoningTokens = shouldStreamReasoningTokens;
  }
  
  /**
   * Main entry point to conduct research
   * @param dataStream - The data stream to write results to
   */
  async conductResearch(dataStream: any) {
    try {
      // Update status to show we're starting research
      dataStream.writeData({
        type: 'researchProgress',
        status: "Beginning deep research...",
        percentage: 0
      });
      
      // 1. Get all tools
      await this.initializeTools();
      
      // 2. Generate clarification questions if needed
      const shouldClarify = await this.shouldAskClarificationQuestions();
      
      if (shouldClarify) {
        // Since we can't directly ask questions in this flow, we'll add context to the dataStream
        dataStream.writeData({
          type: 'researchProgress',
          status: "This query would benefit from clarification, but we'll proceed with best assumptions",
          percentage: 5
        });
      }
      
      // 3. Break down research query into sub-queries
      await this.generateSubQueries();
      dataStream.writeData({
        type: 'researchProgress',
        status: `Breaking down research into ${this.subQueries.length} sub-queries`,
        percentage: 10
      });
      
      // 4. Process each sub-query
      const totalSubQueries = this.subQueries.length;
      for (let i = 0; i < totalSubQueries; i++) {
        const subQuery = this.subQueries[i];
        
        // Update progress
        dataStream.writeData({
          type: 'researchProgress',
          status: `Processing sub-query ${i + 1}/${totalSubQueries}: ${subQuery.substring(0, 50)}...`,
          percentage: 10 + Math.floor((i / totalSubQueries) * 70)
        });
        
        // 4a. Retrieve context from graph and web
        const combinedContext = await this.retrieveContext(subQuery);
        
        // 4b. Process with reasoning model
        const reasoningResult = await this.processWithReasoningModel(subQuery, combinedContext);
        
        // 4c. Store results and process reasoning
        this.finalResults.push(reasoningResult.response);
        await this.processReasoning(reasoningResult.reasoning, subQuery);
        
        // 4d. Write partial results to stream
        dataStream.writeData({
          type: 'partialResult',
          subQuery,
          result: reasoningResult.response
        });
        
        if (this.shouldStreamReasoningTokens && reasoningResult.reasoning) {
          dataStream.writeData({
            type: 'reasoning',
            subQuery,
            reasoning: reasoningResult.reasoning
          });
        }
      }
      
      // 5. Synthesize the final response
      dataStream.writeData({
        type: 'researchProgress',
        status: "Synthesizing final research results...",
        percentage: 80
      });
      
      this.finalResponse = await this.synthesizeFinalResponse();
      
      // 6. Complete the research
      dataStream.writeData({
        type: 'researchProgress',
        status: "Research complete",
        percentage: 100
      });
      
      // 7. Write final result
      dataStream.writeData({
        type: 'finalResult',
        result: this.finalResponse
      });
    } catch (error) {
      console.error("Research orchestration error:", error);
      dataStream.writeData({
        type: 'error',
        message: `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Get the final synthesized response
   */
  async getFinalResponse(): Promise<string> {
    return this.finalResponse;
  }
  
  /**
   * Initialize all tools needed for research
   */
  private async initializeTools() {
    try {
      // Setup default tools
      this.tools = {
        semanticRetrieval,
        extractGraphNodes,
        processReasoningTokens,
      };
      
      // We're not using MCP tools - rely on AI SDK's built-in capabilities
      
    } catch (error) {
      console.error("Failed to initialize tools:", error);
      throw new Error(`Tool initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Determine if clarification questions should be asked
   */
  private async shouldAskClarificationQuestions(): Promise<boolean> {
    try {
      const response = await openai.chat.completions.create({
        model: this.standardModel,
        messages: [
          {
            role: 'system',
            content: `You are a research assistant evaluating if a research query is clear and specific enough. 
            Determine if clarifying questions would significantly improve the quality of research on this topic.
            Consider if the query:
            1. Has clear scope and boundaries
            2. Has specific metrics or criteria for evaluation
            3. Makes clear what type of evidence would be relevant
            4. Is free from ambiguous terms or concepts
            
            Respond with "true" ONLY if clarification would significantly improve research quality. Otherwise respond with "false".`
          },
          {
            role: 'user',
            content: this.query
          }
        ] as Array<OpenAI.ChatCompletionMessageParam>,
        temperature: 0.1,
      });
      
      const needsClarification = response.choices[0].message.content?.toLowerCase().includes('true');
      return needsClarification || false;
    } catch (error) {
      console.error("Error determining if clarification needed:", error);
      return false; // Default to not asking clarification
    }
  }
  
  /**
   * Generate appropriate sub-queries for the main research query
   */
  private async generateSubQueries() {
    try {
      const response = await openai.chat.completions.create({
        model: this.standardModel,
        messages: [
          {
            role: 'system',
            content: `You are a research planner breaking down complex queries into focused sub-queries.
            For the given research query, generate ${this.maxSubQueries} sub-queries that:
            1. Cover distinct but complementary aspects of the main query
            2. Are specific and well-scoped
            3. Together provide comprehensive coverage of the main question
            4. Are phrased as direct questions
            
            Format your response as a JSON array of strings containing only the sub-queries.`
          },
          {
            role: 'user',
            content: this.query
          }
        ] as Array<OpenAI.ChatCompletionMessageParam>,
        response_format: { type: "json_object" },
        temperature: 0.7,
      });
      
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Failed to generate sub-queries - empty response");
      }
      
      const parsed = JSON.parse(content);
      
      if (!parsed.subQueries || !Array.isArray(parsed.subQueries)) {
        // Try to extract from the general response if not formatted correctly
        this.subQueries = Object.values(parsed).flat().filter(q => typeof q === 'string');
      } else {
        this.subQueries = parsed.subQueries;
      }
      
      // Ensure we have at least one sub-query
      if (this.subQueries.length === 0) {
        this.subQueries = [this.query]; // Use main query as fallback
      }
      
      // Cap to max sub-queries
      this.subQueries = this.subQueries.slice(0, this.maxSubQueries);
      
    } catch (error) {
      console.error("Error generating sub-queries:", error);
      // Fallback: use the main query as the only sub-query
      this.subQueries = [this.query];
    }
  }
  
  /**
   * Retrieve context from both knowledge graph and web search
   */
  private async retrieveContext(subQuery: string): Promise<string> {
    try {
      // First, try to retrieve data from the knowledge graph
      let graphResults = "";
      try {
        const retrievalResult = await this.tools.semanticRetrieval.execute({
          queryText: subQuery,
          limit: 5,
          nodeTypes: ['Thought', 'ReasoningChain', 'Person', 'Concept', 'Entity', 'Proposition']
        });
        
        if (retrievalResult && Array.isArray(retrievalResult) && retrievalResult.length > 0) {
          graphResults = "From knowledge graph:\n" + 
            retrievalResult.map(item => {
              const nodeType = item.nodeType || 'Unknown';
              const name = item.name || 'Unnamed';
              const content = item.thoughtContent || item.definition || item.description || item.statement || item.conclusion || '';
              const score = item.similarityScore ? `(Relevance: ${(item.similarityScore * 100).toFixed(1)}%)` : '';
              
              return `- ${nodeType}: "${name}" ${score}\n  ${content}\n`;
            }).join('\n') + '\n\n';
        }
      } catch (error) {
        console.warn("Error accessing knowledge graph:", error);
      }
      
      // Then, use OpenAI Responses API for web search
      let webResults = "";
      try {
        // Use the streamText function with AI SDK's openai.responses
        const responseStream = await streamText({
          model: aiSdkOpenai.responses(this.standardModel),
          messages: [
            {
              role: 'system',
              content: `You are a research assistant helping to find relevant information for a specific research question.
              For the given query, provide relevant factual information from reliable sources.
              Be comprehensive but focused on providing quality information that directly addresses the query.
              Use web search to find up-to-date information.`
            },
            { 
              role: 'user', 
              content: `Research question: "${subQuery}"\n\nPlease search the web for relevant information on this topic.` 
            }
          ],
          maxSteps: 3,
          tools: {
            web_search_preview: aiSdkOpenai.tools.webSearchPreview()
          },
          toolChoice: { type: 'tool', toolName: 'web_search_preview' }
        });
        
        // The response includes the generated text
        const responseContent = responseStream.text || '';
        webResults = "From web search:\n" + responseContent + "\n\n";
        
        // Sources are available as a promise in sourceDocuments
        try {
          const sources = await responseStream.sources;
          if (sources && sources.length > 0) {
            webResults += "Sources:\n" + 
              sources.map((source, index) => 
                `[${index + 1}] ${source.title || ''} - ${source.url || ''}`
              ).join('\n') + '\n\n';
          }
        } catch (error) {
          console.warn("Error accessing sources:", error);
        }
      } catch (error) {
        console.warn("Error using OpenAI Responses API for web search:", error);
      }
      
      // Combine results, with web search first (usually more up-to-date)
      const combinedResults = webResults + graphResults;
      
      return combinedResults || "No relevant context found.";
    } catch (error) {
      console.error("Error retrieving context:", error);
      return "Context retrieval failed. Proceeding with limited information.";
    }
  }
  
  /**
   * Process sub-query and context with reasoning model
   */
  private async processWithReasoningModel(
    subQuery: string, 
    context: string
  ): Promise<{ response: string; reasoning: string }> {
    try {
      // Create a request to run reasoning model 
      const messages: Array<OpenAI.ChatCompletionMessageParam> = [
        { 
          role: 'system', 
          content: `You are a research assistant analyzing information to answer focused research questions.
          
          For the given sub-query, analyze the provided context from both knowledge graph and web search.
          Synthesize the information to provide:
          1. A comprehensive answer to the sub-query
          2. Analysis of how different sources complement or contradict each other
          3. Any limitations or gaps in the available information
          
          In addition to your answer, provide your detailed reasoning process as you analyze the information.`
        },
        {
          role: 'user',
          content: `Research Sub-Query: ${subQuery}
          
          Available Context:
          ${context}`
        }
      ];
      
      // Execute with reasoning model
      const response = await openai.chat.completions.create({
        model: this.reasoningModel,
        messages,
        temperature: 0.7,
      });
      
      const content = response.choices[0].message.content || "";
      
      // Extract reasoning and answer from structured response
      const reasoningMatch = content.match(/REASONING:([\s\S]*?)(?=ANSWER:|$)/i);
      const answerMatch = content.match(/ANSWER:([\s\S]*?)$/i);
      
      const reasoning = reasoningMatch ? reasoningMatch[1].trim() : "";
      const answer = answerMatch ? answerMatch[1].trim() : content;
      
      return { response: answer, reasoning };
    } catch (error) {
      console.error("Error processing with reasoning model:", error);
      return { 
        response: `Processing error: Unable to process this sub-query due to an error.`, 
        reasoning: "" 
      };
    }
  }
  
  /**
   * Process reasoning tokens into knowledge graph
   */
  private async processReasoning(reasoning: string, queryContext: string) {
    if (!reasoning || reasoning.trim() === '') return;
    
    try {
      await processReasoningTokens.execute({ 
        reasoning, 
        messageId: nanoid(), 
        queryContext,
        processInBackground: true
      });
    } catch (error) {
      console.error("Error processing reasoning:", error);
    }
  }
  
  /**
   * Synthesize final response from all sub-query results
   */
  private async synthesizeFinalResponse(): Promise<string> {
    try {
      // If only one result, return it directly
      if (this.finalResults.length === 1) {
        return this.finalResults[0];
      }
      
      // For multiple results, synthesize them
      const response = await openai.chat.completions.create({
        model: this.standardModel,
        messages: [
          {
            role: 'system',
            content: `You are a research synthesizer combining multiple research findings into a cohesive, comprehensive answer. Your synthesis should:
            1. Integrate all key insights from the individual findings
            2. Resolve any contradictions or tensions between findings
            3. Present a holistic view of the research question
            4. Be well-structured and readable
            5. Acknowledge any remaining uncertainties or areas for further research
            
            Focus on creating value through synthesis rather than merely combining text.`
          },
          {
            role: 'user',
            content: `MAIN RESEARCH QUESTION: ${this.query}\n\nFINDINGS FROM SUB-QUERIES:\n\n${this.finalResults.map((r, i) => `FINDING ${i+1}:\n${r}`).join('\n\n')}`
          }
        ] as Array<OpenAI.ChatCompletionMessageParam>,
        temperature: 0.7,
      });
      
      return response.choices[0].message.content || "Synthesis failed.";
    } catch (error) {
      console.error("Error synthesizing final response:", error);
      // Fallback: concatenate all results with headers
      return `# Research Findings on: ${this.query}\n\n` + 
        this.finalResults.map((r, i) => `## Finding ${i+1}\n${r}`).join('\n\n');
    }
  }
}