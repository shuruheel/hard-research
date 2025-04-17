# Expand to Nodes in a subgraph

This procedure expands to subgraph nodes reachable from the start node following relationships to max-level adhering to the label filters. It allows fine grained control over the traversals that expand the subgraph.

## Procedure Overview

The procedure is described below:

<table>
Qualified Name	Type	Release
apoc.path.subgraphNodes 
apoc.path.subgraphNodes(startNode <id>|Node|list, {maxLevel,relationshipFilter,labelFilter,bfs:true, filterStartNode:false, limit:-1, optional:false, endNodes:[], terminatorNodes:[], sequence, beginSequenceAtStart:true}) yield node - expand the subgraph nodes reachable from start node following relationships to max-level adhering to the label filters
Procedure
APOC Core
</table>

## Configuration Parameters

The procedures support the following config parameters:

<table>
name	type	default	description
minLevel
Long
-1
the minimum number of hops in the traversal. Must be 0 or 1 if specified
maxLevel
Long
-1
the maximum number of hops in the traversal
relationshipFilter
String
null
the relationship types and directions to traverse.
See Relationship Filters.
labelFilter
String
null
the node labels to traverse.
See Label Filters.
beginSequenceAtStart
Boolean
true
starts matching sequences of node labels and/or relationship types (defined in relationshipFilter, labelFilter, or sequences) one node away from the start node.
bfs
Boolean
true
use Breadth First Search when traversing. Uses Depth First Search if set to false
filterStartNode
Boolean
false
whether the labelFilter and sequence apply to the start node of the expansion.
limit
Long
-1
limit the number of paths returned. When using bfs:true, this has the effect of returning paths to the n nearest nodes with labels in the termination or end node filter, where n is the limit given. If set to true, a null value is yielded whenever the expansion would normally eliminate rows due to no results.
endNodes
List<Node>
null
only these nodes can end returned paths, and expansion will continue past these nodes, if possible.
terminatorNodes
List<Node>
null
Only these nodes can end returned paths, and expansion won’t continue past these nodes.
whiteListNodes
List<Node>
null
Only these nodes are allowed in the expansion (though endNodes and terminatorNodes will also be allowed, if present).
blackListNodes
List<Node>
null
None of the paths returned will include these nodes.
</table>

It also has the following fixed parameter:

<table>
name	type	default	description
uniqueness
String
NODE_GLOBAL
the strategy to use when expanding relationships in a traversal. NODE_GLOBAL means that a node cannot be traversed more than once. This is what the legacy traversal framework does.
</table>

## Relationship Filters

The syntax for relationship filters is described below:

Syntax: [<]RELATIONSHIP_TYPE1[>]|[<]RELATIONSHIP_TYPE2[>]|…​

<table>
LIKES>
LIKES
OUTGOING
<FOLLOWS
FOLLOWS
INCOMING
KNOWS
KNOWS
BOTH
>
any type
OUTGOING
<
any type
INCOMING
</table>

## Label Filters

The syntax for label filters is described below:

Syntax: [+-/>]LABEL1|LABEL2|*|…​

<table>
input	result
-Foe
blacklist filter - No node in the path will have a label in the blacklist.
+Friend
whitelist filter - All nodes in the path must have a label in the whitelist (exempting termination and end nodes, if using those filters). If no whitelist operator is present, all labels are considered whitelisted.
/Friend
termination filter - Only return paths up to a node of the given labels, and stop further expansion beyond it. Termination nodes do not have to respect the whitelist. Termination filtering takes precedence over end node filtering.
>Friend
end node filter - Only return paths up to a node of the given labels, but continue expansion to match on end nodes beyond it. End nodes do not have to respect the whitelist to be returned, but expansion beyond them is only allowed if the node has a label in the whitelist.
</table>

### Label filter operator precedence and behavior

Multiple label filter operators are allowed at the same time. Take the following example:

labelFilter:'+Person|Movie|-SciFi|>Western|/Romance'

If we work through this label filter, we can see that:

- :Person and :Movie labels are whitelisted
- :SciFi is blacklisted
- :Western is an end node label
- :Romance is as a termination label.

The precedence of operator evaluation isn’t dependent upon their location in the labelFilter but is fixed:
Blacklist filter -, termination filter /, end node filter >, whitelist filter +.

This means:
- No blacklisted label - will ever be present in the nodes of paths returned, even if the same label (or another label of a node with a blacklisted label) is included in another filter list.
- If the termination filter / or end node filter > is used, then only paths up to nodes with those labels will be returned as results. These end nodes are exempt from the whitelist filter.
- If a node is a termination node /, no further expansion beyond the node will occur.
- The whitelist only applies to nodes up to but not including end nodes from the termination or end node filters. If no end node or termination node operators are present, then the whitelist applies to all nodes of the path.
- If no whitelist operators are present in the labelFilter, this is treated as if all labels are whitelisted.

## Examples

The examples in this section are based on the following sample graph:

<cypher>
MERGE (mark:Person:DevRel {name: "Mark"})
MERGE (lju:Person:DevRel {name: "Lju"})
MERGE (praveena:Person:Engineering {name: "Praveena"})
MERGE (zhen:Person:Engineering {name: "Zhen"})
MERGE (martin:Person:Engineering {name: "Martin"})
MERGE (joe:Person:Field {name: "Joe"})
MERGE (stefan:Person:Field {name: "Stefan"})
MERGE (alicia:Person:Product {name: "Alicia"})
MERGE (jake:Person:Product {name: "Jake"})
MERGE (john:Person:Product {name: "John"})
MERGE (jonny:Person:Sales {name: "Jonny"})
MERGE (anthony:Person:Sales {name: "Anthony"})
MERGE (rik:Person:Sales {name: "Rik"})

MERGE (zhen)-[:KNOWS]-(stefan)
MERGE (zhen)-[:KNOWS]-(lju)
MERGE (zhen)-[:KNOWS]-(praveena)
MERGE (zhen)-[:KNOWS]-(martin)
MERGE (mark)-[:KNOWS]-(jake)
MERGE (alicia)-[:KNOWS]-(jake)
MERGE (jonny)-[:KNOWS]-(anthony)
MERGE (john)-[:KNOWS]-(rik)

MERGE (alicia)-[:FOLLOWS]->(joe)
MERGE (joe)-[:FOLLOWS]->(mark)
MERGE (joe)-[:FOLLOWS]->(praveena)
MERGE (joe)-[:FOLLOWS]->(zhen)
MERGE (mark)-[:FOLLOWS]->(stefan)
MERGE (stefan)-[:FOLLOWS]->(joe)
MERGE (praveena)-[:FOLLOWS]->(joe)
MERGE (lju)-[:FOLLOWS]->(jake)
MERGE (alicia)-[:FOLLOWS]->(jonny)
MERGE (zhen)-[:FOLLOWS]->(john)
MERGE (anthony)-[:FOLLOWS]->(joe)
</cypher>

The KNOWS relationship type is considered to be bidirectional, where if Zhen knows Stefan, we can imply that Stefan knows Zhen. When using the KNOWS relationship we will ignore the direction.

The FOLLOWS relationship has a direction, so we will specify a direction when we use it.

### Relationship Type and Node Label Filters

Let’s start by expanding paths from the Praveena node. We only want to consider the KNOWS relationship type, so we’ll specify that as the relationshipFilter parameter.

The following returns the people reachable by the KNOWS relationship at 1 to 2 hops from Praveena

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.subgraphNodes(p, {
	relationshipFilter: "KNOWS",
    minLevel: 1,
    maxLevel: 2
})
YIELD node
RETURN node;
</cypher>

Results:
<table>
node
(:Person:Engineering {name: "Zhen"})
(:Person:Engineering {name: "Martin"})
(:Person:DevRel {name: "Lju"})
(:Person:Field {name: "Stefan"})
</table>

4 people are reachable from Praveena.

We can also provide a node label filter to restrict the nodes that are returned. If we want to only return paths where every node has the Engineering label, we’ll provide the value +Engineering to the labelFilter parameter.

The following returns the Engineering people reachable by the KNOWS relationship at 1 to 2 hops from Praveena

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.subgraphNodes(p, {
	relationshipFilter: "KNOWS",
	labelFilter: "+Engineering",
    minLevel: 1,
    maxLevel: 2
})
YIELD node
RETURN node;
</cypher>

Results:
<table>
node
(:Person:Engineering {name: "Zhen"})
(:Person:Engineering {name: "Martin"})
</table>

We lose Lju and Stefan because those nodes don’t have the Engineering label.

We can specify multiple relationship types. The following query starts from the Alicia node, and then expands the FOLLOWS and KNOWS relationships:

The following returns the people reachable by the FOLLOWS or KNOWS relationships at 1 to 3 hops from Alicia

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.subgraphNodes(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3
})
YIELD node
RETURN node;
</cypher>

Results:
<table>
node
(:Person:Sales {name: "Jonny"})
(:Person:Field {name: "Joe"})
(:Person:Product {name: "Jake"})
(:Person:Sales {name: "Anthony"})
(:Person:Engineering {name: "Praveena"})
(:Person:DevRel {name: "Mark"})
(:Person:Engineering {name: "Zhen"})
(:Person:Field {name: "Stefan"})
(:Person:Product {name: "John"})
(:Person:Engineering {name: "Martin"})
(:Person:DevRel {name: "Lju"})
</table>

This list includes all but one of the people in our graph, which means that Alicia is very well connected.

We can also specify traversal termination criteria using label filters. If we wanted to terminate a traversal as soon as the traversal encounters a node containing the Engineering label, we can use the /Engineering node filter.

The following returns the people reachable by the FOLLOWS or KNOWS relationships at 1 to 3 hops from Alicia, terminating as soon as a node with the Engineering label is reached

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.subgraphNodes(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    labelFilter: "/Engineering",
    minLevel: 1,
    maxLevel: 3
})
YIELD node
RETURN node;
</cypher>

Results:
<table>
node
(:Person:Engineering {name: "Zhen"})
(:Person:Engineering {name: "Praveena"})
</table>

We’re now down to only 2 people - Zhen and Praveena. But this query doesn’t capture all of the paths from Alicia that end in a node with the Engineering label. We can use the >Engineering node filter to define a traversal that:
- only returns nodes that have the Engineering label
- continues expansion to end nodes after that, looking for more nodes that have the Engineering label

The following returns Engineering people reachable by the FOLLOWS or KNOWS relationships at 1 to 3 hops from Alicia

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.subgraphNodes(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    labelFilter: ">Engineering",
    minLevel: 1,
    maxLevel: 3
})
YIELD node
RETURN node;
</cypher>

Results:
<table>
node
(:Person:Engineering {name: "Zhen"})
(:Person:Engineering {name: "Praveena"})
(:Person:Engineering {name: "Martin"})
</table>

Our query now also returns Martin, who must have been reachable via either Zhen or Praveena.

### Terminator Nodes and End Nodes

As well as specifying terminator and end labels for traversals, we can also specify terminator and end nodes. For this procedure, these parameters both behave the same way - the procedure will determine whether any of the nodes provided as terminator or end nodes are reachable from the start node.

Let’s build on the previous query that found people that Alicia KNOWS or FOLLOWS. We want to know whether there’s a way to get from Alicia to Joe, which we can do by passing the Joe node to the terminatorNodes parameter.

The following returns the terminator nodes reachable by the FOLLOWS or KNOWS relationships at 1 to 3 hops from Alicia

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (joe:Person {name: "Joe"})
CALL apoc.path.subgraphNodes(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    terminatorNodes: [joe]
})
YIELD node
RETURN node;
</cypher>

Results:
<table>
node
(:Person:Field {name: "Joe"})
</table>

We do indeed have a path from Alicia to Joe.

And we know from an earlier example that Alicia can actually reach all other nodes in the graph using the KNOWS or FOLLOWS relationships. But what if we want to determine whether Mark, Joe, Zhen, and Praveena are reachable using only the KNOWS relationship?

The following returns the end nodes reachable by the KNOWS relationships at 1 to 3 hops from Alicia

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (end:Person)
WHERE end.name IN ["Mark", "Joe", "Zhen", "Praveena"]
WITH p, collect(end) AS endNodes
CALL apoc.path.subgraphNodes(p, {
    relationshipFilter: "KNOWS",
    minLevel: 1,
    maxLevel: 3,
    endNodes: endNodes
})
YIELD node
RETURN node;
</cypher>

Results:
<table>
node
(:Person:DevRel {name: "Mark"})
</table>

Only Mark is reachable!

### Whitelist Nodes and Blacklist Nodes

Whitelist and blacklist nodes can also be specified.

Let’s build on the query that found people that Alicia KNOWS or FOLLOWS. We want to find the nodes reachable via paths that only include Jonny, Mark, or Zhen. We can do this by passing those odes to the parameter whitelistNodes.

The following returns nodes reachable by the FOLLOWS or KNOWS relationship types at 1 to 3 hops from Alicia, where the paths to those nodes must only include Mark, Jonny, or Zhen

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (whitelist:Person)
WHERE whitelist.name IN ["Jonny", "Mark", "Zhen"]
WITH p, collect(whitelist) AS whitelistNodes
CALL apoc.path.subgraphNodes(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    whitelistNodes: whitelistNodes
})
YIELD node
RETURN node;
</cypher>

Results:
<table>
node
(:Person:Sales {name: "Jonny"})
</table>

Only Jonny can be reached. We can therefore infer that Mark and Zhen are only reachable via another node that wasn’t include in the whitelist.

A blacklist is used to exclude nodes from the paths that lead to reachable nodes. If we want to return nodes that are reachable without going through Joe, we can do this by passing the Joe node to the blacklistNodes parameter.

The following returns nodes reachable by the FOLLOWS or KNOWS relationship types at 1 to 3 hops from Alicia, where the paths to those nodes do not go through Joe

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (joe:Person {name: "Joe"})
CALL apoc.path.subgraphNodes(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    blacklistNodes: [joe]
})
YIELD node
RETURN node;
</cypher>

Results:
<table>
node
(:Person:Sales {name: "Jonny"})
(:Person:Product {name: "Jake"})
(:Person:Sales {name: "Anthony"})
(:Person:DevRel {name: "Mark"})
(:Person:Field {name: "Stefan"})
</table>

Only 5 nodes are reachable without going through the Joe node. If we remember back to an earlier example, 11 nodes were reachable when we didn’t specify a blacklist. This indicates that Joe is an important connector in this graph.

### Sequences of Relationship Types

Sequences of relationship types can be specified by comma separating the values passed to relationshipFilter.

For example, if we want to start from the Joe node and traverse a sequence of the FOLLOWS relationship in the outgoing direction and the KNOWS relationship in either direction, we can specify the relationship filter FOLLOWS>,KNOWS.

The following returns the reachable nodes by following the FOLLOWS and KNOWS relationship types alternately from Joe

<cypher>
MATCH (p:Person {name: "Joe"})
CALL apoc.path.subgraphNodes(p, {
	relationshipFilter: "FOLLOWS>,KNOWS",
	beginSequenceAtStart: true,
	minLevel: 1,
	maxLevel: 4
})
YIELD node
RETURN node;
</cypher>

Results:
<table>
node
(:Person:Engineering {name: "Praveena"})
(:Person:DevRel {name: "Mark"})
(:Person:Engineering {name: "Zhen"})
(:Person:Product {name: "Jake"})
(:Person:Engineering {name: "Martin"})
(:Person:DevRel {name: "Lju"})
(:Person:Field {name: "Stefan"})
</table>

# Expand to subgraph

The expand to subgraph procedure expands to subgraph nodes reachable from the start node following relationships to max-level adhering to the label filters. Returns the collection of nodes in the subgraph, and the collection of relationships between all subgraph nodes. It allows fine grained control over the traversals that expand these subgraphs.

## Procedure Overview

The procedure is described below:

<table>
Qualified Name	Type	Release
apoc.path.subgraphAll 
apoc.path.subgraphAll(startNode <id>|Node|list, {maxLevel,relationshipFilter,labelFilter,bfs:true, filterStartNode:false, limit:-1, endNodes:[], terminatorNodes:[], sequence, beginSequenceAtStart:true}) yield nodes, relationships - expand the subgraph reachable from start node following relationships to max-level adhering to the label filters, and also return all relationships within the subgraph
</table>

## Configuration Parameters

The procedures support the following config parameters:

<table>
name	type	default	description
minLevel
Long
-1
the minimum number of hops in the traversal. Must be 0 or 1 if specified
maxLevel
Long
-1
the maximum number of hops in the traversal
relationshipFilter
String
null
the relationship types and directions to traverse.
See Relationship Filters.
labelFilter
String
null
the node labels to traverse.
See Label Filters.
beginSequenceAtStart
Boolean
true
starts matching sequences of node labels and/or relationship types (defined in relationshipFilter, labelFilter, or sequences) one node away from the start node.
bfs
Boolean
true
use Breadth First Search when traversing. Uses Depth First Search if set to false
filterStartNode
Boolean
false
whether the labelFilter and sequence apply to the start node of the expansion.
limit
Long
-1
limit the number of paths returned. When using bfs:true, this has the effect of returning paths to the n nearest nodes with labels in the termination or end node filter, where n is the limit given. If set to true, a null value is yielded whenever the expansion would normally eliminate rows due to no results.
endNodes
List<Node>
null
only these nodes can end returned paths, and expansion will continue past these nodes, if possible.
terminatorNodes
List<Node>
null
Only these nodes can end returned paths, and expansion won’t continue past these nodes.
whitelistNodes
List<Node>
null
Only these nodes are allowed in the expansion (though endNodes and terminatorNodes will also be allowed, if present).
blacklistNodes
List<Node>
null
None of the paths returned will include these nodes.
</table>

It also has the following fixed parameter:

<table>
name	type	default	description
uniqueness
String
NODE_GLOBAL
the strategy to use when expanding relationships in a traversal. NODE_GLOBAL means that a node cannot be traversed more than once. This is what the legacy traversal framework does.
</table>

## Relationship Filters

The syntax for relationship filters is described below:

Syntax: [<]RELATIONSHIP_TYPE1[>]|[<]RELATIONSHIP_TYPE2[>]|…​

<table>
input	type	direction
LIKES>
LIKES
OUTGOING
<FOLLOWS
FOLLOWS
INCOMING
KNOWS
KNOWS
BOTH
>
any type
OUTGOING
<
any type
INCOMING
</table>

## Label Filters

The syntax for label filters is described below:

Syntax: [+-/>]LABEL1|LABEL2|*|…​

<table>
input	result
-Foe
blacklist filter - No node in the path will have a label in the blacklist.
+Friend
whitelist filter - All nodes in the path must have a label in the whitelist (exempting termination and end nodes, if using those filters). If no whitelist operator is present, all labels are considered whitelisted.
/Friend
termination filter - Only return paths up to a node of the given labels, and stop further expansion beyond it. Termination nodes do not have to respect the whitelist. Termination filtering takes precedence over end node filtering.
>Friend
end node filter - Only return paths up to a node of the given labels, but continue expansion to match on end nodes beyond it. End nodes do not have to respect the whitelist to be returned, but expansion beyond them is only allowed if the node has a label in the whitelist.
</table>

### Label filter operator precedence and behavior

Multiple label filter operators are allowed at the same time. Take the following example:

labelFilter:'+Person|Movie|-SciFi|>Western|/Romance'

If we work through this label filter, we can see that:
- :Person and :Movie labels are whitelisted
- :SciFi is blacklisted
- :Western is an end node label
- :Romance is as a termination label.

The precedence of operator evaluation isn’t dependent upon their location in the labelFilter but is fixed:

Blacklist filter -, termination filter /, end node filter >, whitelist filter +.

This means:

- No blacklisted label - will ever be present in the nodes of paths returned, even if the same label (or another label of a node with a blacklisted label) is included in another filter list.
- If the termination filter / or end node filter > is used, then only paths up to nodes with those labels will be returned as results. These end nodes are exempt from the whitelist filter.
- If a node is a termination node /, no further expansion beyond the node will occur.
- The whitelist only applies to nodes up to but not including end nodes from the termination or end node filters. If no end node or termination node operators are present, then the whitelist applies to all nodes of the path.
- If no whitelist operators are present in the labelFilter, this is treated as if all labels are whitelisted.

## Examples

The examples in this section are based on the following sample graph:

<cypher>
MERGE (mark:Person:DevRel {name: "Mark"})
MERGE (lju:Person:DevRel {name: "Lju"})
MERGE (praveena:Person:Engineering {name: "Praveena"})
MERGE (zhen:Person:Engineering {name: "Zhen"})
MERGE (martin:Person:Engineering {name: "Martin"})
MERGE (joe:Person:Field {name: "Joe"})
MERGE (stefan:Person:Field {name: "Stefan"})
MERGE (alicia:Person:Product {name: "Alicia"})
MERGE (jake:Person:Product {name: "Jake"})
MERGE (john:Person:Product {name: "John"})
MERGE (jonny:Person:Sales {name: "Jonny"})
MERGE (anthony:Person:Sales {name: "Anthony"})
MERGE (rik:Person:Sales {name: "Rik"})

MERGE (zhen)-[:KNOWS]-(stefan)
MERGE (zhen)-[:KNOWS]-(lju)
MERGE (zhen)-[:KNOWS]-(praveena)
MERGE (zhen)-[:KNOWS]-(martin)
MERGE (mark)-[:KNOWS]-(jake)
MERGE (alicia)-[:KNOWS]-(jake)
MERGE (jonny)-[:KNOWS]-(anthony)
MERGE (john)-[:KNOWS]-(rik)

MERGE (alicia)-[:FOLLOWS]->(joe)
MERGE (joe)-[:FOLLOWS]->(mark)
MERGE (joe)-[:FOLLOWS]->(praveena)
MERGE (joe)-[:FOLLOWS]->(zhen)
MERGE (mark)-[:FOLLOWS]->(stefan)
MERGE (stefan)-[:FOLLOWS]->(joe)
MERGE (praveena)-[:FOLLOWS]->(joe)
MERGE (lju)-[:FOLLOWS]->(jake)
MERGE (alicia)-[:FOLLOWS]->(jonny)
MERGE (zhen)-[:FOLLOWS]->(john)
MERGE (anthony)-[:FOLLOWS]->(joe)
</cypher>

The KNOWS relationship type is considered to be bidirectional, where if Zhen knows Stefan, we can imply that Stefan knows Zhen. When using the KNOWS relationship we will ignore the direction.

The FOLLOWS relationship has a direction, so we will specify a direction when we use it.

### Relationship Type and Node Label Filters

Let’s start by expanding paths from the Praveena node. We only want to consider the KNOWS relationship type, so we’ll specify that as the relationshipFilter parameter.

The following returns the subgraph reachable by the KNOWS relationship at 1 to 2 hops from Praveena

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.subgraphAll(p, {
	relationshipFilter: "KNOWS",
    minLevel: 1,
    maxLevel: 2
})
YIELD nodes, relationships
RETURN nodes, relationships;
</cypher>

We can also provide a node label filter to restrict the nodes that are returned. If we want to only return paths where every node has the Engineering label, we’ll provide the value +Engineering to the labelFilter parameter.

The following returns the subgraph o Engineering people reachable by the KNOWS relationship at 1 to 2 hops from Praveena

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.subgraphAll(p, {
	relationshipFilter: "KNOWS",
	labelFilter: "+Engineering",
    minLevel: 1,
    maxLevel: 2
})
YIELD nodes, relationships
RETURN nodes, relationships;
</cypher>

We lose Lju and Stefan because those nodes don’t have the Engineering label.

We can specify multiple relationship types. The following query starts from the Alicia node, and then expands the FOLLOWS and KNOWS relationships:

The following returns the subgraph of people reachable by the FOLLOWS or KNOWS relationships at 1 to 3 hops from Alicia

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.subgraphAll(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3
})
YIELD nodes, relationships
RETURN nodes, relationships;
</cypher>

This subgraph includes all but one of the people in our graph, which means that Alicia is very well connected.

We can also specify traversal termination criteria using label filters. If we wanted to terminate a traversal as soon as the traversal encounters a node containing the Engineering label, we can use the /Engineering node filter.

The following returns the subgraph reachable by the FOLLOWS or KNOWS relationships at 1 to 3 hops from Alicia, terminating as soon as a node with the Engineering label is reached

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.subgraphAll(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    labelFilter: "/Engineering",
    minLevel: 1,
    maxLevel: 3
})
YIELD nodes, relationships
RETURN nodes, relationships;
</cypher>

We’re now down to only 2 people - Zhen and Praveena. But this query doesn’t capture all of the paths from Alicia that end in a node with the Engineering label. We can use the >Engineering node filter to define a traversal that:
- only returns paths that terminate at nodes with the Engineering label
- continues expansion to end nodes after that, looking for more paths that end with the Engineering label

The following returns the subgraph of Engineering people reachable by the FOLLOWS or KNOWS relationships at 1 to 3 hops from Alicia

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.subgraphAll(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    labelFilter: ">Engineering",
    minLevel: 1,
    maxLevel: 3
})
YIELD nodes, relationships
RETURN nodes, relationships;
</cypher>

Our subgraph now also includes Martin, who is reached via a relationship from Zhen.

### Terminator Nodes and End Nodes

As well as specifying terminator and end labels for traversals, we can also specify terminator and end nodes.
Let’s build on the previous query that found people that Alicia KNOWS or FOLLOWS. We want the returned subgraph to stop as soon as the Mark, Joe, Zhen, or Praveena nodes are reached. We can do that by passing those nodes to the terminatorNodes parameter.

The following returns the subgraph of people that Alicia FOLLOWS or KNOWS from 1 to 3 hops, terminating as soon as Mark, Joe, Zhen, or Rik nodes are reached

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (terminator:Person)
WHERE terminator.name IN ["Mark", "Joe", "Zhen", "Rik"]
WITH p, collect(terminator) AS terminatorNodes
CALL apoc.path.subgraphAll(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    terminatorNodes: terminatorNodes
})
YIELD nodes, relationships
RETURN nodes, relationships;
</cypher>

We have paths to Mark and Joe, but Zhen and Rik can’t be reached This could be because there is no path to Zhen and Rik that doesn’t go through Mark and Joe, or it could mean that there’s no path based on the other traversal criteria.
We can find out whether Mark, Joe, Zhen, or Rik are reachable by passing these nodes to the endNodes parameter.

The following returns the subgraph of people that Alicia FOLLOWS or KNOWS from 1 to 3 hops, ending as soon as Mark, Joe, Zhen, or Rik nodes are reached

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (end:Person)
WHERE end.name IN ["Mark", "Joe", "Zhen", "Rik"]
WITH p, collect(end) AS endNodes
CALL apoc.path.subgraphAll(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    endNodes: endNodes
})
YIELD nodes, relationships
RETURN nodes, relationships;
</cypher>

We can now reach Joe, Mark, and Zhen, but Rik is still unreachable.

### Whitelist Nodes and Blacklist Nodes

Whitelist and blacklist nodes can also be specified.

Let’s build on the previous query that found people that Alicia KNOWS or FOLLOWS. We want any returned paths to only include the nodes Mark, Joe, Zhen, and Praveena, which we can do by passing these nodes to the parameter whitelistNodes.

The following returns nodes reachable by the FOLLOWS or KNOWS relationship types at 1 to 3 hops from Alicia, where the paths to those nodes must only include Mark, Jonny, or Zhen

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (whitelist:Person)
WHERE whitelist.name IN ["Jonny", "Mark", "Zhen"]
WITH p, collect(whitelist) AS whitelistNodes
CALL apoc.path.subgraphAll(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    whitelistNodes: whitelistNodes
})
YIELD nodes, relationships
RETURN nodes, relationships;
</cypher>

Only Jonny can be reached. We can therefore infer that Mark and Zhen are only reachable via another node that wasn’t include in the whitelist.

A blacklist is used to exclude nodes from the paths that lead to reachable nodes. If we want to return nodes that are reachable without going through Joe, we can do this by passing the Joe node to the blacklistNodes parameter.

The following returns nodes reachable by the FOLLOWS or KNOWS relationship types at 1 to 3 hops from Alicia, where the paths to those nodes do not go through Joe

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (joe:Person {name: "Joe"})
CALL apoc.path.subgraphAll(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    blacklistNodes: [joe]
})
YIELD nodes, relationships
RETURN nodes, relationships;
</cypher>

### Sequences of Relationship Types

Sequences of relationship types can be specified by comma separating the values passed to relationshipFilter.

For example, if we want to start from the Joe node and traverse a sequence of the FOLLOWS relationship in the outgoing direction and the KNOWS relationship in either direction, we can specify the relationship filter FOLLOWS>,KNOWS.

The following returns the reachable nodes by following the FOLLOWS and KNOWS relationship types alternately from Joe

<cypher>
MATCH (p:Person {name: "Joe"})
CALL apoc.path.subgraphAll(p, {
	relationshipFilter: "FOLLOWS>,KNOWS",
	beginSequenceAtStart: true,
	minLevel: 1,
	maxLevel: 4
})
YIELD nodes, relationships
RETURN nodes, relationships;
</cypher>

# Expand to a spanning tree

Expands a spanning tree reachable from start node following relationships to max-level adhering to the label filters. The paths returned collectively form a spanning tree.
This procedure has the same behaviour as Expand paths with config with the config uniqueness: "NODE_GLOBAL".

## Procedure Overview

The procedure is described below:

<table>
Qualified Name	Type	Release
apoc.path.spanningTree 
apoc.path.spanningTree(startNode <id>|Node|list, {maxLevel,relationshipFilter,labelFilter,bfs:true, filterStartNode:false, limit:-1, optional:false, endNodes:[], terminatorNodes:[], sequence, beginSequenceAtStart:true}) yield path - expand a spanning tree reachable from start node following relationships to max-level adhering to the label filters
Procedure
APOC Core
</table>

## Configuration Parameters

The procedures support the following config parameters:

<table>
name	type	default	description
minLevel
Long
-1
the minimum number of hops in the traversal. Must be 0 or 1 if specified
maxLevel
Long
-1
the maximum number of hops in the traversal
relationshipFilter
String
null
the relationship types and directions to traverse.
See Relationship Filters.
labelFilter
String
null
the node labels to traverse.
See Label Filters.
beginSequenceAtStart
Boolean
true
starts matching sequences of node labels and/or relationship types (defined in relationshipFilter, labelFilter, or sequences) one node away from the start node.
bfs
Boolean
true
use Breadth First Search when traversing. Uses Depth First Search if set to false
filterStartNode
Boolean
false
whether the labelFilter and sequence apply to the start node of the expansion.
limit
Long
-1
limit the number of paths returned. When using bfs:true, this has the effect of returning paths to the n nearest nodes with labels in the termination or end node filter, where n is the limit given. If set to true, a null value is yielded whenever the expansion would normally eliminate rows due to no results.
endNodes
List<Node>
null
only these nodes can end returned paths, and expansion will continue past these nodes, if possible.
terminatorNodes
List<Node>
null
Only these nodes can end returned paths, and expansion won’t continue past these nodes.
whiteListNodes
List<Node>
null
Only these nodes are allowed in the expansion (though endNodes and terminatorNodes will also be allowed, if present).
blackListNodes
List<Node>
null
None of the paths returned will include these nodes.
</table>

It also has the following fixed parameter:

<table>
name	type	default	description
uniqueness
String
NODE_GLOBAL
the strategy to use when expanding relationships in a traversal. NODE_GLOBAL means that a node cannot be traversed more than once. This is what the legacy traversal framework does.
</table>

## Examples

### Relationship Type and Node Label Filters

Let’s start by expanding paths from the Praveena node. We only want to consider the KNOWS relationship type, so we’ll specify that as the relationshipFilter parameter.

The following returns the spanning tree starting from Praveena and traversing the KNOWS relationship type for 1 to 2 hops

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.spanningTree(p, {
	relationshipFilter: "KNOWS",
    minLevel: 1,
    maxLevel: 2
})
YIELD path
RETURN path;
</cypher>

The spanning tree contains 4 nodes apart from Praveena. Praveena only has a direct KNOWS relationship to Zhen, but Zhen has KNOWS relationships to 3 other people, which means they’re also included in the spanning tree.

We can also provide a node label filter to restrict the nodes that are returned. If we want to only return paths where every node has the Engineering label, we’ll provide the value +Engineering to the labelFilter parameter.

The following returns the spanning tree starting from Praveena and traversing the KNOWS relationship type for 1 to 2 hops, only includin Engineering nodes

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.spanningTree(p, {
	relationshipFilter: "KNOWS",
	labelFilter: "+Engineering",
    minLevel: 1,
    maxLevel: 2
})
YIELD path
RETURN path;
</cypher>

We lose Lju and Stefan from the spanning tree because neither of those nodes had the Engineering label.

We can specify multiple relationship types. The following query starts from the Alicia node, and then expands the FOLLOWS and KNOWS relationships:

The following returns the spanning tree starting from Alicia and traversing the FOLLOWS or KNOWS relationship type for 1 to 3 hops

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.spanningTree(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3
})
YIELD path
RETURN path;
</cypher>

This query returns paths to 11 of the 12 people in the graph, which indicates that Alicia is very well connected.

We can also specify traversal termination criteria using label filters. If we wanted to terminate a traversal as soon as the traversal encounters a node containing the Engineering label, we can use the /Engineering node filter.

The following returns the spanning tree starting from Alicia and traversing the FOLLOWS or KNOWS relationship type for 1 to 3 hops, terminating as soon as a node with the Engineering label is reached

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.spanningTree(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    labelFilter: "/Engineering",
    minLevel: 1,
    maxLevel: 3
})
YIELD path
RETURN path;
</cypher>

Our spanning tree has been reduced to only 3 other nodes apart from Alicia. But this query doesn’t capture the complete spanning tree from Alicia containing nodes with the Engineering label. We can use the >Engineering node filter to define a traversal that:
- only returns paths that terminate at nodes with the Engineering label
- continues expansion to end nodes after that, looking for more paths that end with the Engineering label

The following returns the spanning tree starting from Alicia and traversing the FOLLOWS or KNOWS relationship type for 1 to 3 hops, where paths end with a node with the Engineering label

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.spanningTree(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    labelFilter: ">Engineering",
    minLevel: 1,
    maxLevel: 3
})
YIELD path
RETURN path;
</cypher>

The spanning tree now also reaches Martin, via a relationship from Zhen.

### Terminator Nodes and End Nodes

As well as specifying terminator and end labels for traversals, we can also specify terminator and end nodes.

Let’s build on the previous query that found people that Alicia KNOWS or FOLLOWS. We want the returned spanning tree to stop as soon as the Mark, Joe, Zhen, or Praveena nodes are reached. We can do that by passing those nodes to the terminatorNodes parameter.

The following returns the spanning tree of people that Alicia FOLLOWS or KNOWS from 1 to 3 hops, terminating as soon as Mark, Joe, Zhen, or Rik nodes are reached

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (terminator:Person)
WHERE terminator.name IN ["Mark", "Joe", "Zhen", "Rik"]
WITH p, collect(terminator) AS terminatorNodes
CALL apoc.path.spanningTree(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    terminatorNodes: terminatorNodes
})
YIELD path
RETURN path;
</cypher>

The spanning tMark and Joe are included in the spanning tree, but Rik and Zhen can’t be reached. This could be because there is no path to Zhen and Rik that doesn’t go through Mark and Joe, or it could mean that there’s no path based on the other traversal criteria.

We can find out whether Mark, Joe, Zhen, or Rik are reachable by passing these nodes to the endNodes parameter.

The following returns the spanning tree of people that Alicia FOLLOWS or KNOWS from 1 to 3 hops, ending as soon as Mark, Joe, Zhen, or Rik nodes are reached

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (end:Person)
WHERE end.name IN ["Mark", "Joe", "Zhen", "Rik"]
WITH p, collect(end) AS endNodes
CALL apoc.path.spanningTree(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    endNodes: endNodes
})
YIELD path
RETURN path;
</cypher>

Our spanning tree now includes Joe, Mark, and Zhen, but Rik is still unreachable.

### Whitelist Nodes and Blacklist Nodes

Whitelist and blacklist nodes can also be specified.

Let’s build on the previous query that found people that Alicia KNOWS or FOLLOWS. We want any returned paths to only include the nodes Mark, Joe, Zhen, and Praveena, which we can do by passing these nodes to the parameter whitelistNodes.

The following returns the spanning tree reachable by the FOLLOWS or KNOWS relationship types at 1 to 3 hops from Alicia, where the paths to those nodes must only include Mark, Jonny, or Zhen

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (whitelist:Person)
WHERE whitelist.name IN ["Jonny", "Mark", "Zhen"]
WITH p, collect(whitelist) AS whitelistNodes
CALL apoc.path.spanningTree(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    whitelistNodes: whitelistNodes
})
YIELD path
RETURN path;
</cypher>

Only Jonny can be reached. We can therefore infer that Mark and Zhen are only reachable via another node that wasn’t include in the whitelist.

A blacklist is used to exclude nodes from the paths that lead to reachable nodes. If we want to return nodes that are reachable without going through Joe, we can do this by passing the Joe node to the blacklistNodes parameter.

The following returns the spanning tree reachable by the FOLLOWS or KNOWS relationship types at 1 to 3 hops from Alicia, where the paths to those nodes do not go through Joe

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (joe:Person {name: "Joe"})
CALL apoc.path.spanningTree(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    blacklistNodes: [joe]
})
YIELD path
RETURN path;
</cypher>

### Sequences of Relationship Types

Sequences of relationship types can be specified by comma separating the values passed to relationshipFilter.

For example, if we want to start from the Joe node and traverse a sequence of the FOLLOWS relationship in the outgoing direction and the KNOWS relationship in either direction, we can specify the relationship filter FOLLOWS>,KNOWS.

The following returns the reachable nodes by following the FOLLOWS and KNOWS relationship types alternately from Joe

<cypher>
MATCH (p:Person {name: "Joe"})
CALL apoc.path.spanningTree(p, {
	relationshipFilter: "FOLLOWS>,KNOWS",
	beginSequenceAtStart: true,
	minLevel: 1,
	maxLevel: 4
})
YIELD path
RETURN path;
</cypher>

