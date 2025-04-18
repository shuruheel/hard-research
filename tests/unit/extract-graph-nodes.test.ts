import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractGraphNodes } from '@/lib/ai/tools/extractGraphNodes';
import { getNeo4jDriver } from '@/lib/neo4j/driver';
import OpenAI from 'openai';

// Mock dependencies
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    }))
  };
});

vi.mock('@/lib/neo4j/driver', () => {
  const mockSession = {
    run: vi.fn(),
    close: vi.fn()
  };
  
  return {
    getNeo4jDriver: vi.fn().mockReturnValue({
      session: vi.fn().mockReturnValue(mockSession)
    })
  };
});

describe('extractGraphNodes tool', () => {
  const mockSession = getNeo4jDriver().session();
  const mockOpenAI = new OpenAI({ apiKey: 'test-key' });
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock OpenAI response
    mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue({
      choices: [{
        message: {
          content: `
          \`\`\`json
          {
            "nodes": [
              {
                "id": "concept-1",
                "type": "Concept",
                "name": "Artificial Intelligence",
                "definition": "The simulation of human intelligence in machines"
              },
              {
                "id": "thought-1",
                "type": "Thought",
                "name": "AI Ethics Consideration",
                "thoughtContent": "We need to consider ethical implications of AI",
                "confidence": 0.9
              }
            ],
            "relationships": [
              {
                "source": "thought-1",
                "target": "concept-1",
                "type": "REFERS_TO"
              }
            ]
          }
          \`\`\`
          `
        }
      }]
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call OpenAI with the correct conversation text and system prompt', async () => {
    // Mock Neo4j response for successful node creation
    (mockSession.run as any).mockResolvedValue({ records: [] });
    
    // Create test messages
    const messages = [
      {
        id: 'msg1',
        role: 'user',
        content: 'Tell me about artificial intelligence'
      },
      {
        id: 'msg2',
        role: 'assistant',
        content: 'Artificial intelligence is the simulation of human intelligence in machines',
        parts: [
          {
            type: 'text',
            text: 'Artificial intelligence is the simulation of human intelligence in machines'
          }
        ]
      }
    ];

    // Execute the tool
    await extractGraphNodes.execute({
      messages,
      extractionDepth: 'standard'
    });

    // Verify OpenAI was called with appropriate content
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    const callArgs = (mockOpenAI.chat.completions.create as any).mock.calls[0][0];
    
    // Check model
    expect(callArgs.model).toBe('gpt-4o');
    
    // Check that system message contains schema information
    expect(callArgs.messages[0].role).toBe('system');
    expect(callArgs.messages[0].content).toContain('Entity');
    expect(callArgs.messages[0].content).toContain('Concept');
    expect(callArgs.messages[0].content).toContain('Thought');
    
    // Check that user message contains the conversation content
    expect(callArgs.messages[1].role).toBe('user');
    expect(callArgs.messages[1].content).toContain('USER: Tell me about artificial intelligence');
    expect(callArgs.messages[1].content).toContain('ASSISTANT: Artificial intelligence is the simulation');
  });

  it('should properly extract reasoning chains from reasoning tokens', async () => {
    // Mock Neo4j response
    (mockSession.run as any).mockResolvedValue({ records: [] });
    
    // Create test messages with reasoning tokens
    const messages = [
      {
        id: 'msg1',
        role: 'user',
        content: 'What is the ethical impact of AI?'
      },
      {
        id: 'msg2',
        role: 'assistant',
        content: 'AI ethics is a complex topic',
        parts: [
          {
            type: 'reasoning',
            reasoning: 'Step 1: Identify key ethical concerns\n\nStep 2: Consider implications for society'
          },
          {
            type: 'text',
            text: 'AI ethics is a complex topic'
          }
        ]
      }
    ];

    // Execute the tool
    await extractGraphNodes.execute({
      messages,
      extractionDepth: 'standard'
    });

    // The reasoning extraction should be reflected in Neo4j calls
    // We should see attempts to create nodes for the reasoning chain and steps
    const allCalls = (mockSession.run as any).mock.calls;
    
    // Find calls that create ReasoningChain or ReasoningStep nodes
    const reasoningCalls = allCalls.filter((call: any[]) => {
      const query = call[0];
      return query.includes('ReasoningChain') || query.includes('ReasoningStep');
    });
    
    // Should have at least some calls creating reasoning nodes
    expect(reasoningCalls.length).toBeGreaterThan(0);
  });

  it('should save extracted nodes and relationships to Neo4j', async () => {
    // Mock Neo4j response
    (mockSession.run as any).mockResolvedValue({ records: [] });
    
    // Create test messages
    const messages = [
      {
        id: 'msg1',
        role: 'user',
        content: 'Tell me about AI'
      }
    ];

    // Execute the tool
    const result = await extractGraphNodes.execute({
      messages,
      extractionDepth: 'standard'
    });

    // Verify Neo4j session was used
    expect(mockSession.run).toHaveBeenCalled();
    
    // Verify all database calls have completed
    expect(mockSession.close).toHaveBeenCalled();
    
    // Check that nodes were created
    expect(result.success).toBe(true);
    expect(result.nodesCreated).toBeDefined();
    expect(result.summary).toContain('Extracted');
  });

  it('should handle errors gracefully', async () => {
    // Mock a failure in OpenAI
    (mockOpenAI.chat.completions.create as any).mockRejectedValue(
      new Error('OpenAI API error')
    );
    
    // Create test messages
    const messages = [
      {
        id: 'msg1',
        role: 'user',
        content: 'Tell me about AI'
      }
    ];

    // Execute the tool and expect it to throw
    await expect(extractGraphNodes.execute({
      messages,
      extractionDepth: 'standard'
    })).rejects.toThrow('Failed to extract graph nodes');
  });
}); 