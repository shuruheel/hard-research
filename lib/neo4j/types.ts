import { Integer, Node, Relationship } from 'neo4j-driver';

/**
 * Base node properties interface
 */
export interface BaseNodeProperties {
  id: string;
  name: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  embedding?: number[]; // Vector embedding for semantic search
}

/**
 * Entity node properties interface
 */
export interface EntityProperties extends BaseNodeProperties {
  type?: string;
  description?: string;
}

/**
 * Person node properties interface (subtype of Entity)
 */
export interface PersonProperties extends EntityProperties {
  biography?: string;
  domain?: string;
  expertise?: string[];
}

/**
 * Concept node properties interface
 */
export interface ConceptProperties extends BaseNodeProperties {
  definition: string;
  domain?: string;
  aliases?: string[];
}

/**
 * Thought node properties interface
 */
export interface ThoughtProperties extends BaseNodeProperties {
  thoughtContent: string;
  confidence: number;
  source?: string;
}

/**
 * ReasoningChain node properties interface
 */
export interface ReasoningChainProperties extends BaseNodeProperties {
  description: string;
  conclusion: string;
  steps?: number;
  messageId?: string;
}

/**
 * ReasoningStep node properties interface
 */
export interface ReasoningStepProperties extends BaseNodeProperties {
  content: string;
  stepType: 'premise' | 'inference' | 'conclusion';
  order: number;
  chainId: string;
}

/**
 * Proposition node properties interface
 */
export interface PropositionProperties extends BaseNodeProperties {
  statement: string;
  status: string;
  confidence: number;
  truthValue?: boolean;
  sources?: string[];
  domain?: string;
  emotionalValence?: number;
  emotionalArousal?: number;
}

/**
 * Node types union type
 */
export type NodeType = 'Entity' | 'Person' | 'Concept' | 'Thought' | 'ReasoningChain' | 'ReasoningStep' | 'Proposition';

/**
 * Relationship type enum
 */
export enum RelationshipType {
  RELATED_TO = 'RELATED_TO',
  HAS_CONCEPT = 'HAS_CONCEPT',
  HAS_PART = 'HAS_PART',
  REFERS_TO = 'REFERS_TO',
  CONTRADICTS = 'CONTRADICTS',
  SUPPORTS = 'SUPPORTS',
  PRECEDES = 'PRECEDES'
}

/**
 * Base relationship properties interface
 */
export interface BaseRelationshipProperties {
  confidence?: number;
  createdAt?: Date | string;
}

/**
 * Typed Node interfaces for Neo4j
 */
export type EntityNode = Node<Integer, EntityProperties>;
export type PersonNode = Node<Integer, PersonProperties>;
export type ConceptNode = Node<Integer, ConceptProperties>;
export type ThoughtNode = Node<Integer, ThoughtProperties>;
export type ReasoningChainNode = Node<Integer, ReasoningChainProperties>;
export type ReasoningStepNode = Node<Integer, ReasoningStepProperties>;
export type PropositionNode = Node<Integer, PropositionProperties>;

/**
 * Typed Relationship interfaces for Neo4j
 */
export type BaseRelationship = Relationship<Integer, BaseRelationshipProperties>;

/**
 * Pagination parameters for queries
 */
export interface PaginationParams {
  skip?: number;
  limit?: number;
}

/**
 * Semantic search parameters
 */
export interface SemanticSearchParams {
  queryText: string;
  nodeTypes?: NodeType[];
  limit?: number;
  threshold?: number; // Similarity threshold (0-1)
}

/**
 * Graph node extraction parameters
 */
export interface GraphNodeExtractionParams {
  messages: Message[];
  extractionDepth?: 'minimal' | 'standard' | 'deep';
}

/**
 * Message interface for extraction
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  parts?: MessagePart[];
}

/**
 * Message part interface
 */
export interface MessagePart {
  type: string;
  text?: string;
  reasoning?: string;
  toolInvocation?: any;
}

/**
 * Extracted node interface
 */
export interface ExtractedNode {
  id: string;
  type: NodeType;
  name: string;
  [key: string]: any;
}

/**
 * Extracted relationship interface
 */
export interface ExtractedRelationship {
  source: string;
  target: string;
  type: string;
}

/**
 * Extraction result interface
 */
export interface ExtractionResult {
  success: boolean;
  nodesCreated: Record<string, number>;
  summary: string;
}

/**
 * Semantic search result interface
 */
export interface SemanticSearchResult {
  id: string;
  name: string;
  nodeType: NodeType;
  similarityScore: number;
  [key: string]: any;
} 