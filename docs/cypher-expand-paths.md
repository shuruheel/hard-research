# Path Expander Overview

The Cypher query language supports variable-length pattern matching, but path expansion is limited to relationship types. The path expander procedures enable more powerful variable length path traversals, where users can specify the following:

- the direction of the relationship per relationship type.
- a list of label names which act as a "whitelist" or a "blacklist".
- end nodes for the expansion.

This functionality is supported by five procedures:

<table>
| Procedure | Description |
|-----------|-------------|
| apoc.path.expand() | expands paths using Cypher's default expansion modes (bfs and 'RELATIONSHIP_PATH' uniqueness). |
| apoc.path.expandConfig() | expands paths with more flexible configuration of parameters and expansion modes. |
| apoc.path.subgraphNodes() | expands to nodes of a subgraph. |
| apoc.path.subgraphAll() | expands to nodes of a subgraph and also returns all relationships in the subgraph. |
| apoc.path.spanningTree() | expands to paths collectively forming a spanning tree. | 
</table>
## Expand Paths

The expand paths procedure is the most basic of the path expanders. This procedure enables path traversals based on relationship filters and node filters. See "Expand paths with config" if more control is required over the traversal.

### Procedure Overview

The procedure is described below:

<table>
Qualified Name	Type	Release
apoc.path.expand 
apoc.path.expand(startNode <id>|Node|list, 'TYPE|TYPE_OUT>|<TYPE_IN', '+YesLabel|-NoLabel', minLevel, maxLevel ) yield path - expand from start node following the given relationships from min to max-level adhering to the label filters
Procedure
APOC Core
</table>

## Parameter Syntax

This procedure takes the following parameters:
1. start - a list of nodes or node ids
2. relationshipFilter - the relationship types to be expanded
3. labelFilter - the node labels to be expanded
4. minLevel - the minimum number of hops in our traversal
5. maxLevel - the maximum number of hops in our traversal

### Relationship filters

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

### Label filters

The syntax for label filters is described below:

Syntax: '+YesLabel|-NoLabel'

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

## Examples

The examples in this section are based on the following sample graph:

<cypher>
MERGE (mark:Person:DevRel {name: "Mark"})
MERGE (praveena:Person:Engineering {name: "Praveena"})
MERGE (joe:Person:Field {name: "Joe"})
MERGE (lju:Person:DevRel {name: "Lju"})
MERGE (zhen:Person:Engineering {name: "Zhen"})
MERGE (stefan:Person:Field {name: "Stefan"})
MERGE (alicia:Person:Product {name: "Alicia"})
MERGE (martin:Person:Engineering {name: "Martin"})
MERGE (jake:Person:Product {name: "Jake"})

MERGE (zhen)-[:KNOWS]-(stefan)
MERGE (zhen)-[:KNOWS]-(lju)
MERGE (zhen)-[:KNOWS]-(praveena)
MERGE (zhen)-[:KNOWS]-(martin)
MERGE (mark)-[:KNOWS]-(jake)
MERGE (alicia)-[:KNOWS]-(jake)

MERGE (alicia)-[:FOLLOWS]->(joe)
MERGE (joe)-[:FOLLOWS]->(mark)
MERGE (joe)-[:FOLLOWS]->(praveena)
MERGE (joe)-[:FOLLOWS]->(zhen)
MERGE (mark)-[:FOLLOWS]->(stefan)
MERGE (stefan)-[:FOLLOWS]->(joe)
MERGE (praveena)-[:FOLLOWS]->(joe)
</cypher>

The KNOWS relationship type is considered to be bidirectional, where if Zhen knows Stefan, we can imply that Stefan knows Zhen. When using the KNOWS relationship we will ignore the direction.

The FOLLOWS relationship has a direction, so we will specify a direction when we use it.

Let’s start by expanding paths from the Praveena node. We only want to consider the KNOWS relationship type, so we’ll specify that as the relationship filter.

The following returns the paths to people that Praveena KNOWS from 1 to 2 hops

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.expand(p, "KNOWS", null, 1, 2)
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})
1
(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Martin"})
2
(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:DevRel {name: "Lju"})
2
(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Field {name: "Stefan"})
2
</table>

Praveena only has a direct KNOWS relationship to Zhen, but Zhen has KNOWS relationships to 3 other people, which means they’re 2 hops away from Praveena.

We can also provide a node label filter to restrict the nodes that are returned. The following query only returns paths where every node has the Engineering label.

The following returns paths containing only Engineering people that Praveena KNOWS from 1 to 2 hops

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.expand(p, "KNOWS", "+Engineering", 1, 2)
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})
1
(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Martin"})
2
</table>

We lose the paths that ended with Lju and Stefan because neither of those nodes had the Engineering label.

We can specify multiple relationship types. The following query starts from the Alicia node, and then expands the FOLLOWS and KNOWS relationships:

The following returns paths containing people that Alicia FOLLOWS or KNOWS from 1 to 3 hops

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.expand(p, "FOLLOWS>|KNOWS", "", 1, 3)
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
1
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Sales {name: "Jonny"})
1
(:Person:Product {name: "Alicia"})-[:KNOWS]→(:Person:Product {name: "Jake"})
1
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Sales {name: "Jonny"})-[:KNOWS]→(:Person:Sales {name: "Anthony"})
2
(:Person:Product {name: "Alicia"})-[:KNOWS]→(:Person:Product {name: "Jake"})←[:KNOWS]-(:Person:DevRel {name: "Mark"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:FOLLOWS]→(:Person:Product {name: "John"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Martin"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Praveena"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:DevRel {name: "Lju"})
3
... (19 total rows)
</table>

This query returns 19 paths, Alicia is very well connected!

We can also specify traversal termination criteria using label filters. If we wanted to terminate a traversal as soon as the traversal encounters a node containing the Engineering label, we can use the /Engineering node filter.

The following returns paths containing people that Alicia FOLLOWS or KNOWS from 1 to 3 hops, terminating as soon as a node with the Engineering label is reached

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.expand(p, "FOLLOWS>|KNOWS", "/Engineering", 1, 3)
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})
2
</table>

We’re now down to only two paths. But this query doesn’t capture all of the paths from Alicia that end in a node with the Engineering label. We can use the >Engineering node filter to define a traversal that:
- only returns paths that terminate at nodes with the Engineering label 
- continues expansion to end nodes after that, looking for more paths that end with the Engineering label

The following returns paths containing people that Alicia FOLLOWS or KNOWS from 1 to 3 hops, where paths end with a node with the Engineering label

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.expand(p, "FOLLOWS>|KNOWS", ">Engineering", 1, 3)
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Martin"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Praveena"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})
3
</table>

Our query now also returns paths going through Praveena and Zhen, one going to Martin, and other others going back to Zhen and Praveena!

## Expand Paths with Config

The expand paths with config procedure enables powerful variable length path traversals with fine grained control over the traversals. For a more basic version of the algorithm where fine grained control over traversals isn’t required, see Expand paths.

### Procedure Overview

The procedure is described below:

<table>
Qualified Name	Type	Release
apoc.path.expandConfig 
apoc.path.expandConfig(startNode <id>|Node|list, {minLevel,maxLevel,uniqueness,relationshipFilter,labelFilter,uniqueness:'RELATIONSHIP_PATH',bfs:true, filterStartNode:false, limit:-1, optional:false, endNodes:[], terminatorNodes:[], sequence, beginSequenceAtStart:true}) yield path - expand from start node following the given relationships from min to max-level adhering to the label filters.
Procedure
APOC Core
</table>

### Configuration Parameters

The procedures support the following config parameters:

<table>
name	type	default	description
minLevel
Long
-1
the minimum number of hops in the traversal
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
sequence
String
null
comma-separated alternating label and relationship filters, for each step in a repeating sequence. If present, labelFilter, and relationshipFilter are ignored, as this takes priority.
See Specifying Sequences of node labels and relationship types.
beginSequenceAtStart
Boolean
true
starts matching sequences of node labels and/or relationship types (defined in relationshipFilter, labelFilter, or sequences) one node away from the start node.
uniqueness
String
RELATIONSHIP_PATH
the strategy to use when expanding relationships in a traversal.
See Uniqueness.
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
limit the number of paths returned. When using bfs:true, this has the effect of returning paths to the n nearest nodes with labels in the termination or end node filter, where n is the limit given.
optional
Boolean
false
is path expansion optional? If set to true, a null value is yielded whenever the expansion would normally eliminate rows due to no results.
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

### Relationship Filters

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

### Label Filters

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

#### Label filter operator precedence and behavior

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

### Uniqueness

Uniqueness of nodes and relationships guides the expansion and the returned results. The table below describes the available values:

<table>
value	description
RELATIONSHIP_PATH
For each returned node there’s a (relationship wise) unique path from the start node to it. This is Cypher’s default expansion mode.
NODE_GLOBAL
A node cannot be traversed more than once. This is what the legacy traversal framework does.
NODE_LEVEL
Entities on the same level are guaranteed to be unique.
NODE_PATH
For each returned node there’s a unique path from the start node to it.
NODE_RECENT
This is like NODE_GLOBAL, but only guarantees uniqueness among the most recent visited nodes, with a configurable count. Traversing a huge graph is quite memory intensive in that it keeps track of all the nodes it has visited. For huge graphs a traverser can hog all the memory in the JVM, causing OutOfMemoryError. Together with this Uniqueness you can supply a count, which is the number of most recent visited nodes. This can cause a node to be visited more than once, but scales infinitely.
RELATIONSHIP_GLOBAL
A relationship cannot be traversed more than once, whereas nodes can.
RELATIONSHIP_LEVEL
Entities on the same level are guaranteed to be unique.
RELATIONSHIP_RECENT
Same as for NODE_RECENT, but for relationships.
NONE
No restriction (the user will have to manage it)
</table>

### Specifying Sequences of node labels and relationship types

The sequence parameter is a comma-separated list of alternating label and relationship filters, for each step in a repeating sequence. If present, labelFilter, and relationshipFilter are ignored, as this takes priority.

### Specifying Sequences of node labels and relationship types

Path expander procedures can expand on repeating sequences of labels, relationship types, or both. Sequences can be defined as follows:

- If only using label sequences, use the labelFilter, but use commas to separate the filtering for each step in the repeating sequence.
- If only using relationship sequences, use the relationshipFilter, but use commas to separate the filtering for each step of the repeating sequence.
- If using sequences of both relationships and labels, use the sequence parameter.

<table>
Usage	config param	description	syntax	explanation
label sequences only
labelFilter
Same syntax and filters, but uses commas (,) to separate the filters for each step in the sequence.
labelFilter:'Post|-Blocked,Reply,>Admin'
Start node must be a :Post node that isn’t :Blocked, next node must be a :Reply, and the next must be an :Admin, then repeat if able. Only paths ending with the :Admin node in that position of the sequence will be returned.
relationship sequences only
relationshipFilter
Same syntax, but uses commas (,) to separate the filters for each relationship traversal in the sequence.
relationshipFilter:'NEXT>,<FROM,POSTED>|REPLIED>'
Expansion will first expand NEXT> from the start node, then <FROM, then either POSTED> or REPLIED>, then repeat if able.
sequences of both labels and relationships
sequence
A string of comma-separated alternating label and relationship filters, for each step in a repeating sequence. The sequence should begin with a label filter, and end with a relationship filter. If present, labelFilter, and relationshipFilter are ignored, as this takes priority.
sequence:'Post|-Blocked, NEXT>, Reply, <FROM, >Admin, POSTED>|REPLIED>'
Combines the behaviors above.
</table>

There are some uses cases where the sequence does not begin at the start node, but at one node distant.

The config parameter beginSequenceAtStart toggles this behavior. Its default value is true. If set to false, this changes the expected values for labelFilter, relationshipFilter, and sequence as noted below:

<table>

sequence	altered behavior	example	explanation
labelFilter
The start node is not considered part of the sequence. The sequence begins one node off from the start node.
beginSequenceAtStart:false, labelFilter:'Post|-Blocked,Reply,>Admin'
The next node(s) out from the start node begins the sequence (and must be a :Post node that isn’t :Blocked), and only paths ending with Admin nodes returned.
relationshipFilter
The first relationship filter in the sequence string will not be considered part of the repeating sequence, and will only be used for the first relationship from the start node to the node that will be the actual start of the sequence.
beginSequenceAtStart:false, relationshipFilter:'FIRST>,NEXT>,<FROM,POSTED>|REPLIED>'
FIRST> will be traversed just from the start node to the node that will be the start of the repeating NEXT>,<FROM,POSTED>|REPLIED> sequence.
sequence
Combines the above two behaviors.
beginSequenceAtStart:false, sequence:'FIRST>, Post|-Blocked, NEXT>, Reply, <FROM, >Admin, POSTED>|REPLIED>'
Combines the behaviors above.
</table>

Label filtering in sequences work together with the endNodes+terminatorNodes, though inclusion of a node must be unanimous.
If you need to limit the number of times a sequence repeats, this can be done with the maxLevel config param (multiply the number of iterations with the size of the nodes in the sequence).

### Examples

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

#### Relationship Type and Node Label Filters

Let’s start by expanding paths from the Praveena node. We only want to consider the KNOWS relationship type, so we’ll specify that as the relationshipFilter parameter.

The following returns the paths to people that Praveena KNOWS from 1 to 2 hops

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.expandConfig(p, {
	relationshipFilter: "KNOWS",
    minLevel: 1,
    maxLevel: 2
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})
1
(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Martin"})
2
(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:DevRel {name: "Lju"})
2
(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Field {name: "Stefan"})
2
</table>

Praveena only has a direct KNOWS relationship to Zhen, but Zhen has KNOWS relationships to 3 other people, which means they’re 2 hops away from Praveena.

We can also provide a node label filter to restrict the nodes that are returned. If we want to only return paths where every node has the Engineering label, we’ll provide the value +Engineering to the labelFilter parameter.

The following returns paths containing only Engineering people that Praveena KNOWS from 1 to 2 hops

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.expandConfig(p, {
	relationshipFilter: "KNOWS",
	labelFilter: "+Engineering",
    minLevel: 1,
    maxLevel: 2
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})
1
(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Martin"})
2
</table>

We lose the paths that ended with Lju and Stefan because neither of those nodes had the Engineering label.

We can specify multiple relationship types. The following query starts from the Alicia node, and then expands the FOLLOWS and KNOWS relationships:

The following returns paths containing people that Alicia FOLLOWS or KNOWS from 1 to 3 hops

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.expandConfig(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
1
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Sales {name: "Jonny"})
1
(:Person:Product {name: "Alicia"})-[:KNOWS]→(:Person:Product {name: "Jake"})
1
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Sales {name: "Jonny"})-[:KNOWS]→(:Person:Sales {name: "Anthony"})
2
(:Person:Product {name: "Alicia"})-[:KNOWS]→(:Person:Product {name: "Jake"})←[:KNOWS]-(:Person:DevRel {name: "Mark"})
2
... (19 total rows)
</table>

This query returns 19 paths, Alicia is very well connected!

We can also specify traversal termination criteria using label filters. If we wanted to terminate a traversal as soon as the traversal encounters a node containing the Engineering label, we can use the /Engineering node filter.

The following returns paths containing people that Alicia FOLLOWS or KNOWS from 1 to 3 hops, terminating as soon as a node with the Engineering label is reached

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.expandConfig(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    labelFilter: "/Engineering",
    minLevel: 1,
    maxLevel: 3
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

<table>
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})
2
</table>

We’re now down to only two paths. But this query doesn’t capture all of the paths from Alicia that end in a node with the Engineering label. We can use the >Engineering node filter to define a traversal that:
- only returns paths that terminate at nodes with the Engineering label
- continues expansion to end nodes after that, looking for more paths that end with the Engineering label

The following returns paths containing people that Alicia FOLLOWS or KNOWS from 1 to 3 hops, where paths end with a node with the Engineering label

<cypher>
MATCH (p:Person {name: "Alicia"})
CALL apoc.path.expandConfig(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    labelFilter: ">Engineering",
    minLevel: 1,
    maxLevel: 3
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Martin"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Praveena"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})
3
</table>

Our query now also returns paths going through Praveena and Zhen, one going to Martin, and other others going back to Zhen and Praveena!

### Terminator Nodes and End Nodes

As well as specifying terminator and end labels for traversals, we can also specify terminator and end nodes.

Let’s build on the previous query that found people that Alicia KNOWS or FOLLOWS. We want any returned paths to stop as soon as the Joe node is encountered, which we can do by passing the Joe node to the terminatorNodes parameter.

The following returns paths containing people that Alicia FOLLOWS or KNOWS from 1 to 3 hops, terminating as soon as Joe is reached

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (joe:Person {name: "Joe"})
CALL apoc.path.expandConfig(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    terminatorNodes: [joe]
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
1
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Sales {name: "Jonny"})-[:KNOWS]→(:Person:Sales {name: "Anthony"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
3
</table>

Alicia FOLLOWS Joe, but there’s also another path that goes via Jonny and Anthony.

The terminator nodes approach doesn’t necessarily find all the paths that exist between Alicia and Joe. There might be other paths that go through the Joe node twice. We can find these paths by passing the Joe node to the endNodes parameter. If we use this parameter, all returned paths will end at the Joe node, but expansion will continue past this node to try and find other paths that end at Joe.

The following returns paths containing people that Alicia FOLLOWS or KNOWS from 1 to 3 hops, where paths end when they reach Joe

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (joe:Person {name: "Joe"})
CALL apoc.path.expandConfig(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    endNodes: [joe]
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
1
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Sales {name: "Jonny"})-[:KNOWS]→(:Person:Sales {name: "Anthony"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
3
</table>

We’ve got the two paths we got with the terminator nodes approach, from Alicia to Joe, and from Alicia to Jonny to Jonny to Joe. But we’ve also got an extra path that goes from Alicia to Joe to Praveena to Joe.

### Whitelist Nodes and Blacklist Nodes

Whitelist and blacklist nodes can also be specified.

Let’s build on the previous query that found people that Alicia KNOWS or FOLLOWS. We want any returned paths to only include the nodes Mark, Joe, Zhen, and Praveena, which we can do by passing these nodes to the parameter whitelistNodes.

The following returns paths from Alicia following the FOLLOWS or KNOWS relationship types from 1 to 3 hops, only including paths that contain Mark, Joe, Zhen, and Praveena

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (whitelist:Person)
WHERE whitelist.name IN ["Mark", "Joe", "Zhen", "Praveena"]
WITH p, collect(whitelist) AS whitelistNodes
CALL apoc.path.expandConfig(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    whitelistNodes: whitelistNodes
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
1
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Praveena"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})
3
</table>

Out of the white list, the only person with a direct connection to Alicia is Joe, so all paths go through him. We then go from Joe to the others, and then between each other for the paths of 3 hops.

A blacklist is used to exclude nodes from the returned paths. If we want to exclude paths that contain Joe, we can do this by passing the Joe node to the blacklistNodes parameter.

The following returns paths containing people that Alicia FOLLOWS or KNOWS from 1 to 3 hops, excluding paths that include Joe

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (joe:Person {name: "Joe"})
CALL apoc.path.expandConfig(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    blacklistNodes: [joe]
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Sales {name: "Jonny"})
1
(:Person:Product {name: "Alicia"})-[:KNOWS]→(:Person:Product {name: "Jake"})
1
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Sales {name: "Jonny"})-[:KNOWS]→(:Person:Sales {name: "Anthony"})
2
(:Person:Product {name: "Alicia"})-[:KNOWS]→(:Person:Product {name: "Jake"})←[:KNOWS]-(:Person:DevRel {name: "Mark"})
2
(:Person:Product {name: "Alicia"})-[:KNOWS]→(:Person:Product {name: "Jake"})←[:KNOWS]-(:Person:DevRel {name: "Mark"})-[:FOLLOWS]→(:Person:Field {name: "Stefan"})
3
</table>

This returns a very small set of paths since Joe was a very pivotal node in connecting Alicia to the rest of the graph.

### Breadth First Search and Depth First Search

We can control whether the traversal uses the Breadth First Search (BFS), by specifying bfs: true, or Depth First Search algorithm (DFS), by specifying bfs: false. This is often combined with the limit parameter to find the nearest nodes based on the chosen algorithm.

The following returns 10 paths containing people that Alicia FOLLOWS or KNOWS from 1 to 3 hops, using BFS

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (joe:Person {name: "Joe"})
CALL apoc.path.expandConfig(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 5,
    bfs: true,
    limit: 10
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
1
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Sales {name: "Jonny"})
1
(:Person:Product {name: "Alicia"})-[:KNOWS]→(:Person:Product {name: "Jake"})
1
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Sales {name: "Jonny"})-[:KNOWS]→(:Person:Sales {name: "Anthony"})
2
(:Person:Product {name: "Alicia"})-[:KNOWS]→(:Person:Product {name: "Jake"})←[:KNOWS]-(:Person:DevRel {name: "Mark"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:FOLLOWS]→(:Person:Product {name: "John"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Martin"})
3
</table>

From these results we can see that paths are completely expanded at each level before going onto the next one. For example, we first expand from:
- Alicia → Joe
- Alicia → Jonny
- Alicia → Jake
Before then following relationships from those nodes. And once it’s expanded everything at level 2, it will then explore level 3.

If we use the Depth First Search algorithm, the traversal will go as far as it can (up to the maxLevel of hops) down a particular path, before going back up and exploring other ones.

The following returns 10 paths containing people that Alicia FOLLOWS or KNOWS from 1 to 3 hops, using DFS

<cypher>
MATCH (p:Person {name: "Alicia"})
MATCH (joe:Person {name: "Joe"})
CALL apoc.path.expandConfig(p, {
    relationshipFilter: "FOLLOWS>|KNOWS",
    minLevel: 1,
    maxLevel: 3,
    bfs: false,
    limit: 10
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
1
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})
2
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:FOLLOWS]→(:Person:Product {name: "John"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Martin"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Praveena"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:DevRel {name: "Lju"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Field {name: "Stefan"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
3
(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})
3
</table>

Now we have a different set of paths returned. We don’t even see the paths from Alicia to Jonny or Alicia to Jake because our limit of 10 paths is completely taken up with paths going through Joe.

### Uniqueness

We can specify the uniqueness strategy to be used by the traversal through the uniqueness parameter. See Uniqueness for a list of valid strategies. The default value is RELATIONSHIP_PATH.

In this section we’re going to write queries that start from Joe and traverse the FOLLOWS relationship.

The following returns the nodes in paths starting from Joe and traversing the FOLLOWS relationship type from 1 to 3 hops

<cypher>
MATCH (p:Person {name: "Joe"})
CALL apoc.path.expandConfig(p, {
    relationshipFilter: "FOLLOWS>",
    minLevel: 1,
    maxLevel: 3,
    uniqueness: "RELATIONSHIP_PATH" // default
})
YIELD path
RETURN [node in nodes(path) | node.name] AS nodes, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
nodes	hops
["Joe", "Zhen"]
1
["Joe", "Praveena"]
1
["Joe", "Mark"]
1
["Joe", "Zhen", "John"]
2
["Joe", "Praveena", "Joe"]
2
["Joe", "Mark", "Stefan"]
2
["Joe", "Praveena", "Joe", "Zhen"]
3
["Joe", "Praveena", "Joe", "Mark"]
3
["Joe", "Mark", "Stefan", "Joe"]
3
</table>

Several of the paths returned contain the Joe node twice. If we want to ensure that the nodes in a path are unique, we can use the NODE_PATH strategy.

The following returns the nodes in paths starting from Joe and traversing the FOLLOWS relationship type from 1 to 3 hops, using the NODE_PATH strategy

<cypher>
MATCH (p:Person {name: "Joe"})
CALL apoc.path.expandConfig(p, {
    relationshipFilter: "FOLLOWS>",
    minLevel: 1,
    maxLevel: 3,
    uniqueness: "NODE_PATH"
})
YIELD path
RETURN [node in nodes(path) | node.name] AS nodes, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
nodes	hops
["Joe", "Zhen"]
1
["Joe", "Praveena"]
1
["Joe", "Mark"]
1
["Joe", "Zhen", "John"]
2
["Joe", "Mark", "Stefan"]
2
</table>

The paths returned now have unique lists of nodes.

### Sequences of Relationship Types

Sequences of relationship types can be specified by comma separating the values passed to relationshipFilter.
For example, if we want to start from the Joe node and traverse a sequence of the FOLLOWS relationship in the outgoing direction and the KNOWS relationship in either direction, we can specify the relationship filter FOLLOWS>,KNOWS.

The following returns the paths of 1 to 4 hops from Joe where the relationship types alternate between FOLLOWS and KNOWS

<cypher>
MATCH (p:Person {name: "Joe"})
CALL apoc.path.expandConfig(p, {
	relationshipFilter: "FOLLOWS>,KNOWS",
	beginSequenceAtStart: true,
	minLevel: 1,
	maxLevel: 4
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})
1
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})
1
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})
1
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Martin"})
2
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Praveena"})
2
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:DevRel {name: "Lju"})
2
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Field {name: "Stefan"})
2
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})
2
... (more results)
</table>

The minLevel and maxLevel values refer to the number of relationships in the path. Using a minLevel of 1 means that paths one hop from Joe with the FOLLOWS relationship type will be returned. If we want to ensure that the relationship type sequence defined in this relationshipFilter is matched at least once, we need to use a minLevel of 2 since there are two relationship types in the filter.

The following returns the paths of 2 to 4 hops from Joe where the relationship types alternate between FOLLOWS and KNOWS

<cypher>
MATCH (p:Person {name: "Joe"})
CALL apoc.path.expandConfig(p, {
	relationshipFilter: "FOLLOWS>,KNOWS",
	beginSequenceAtStart: true,
	minLevel: 2,
	maxLevel: 4
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Martin"})
2
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Praveena"})
2
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:DevRel {name: "Lju"})
2
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Field {name: "Stefan"})
2
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Praveena"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})
2
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})-[:KNOWS]→(:Person:Product {name: "Jake"})
2
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:Engineering {name: "Praveena"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
3
(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})-[:KNOWS]→(:Person:DevRel {name: "Lju"})-[:FOLLOWS]→(:Person:Product {name: "Jake"})
3
... (more results)
</table>

This config can also be used in combination with beginSequenceAtStart: false, which means that the sequence will start one hop away from the starting node. If we use this config, it means that the first relationship type defined in relationshipFilter will only apply to the starting node.

The following returns the paths of 3 to 5 hops from Jake where the relationship types alternate between FOLLOWS and KNOWS, after first following KNOWS relationships from Jake

<cypher>
MATCH (p:Person {name: "Jake"})
CALL apoc.path.expandConfig(p, {
	relationshipFilter: "KNOWS,FOLLOWS>,KNOWS",
	beginSequenceAtStart: false,
	minLevel: 3,
	maxLevel: 7
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Product {name: "Jake"})←[:KNOWS]-(:Person:DevRel {name: "Mark"})-[:FOLLOWS]→(:Person:Field {name: "Stefan"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})
3
(:Person:Product {name: "Jake"})←[:KNOWS]-(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Sales {name: "Jonny"})-[:KNOWS]→(:Person:Sales {name: "Anthony"})
3
(:Person:Product {name: "Jake"})←[:KNOWS]-(:Person:DevRel {name: "Mark"})-[:FOLLOWS]→(:Person:Field {name: "Stefan"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})-[:FOLLOWS]→(:Person:Product {name: "John"})
4
(:Person:Product {name: "Jake"})←[:KNOWS]-(:Person:Product {name: "Alicia"})-[:FOLLOWS]→(:Person:Sales {name: "Jonny"})-[:KNOWS]→(:Person:Sales {name: "Anthony"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
4
(:Person:Product {name: "Jake"})←[:KNOWS]-(:Person:DevRel {name: "Mark"})-[:FOLLOWS]→(:Person:Field {name: "Stefan"})←[:KNOWS]-(:Person:Engineering {name: "Zhen"})-[:FOLLOWS]→(:Person:Product {name: "John"})-[:KNOWS]→(:Person:Sales {name: "Rik"})
5
</table>

### Sequences of Node Labels

Sequences of node labels can be specified by comma separating values passed to labelFilter. This is usually used in combination with beginSequenceAtStart: false, which means that sequences will start one hop away from the starting node.

For example, if we start from the Praveena node and want to return the paths that contain alternating Field and DevRel nodes, we can specify a label filter of "+Field,+DevRel".

The following returns the paths of 1 to 4 hops from Praveena where the nodes alternate between having the Field and DevRel labels.

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.expandConfig(p, {
	labelFilter: "+Field,+DevRel",
	beginSequenceAtStart: false,
	minLevel: 1,
	maxLevel: 4
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Engineering {name: "Praveena"})←[:FOLLOWS]-(:Person:Field {name: "Joe"})
1
(:Person:Engineering {name: "Praveena"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})
1
(:Person:Engineering {name: "Praveena"})←[:FOLLOWS]-(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})
2
(:Person:Engineering {name: "Praveena"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})
2
(:Person:Engineering {name: "Praveena"})←[:FOLLOWS]-(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})-[:FOLLOWS]→(:Person:Field {name: "Stefan"})
3
(:Person:Engineering {name: "Praveena"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})-[:FOLLOWS]→(:Person:Field {name: "Stefan"})
3
</table>

The minLevel and maxLevel values refer to the number of relationships in the path. Using a minLevel of 1 means that paths where the node one hop from Praveena has the Field label will be returned. If we want to ensure that the label sequence defined in this labelFilter is matched at least once, we need to use a minLevel of 2.

The following returns the paths of 2 to 4 hops from Praveena where the nodes alternate between having the Field and DevRel labels.

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.expandConfig(p, {
	labelFilter: "+Field,+DevRel",
	beginSequenceAtStart: false,
	minLevel: 2,
	maxLevel: 4
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Engineering {name: "Praveena"})←[:FOLLOWS]-(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})
2
(:Person:Engineering {name: "Praveena"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})
2
(:Person:Engineering {name: "Praveena"})←[:FOLLOWS]-(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})-[:FOLLOWS]→(:Person:Field {name: "Stefan"})
3
(:Person:Engineering {name: "Praveena"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})-[:FOLLOWS]→(:Person:Field {name: "Stefan"})
3
</table>

The paths that only contain a relationship from Praveena to Joe have now been filtered out.

But what if we don’t want to specify multiple labels exist, but instead want to find paths where a node doesn’t have a label? To find paths that contain alternating Field and not Field nodes, we can specify a label filter of "+Field,-Field".

The following returns the paths of 1 to 4 hops from Praveena where the nodes alternate between having the Field label and not having the Field label

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.expandConfig(p, {
	labelFilter: "+Field,-Field",
	beginSequenceAtStart: false,
	minLevel: 2,
	maxLevel: 4
})
YIELD path
RETURN path, length(path) AS hops
ORDER BY hops;
</cypher>

Results:
<table>
path	hops
(:Person:Engineering {name: "Praveena"})←[:FOLLOWS]-(:Person:Field {name: "Joe"})←[:FOLLOWS]-(:Person:Sales {name: "Anthony"})
2
(:Person:Engineering {name: "Praveena"})←[:FOLLOWS]-(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})
2
(:Person:Engineering {name: "Praveena"})←[:FOLLOWS]-(:Person:Field {name: "Joe"})←[:FOLLOWS]-(:Person:Product {name: "Alicia"})
2
(:Person:Engineering {name: "Praveena"})←[:FOLLOWS]-(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:DevRel {name: "Mark"})
2
(:Person:Engineering {name: "Praveena"})←[:FOLLOWS]-(:Person:Field {name: "Joe"})←[:FOLLOWS]-(:Person:Engineering {name: "Praveena"})
2
(:Person:Engineering {name: "Praveena"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})←[:FOLLOWS]-(:Person:Sales {name: "Anthony"})
2
(:Person:Engineering {name: "Praveena"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})-[:FOLLOWS]→(:Person:Engineering {name: "Zhen"})
2
(:Person:Engineering {name: "Praveena"})-[:FOLLOWS]→(:Person:Field {name: "Joe"})←[:FOLLOWS]-(:Person:Product {name: "Alicia"})
2
... (more results)
</table>

We’ve got a lot more paths, with path lengths between 2 and 4 hops. These paths have the following labels:

- 2 hops - Field → Not Field
- 3 hops - Field → Not Field → Field
- 4 hops - Field → Not Field → Field → Not Field

These paths are a bit difficult to read, so we can simplify the output by using the nodes function to just return the nodes. We’ll also filter the results so that we only return paths that match the complete +Field,-Field label filter. We can do this by only returning paths of even length:

The following returns nodes of paths of 1 to 4 hops from Praveena where the nodes alternate between having the Field label and not having the Field label

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.expandConfig(p, {
	labelFilter: "+Field,-Field",
	beginSequenceAtStart: false,
	minLevel: 2,
	maxLevel: 4
})
YIELD path
WHERE length(path) % 2 = 0

// Remove the Praveena node from the returned path
RETURN nodes(path)[1..] AS nodes, length(path) AS hops

ORDER BY hops;
</cypher>

Results:
<table>
nodes	hops
[(:Person:Field {name: "Joe"}), (:Person:Sales {name: "Anthony"})]
2
[(:Person:Field {name: "Joe"}), (:Person:Engineering {name: "Zhen"})]
2
[(:Person:Field {name: "Joe"}), (:Person:Product {name: "Alicia"})]
2
[(:Person:Field {name: "Joe"}), (:Person:DevRel {name: "Mark"})]
2
[(:Person:Field {name: "Joe"}), (:Person:Engineering {name: "Praveena"})]
2
[(:Person:Field {name: "Joe"}), (:Person:Sales {name: "Anthony"})]
2
[(:Person:Field {name: "Joe"}), (:Person:Engineering {name: "Zhen"})]
2
[(:Person:Field {name: "Joe"}), (:Person:Product {name: "Alicia"})]
2
[(:Person:Field {name: "Joe"}), (:Person:Engineering {name: "Praveena"})]
2
[(:Person:Field {name: "Joe"}), (:Person:DevRel {name: "Mark"})]
2
[(:Person:Field {name: "Joe"}), (:Person:Engineering {name: "Zhen"}), (:Person:Field {name: "Stefan"}), (:Person:DevRel {name: "Mark"})]
4
[(:Person:Field {name: "Joe"}), (:Person:DevRel {name: "Mark"}), (:Person:Field {name: "Stefan"}), (:Person:Engineering {name: "Zhen"})]
4
[(:Person:Field {name: "Joe"}), (:Person:Engineering {name: "Zhen"}), (:Person:Field {name: "Stefan"}), (:Person:DevRel {name: "Mark"})]
4
[(:Person:Field {name: "Joe"}), (:Person:DevRel {name: "Mark"}), (:Person:Field {name: "Stefan"}), (:Person:Engineering {name: "Zhen"})]
4
</table>

The * character can be used as a wildcard in a node sequence to indicate that any label can appear in that position. If we want to match a sequence of nodes with any label followed by one with the DevRel label, we can specify the label filter *,+DevRel

The following returns nodes of paths of 2 to 4 hops from Praveena where the nodes alternate between having any label and the DevRel label

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.path.expandConfig(p, {
	labelFilter: "*,+DevRel",
	beginSequenceAtStart: false,
	minLevel: 2,
	maxLevel: 4
})
YIELD path
WHERE length(path) % 2 = 0

// Remove the Praveena node from the returned path
RETURN nodes(path)[1..] AS nodes, length(path) AS hops

ORDER BY hops;
</cypher>

Results:
<table>
nodes	hops
[(:Person:Field {name: "Joe"}), (:Person:DevRel {name: "Mark"})]
2
[(:Person:Field {name: "Joe"}), (:Person:DevRel {name: "Mark"})]
2
[(:Person:Engineering {name: "Zhen"}), (:Person:DevRel {name: "Lju"})]
2
[(:Person:Field {name: "Joe"}), (:Person:DevRel {name: "Mark"}), (:Person:Product {name: "Jake"}), (:Person:DevRel {name: "Lju"})]
4
[(:Person:Field {name: "Joe"}), (:Person:DevRel {name: "Mark"}), (:Person:Product {name: "Jake"}), (:Person:DevRel {name: "Lju"})]
4
[(:Person:Engineering {name: "Zhen"}), (:Person:DevRel {name: "Lju"}), (:Person:Product {name: "Jake"}), (:Person:DevRel {name: "Mark"})]
4
</table>

## Path Manipulator

The functions in this section can be used to create, combine and split paths.

### Function Overview

The available functions are described below:

<table>
Qualified Name	Type	Release
apoc.path.create 
apoc.path.create(startNode,[rels]) - creates a path instance of the given elements
Function
APOC Core
apoc.path.combine 
apoc.path.combine(path1, path2) - combines the paths into one if the connecting node matches
Function
APOC Core
apoc.path.slice 
apoc.path.slice(path, [offset], [length]) - creates a sub-path with the given offset and length
Function
APOC Core
apoc.path.elements 
apoc.path.elements(path) - returns a list of node-relationship-node-…​
Function
APOC Core
</table>

### Examples

The apoc.path.create function creates paths from a start node and a list of relationhips. One use case for this function is combining relationships from OPTIONAL MATCH clauses.

The following query creates a path from relationships returned by OPTIONAL MATCH clauses

<cypher>
MATCH (club:Club)
OPTIONAL MATCH (club)-[inLeague:IN_LEAGUE]->(league)
OPTIONAL MATCH (league)-[inCountry:IN_COUNTRY]->(country)
OPTIONAL MATCH (country)-[inConfederation:IN_CONFEDERATION]->(confederation)
RETURN club.name, apoc.path.create(club, [inLeague, inCountry, inConfederation]) AS path
ORDER BY length(path);
</cypher>

Results:
<table>
club.name	path
"Juventus"
(:Club {name: "Juventus"})-[:IN_LEAGUE]→(:League {name: "Serie A"})
"Flamengo"
(:Club {name: "Flamengo"})-[:IN_LEAGUE]→(:League {name: "Brasileirão"})-[:IN_COUNTRY]→(:Country {name: "Brazil"})
"Man Utd"
(:Club {name: "Man Utd"})-[:IN_LEAGUE]→(:League {name: "Premier League"})-[:IN_COUNTRY]→(:Country {name: "England"})-[:IN_CONFEDERATION]→(:Confederation {name: "UEFA"})
</table>

If we want to create a path from a query that contains two OPTIONAL MATCH clauses, we can instead use the apoc.path.combine function.

The following returns a path that combines the (club)-[:IN_LEAGUE]→(league) and (league)-[:IN_COUNTRY]→(country) paths

<cypher>
MATCH (club:Club)
OPTIONAL MATCH path1 = (club)-[:IN_LEAGUE]->(league)
OPTIONAL MATCH path2 = (league)-[:IN_COUNTRY]->(country)
RETURN club.name, apoc.path.combine(path1, pathThe apoc.path.slice function returns a subset of a path starting from a specified offset for a specified number of elements.2) AS path
ORDER BY length(path);
</cypher>

Results:
<table>
club.name	path
"Juventus"
(:Club {name: "Juventus"})-[:IN_LEAGUE]→(:League {name: "Serie A"})
"Man Utd"
(:Club {name: "Man Utd"})-[:IN_LEAGUE]→(:League {name: "Premier League"})-[:IN_COUNTRY]→(:Country {name: "England"})
"Flamengo"
(:Club {name: "Flamengo"})-[:IN_LEAGUE]→(:League {name: "Brasileirão"})-[:IN_COUNTRY]→(:Country {name: "Brazil"})
</table>

The apoc.path.slice function returns a subset of a path starting from a specified offset for a specified number of elements.

The following returns a subset of the combined path, starting from an offset of 1 for a length of 1

<cypher>
MATCH (club:Club)
OPTIONAL MATCH path1 = (club)-[:IN_LEAGUE]->(league)
OPTIONAL MATCH path2 = (league)-[:IN_COUNTRY]->(country)
WITH apoc.path.combine(path1, path2) AS path
RETURN apoc.path.slice(path, 1, 1);
</cypher>

Results:
<table>
apoc.path.slice(path, 1, 1)
(:League {name: "Premier League"})-[:IN_COUNTRY]→(:Country {name: "England"})
(:League {name: "Serie A"})
(:League {name: "Brasileirão"})-[:IN_COUNTRY]→(:Country {name: "Brazil"})
</table>

The apoc.path.elements function converts a path into a list of nodes and relationships.

The following returns a list of entities in the (club)-[:IN_LEAGUE]→(league)-[:IN_COUNTRY]→(country) path

<cypher>
MATCH path = (club:Club)-[:IN_LEAGUE]->(league)-[:IN_COUNTRY]->(country)
RETURN path, apoc.path.elements(path);
</cypher>

Results:
<table>
path	apoc.path.elements(path)
(:Club {name: "Man Utd"})-[:IN_LEAGUE]→(:League {name: "Premier League"})-[:IN_COUNTRY]→(:Country {name: "England"})
[(:Club {name: "Man Utd"}), [:IN_LEAGUE], (:League {name: "Premier League"}), [:IN_COUNTRY], (:Country {name: "England"})]
(:Club {name: "Flamengo"})-[:IN_LEAGUE]→(:League {name: "Brasileirão"})-[:IN_COUNTRY]→(:Country {name: "Brazil"})
[(:Club {name: "Flamengo"}), [:IN_LEAGUE], (:League {name: "Brasileirão"}), [:IN_COUNTRY], (:Country {name: "Brazil"})]
</table>

We can use this function to return a stream of triples representing the nodes and relationships contained in paths.

The following returns triples of (subject, predicate, object)

<cypher>
MATCH path = (club:Club)
OPTIONAL MATCH path1 = (club)-[:IN_LEAGUE]->(league)
OPTIONAL MATCH path2 = (league)-[:IN_COUNTRY]->(country)
WITH apoc.path.combine(path1, path2) AS path
WITH apoc.path.elements(path) AS elements
UNWIND range(0, size(elements)-2) AS index
WITH elements, index
WHERE index %2 = 0
RETURN elements[index] AS subject, elements[index+1] AS predicate, elements[index+2] AS object;
</cypher>

Results:
<table>
subject	predicate	object
(:Club {name: "Man Utd"})
[:IN_LEAGUE]
(:League {name: "Premier League"})
(:League {name: "Premier League"})
[:IN_COUNTRY]
(:Country {name: "England"})
(:Club {name: "Juventus"})
[:IN_LEAGUE]
(:League {name: "Serie A"})
(:Club {name: "Flamengo"})
[:IN_LEAGUE]
(:League {name: "Brasileirão"})
(:League {name: "Brasileirão"})
[:IN_COUNTRY]
(:Country {name: "Brazil"})
</table>

