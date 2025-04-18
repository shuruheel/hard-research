import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Create Neo4j driver using environment variables
const driver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME!,
    process.env.NEO4J_PASSWORD!
  )
);

async function initializeSchema() {
  const session = driver.session();
  try {
    console.log('Initializing Neo4j schema...');

    // 1. Create unique constraints for node IDs
    const nodeTypes = [
      'Entity', 'Person', 'Event', 'Concept', 'Attribute',
      'Proposition', 'Thought', 'ReasoningChain', 'ReasoningStep'
    ];

    for (const nodeType of nodeTypes) {
      await session.run(
        `CREATE CONSTRAINT IF NOT EXISTS FOR (n:${nodeType}) REQUIRE n.id IS UNIQUE`
      );
      console.log(`Created constraint for ${nodeType}.id`);
    }

    // 2. Create or verify vector indexes for semantic search
    const vectorIndexes = [
      { name: 'concept-embeddings', label: 'Concept', property: 'embedding', dimensions: 3072 },
      { name: 'entity-embeddings', label: 'Entity', property: 'embedding', dimensions: 3072 },
      { name: 'person-embeddings', label: 'Person', property: 'embedding', dimensions: 3072 },
      { name: 'proposition-embeddings', label: 'Proposition', property: 'embedding', dimensions: 3072 },
      { name: 'reasoningchain-embeddings', label: 'ReasoningChain', property: 'embedding', dimensions: 3072 },
      { name: 'thought-embeddings', label: 'Thought', property: 'embedding', dimensions: 3072 }
    ];

    for (const idx of vectorIndexes) {
      try {
        const existing = await session.run(
          `SHOW INDEXES WHERE name = $indexName`,
          { indexName: idx.name }
        );
        if (existing.records.length === 0) {
          await session.run(
            `CALL db.index.vector.createNodeIndex(
              $indexName,
              $nodeLabel,
              $propertyName,
              $dimensions,
              'cosine'
            )`,
            {
              indexName: idx.name,
              nodeLabel: idx.label,
              propertyName: idx.property,
              dimensions: neo4j.int(idx.dimensions)
            }
          );
          console.log(`Created vector index ${idx.name} on ${idx.label}`);
        } else {
          console.log(`Vector index ${idx.name} already exists`);
        }
      } catch (error) {
        console.error(`Error with vector index ${idx.name}:`, error);
      }
    }

    // 3. Create text indexes for name properties
    for (const nodeType of nodeTypes) {
      try {
        await session.run(
          `CREATE TEXT INDEX IF NOT EXISTS FOR (n:${nodeType}) ON (n.name)`
        );
        console.log(`Created text index for ${nodeType}.name`);
      } catch (error) {
        console.error(`Error creating text index for ${nodeType}.name:`, error);
      }
    }

    console.log('Schema initialization complete.');
  } catch (error) {
    console.error('Schema initialization failed:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

initializeSchema()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error during schema init:', error);
    process.exit(1);
  }); 