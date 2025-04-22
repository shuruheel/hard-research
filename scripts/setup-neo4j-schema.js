const neo4j = require('neo4j-driver');
require('dotenv').config();

async function setupNeo4jSchema() {
  const uri = process.env.NEO4J_URI || 'neo4j://localhost:7687';
  const username = process.env.NEO4J_USERNAME || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'password';
  
  console.log(`Connecting to Neo4j database at ${uri}...`);
  
  const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(username, password),
    {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 30000,
    }
  );
  
  const session = driver.session();
  
  try {
    console.log('Setting up Neo4j schema for reasoning tokens...');
    
    // Create constraints for unique IDs
    console.log('Creating constraints for unique IDs...');
    await session.run(`
      CREATE CONSTRAINT FOR (r:ReasoningChain) REQUIRE r.id IS UNIQUE IF NOT EXISTS
    `);
    console.log('✅ Created constraint for ReasoningChain');
    
    await session.run(`
      CREATE CONSTRAINT FOR (s:ReasoningStep) REQUIRE s.id IS UNIQUE IF NOT EXISTS
    `);
    console.log('✅ Created constraint for ReasoningStep');
    
    await session.run(`
      CREATE CONSTRAINT FOR (c:Concept) REQUIRE c.id IS UNIQUE IF NOT EXISTS
    `);
    console.log('✅ Created constraint for Concept');
    
    await session.run(`
      CREATE CONSTRAINT FOR (e:Entity) REQUIRE e.id IS UNIQUE IF NOT EXISTS
    `);
    console.log('✅ Created constraint for Entity');
    
    await session.run(`
      CREATE CONSTRAINT FOR (p:Proposition) REQUIRE p.id IS UNIQUE IF NOT EXISTS
    `);
    console.log('✅ Created constraint for Proposition');
    
    // Create name index for faster retrieval
    console.log('Creating name indexes...');
    await session.run(`
      CREATE INDEX FOR (c:Concept) ON (c.name) IF NOT EXISTS
    `);
    console.log('✅ Created name index for Concept');
    
    await session.run(`
      CREATE INDEX FOR (e:Entity) ON (e.name) IF NOT EXISTS
    `);
    console.log('✅ Created name index for Entity');
    
    // Create vector index for embeddings
    console.log('Creating vector index for semantic search...');
    await session.run(`
      CREATE VECTOR INDEX reasoningVectorIndex IF NOT EXISTS
      FOR (r:ReasoningChain) 
      ON r.embedding
      OPTIONS {indexConfig: {
        \`vector.dimensions\`: 3072,
        \`vector.similarity_function\`: 'cosine'
      }}
    `);
    console.log('✅ Created vector index for embeddings');
    
    console.log('Neo4j schema setup complete!');

  } catch (error) {
    console.error('Error setting up Neo4j schema:', error);
  } finally {
    await session.close();
  }
  
  await driver.close();
}

setupNeo4jSchema().catch(error => {
  console.error('Error in setup script:', error);
  process.exit(1);
}); 