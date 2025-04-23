import {
  UIMessage,
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
  ToolInvocation,
  TextPart,
  StreamData,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
  saveDocument,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '@/lib/actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { semanticRetrieval } from '@/lib/ai/tools/semanticRetrieval';
import { extractGraphNodes } from '@/lib/ai/tools/extractGraphNodes';
import { processReasoningTokens } from '@/lib/ai/tools/processReasoningTokens';
import { deepResearch, DeepResearchResult } from '@/lib/ai/tools/deepResearch';
import { documentHandlersByArtifactKind } from '@/lib/artifacts/server';

// Increase maximum duration for Go Deep mode
export const maxDuration = 300; // 5 minutes

// Define the shape of tool responses with reasoning
interface ToolResponseWithReasoning {
  reasoning?: string;
  [key: string]: any;
}

// Extend DataStreamOptions to include our custom flag
interface ExtendedDataStreamOptions {
  sendReasoning: boolean;
  metadata?: Record<string, any>;
}

// Define custom stream data for deep research mode
interface DeepResearchStreamData extends StreamData {
  response?: string;
  reasoning?: string;
}

// Define the structure for onFinish callback parameters
interface OnFinishResult {
  response: {
    messages: Array<any>;
    toolResponses?: ToolResponseWithReasoning[];
  };
  reasoning?: string;
}

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
      chatId,
    }: {
      id: string;
      messages: Array<UIMessage>;
      selectedChatModel: string;
      chatId: string;
    } = await request.json();

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message: userMessage,
      });

      await saveChat({ id, userId: session.user.id, title });
    } else {
      if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: userMessage.id,
          role: 'user',
          parts: userMessage.parts,
          attachments: userMessage.experimental_attachments ?? [],
          createdAt: new Date(),
        },
      ],
    });

    return createDataStreamResponse({
      execute: (dataStream) => {
        // Determine which mode we're using
        const isGoDeepMode = selectedChatModel === 'deep-research-mode';
        const isWanderMode = selectedChatModel === 'wander-mode';

        // Configure maximum tool steps based on selected mode
        const maxSteps = isGoDeepMode ? 10 : 3;

        // Extract user's query from message
        let userQuery = "";
        if (typeof userMessage.content === 'string') {
          userQuery = userMessage.content;
        } else if (userMessage.parts && userMessage.parts.length > 0) {
          const textPart = userMessage.parts.find(part => 
            (part as TextPart).type === 'text' && (part as TextPart).text
          ) as TextPart | undefined;
          
          if (textPart) {
            userQuery = textPart.text ?? "";
          }
        }

        // Configure tools - for Go Deep mode, use enhanced document creation
        const availableTools = {
          getWeather,
          createDocument: isGoDeepMode 
            ? createDocument({ 
                session, 
                dataStream, 
                enhanceWithDeepResearch: true  // Enable deep research for document creation
              })
            : createDocument({ session, dataStream }),
          updateDocument: updateDocument({ session, dataStream }),
          requestSuggestions: requestSuggestions({
            session,
            dataStream,
          }),
          semanticRetrieval,
          extractGraphNodes,
          processReasoningTokens,
          deepResearch,
        };

        // Tool names for experimental_activeTools
        type ToolNames = keyof typeof availableTools;
        const toolNames = Object.keys(availableTools) as ToolNames[];

        // For Go Deep mode, we'll explicitly call deepResearch right away
        // with the user's query, but we need to handle it specially
        let deepResearchPromise: Promise<DeepResearchResult> | null = null;
        let deepResearchInProgress = false;

        if (isGoDeepMode && userQuery) {
          // Start deep research to run in parallel
          deepResearchInProgress = true;
          deepResearchPromise = deepResearch.execute({
            query: userQuery,
            maxSteps,
            chatId,
          }).catch(error => {
            console.error("Deep research failed:", error);
            return {
              result: `I encountered an issue while conducting deep research: ${error.message}`,
              reasoningChains: [],
              graphResults: [],
              webResults: []
            };
          });
        }

        // Define a special system prompt for deep research mode
        let systemInstructions = systemPrompt({ selectedChatModel });

        // If in deep research mode, add a specific instruction to wait for research results
        if (isGoDeepMode) {
          systemInstructions = `${systemInstructions}

IMPORTANT: I am currently conducting deep research on your query. Please wait for the research to complete before making any tool calls or providing detailed responses. 
You should:
1. Acknowledge the query
2. Indicate that deep research is being conducted 
3. DO NOT call any tools until the research is complete
4. Wait for the research results to be provided before giving a detailed response

Once research is complete, you'll receive the results and can then use the createDocument tool if appropriate.`;
        }

        const streamConfig = {
          model: myProvider.languageModel(selectedChatModel),
          system: systemInstructions,
          messages,
          maxSteps,
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          experimental_activeTools: isGoDeepMode 
            ? deepResearchInProgress ? [] : ['createDocument'] // Only enable document creation after research completes
            : toolNames, // For Wander mode, use all tools in background
          tools: availableTools,
          onFinish: async (result: OnFinishResult) => {
            if (session.user?.id) {
              try {
                const assistantId = getTrailingMessageId({
                  messages: result.response.messages.filter(
                    (message) => message.role === 'assistant',
                  ),
                });

                if (!assistantId) {
                  throw new Error('No assistant message found!');
                }

                const [, assistantMessage] = appendResponseMessages({
                  messages: [userMessage],
                  responseMessages: result.response.messages,
                });

                await saveMessages({
                  messages: [
                    {
                      id: assistantId,
                      chatId: id,
                      role: assistantMessage.role,
                      parts: assistantMessage.parts,
                      attachments:
                        assistantMessage.experimental_attachments ?? [],
                      createdAt: new Date(),
                    },
                  ],
                });

                // Process reasoning tokens from tool responses if available
                // @ts-ignore - response may include toolResponses with reasoning
                const toolResponses = result.response.toolResponses as ToolResponseWithReasoning[] || [];
                let reasoningText = toolResponses.find(tr => tr?.reasoning)?.reasoning || result.reasoning;
                
                // For Go Deep mode, use the reasoning chains from the deepResearch execution
                if (isGoDeepMode && deepResearchPromise) {
                  try {
                    const deepResearchResult = await deepResearchPromise;
                    reasoningText = deepResearchResult.reasoningChains.join('\n\n');
                    
                    // Create artifact from research results if not already created via tools
                    const toolCallsContainDocumentCreation = result.response.messages.some(msg => {
                      if (msg.role !== 'assistant') return false;
                      // Check for tool calls that created documents
                      if (!msg.tool_calls) return false;
                      return msg.tool_calls.some((call: any) => 
                        call.function?.name === 'createDocument'
                      );
                    });
                    
                    // If document wasn't created via tool call, create it here automatically
                    if (!toolCallsContainDocumentCreation) {
                      const artifactId = generateUUID();
                      const artifactTitle = `Research Report: ${userQuery.substring(0, 50)}`;
                      
                      try {
                        // Format the research result with sources
                        const formattedContent = `${deepResearchResult.result}
`;
                        
                        // Save document directly using the db query
                        await saveDocument({
                          id: artifactId,
                          title: artifactTitle,
                          content: formattedContent,
                          kind: 'text',
                          userId: session.user.id,
                        });
                        
                        // Instead of sending text deltas that duplicate content in the chat,
                        // just send a reference message to the artifact
                        dataStream.writeData({
                          type: 'text-delta',
                          content: 'I\'ve created a detailed research report based on your query. You can view it in the artifacts panel.',
                        });
                        
                        // Notify client about new artifact
                        dataStream.writeData({
                          type: 'artifact',
                          content: {
                            id: artifactId,
                            title: artifactTitle,
                            kind: 'text',
                            createdAt: new Date().toISOString()
                          }
                        });
                      } catch (error) {
                        console.error("Failed to create artifact from research results:", error);
                      }
                    }
                  } catch (error) {
                    console.error("Failed to get deep research reasoning or create artifact:", error);
                  }
                }
                
                if (reasoningText) {
                  try {
                    // Process tokens differently based on mode:
                    // - In Go Deep mode: Process synchronously and more thoroughly
                    // - In Wander mode: Process in background with lighter processing
                    await processReasoningTokens.execute({
                      reasoning: reasoningText,
                      messageId: assistantId,
                      queryContext: userQuery || "Research query",
                      processInBackground: isWanderMode, // Only process in background for Wander mode
                    });
                  } catch (error) {
                    console.error("Failed to process reasoning tokens:", error);
                  }
                }
              } catch (error) {
                console.error('Failed to save chat:', error);
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        };
        
        // For Go Deep mode, we need to intercept the stream to inject our deep research results
        // Use a type assertion to avoid type compatibility issues with experimental_transform
        const result = streamText(streamConfig as any);

        // Handle special processing for Go Deep mode
        if (isGoDeepMode && deepResearchPromise) {
          // Wait for deep research to complete and then push results to the stream
          deepResearchPromise.then(deepResearchResult => {
            // Signal that research is complete and tools can now be used
            deepResearchInProgress = false;
            
            // Send research completion notification to the client
            dataStream.writeData({
              type: 'researchComplete',
              content: 'Research complete. You can now use the results to create a document.'
            });
            
            // Send the research results to the client
            dataStream.writeData({
              type: 'text-delta',
              content: `\n\nResearch complete. Here are the key findings:\n\n${deepResearchResult.result.substring(0, 500)}...`
            });

            // Send a system message that can be used by the model
            dataStream.writeData({
              type: 'system-message',
              content: {
                role: "system",
                content: `Research complete. You may now use the createDocument tool to create a document summarizing the research.`
              }
            });
            
            // In deep research mode, we don't need to merge results again since we already
            // handle it in the onFinish callback with the artifact creation.
            // We'll just use this to update metadata if needed.
            if (result.mergeIntoDataStream) {
              const streamOptions: ExtendedDataStreamOptions = {
                sendReasoning: true,
                metadata: {
                  isGoDeepMode: true,
                  reasoning: deepResearchResult.reasoningChains.join('\n\n'),
                  researchComplete: true,
                  researchResults: deepResearchResult.result
                }
              };
              
              // @ts-ignore - We're extending the data stream options
              result.mergeIntoDataStream(dataStream, streamOptions);
            }
            
            // Since we can't dynamically update the tools, let's create a new document automatically
            // We don't have access to messages through result.response, so just create the document directly
            const artifactId = generateUUID();
            const artifactTitle = `Research Report: ${userQuery.substring(0, 50)}`;
            
            try {
              // Format the research result with sources
              const formattedContent = `${deepResearchResult.result}`;
              
              // Save document directly using the db query
              if (session.user?.id) {
                saveDocument({
                  id: artifactId,
                  title: artifactTitle,
                  content: formattedContent,
                  kind: 'text',
                  userId: session.user.id,
                }).then(() => {
                  // Notify client about new artifact
                  dataStream.writeData({
                    type: 'artifact',
                    content: {
                      id: artifactId,
                      title: artifactTitle,
                      kind: 'text',
                      createdAt: new Date().toISOString()
                    }
                  });
                });
              }
            } catch (error) {
              console.error("Failed to create artifact from research results:", error);
            }
          }).catch(error => {
            console.error("Failed to process deep research results:", error);
          });
        }

        result.consumeStream();

        // Always send reasoning tokens to the client, but with mode info in metadata
        const streamOptions: ExtendedDataStreamOptions = {
          sendReasoning: true,
          metadata: {
            isGoDeepMode: isGoDeepMode,
          }
        };
        
        // @ts-ignore - We're extending the data stream options
        result.mergeIntoDataStream(dataStream, streamOptions);
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });
  } catch (error) {
    console.error("Error in POST /api/chat:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: `An error occurred while processing your request: ${errorMessage}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request!', {
      status: 500,
    });
  }
}
