import { getNeo4jDriver, neo4j } from './driver';
import { getEmbeddingForText } from '../ai/embeddings';

/**
 * Get reasoning chain and steps for a specific message
 */
export async function getReasoningForMessage(messageId: string) {
  const session = getNeo4jDriver().session();
  
  try {
    const result = await session.run(`
      MATCH (rc:ReasoningChain {messageId: $messageId})
      OPTIONAL MATCH (rc)-[:HAS_STEP]->(rs:ReasoningStep)
      RETURN rc, rs
      ORDER BY rs.order
    `, { messageId });
    
    if (result.records.length === 0) {
      return null;
    }
    
    const chain = result.records[0].get('rc').properties;
    const steps = result.records
      .filter(record => record.get('rs'))
      .map(record => record.get('rs').properties);
      
    return {
      id: chain.id,
      name: chain.name,
      description: chain.description,
      steps: steps.map(step => ({
        id: step.id,
        content: step.content,
        stepType: step.stepType,
        order: step.order
      }))
    };
  } finally {
    await session.close();
  }
}

/**
 * Find reasoning chains similar to the query
 */
export async function searchReasoningChains(query: string, limit = 5) {
  const embedding = await getEmbeddingForText(query);
  const session = getNeo4jDriver().session();
  
  try {
    const result = await session.run(`
      MATCH (rc:ReasoningChain)
      WHERE rc.embedding IS NOT NULL
      WITH rc, vector.similarity.cosine(rc.embedding, $embedding) AS score
      WHERE score > 0.7
      RETURN rc, score
      ORDER BY score DESC
      LIMIT $limit
    `, { 
      embedding, 
      limit: neo4j.int(limit) 
    });
    
    return result.records.map(record => ({
      ...record.get('rc').properties,
      score: record.get('score')
    }));
  } finally {
    await session.close();
  }
}

/**
 * Get related concepts mentioned in reasoning chains
 */
export async function getRelatedConceptsForQuery(query: string, limit = 10) {
  const embedding = await getEmbeddingForText(query);
  const session = getNeo4jDriver().session();
  
  try {
    const result = await session.run(`
      MATCH (rc:ReasoningChain)
      WHERE rc.embedding IS NOT NULL
      WITH rc, vector.similarity.cosine(rc.embedding, $embedding) AS score
      WHERE score > 0.7
      MATCH (rc)-[:REFERENCES]->(c:Concept)
      RETURN c, count(c) as frequency, max(score) as relevance
      ORDER BY frequency DESC, relevance DESC
      LIMIT $limit
    `, { 
      embedding, 
      limit: neo4j.int(limit) 
    });
    
    return result.records.map(record => ({
      ...record.get('c').properties,
      frequency: record.get('frequency').toNumber(),
      relevance: record.get('relevance')
    }));
  } finally {
    await session.close();
  }
}

/**
 * Get related entities mentioned in reasoning chains
 */
export async function getRelatedEntitiesForQuery(query: string, limit = 10) {
  const embedding = await getEmbeddingForText(query);
  const session = getNeo4jDriver().session();
  
  try {
    const result = await session.run(`
      MATCH (rc:ReasoningChain)
      WHERE rc.embedding IS NOT NULL
      WITH rc, vector.similarity.cosine(rc.embedding, $embedding) AS score
      WHERE score > 0.7
      MATCH (rc)-[:MENTIONS]->(e:Entity)
      RETURN e, count(e) as frequency, max(score) as relevance
      ORDER BY frequency DESC, relevance DESC
      LIMIT $limit
    `, { 
      embedding, 
      limit: neo4j.int(limit) 
    });
    
    return result.records.map(record => ({
      ...record.get('e').properties,
      frequency: record.get('frequency').toNumber(),
      relevance: record.get('relevance')
    }));
  } finally {
    await session.close();
  }
} 