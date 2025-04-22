/**
 * Helper functions for building Cypher queries
 */

/**
 * Build a Cypher MATCH clause for a node
 * @param label Label for the node
 * @param properties Properties to match on (object with key-value pairs)
 * @param variable Variable name in Cypher
 * @returns MATCH clause
 */
export function matchNode(label: string, properties?: Record<string, any>, variable: string = 'n'): string {
  const labelClause = label ? `:${label}` : '';
  const propsClause = properties ? ` {${Object.keys(properties).map(key => `${key}: $${variable}_${key}`).join(', ')}}` : '';
  
  return `MATCH (${variable}${labelClause}${propsClause})`;
}

/**
 * Build a parameters object for a node match
 * @param properties Properties to match on
 * @param variable Variable name prefix in parameters
 * @returns Parameters object
 */
export function nodeMatchParams(properties: Record<string, any>, variable: string = 'n'): Record<string, any> {
  if (!properties) return {};
  
  const params: Record<string, any> = {};
  for (const [key, value] of Object.entries(properties)) {
    params[`${variable}_${key}`] = value;
  }
  
  return params;
}

/**
 * Build a Cypher MATCH clause for a relationship
 * @param startLabel Label for the start node
 * @param relType Relationship type
 * @param endLabel Label for the end node
 * @param direction Direction of the relationship ('>', '<', or undefined for both)
 * @param startVar Variable name for start node
 * @param relVar Variable name for relationship
 * @param endVar Variable name for end node
 * @returns MATCH clause
 */
export function matchRelationship(
  startLabel: string, 
  relType: string, 
  endLabel: string, 
  direction: '>' | '<' | undefined = '>',
  startVar: string = 'a',
  relVar: string = 'r',
  endVar: string = 'b'
): string {
  const startLabelClause = startLabel ? `:${startLabel}` : '';
  const endLabelClause = endLabel ? `:${endLabel}` : '';
  const relTypeClause = relType ? `:${relType}` : '';
  
  if (direction === '>') {
    return `MATCH (${startVar}${startLabelClause})-[${relVar}${relTypeClause}]->(${endVar}${endLabelClause})`;
  } else if (direction === '<') {
    return `MATCH (${startVar}${startLabelClause})<-[${relVar}${relTypeClause}]-(${endVar}${endLabelClause})`;
  } else {
    return `MATCH (${startVar}${startLabelClause})-[${relVar}${relTypeClause}]-(${endVar}${endLabelClause})`;
  }
}

/**
 * Build a Cypher CREATE clause for a node
 * @param label Label for the node
 * @param properties Properties to set (object with key-value pairs)
 * @param variable Variable name in Cypher
 * @returns CREATE clause
 */
export function createNode(label: string, properties: Record<string, any>, variable: string = 'n'): string {
  const labelClause = label ? `:${label}` : '';
  const propsClause = properties ? ` {${Object.keys(properties).map(key => `${key}: $${variable}_${key}`).join(', ')}}` : '';
  
  return `CREATE (${variable}${labelClause}${propsClause})`;
}

/**
 * Build a parameters object for a node creation
 * @param properties Properties to set
 * @param variable Variable name prefix in parameters
 * @returns Parameters object
 */
export function nodeCreateParams(properties: Record<string, any>, variable: string = 'n'): Record<string, any> {
  if (!properties) return {};
  
  const params: Record<string, any> = {};
  for (const [key, value] of Object.entries(properties)) {
    params[`${variable}_${key}`] = value;
  }
  
  return params;
}

/**
 * Build a Cypher CREATE clause for a relationship
 * @param startVar Variable name for start node
 * @param relType Relationship type
 * @param endVar Variable name for end node
 * @param properties Properties to set on the relationship
 * @param relVar Variable name for the relationship
 * @returns CREATE clause
 */
export function createRelationship(
  startVar: string, 
  relType: string, 
  endVar: string, 
  properties?: Record<string, any>,
  relVar: string = 'r'
): string {
  const relTypeClause = relType ? `:${relType}` : '';
  const propsClause = properties ? ` {${Object.keys(properties).map(key => `${key}: $${relVar}_${key}`).join(', ')}}` : '';
  
  return `CREATE (${startVar})-[${relVar}${relTypeClause}${propsClause}]->(${endVar})`;
}

/**
 * Build a parameters object for a relationship creation
 * @param properties Properties to set
 * @param variable Variable name prefix in parameters
 * @returns Parameters object
 */
export function relationshipCreateParams(properties: Record<string, any>, variable: string = 'r'): Record<string, any> {
  if (!properties) return {};
  
  const params: Record<string, any> = {};
  for (const [key, value] of Object.entries(properties)) {
    params[`${variable}_${key}`] = value;
  }
  
  return params;
}

/**
 * Build a Cypher MERGE clause for a node
 * @param label Label for the node
 * @param properties Properties to match on (object with key-value pairs)
 * @param variable Variable name in Cypher
 * @returns MERGE clause
 */
export function mergeNode(label: string, properties: Record<string, any>, variable: string = 'n'): string {
  const labelClause = label ? `:${label}` : '';
  const propsClause = properties ? ` {${Object.keys(properties).map(key => `${key}: $${variable}_${key}`).join(', ')}}` : '';
  
  return `MERGE (${variable}${labelClause}${propsClause})`;
}

/**
 * Build a pagination clause with SKIP and LIMIT
 * @param skip Number of records to skip
 * @param limit Maximum number of records to return
 * @returns Pagination clause
 */
export function paginate(skip?: number, limit?: number): string {
  const skipClause = skip !== undefined ? `SKIP ${skip}` : '';
  const limitClause = limit !== undefined ? `LIMIT ${limit}` : '';
  
  if (skipClause && limitClause) {
    return `${skipClause} ${limitClause}`;
  }
  
  return skipClause || limitClause;
}

/**
 * Build a Cypher query with multiple clauses
 * @param clauses Array of query clauses
 * @param terminator Query terminator (e.g., ';')
 * @returns Complete Cypher query
 */
export function buildQuery(clauses: string[], terminator: string = ''): string {
  return clauses.join('\n') + terminator;
}

/**
 * Merge multiple parameter objects
 * @param paramsArray Array of parameter objects
 * @returns Merged parameters object
 */
export function mergeParams(...paramsArray: Record<string, any>[]): Record<string, any> {
  return Object.assign({}, ...paramsArray);
} 