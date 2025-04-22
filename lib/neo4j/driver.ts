import neo4j, { Driver } from 'neo4j-driver';

// Ensure required environment variables are present
if (!process.env.NEO4J_URI) {
  console.warn('NEO4J_URI not provided, defaulting to localhost');
}

if (!process.env.NEO4J_USERNAME || !process.env.NEO4J_PASSWORD) {
  console.warn('NEO4J credentials not provided, using defaults. DO NOT use default credentials in production!');
}

let driver: Driver | null = null;

/**
 * Get the Neo4j driver instance as a singleton
 * @returns Neo4j driver instance
 */
export function getNeo4jDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || 'neo4j://localhost:7687';
    const username = process.env.NEO4J_USERNAME || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'password';
    
    driver = neo4j.driver(
      uri,
      neo4j.auth.basic(username, password),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 30000,
      }
    );
  }
  
  return driver;
}

/**
 * Close the Neo4j driver instance
 */
export async function closeNeo4jDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

// Re-export neo4j for types
export { neo4j };

// Export default driver getter
export default getNeo4jDriver; 