# Neighbor Functions
The Neighborhood search procedures enable quick discovery of surrounding nodes based on a specific relationship type and number of hops.

## Available procedures

The table below describes the available procedures:

<table>
Qualified Name	Type	Release
apoc.neighbors.athop 
apoc.neighbors.athop(node, rel-direction-pattern, distance) - returns distinct nodes of the given relationships in the pattern at a distance, can use '>' or '<' for all outgoing or incoming relationships
Procedure
APOC Core
apoc.neighbors.byhop 
apoc.neighbors.byhop(node, rel-direction-pattern, distance) - returns distinct nodes of the given relationships in the pattern at each distance, can use '>' or '<' for all outgoing or incoming relationships
Procedure
APOC Core
apoc.neighbors.tohop 
apoc.neighbors.tohop(node, rel-direction-pattern, distance) - returns distinct nodes of the given relationships in the pattern up to a certain distance, can use '>' or '<' for all outgoing or incoming relationships
Procedure
APOC Core
</table>

## Relationship Filters

The 2nd parameter in each of the neighborhood search procedures is a relationship filter. A relationship filter is a | separated list of relationship types, using the following syntax:

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

## Examples

The examples in this section are based on the following sample graph:

<cypher>
MERGE (mark:Person {name: "Mark"})
MERGE (praveena:Person {name: "Praveena"})
MERGE (joe:Person {name: "Joe"})
MERGE (lju:Person {name: "Lju"})
MERGE (michael:Person {name: "Michael"})
MERGE (emil:Person {name: "Emil"})
MERGE (ryan:Person {name: "Ryan"})

MERGE (ryan)-[:FOLLOWS]->(joe)
MERGE (joe)-[:FOLLOWS]->(mark)
MERGE (mark)-[:FOLLOWS]->(emil)
MERGE (michael)-[:KNOWS]-(emil)
MERGE (michael)-[:KNOWS]-(lju)
MERGE (michael)-[:KNOWS]-(praveena)
MERGE (emil)-[:FOLLOWS]->(joe)
MERGE (praveena)-[:FOLLOWS]->(joe)
</cypher>

The KNOWS relationship type is considered to be bidirectional, where if Michael knows Emil, we can imply that Emil knows Michael. When using the KNOWS relationship we will ignore the direction.

The FOLLOWS relationship has a direction, so we will specify a direction when we use it.

### Find neighbors at a specified hop count

The apoc.neighbors.athop procedures compute a node’s neighborhood at a specific hop count.

The following returns the people that Emil KNOWS at 1 hop

<cypher>
MATCH (p:Person {name: "Emil"})
CALL apoc.neighbors.athop(p, "KNOWS", 1)
YIELD node
RETURN node
</cypher>

Results:
<table>
node
(:Person {name: "Michael"})
</table>

Emil only has a direct KNOWS relationship to Michael, so Michael is the only node returned by this query.


The following returns the people that Emil KNOWS at 2 hops

<cypher>
MATCH (p:Person {name: "Emil"})
CALL apoc.neighbors.athop(p, "KNOWS", 2)
YIELD node
RETURN node
</cypher>

Results:
<table>
node
(:Person {name: "Praveena"})
(:Person {name: "Lju"})
</table>

Michael also KNOWS Praveena and Lju, and since Emil doesn’t KNOW either of those directly, he only KNOWS them at a hop distance of 2. If we aren’t interested in knowing which nodes are in our neighborhood, but just want a count of the number, we can do that as well.

The following returns the number of people that Emil KNOWS at 2 hops

<cypher>
MATCH (p:Person {name: "Emil"})
CALL apoc.neighbors.athop.count(p, "KNOWS", 2)
YIELD value
RETURN value
</cypher>

Results:
<table>
value
1
</table>

### Find neighbors at specifeid hop counts

The apoc.neighbors.byhop procedures compute a node’s neighborhood at multiple hop counts.

<cypher>
MATCH (p:Person {name: "Emil"})
CALL apoc.neighbors.byhop(p, "KNOWS", 2)
YIELD nodes
RETURN nodes
</cypher>

Results:
<table>
nodes
[(:Person {name: "Michael"})]
[(:Person {name: "Praveena"}), (:Person {name: "Lju"})]
</table>

From these results we can see that at level 1 Emil KNOWS Michael, and at level 2 Emil KNOWS Lju and Praveena. The following graph patterns describe how Emil knows the different people:

Level 1
(emil)-[:KNOWS]-(michael)

Level 2
(emil)-[:KNOWS]-(michael)-[:KNOWS]-(lju)
(emil)-[:KNOWS]-(michael)-[:KNOWS]-(praveena)

We can also use multiple relationship types when searching the neighborhood.

Let’s say that as well as finding the people that Emil knows, we also want to find the people that follow him. We can specify a direction to the relationship types, by using < to indicate an incoming relationship, or > to indicate an outgoing relationship. So to find people that follow Emil, we’d use <FOLLOWS.

The following returns the people that Emil KNOWS and those that have FOLLOWS relationships to him, at up to 3 hops

<cypher>
MATCH (p:Person {name: "Emil"})
CALL apoc.neighbors.byhop(p, "KNOWS|<FOLLOWS", 3)
YIELD nodes
RETURN nodes
</cypher>

Results:
<table>
nodes
[(:Person {name: "Mark"}), (:Person {name: "Michael"})]
[(:Person {name: "Praveena"}), (:Person {name: "Joe"}), (:Person {name: "Lju"})]
[(:Person {name: "Ryan"})]
</table>

We’ve got some more results this time. Mark is in Emil’s level 1 neighborhood, Joe is in his level 2 neighborhood, and Ryan is in his level 3 neighborhood.
The following graph patterns describe how Emil knows the different people:

Level 1
(emil)-[:KNOWS]-(michael)
(mark)-[:FOLLOWS]→(emil)

Level 2
(emil)-[:KNOWS]-(michael)-[:KNOWS]-(lju)
(emil)-[:KNOWS]-(michael)-[:KNOWS]-(praveena)
(joe)-[:FOLLOWS]→(mark)-[:FOLLOWS]→(emil)

Level 3
(ryan)-[:FOLLOWS]→(joe)-[:FOLLOWS]→(mark)-[:FOLLOWS]→(emil)

And, as with the apoc.neighbors.athop procedure, we can also return just the neighborhood size at each hop.

The following returns the number of people that Emil KNOWS and the number that have FOLLOWS relationships to him, at up to 3 hops

<cypher>
MATCH (p:Person {name: "Emil"})
CALL apoc.neighbors.byhop.count(p, "KNOWS|<FOLLOWS", 3)
YIELD value
RETURN value
</cypher>

Results:
<table>
value
[2, 3, 1]
</table>

And as expected we have a count of 2 at level 1, 3 at level 2, and 1 at level 3.

We could even turn that list of numbers into a map with the key being the number of hops and the value the neighborhood size. The following query shows how to do this using the apoc.map.fromLists function:

<cypher>
MATCH (p:Person {name: "Emil"})
CALL apoc.neighbors.byhop.count(p, "KNOWS|<FOLLOWS", 3)
YIELD value
RETURN apoc.map.fromLists(
         [value in range(1, size(value)) | toString(value)],
         value) AS value
</cypher>

Results:
<table>
value
{1: 2, 2: 3, 3: 1}
</table>

### Find neighbors up to a specified hop count

The apoc.neighbors.tohop procedures compute a node’s neighborhood up to a specified hop count.

The following returns the people that Praveena FOLLOWS up to 1 hop

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.neighbors.tohop(p, "FOLLOWS>", 1)
YIELD node
RETURN node
</cypher>

Results:
<table>
nodes
(:Person {name: "Joe"})
</table>

The only person that Praveena follows is Joe, so that’s the only node returned. What about if we include people at up to 2 hops?

The following returns the people that Praveena FOLLOWS up to 2 hops

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.neighbors.tohop(p, "FOLLOWS>", 2)
YIELD node
RETURN node
</cypher>

Results:

<table>
nodes
(:Person {name: "Mark"})
(:Person {name: "Joe"})
</table>

Now Mark is returned as well. The following graph patterns describe how Emil knows the different people:

(praveena)-[:FOLLOWS]-(joe)
(praveena)-[:FOLLOWS]-(joe)-[:FOLLOWS]→(mark)

And if we just want a count of the number of people, we can use the count variant.

The following returns the number of people that Praveena FOLLOWS up to 2 hops

<cypher>
MATCH (p:Person {name: "Praveena"})
CALL apoc.neighbors.tohop.count(p, "FOLLOWS>", 2)
YIELD value
RETURN value
</cypher>

Results:
<table>
value
2
</table>
