export async function vectorSearch(
    neo4jDriver: Neo4jDriver, 
    queryEmbedding: number[],
    nodeType?: string,
    limit: number = 27,
    threshold: number = 0.75
  ): Promise<KnowledgeGraph> {
    // We'll use a hardcoded integer value (27) for Neo4j LIMIT clause
    const session = neo4jDriver.session();
    
    try {
      console.error(`Performing vector search`);
      
      // Verify that queryEmbedding is an array of numbers
      if (!Array.isArray(queryEmbedding)) {
        console.error(`Error: Query embedding is not an array. Current type: ${typeof queryEmbedding}`);
        throw new Error('Vector search requires an embedding vector (array of numbers)');
      }
      
      // Determine which index to use based on nodeType
      let indexToUse: string;
      
      if (nodeType) {
        // If node type is provided, use the corresponding index
        indexToUse = NODE_TYPE_TO_INDEX[nodeType] || 'entity-embeddings';
      } else {
        // If no node type provided, use all indexes and combine results
        return combinedVectorSearch(neo4jDriver, queryEmbedding, limit, threshold);
      }
      
      console.error(`Using vector index: ${indexToUse}`);
      
      // Execute vector search query
      const result = await session.executeRead(tx => tx.run(`
        // Search the vector index
        CALL db.index.vector.queryNodes($indexName, $limit, $queryEmbedding)
        YIELD node, score
        WHERE score >= $threshold
        
        // Get node properties
        WITH node, score
        
        // Get outgoing relationships
        OPTIONAL MATCH (node)-[outRel]->(connected)
        
        // Get incoming relationships
        OPTIONAL MATCH (other)-[inRel]->(node)
        
        // Return node with relationships and similarity score
        RETURN 
          node as entity, 
          collect(DISTINCT outRel) as relations, 
          collect(DISTINCT inRel) as inRelations,
          score
        ORDER BY score DESC
        LIMIT 27
      `, { 
        queryEmbedding,
        indexName: indexToUse,
        limit,
        threshold
      }));
      
      console.error(`Vector search found ${result.records.length} results`);
      return processSearchResults(result.records);
    } catch (error) {
      console.error(`Error in vector search: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }
  