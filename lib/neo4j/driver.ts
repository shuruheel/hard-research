import neo4j, { Driver, Integer, DateTime } from 'neo4j-driver';

// Ensure required environment variables are present
const requiredEnvVars = ['NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Singleton instance for Neo4j driver
let driverInstance: Driver | null = null;

/**
 * Get the Neo4j driver instance as a singleton
 * @returns Neo4j driver instance
 */
export function getNeo4jDriver(): Driver {
  if (driverInstance) {
    return driverInstance;
  }

  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const username = process.env.NEO4J_USERNAME || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'password';

  // Create auth credentials
  const auth = neo4j.auth.basic(username, password);

  // Create driver with configuration
  driverInstance = neo4j.driver(uri, auth, {
    maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
    disableLosslessIntegers: false, // Keep neo4j integers as Integer objects
  });

  return driverInstance;
}

/**
 * Close the Neo4j driver connection
 */
export async function closeNeo4jDriver(): Promise<void> {
  if (driverInstance) {
    await driverInstance.close();
    driverInstance = null;
  }
}

// Export neo4j types for convenience
export { neo4j, Integer, DateTime };

// Export default driver getter
export default getNeo4jDriver; 