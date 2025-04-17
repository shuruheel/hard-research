# Examples of Cypher Queries

## Data Normalization

### Normalization of persons and occupations

“REMOVE_TITLES = ["dr.", "prof.", "dean", "president", "pres.", "sir", 
[CA] "mr.", "mrs."]
QUERY_NORM_PERSONS = """ #A
[CA]  MATCH (e:Entity {label: "Person"})
[CA]  WITH e, CASE WHEN ANY(title IN $remove_titles WHERE toLower(e.name)
[CA]  STARTS WITH title) THEN apoc.text.join(split(e.name, " ")[1..], " ")
[CA]  ELSE e.name END AS name
[CA}  SET e.name_normalized = name
[CA] “””
 
QUERY_NORM_OCCUPATIONS = “”” #B
[CA]  MATCH (e:Entity {label: “Occupation”})
[CA]  SET e.name_normalized = toLower(e.name)
[CA]"""
 
with driver.session(database=NEO4J_DB) as session: #C
    print("Normalising Person names")
    session.run(QUERY_NORM_PERSONS, remove_titles=REMOVE_TITLES)
    print("Normalising Occupations")
    session.run(QUERY_NORM_OCCUPATIONS) 
    
     #A Cleanse Person names: remove titles/degrees
     #B Lowercase Occupation entity names (case is irrelevant for research disciplines, technologies, etc.)
     #C Execute the queries”

### Show influence network related to a topic

MATCH path = ()<-[:WORKS_ON|WORKS_FOR]-(p2:Person)
[CA] -[:TALKED_ABOUT|TALKED_WITH|WORKS_WITH|STUDENT_OF*1..2]->
(p:Person)-[:WORKS_ON]->()-[:SIMILAR_OCCUPATION*0..1]-(o:Occupation)
WHERE o.name = toLower($occupation) AND
[CA] NOT ANY(x IN nodes(path1) WHERE x.name = "WW")
RETURN path

## Named Entity Disambiguation

### Get textual contents about causality between nodes

MATCH (m1:MedicalEntity)-[:IS_SNOMED_ENTITY]->(s1:SnomedEntity)<-[r1:SNOMED_RELATION]-(s2:SnomedEntity)<-[:IS_SNOMED_ENTITY]-(e:MedicalEntity)
WHERE m1.aliases[0] = "islets of Langerhans" AND r1.type = "FINDING_SITE"
WITH e
 
MATCH path=(f:File)-[:CONTAINS_PAGE]->(p)-[r:MENTIONS_MENTION]->(m)-[:DISAMBIGUATED_TO]->(e)
UNWIND range(0, size(r.start_chars)-1) as mention 
WITH f, p, r, e, mention
RETURN DISTINCT f.id as `File ID`,
p.page_idx as `Page index`,
collect(distinct e.aliases[0]) as `Mentioned entities`,
apoc.text.join(collect(substring (p.text, apoc.coll.max([r.start_chars[mention] - 100, 0]), (r.end_chars[mention] - r.start_chars[mention] + 200) ))[0..3], '\n\n') as `Mention contexts`
ORDER BY size(`Mentioned entities`) DESC
LIMIT 5

### Get co-occurring entities

MATCH (n1:MedicalEntity)-[r:COOCCURR]-(n2:MedicalEntity)
WHERE n1.id= “C0318793” and n2.type = “Disease or Syndrome”
WITH n1, r, n2
ORDER BY r.count DESC
 
MATCH (f:File)-[:CONTAINS_PAGE]->(p:Page)-[r1:MENTIONS_MENTION]->(m1)-[:DISAMBIGUATED_TO]->(n1),
(p)-[r2:MENTIONS_MENTION]->(m2)-[:DISAMBIGUATED_TO]->(n2)
WHERE r1.sentence_index = r2.sentence_index
WITH f, p, r1, r2, n2
 
RETURN DISTINCT
f.id as `File ID`,
p.page_idx as `Page index`,
n2.id as `Co-occurring entity id`,
n2.aliases[0] as `Co-occurring entity name`,
CASE
  WHEN r1.end_chars[0] > r2.start_chars[0]
  THEN substring(p.text, r2.start_chars[0], r1.end_chars[0] - r2.start_chars[0])
  ELSE substring(p.text, r1.start_chars[0], r2.end_chars[0] - r1.start_chars[0])
END as `Mentions context`

### Get paths connecting two types of nodes filtering hub nodes

“CALL gds.degree.stream('snomedGraph')
YIELD nodeId, score
WITH gds.util.asNode(nodeId).name AS name, score AS degree
ORDER BY degree DESC
LIMIT 350
WITH collect(name) as hub_nodes
 
MATCH (s1), (s2)
WHERE s1.id="3928002" AND s2.id="40956001"
WITH s1, s2, allShortestPaths((s1)-[:SNOMED_RELATION*1..8]-(s2)) AS paths, hub_nodes
UNWIND paths AS path
WITH relationships(path) AS path_edges, nodes(path) as path_nodes, hub_nodes
WITH [n IN path_nodes | n.name] AS node_names,
     [r IN path_edges | r.type] AS rel_types,
     [n IN path_edges | startnode(n).name] AS rel_starts,
     hub_nodes
WHERE not any(x IN node_names WHERE x IN hub_nodes)
WITH [i in range(0, size(node_names)-1) | CASE
WHEN i = size(node_names)-1
THEN node_names[size(node_names)-1]
WHEN node_names[i] = rel_starts[i] 
THEN node_names[i] + '-[:' + rel_types[i] + ']->'
ELSE node_names[i] + '<-[:' + rel_types[i] + ']-' END] as string_paths
RETURN DISTINCT apoc.text.join(string_paths, '') AS `Extracted paths`”

## NER with LLMs
### Simplified prompt for Named Entity Recognition
“system = “You are an assistant capable of extracting named entities in the medical domain. Your task is to extract ALL single mentions of named entities from the text. You must only use one of the pre-defined entities from the following list: {named_entities}. No other entity categories are allowed. For each sentence, extract the named entities and present the output in valid JSON format”.format(named_entities=named_entities))
 
input = “Risk factors for rhinocerebral mucormycosis include poorly controlled diabetes mellitus and severe immunosuppression.”
 
assistant = [
  {
    "sentence": "Risk factors for rhinocerebral mucormycosis include poorly controlled diabetes mellitus and severe immunosuppression.",
    "entities": [
      {
        "id": 0,
        "mention": "Risk factors",
        "label": "Events"
      },
      {
        "id": 1,
        "mention": "rhinocerebral mucormycosis",
        "label": "Disease"
      },
      {
        "id": 2,
        "mention": "poorly controlled diabetes mellitus",
        "label": "Disease"
      },
      {
        "id": 3,
        "mention": "severe immunosuppression",
        "label": "Qualifier value"
      }
    ]
  }
]
    ”

### Simplified prompt for translating graph paths into sentences

“system = “You are an assistant capable of translating a Neo4j graph path into a clear sentence. Use the exact entity names from the path while generating the sentence. The sentences will assist a large language model (LLM) in disambiguating biomedical entities. Ensure the output is a valid JSON with no extraneous characters.”
 
input = {
  "paths": [
    {
      "id": 1,
      "path": "(Hypertension)-[:RISK_FACTOR_FOR]->(Cardiovascular Disease)<-[:ASSOCIATED_WITH]-(Myocardial Infarction)"
    }
  ]
}
 
assistant = {
  "sentences": [
    {
      "id": 1,
      "sentence": "Hypertension is a risk factor for cardiovascular disease. Myocardial infarction is also associated with cardiovascular disease, indicating that hypertension may increase the risk of experiencing a myocardial infarction through its connection to cardiovascular disease."
    }
  ]
}”

### Prompt for summarizing textual paths

“system = “You are an assistant that can summarize multiple sentences derived from ontology paths into a short summary. This summary will be used to support a named entity disambiguation task. Ensure the output is a valid JSON with no extraneous characters.”
 
input = {
  "sentences": [
    {
      "id": 1,
      "sentence": "Hypertension is a risk factor for cardiovascular disease. Myocardial infarction is also associated with cardiovascular disease, indicating that hypertension may increase the risk of experiencing a myocardial infarction through its connection to cardiovascular disease."
    },
    {
      "id": 2,
      "sentence": "Diabetes mellitus is a complication that arises from an endocrine disorder. Diabetic retinopathy is also associated with endocrine disorders, suggesting that diabetes mellitus can lead to the development of diabetic retinopathy through its link to endocrine dysfunction."
    },
    {
      "id": 3,
      "sentence": "Asthma is associated with respiratory disorders. Allergic rhinitis is also linked to respiratory disorders, which implies that individuals with asthma may also experience allergic rhinitis due to their common association with respiratory conditions."
    },
    {
      "id": 4,
      "sentence": "Osteoporosis leads to bone weakness. Bone fractures are a result of bone weakness, indicating that osteoporosis can increase the likelihood of bone fractures due to the weakened state of the bones."
    }
  ]
 
assistant = {
  "context": "Hypertension is a risk factor for cardiovascular[…]”

### Prompt for Entity Disambiguation with LLMs
“system = “You are an assistant specialized in entity disambiguation. Your task is to identify and accurately disambiguate the entities mentioned in a given sentence, relying heavily on the contextual entities present in surrounding sentences:
1. Original Sentence: The sentence that contains ambiguous entities that need to be resolved.
2. Candidate Entities: A list of potential entities extracted from the sentence, with each entity having multiple possible meanings or labels.
3. Contextual Sentences: A collection of related or surrounding sentences that provide additional context for disambiguating the mentioned entities.
Your objective is to use the entities mentioned in the contextual sentences as the primary source of information to disambiguate the entities in the original sentence. Analyze the candidate entities for each ambiguous mention and select the one that aligns best with both the context and the meaning provided by the contextual sentences.The output must be a valid JSON.”
 
 
input = {
  "sentence": "Asthma and allergic rhinitis are commonly addressed together in treatment protocols, given their shared underlying inflammatory processes in allergic individuals.",
  "candidates": [
    {
      "id": 1,
      "candidates": [
        {”
“       "snomed_id": "233681001",
          "name": "Extrinsic asthma with asthma attack"
        },
        {
          "snomed_id": "195967001",
          "name": "Asthma"
        },
        {
          "snomed_id": "266361008",
          "name": "Intrinsic asthma"
        },
        {
          "snomed_id": "266364000",
          "name": "Asthma attack"
        },
        {
          "snomed_id": "270442000",
          "name": "Asthma monitored"
        },
        {
          "snomed_id": "170642006",
          "name": "Asthma severity"
        },
        {
          "snomed_id": "170643001",
          "name": "Occasional asthma"
        },
        {
          "snomed_id": "170644007",
          "name": "Mild asthma"
        },
        {
          "snomed_id": "170645008",
          "name": "Moderate asthma"
        }
      ]
    }
 
assistant = {
  "entities": [
    {
      "id": 1,
      "disambiguation": {
        "snomed_id": "195967001",
        "name": "Asthma"
      }
    },
    {
      "id": 2,
      "disambiguation": {
        "snomed_id": "61582004",
        "name": "Allergic rhinitis"
      }
    }
  ]
}”

## Graph Clustering
### Running Louvain on a network
“import math
import time
import networkx as nx
import matplotlib.pyplot as plt
 
def set_club_colors(G):
    for node in G.nodes(data=True):
        # Mr. Hi = 'purple', Officier = 'blue'
        color = '#00fff9'
        if node[1]['club'] == 'Mr. Hi':
            color = '#e6e6fa'
        node[1]['color'] = color
 
def draw_and_save_graph_picture(G, i=0):
    set_club_colors(G)
    layout_position = nx.spring_layout(G, k=8 / math.sqrt(G.order()))
    colors = [n[1]['color'] for n in G.nodes(data=True)]
    nx.draw_networkx(G, pos=layout_position, node_color=colors)
    plt.axis('off')
    plt.savefig("Karate_Graph_" + str(i) + ".svg", format="SVG", dpi=1000)
    plt.savefig("Karate_Graph_" + str(i) + ".png", format="PNG", dpi=1000)
    plt.show()
 
if __name__ == '__main__':
    start = time.time()
    G = nx.karate_club_graph()
    draw_and_save_graph_picture(G)
    communities = nx.community.louvain_communities(G, seed=123) #A
    i = 1
    for community in communities: #B
        subGraph = G.subgraph(community)
        draw_and_save_graph_picture(subGraph, i)
        i += 1
 
    end = time.time() - start
    print("Time to complete:", end) 
    
     #A This function computes communities using Louvain
     #B This piece of code draws multiple graphs, one for each community”

### Computing egonet density in a fraud detection network

“import networkx as nx
 
def compute_density_metrics(G):
    density_metrics = {} #A
    
    for node in G.nodes():
        neighbors = list(G.neighbors(node))
        egonet_nodes = neighbors + [node] #B
        
        
        N = len(egonet_nodes) #I
        
        if N < 2:  # Handle special case where egonet is too small
            density_metrics[node] = 0.0
            continue
            
        M = 0
        for i in range(len(egonet_nodes)):
            for j in range(i + 1, len(egonet_nodes)):
                if G.has_edge(egonet_nodes[i], egonet_nodes[j]): #C
                    M += 1
        
        max_possible_edges = (N * (N - 1)) / 2 #D
        density = M / max_possible_edges #E
        
        density_metrics[node] = round(density, 2) #F
    
    return density_metrics #G
 
def get_node_density(G, node):
    metrics = compute_density_metrics(G)
    return metrics.get(node, 0.0) #H 
    
     #A Initialize dictionary to store density values for each node
     #B Create egonet by getting node's neighbors plus the node itself
     #C Count actual number of edges (M) in the egonet
     #D Calculate maximum possible edges N(N-1)/2 in egonet
     #E Calculate density as ratio of actual edges to maximum possible edges
     #F Round density to 2 decimal places for readability
     #G Return dictionary containing density values for all nodes
     #H Helper function to get density value for a specific node
     #I Get the number of nodes in egonet”

### Computing geodesic path metrics in a fraud detection network

“import networkx as nx
from collections import defaultdict
 
def compute_geodesic_metrics(G, max_hops=3):
    path_metrics = {} #A
    
    fraudster_nodes = [n for n, attr in G.nodes(data=True) 
                      if attr.get('is_fraudster', False)] #B
    
    for node in G.nodes():
        if G.nodes[node].get('is_fraudster', False):
            geodesic_path = 0 #J
            hop_counts = defaultdict(int)
        else:
            paths_to_fraudsters = [] #C
            hop_counts = defaultdict(int)
            
            for fraudster in fraudster_nodes:
                try:
                    path = nx.shortest_path(G, node, fraudster) #D
                    path_length = len(path) - 1  # Convert to number of hops
                    paths_to_fraudsters.append(path_length)
                    
                    if path_length <= max_hops:
                        hop_counts[path_length] += 1 #E
                except nx.NetworkXNoPath:
                    continue
            
            geodesic_path = min(paths_to_fraudsters) if paths_to_fraudsters else float('inf') #F
        
        path_metrics[node] = {
            'geodesic_path': geodesic_path,
            '#1-hop_paths': hop_counts[1],
            '#2-hop_paths': hop_counts[2],
            '#3-hop_paths': hop_counts[3]
        } #G
    
    return path_metrics #H
 
def get_node_paths(G, node):
    metrics = compute_geodesic_metrics(G)
    return metrics.get(node, {
        'geodesic_path': float('inf'),
        '#1-hop_paths': 0,
        '#2-hop_paths': 0,
        '#3-hop_paths': 0
 }) #I
”

“#A Initialize dictionary to store path metrics for each node
     #B Identify all fraudulent nodes in the graph
     #C For non-fraudulent nodes, calculate paths to all fraudsters
     #D Use Dijkstra's algorithm (via NetworkX) to find the shortest path to each fraudster
     #E Count the number of paths for each hop distance up to max_hops
     #F Find the shortest path length to any fraudster
     #G Store metrics including shortest path and count of paths at each hop distance
     #H Return dictionary containing all path metrics for each node
     #I Helper function to get path metrics for a specific node
     #J If node is fraudulent, distance to nearest fraudster is 0”

### Computing closeness centrality in a network

“import networkx as nx
from collections import defaultdict
 
def compute_closeness_metrics(G):
    closeness_metrics = {} #A
    
    for node in G.nodes():
        total_distance = 0
        reachable_nodes = 0
        
        shortest_paths = nx.single_source_shortest_path_length(G, node) #B
        
        for other_node, distance in shortest_paths.items():
            if other_node != node:  #I
                total_distance += distance
                reachable_nodes += 1 #C
        
        n = len(G.nodes()) - 1  #J
        if reachable_nodes > 0 and n > 0:
            # Normalize by reachable nodes to handle disconnected graphs
            closeness = (reachable_nodes / n) * (reachable_nodes / total_distance) #D
        else:
            closeness = 0.0
            
        closeness_metrics[node] = round(closeness, 2) #E
    
    return closeness_metrics #F
 
def get_node_closeness(G, node):
    metrics = compute_closeness_metrics(G)
    return metrics.get(node, 0.0) #G
 
def analyze_closeness_distribution(G):
    metrics = compute_closeness_metrics(G)
    values = list(metrics.values())
    
    stats = {
        'max_closeness': max(values),
        'min_closeness': min(values),
        'avg_closeness': sum(values) / len(values),
        'most_central_node': max(metrics.items(), key=lambda x: x[1])[0],
        'least_central_node': min(metrics.items(), key=lambda x: x[1])[0]
    } #H
    
    return stats”

“#A Initialize dictionary to store closeness values for each node
#B Use NetworkX to efficiently calculate shortest paths to all nodes
#C Count reachable nodes and sum up distances
#D Calculate normalized closeness centrality considering disconnected components
#E Round closeness to 2 decimal places for readability
#F Return dictionary containing closeness values for all nodes
#G Helper function to get closeness value for a specific node
#H Helper function to analyze the distribution of closeness values
#I Exclude self
#J Total nodes minus self”

### Computing betweenness centrality in a network

“import networkx as nx
from collections import defaultdict
 
def compute_betweenness_metrics(G, normalized=True):
    betweenness_metrics = {} #A
    
    betweenness = nx.betweenness_centrality(
        G,
        normalized=normalized,
        endpoints=False #B
    )
    
    for node in G.nodes():
        betweenness_metrics[node] = round(betweenness[node], 3) #C
    
    return betweenness_metrics #D
 
def analyze_betweenness_distribution(G):
    metrics = compute_betweenness_metrics(G)
    values = list(metrics.values())
    
    return {
        'max_betweenness': max(values),
        'min_betweenness': min(values),
        'avg_betweenness': sum(values) / len(values),
        'key_bridges': [node for node, score in metrics.items() 
                       if score > sum(values) / len(values)] #E
    }
 
def get_node_betweenness(G, node):
    metrics = compute_betweenness_metrics(G)
    return metrics.get(node, 0.0) #F
 
def identify_potential_bottlenecks(G, threshold=0.5):
    metrics = compute_betweenness_metrics(G)
    
    bottlenecks = {node: score for node, score in metrics.items() 
                   if score > threshold} #G
    return bottlenecks 
    
     #A Initialize dictionary to store betweenness values for all nodes
     #B Calculate betweenness using NetworkX's efficient implementation
     #C Round values to 3 decimal places for readability and store them
     #D Return dictionary containing betweenness values for all nodes
     #E Identify nodes with above-average betweenness as key bridges
     #F Helper function to get betweenness value for a specific node
     #G Identify potential bottlenecks based on threshold”

### Computing PageRank variations for fraud detection 

“import networkx as nx
import numpy as np
 
def compute_pagerank_metrics(G, fraud_weight=2.0, damping_factor=0.85):
    pagerank_metrics = {} #A
    
    base_pagerank = nx.pagerank(
        G,
        alpha=damping_factor,
        personalization=None,
        weight=None
    ) #B
    
    fraud_personalization = {}
    for node in G.nodes(): #C
        if G.nodes[node].get('is_fraudster', False):
            fraud_personalization[node] = fraud_weight
        else:
            fraud_personalization[node] = 1.0 
    
    fraud_pagerank = nx.pagerank(
        G,
        alpha=damping_factor,
        personalization=fraud_personalization,
        weight=None
    ) #D
    
    for node in G.nodes():
        pagerank_metrics[node] = {
            'pagerank_base': round(base_pagerank[node], 3),
            'pagerank_fraud': round(fraud_pagerank[node], 3)
        } #E
    
    return pagerank_metrics #F
 
 
def get_node_pagerank(G, node):
    metrics = compute_pagerank_metrics(G)
    return metrics.get(node, {
        'pagerank_base': 0.0,
        'pagerank_fraud': 0.0
    }) #G”

“#A Initialize dictionary to store both PageRank variations
     #B Calculate standard PageRank using NetworkX implementation
     #C Create a personalization dictionary giving higher weight to fraudulent nodes
     #D Calculate fraud-weighted PageRank using personalization
     #E Store both PageRank values for each node
     #F Return dictionary containing all PageRank metrics
     #G Helper function to get PageRank values for a specific node
   ”
### Prompt to generate queries for extracting DWTC features

“You are a graph database expert specializing in Neo4j and Cypher queries. I'm working on a drug repurposing project and need help generating queries for metapath analysis.
 
I'll provide you with:
1.  The graph schema (obtained from apoc.meta.schema())
1. An example of the query for CbGaD
2.  A list of metapaths between Compound and Disease nodes
3.  Sample compound and disease names for testing
For each metapath:
- Generate a Cypher query that computes both Path Count (PC) and Degree-Weighted Path Count (DWPC, using damping factor 0.4)
- Include degree calculations for each node in the path
- Return disease_id, disease_name, PC, and DWPC
 
The schema is:
{Shema definition here or as attachement}
 
An example of the query for DWPC is:
MATCH path = (c:Compound)-[:BINDS_CbG]-(g)-[:ASSOCIATES_DaG]-(d:Disease) 
WHERE c.name = 'Metformin' AND d.name = 'type 2 diabetes mellitus'
WITH
[
  count{(v)-[:BINDS_CbG]-()},
  count{()-[:BINDS_CbG]-(g)},
  count{(g)-[:ASSOCIATES_DaG]-()},
  count{()-[:ASSOCIATES_DaG]-(d)}
] 
AS degrees, path, d 
WITH
  d.identifier AS disease_id,
  d.name AS disease_name,
  count(path) AS PC, 
  sum(reduce(pdp = 1.0, d in degrees| pdp * d ^ -0.4)) AS DWPC
RETURN
  disease_id, disease_name, PC, DWPC
 
Please generate queries for these metapaths:
- CbGaD (Compound-binds-Gene-associates-Disease)
- CdGuD (Compound-downregulates-Gene-upregulates-Disease)”

