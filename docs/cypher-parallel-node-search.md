# Node Querying
<table>
Node Querying

Table 1. Functions
apoc.nodes.isDense(node)
returns true if it is a dense node
apoc.nodes.connected(start, end, rel-direction-pattern)
returns true when the node is connected to the other node, optimized for dense nodes
apoc.node.relationship.exists(node, rel-direction-pattern)
returns true when the node has the relationships of the pattern
apoc.node.relationships.exist(node, rel-direction-pattern)
returns a map with rel-pattern, boolean for the given relationship patterns
apoc.nodes.relationships.exist(node|nodes|id|[ids], rel-direction-pattern)
returns a list of maps where each one has two fields: node which is the node subject of the analysis and exists which is a map with <rel-pattern, boolean> for the given relationship patterns
apoc.node.relationship.types(node, rel-direction-pattern)
returns a list of distinct relationship types
apoc.nodes.relationship.types(node|nodes|id|[ids], rel-direction-pattern)
returns a list of maps where each one has two fields: node which is the node subject of the analysis and types which is a list of distinct relationship types
apoc.node.degree(node, rel-direction-pattern)
returns total degrees of the given relationships in the pattern, can use '>' or '<' for all outgoing or incoming relationships
apoc.node.id(node)
returns id for (virtual) nodes
apoc.node.degree.in(node, relationshipName)
returns total number of incoming relationship
apoc.node.degree.out(node, relationshipName)
returns total number of outgoing relationship
apoc.node.labels(node)
returns labels for (virtual) nodes
apoc.any.properties(node/map, )
returns properties for virtual and real nodes, and maps. Optionally restrict via keys.
apoc.any.property(node/map)
returns property for virtual and real nodes, and maps
apoc.label.exists(element, label)
returns true or false related to label existance
</table>

rel-direction-pattern syntax:

[<]RELATIONSHIP_TYPE1[>]|[<]RELATIONSHIP_TYPE2[>]|…​

Example: 'FRIEND|MENTORS>|<REPORTS_TO' will match to :FRIEND relationships in either direction, outgoing :MENTORS relationships, and incoming :REPORTS_TO relationships.

Procedures:
<table>
CALL apoc.nodes.get(node|nodes|id|[ids])
quickly returns all nodes with these ids
</table>

# Parallel Node Search
Utility to find nodes in parallel (if possible). These procedures return a single list of nodes or a list of 'reduced' records with node id, labels, and the properties where the search was executed upon.

<table>
call apoc.search.node(labelPropertyMap, searchType, search ) yield node
A distinct set of Nodes will be returned.
call apoc.search.nodeAll(labelPropertyMap, searchType, search ) yield node
All the found Nodes will be returned.
call apoc.search.nodeReduced(labelPropertyMap, searchType, search ) yield id, labels, values
A merged set of 'minimal' Node information will be returned. One record per node (-id).
call apoc.search.nodeAllReduced(labelPropertyMap, searchType, search ) yield id, labels, values
All the found 'minimal' Node information will be returned. One record per label and property.
</table>

These procedures are passed the following parameters:

<table>
labelPropertyMap
'{ label1 : "propertyOne", label2 :["propOne","propTwo"] }'
(JSON or Map) For every Label-Property combination a search will be executed in parallel (if possible): Label1.propertyOne, label2.propOne and label2.propTwo.
searchType
'exact' or 'contains' or 'starts with' or 'ends with'
Case insensitive string search operators
searchType
"<", ">", "=", "<>", "⇐", ">=", "=~"
Operators
search
'Keanu'
The actual search term (string, number, etc).
</table>

# Example

<cypher>
CALL apoc.search.nodeAll('{Person: "name",Movie: ["title","tagline"]}','contains','her') YIELD node AS n RETURN n
call apoc.search.nodeReduced({Person: 'born', Movie: ['released']},'>',2000) yield id, labels, properties RETURN *
</cypher>