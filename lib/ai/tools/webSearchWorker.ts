import { z } from 'zod';
import OpenAI from 'openai';
import { generateText } from 'ai';
import { openai as aiSdkOpenai } from '@ai-sdk/openai';

// Initialize OpenAI client for direct API calls when needed
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface WebSearchWorkerParams {
  query: string;
  maxResults?: number;
  needsDetailedContent?: boolean;
}

/**
 * Web Search Worker
 * 
 * Performs web searches using OpenAI's web search tool from the Responses API
 * and formats the results for use in research.
 */
export const webSearchWorker = async ({
  query,
  maxResults = 5,
  needsDetailedContent = false
}: WebSearchWorkerParams): Promise<string> => {
  try {
    // Perform web search using the built-in OpenAI tool
    const searchResults = await performWebSearch(query, maxResults);
    
    // If detailed content is needed and we have search results with sources
    let detailedContent = "";
    if (needsDetailedContent && searchResults.sources && searchResults.sources.length > 0) {
      // Get more detailed information for top search results if needed
      detailedContent = await getDetailedContent(searchResults.sources.slice(0, 2), query);
    }
    
    // Combine search results with detailed content
    const combinedResults = `
    === Search Results ===
    ${searchResults.text}
    
    === Sources ===
    ${searchResults.formattedSources}
    
    === Citation References ===
    ${searchResults.formattedCitations}
    
    ${detailedContent ? `=== Detailed Content ===\n${detailedContent}` : ''}
    `;
    
    return combinedResults;
  } catch (error) {
    console.error("Web search failed:", error);
    return `Web search error: ${(error as Error).message}`;
  }
};

/**
 * Perform a web search using OpenAI's Responses API
 */
async function performWebSearch(query: string, maxResults: number) {
  try {
    // Use the AI SDK to perform a web search with the Responses API
    const result = await generateText({
      model: aiSdkOpenai.responses('gpt-4o-mini'),
      prompt: `Find up-to-date information about: ${query}`,
      tools: {
        web_search_preview: aiSdkOpenai.tools.webSearchPreview(),
      },
      temperature: 0
    });
    
    // Format sources for better readability
    const formattedSources = result.sources && result.sources.length > 0
      ? result.sources.slice(0, maxResults).map((source: any, index) => {
          // Access properties carefully with optional chaining
          return `[${index + 1}] ${source.title || 'No title'}
URL: ${source.url || '#'}
Snippet: ${source.snippet || 'No snippet available'}`;
        }).join('\n\n')
      : "No sources found.";
    
    // Format citations in academic format for references section
    const formattedCitations = result.sources && result.sources.length > 0
      ? result.sources.slice(0, maxResults).map((source: any, index) => {
          // Extract domain from URL for publisher info
          const url = source.url || '#';
          let domain = '';
          try {
            domain = new URL(url).hostname.replace('www.', '');
          } catch (e) {
            domain = url;
          }
          
          // Extract date info if available in the title or snippet
          const currentDate = new Date();
          const dateStr = `${currentDate.getFullYear()}, ${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getDate()}`;
          
          // Format as academic citation
          return `[${index + 1}] ${source.title || 'Untitled'}. (Retrieved ${dateStr}). ${domain.charAt(0).toUpperCase() + domain.slice(1)}. URL: ${url}`;
        }).join('\n\n')
      : "No citation references available.";
    
    return {
      text: result.text || "No search results found.",
      sources: result.sources || [],
      formattedSources,
      formattedCitations
    };
  } catch (error) {
    console.error("OpenAI web search failed:", error);
    return { 
      text: `Web search error: ${(error as Error).message}`,
      sources: [],
      formattedSources: "No sources available due to search error.",
      formattedCitations: "No citation references available."
    };
  }
}

/**
 * Get more detailed content about search results if needed
 */
async function getDetailedContent(sources: any[], originalQuery: string): Promise<string> {
  if (!sources || sources.length === 0) {
    return "No sources available for detailed content.";
  }
  
  try {
    // Use OpenAI to generate a detailed analysis of the search results
    // This is more reliable than scraping, which can often hit blocks/challenges
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a research assistant that provides detailed analysis of search results. Extract and organize the most important information from these sources related to the query."
        },
        {
          role: "user",
          content: `Analyze these search results for the query: "${originalQuery}"
          
Sources:
${sources.map((source: any, i) => 
  `[${i+1}] ${source.title || 'Untitled'}
   URL: ${source.url || '#'}
   Snippet: ${source.snippet || 'No snippet available'}`
).join('\n\n')}

Provide a detailed analysis extracting the most important information from these sources.
Focus on facts, data, and insights that directly answer the query.
If sources contradict each other, note this and explain the different perspectives.`
        }
      ]
    });
    
    return response.choices[0].message.content || "No detailed analysis could be generated.";
  } catch (error) {
    console.error("Detailed content analysis failed:", error);
    return `Analysis error: ${(error as Error).message}`;
  }
} 