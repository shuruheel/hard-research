# Neo4j Knowledge Graph Tool Prompts 

## Tool Usage Prompts

When guiding users on interacting with the Neo4j knowledge graph, use these prompts to ensure proper tool usage:

### Exploration Workflow

```
To explore the knowledge graph about [TOPIC]:

1. First, use the `explore_context` tool to check what information exists:
   explore_context(nodeName: "[NODE_NAME]", maxDepth: 2)

2. If that returns limited results, try the weighted exploration:
   explore_weighted_context(nodeName: "[NODE_NAME]", maxDepth: 2, minWeight: 0.3)
   
3. If you need to search for nodes by keywords:
   search_nodes(query: "[SEARCH_TERM]")
```

### Node Creation Workflow 

```
To add new information to the knowledge graph:

1. Create the appropriate nodes:
   create_nodes(nodes: [
     {
       name: "[NODE_NAME]",
       entityType: "Entity|Event|Concept|ScientificInsight|Law|Thought",
       // Add type-specific attributes
       // Add cognitive dimensions
     }
   ])

2. ALWAYS create relationships between nodes:
   create_relations(relations: [
     {
       from: "[SOURCE_NODE]",
       to: "[TARGET_NODE]",
       relationType: "[ACTIVE_VERB]",
       context: "[EXPLANATION of 30-50 words]",
       weight: 0.8, // Strength/importance (0.0-1.0)
       confidenceScore: 0.9 // Certainty (0.0-1.0)
     }
   ])
```

### Thought Capture Workflow

```
To capture your analysis or insights about a topic:

1. Add a thought node and connect it to relevant entities:
   create_thoughts(
     title: "Analysis of [TOPIC]",
     thoughtContent: "[DETAILED_THOUGHT]",
     entities: ["Entity1", "Entity2"],
     concepts: ["Concept1", "Concept2"],
     emotionalValence: 0.7, // -1.0 to 1.0
     thoughtConfidenceScore: 0.85 // 0.0 to 1.0
   )
```

## Prompt Templates for Cognitive Extraction

When extracting cognitive dimensions from user text, use these templates:

### Emotional Dimension Extraction

```
Based on the linguistic cues in the user's description:

- Emotional valence appears [positive/negative/neutral] with a value of [NUMBER between -1.0 and 1.0]
  Evidence: [phrases showing positive/negative sentiment]
  
- Emotional arousal seems [calm/moderate/intense] with a value of [NUMBER between 0.0 and 3.0]
  Evidence: [phrases showing emotional intensity]
```

### Concept Dimension Extraction

```
For the concept described by the user:

- Abstraction level: [NUMBER between 0.0 and 1.0]
  Reasoning: [explanation of why the concept is concrete/abstract]
  
- Metaphorical mappings:
  * "[SOURCE] is [TARGET]" - [explanation of the metaphor]
```

### Scientific Insight Dimension Extraction

```
For this scientific finding:

- Evidence strength: [NUMBER between 0.0 and 1.0]
  Based on: [methodology quality, sample size, replication status]
  
- Surprise value: [NUMBER between 0.0 and 1.0]
  Reasoning: [how unexpected this finding is given prior knowledge]
```

## Neo4j Cypher Query Examples

When helping users construct Cypher queries, provide these examples:

### Basic Exploration Query

```cypher
// Find all entities connected to a concept
MATCH (c:Concept {name: 'Machine Learning'})-[r]-(e:Entity)
RETURN c, r, e
```

### Finding Cognitive Patterns

```cypher
// Find concepts with high emotional impact (high valence + high arousal)
MATCH (c:Concept)
WHERE c.emotionalValence > 0.7 AND c.emotionalArousal > 2.0
RETURN c.name, c.emotionalValence, c.emotionalArousal
ORDER BY c.emotionalArousal DESC
```

### Weighted Path Analysis

```cypher
// Find the strongest path between two nodes
MATCH path = shortestPath((a:Entity {name: 'Source'})-[*]-(b:Entity {name: 'Target'}))
WITH path, [r in relationships(path) | r.weight] AS weights
RETURN path, reduce(w = 1, weight IN weights | w * weight) AS pathStrength
ORDER BY pathStrength DESC
LIMIT 1
```

## Troubleshooting Guidance

If a user encounters issues with the Neo4j knowledge graph, suggest these approaches:

1. **No nodes found**: Verify the exact node name and try search_nodes first
2. **Connection errors**: Check Neo4j connection string and credentials
3. **Empty graph**: First populate with basic nodes and relationships
4. **Performance issues**: Suggest limiting query depth and using weighted relationships
5. **Duplicate nodes**: Use MERGE instead of CREATE in Cypher statements

Remember to provide examples with actual values rather than placeholders when possible, and adapt these prompts to the user's specific context and knowledge level. 