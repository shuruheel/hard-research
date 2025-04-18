import { Integer, DateTime, Node, Relationship, Path, Record as Neo4jRecord } from 'neo4j-driver';

/**
 * Serialize a Neo4j result to a JSON-compatible format
 * @param result Neo4j result object or primitive value
 * @returns Serialized result
 */
export function serializeNeo4j(result: any): any {
  if (result === null || result === undefined) {
    return result;
  }

  // Handle primitives
  if (typeof result !== 'object') {
    return result;
  }

  // Handle arrays
  if (Array.isArray(result)) {
    return result.map(item => serializeNeo4j(item));
  }

  // Handle Neo4j Integer
  if (Integer.isInteger(result)) {
    return result.toNumber();
  }

  // Handle Neo4j DateTime
  if (result instanceof DateTime) {
    return result.toString();
  }

  // Handle Neo4j Node
  if (result instanceof Node) {
    const serializedNode = {
      _id: serializeNeo4j(result.identity),
      _labels: result.labels,
      ...serializeNeo4j(result.properties)
    };
    return serializedNode;
  }

  // Handle Neo4j Relationship
  if (result instanceof Relationship) {
    return {
      _id: serializeNeo4j(result.identity),
      _type: result.type,
      _startNodeId: serializeNeo4j(result.start),
      _endNodeId: serializeNeo4j(result.end),
      ...serializeNeo4j(result.properties)
    };
  }

  // Handle Neo4j Path
  if (result instanceof Path) {
    return {
      segments: result.segments.map(segment => ({
        start: serializeNeo4j(segment.start),
        relationship: serializeNeo4j(segment.relationship),
        end: serializeNeo4j(segment.end)
      }))
    };
  }

  // Handle Neo4j Record
  if (result instanceof Neo4jRecord) {
    const serialized: Record<string, any> = {};
    for (const key of result.keys) {
      serialized[key] = serializeNeo4j(result.get(key));
    }
    return serialized;
  }

  // Handle regular objects
  const serialized: Record<string, any> = {};
  for (const [key, value] of Object.entries(result)) {
    serialized[key] = serializeNeo4j(value);
  }
  return serialized;
}

type NodeSerializer = (node: any) => any;

/**
 * Node type-specific serializers
 */
export const nodeSerializers: Record<string, NodeSerializer> = {
  /**
   * Serialize a Thought node
   * @param node The Neo4j node or properties object
   * @returns Serialized Thought object
   */
  Thought: (node: any) => {
    const props = node.properties || node;
    return {
      id: props.id,
      name: props.name,
      thoughtContent: props.thoughtContent,
      confidence: serializeNeo4j(props.confidence),
      createdAt: serializeNeo4j(props.createdAt),
      updatedAt: serializeNeo4j(props.updatedAt)
    };
  },

  /**
   * Serialize a ReasoningChain node
   * @param node The Neo4j node or properties object
   * @returns Serialized ReasoningChain object
   */
  ReasoningChain: (node: any) => {
    const props = node.properties || node;
    return {
      id: props.id,
      name: props.name,
      description: props.description,
      conclusion: props.conclusion,
      steps: serializeNeo4j(props.steps),
      createdAt: serializeNeo4j(props.createdAt)
    };
  },

  /**
   * Serialize a Person node
   * @param node The Neo4j node or properties object
   * @returns Serialized Person object
   */
  Person: (node: any) => {
    const props = node.properties || node;
    return {
      id: props.id,
      name: props.name,
      biography: props.biography,
      domain: props.domain
    };
  },

  /**
   * Serialize a Concept node
   * @param node The Neo4j node or properties object
   * @returns Serialized Concept object
   */
  Concept: (node: any) => {
    const props = node.properties || node;
    return {
      id: props.id,
      name: props.name,
      definition: props.definition,
      domain: props.domain
    };
  },

  // Add Entity serializer
  Entity: (node: any) => {
    const props = node.properties || node;
    return {
      id: props.id,
      name: props.name,
      type: props.type,
      description: props.description
    };
  },

  // Add Proposition serializer
  Proposition: (node: any) => {
    const props = node.properties || node;
    return {
      id: props.id,
      name: props.name,
      content: props.content,
      truth: props.truth
    };
  },

  // Add ReasoningStep serializer
  ReasoningStep: (node: any) => {
    const props = node.properties || node;
    return {
      id: props.id,
      name: props.name,
      content: props.content,
      stepType: props.stepType,
      order: props.order,
      chainId: props.chainId
    };
  },

  /**
   * Default serializer for any node type
   * @param node The Neo4j node
   * @returns Serialized node object
   */
  default: (node: any) => {
    if (node instanceof Node) {
      return {
        _id: serializeNeo4j(node.identity),
        _labels: node.labels,
        ...serializeNeo4j(node.properties)
      };
    }
    return serializeNeo4j(node);
  }
};

/**
 * Serialize a Neo4j node based on its label
 * @param node The Neo4j node
 * @param label The primary label to use for serialization
 * @returns Serialized node object
 */
export function serializeNode(node: Node, label?: string): any {
  if (!label && node.labels.length > 0) {
    label = node.labels[0];
  }
  
  const serializer = label && nodeSerializers[label] 
    ? nodeSerializers[label] 
    : nodeSerializers.default;
    
  return serializer(node);
}

/**
 * Serialize an array of Neo4j records
 * @param records Array of Neo4j records
 * @returns Serialized records array
 */
export function serializeRecords(records: Neo4jRecord[]): any[] {
  return records.map(record => serializeNeo4j(record));
} 