import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { semanticRetrieval } from '@/lib/ai/tools/semanticRetrieval';
import { getEmbeddingForText } from '@/lib/ai/embeddings';
import { getNeo4jDriver, neo4j } from '@/lib/neo4j/driver';

// Mock the dependencies
vi.mock('@/lib/ai/embeddings', () => ({
  getEmbeddingForText: vi.fn()
}));

vi.mock('@/lib/neo4j/driver', () => {
  const mockSession = {
    run: vi.fn(),
    close: vi.fn()
  };
  
  return {
    neo4j: {
      session: {
        READ: 'READ'
      },
      int: (num: number) => num
    },
    getNeo4jDriver: vi.fn().mockReturnValue({
      session: vi.fn().mockReturnValue(mockSession)
    })
  };
});

describe('semanticRetrieval tool', () => {
  const mockEmbedding = Array(3072).fill(0.1);
  const mockSession = getNeo4jDriver().session();
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup mocks for each test
    (getEmbeddingForText as any).mockResolvedValue(mockEmbedding);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call getEmbeddingForText with the query text', async () => {
    // Mock the Neo4j response
    const mockRecords = [{ 
      get: (key: string) => {
        if (key === 'node') return { 
          properties: { 
            id: 'test-id', 
            name: 'Test Node',
            thoughtContent: 'Test content',
            confidence: 0.9
          }
        };
        if (key === 'score') return 0.95;
        if (key === 'nodeType') return 'Thought';
        return null;
      }
    }];
    
    (mockSession.run as any).mockResolvedValue({ records: mockRecords });

    // Execute the tool
    await semanticRetrieval.execute({
      queryText: 'test query',
      nodeTypes: ['Thought'],
      limit: 5
    });

    // Verify getEmbeddingForText was called with the query text
    expect(getEmbeddingForText).toHaveBeenCalledWith('test query');
  });

  it('should run the correct Cypher query with the embedding', async () => {
    // Mock the Neo4j response
    const mockRecords = [{ 
      get: (key: string) => {
        if (key === 'node') return { 
          properties: { 
            id: 'test-id', 
            name: 'Test Node',
            thoughtContent: 'Test content',
            confidence: 0.9
          }
        };
        if (key === 'score') return 0.95;
        if (key === 'nodeType') return 'Thought';
        return null;
      }
    }];
    
    (mockSession.run as any).mockResolvedValue({ records: mockRecords });

    // Execute the tool
    await semanticRetrieval.execute({
      queryText: 'test query',
      nodeTypes: ['Thought'],
      limit: 5
    });

    // Verify the right Cypher query is executed
    expect(mockSession.run).toHaveBeenCalled();
    const callArgs = (mockSession.run as any).mock.calls[0];
    expect(callArgs[0]).toContain('db.index.vector.queryNodes');
    expect(callArgs[0]).toContain('thought-embeddings');
    expect(callArgs[1]).toEqual({
      embedding: mockEmbedding,
      limit: 5,
      finalLimit: 5
    });
  });

  it('should return properly formatted semantic search results', async () => {
    // Mock the Neo4j response for different node types
    const mockRecords = [
      { 
        get: (key: string) => {
          if (key === 'node') return { 
            properties: { 
              id: 'thought-1', 
              name: 'Test Thought',
              thoughtContent: 'Test thought content',
              confidence: 0.9
            }
          };
          if (key === 'score') return 0.95;
          if (key === 'nodeType') return 'Thought';
          return null;
        }
      },
      { 
        get: (key: string) => {
          if (key === 'node') return { 
            properties: { 
              id: 'concept-1', 
              name: 'Test Concept',
              definition: 'Test definition',
              domain: 'Test domain'
            }
          };
          if (key === 'score') return 0.85;
          if (key === 'nodeType') return 'Concept';
          return null;
        }
      }
    ];
    
    (mockSession.run as any).mockResolvedValue({ records: mockRecords });

    // Execute the tool
    const results = await semanticRetrieval.execute({
      queryText: 'test query',
      nodeTypes: ['Thought', 'Concept'],
      limit: 5
    });

    // Verify the results are properly formatted
    expect(results).toHaveLength(2);
    
    // Check the Thought result
    expect(results[0]).toEqual({
      id: 'thought-1',
      name: 'Test Thought',
      nodeType: 'Thought',
      similarityScore: 0.95,
      thoughtContent: 'Test thought content',
      confidence: 0.9
    });
    
    // Check the Concept result
    expect(results[1]).toEqual({
      id: 'concept-1',
      name: 'Test Concept',
      nodeType: 'Concept',
      similarityScore: 0.85,
      definition: 'Test definition',
      domain: 'Test domain'
    });
  });

  it('should handle errors properly', async () => {
    // Mock a failure in the Neo4j query
    (mockSession.run as any).mockRejectedValue(new Error('Database error'));

    // Execute the tool and expect it to throw
    await expect(semanticRetrieval.execute({
      queryText: 'test query',
      nodeTypes: ['Thought'],
      limit: 5
    })).rejects.toThrow('Failed to retrieve semantic nodes: Database error');

    // Verify session is closed even when there's an error
    expect(mockSession.close).toHaveBeenCalled();
  });
}); 