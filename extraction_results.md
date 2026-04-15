# Extraction Results

## Chapter 5: Orchestration

| Paragraph | Concept |
|-----------|---------|
| Orchestration involves more than just deciding which tools to call and when | Orchestration strategies for coordinating tools, context, and planning in agents |
| Before diving into specific orchestration strategies, it's important to understand the different types of agents | Agent archetypes that shape task decomposition and execution approaches |
| Reflex agents implement a direct mapping from input to action without any internal reasoning trace | Reflex agents as fast rule-based systems without intermediate reasoning |
| ReAct agents interleave Reasoning and Action in an iterative loop | ReAct pattern combining iterative thought, tool invocation, and observation |
| Planner-executor agents split a task into two distinct phases: planning, where the model generates a multistep plan; and execution | Planner-executor architecture separating plan generation from tool execution |
| Query-decomposition agents tackle a complex question by iteratively breaking it into subquestions | Self-ask with search pattern for decomposing complex questions into subqueries |
| Reflection and metareasoning agents extend the ReAct paradigm by not only interleaving thought and action but also reviewing past steps | Reflection agents that self-correct through goal-state review and error detection |
| Deep research agents specialize in tackling open-ended, highly complex investigations | Deep research agents combining planning, decomposition, and reflection for complex investigations |
| Capability: It can handle high-complexity, multistage investigations | "" |
| High cost: Extensive foundation model use and multiple API calls | "" |
| The best use cases are long-form, expert-level tasks | "" |
| Table 5-1 offers a snapshot of today's most common agent archetypes | Agent archetype comparison across speed, flexibility, and complexity tradeoffs |
| Before we get to orchestration, we will start with tool selection | Tool selection as the foundational step for agent orchestration |
| Table 5-2. Tool selection strategies | Tool selection strategy tradeoffs between scalability and accuracy |
| The simplest approach is standard tool selection | Standard tool selection using foundation models to choose from full toolset |
| Effective tool selection often comes down to how you describe each capability | Tool description best practices for improving selection accuracy |
| Here we define another tool that is capable of computing mathematical expressions | Tool definition example for mathematical computation via Wolfram Alpha |
| Here's another example of a tool you might want to register | Zapier webhook tool for triggering automated workflows |
| Now that we've defined our tools, we bind them to the model client | Tool binding and invocation with LangChain's bind_tools method |
| In summary, standard tool selection offers a fast, intuitive way to integrate tools | Standard tool selection as simple but scalability-limited approach |
| Another approach, semantic tool selection, uses semantic representations to index all of the available tools | Semantic tool selection using vector embeddings for scalable tool retrieval |
| Figure 5-2. Semantic tool embedding for retrieval-based selection | Tool embedding pipeline converting descriptions to vector representations |
| Figure 5-3. Semantic tool retrieval and invocation workflow | Runtime workflow embedding queries and retrieving matching tools |
| import os, import requests, import logging | Code example setting up FAISS vector store for tool embeddings |
| Those embeddings for your tool catalog only need to be computed once | Pre-computed tool embeddings enabling fast runtime retrieval |
| def select_tool(query: str, top_k: int = 1) -> list: | Vector similarity function for retrieving top-k relevant tools |
| def determine_parameters(query: str, tool_name: str) -> dict: | LLM-based parameter extraction from user query for selected tool |
| If your scenario involves a large number of tools, however, you might need to consider hierarchical tool selection | Hierarchical tool selection for improving accuracy with large toolsets |
| Figure 5-4. Hierarchical tool-selection workflow | Two-stage selection routing queries through tool groups to individual tools |
| import os, import requests, import logging | Code example defining tool groups for hierarchical selection |
| tool_groups = { | Tool group organization with descriptive categories |
| @tool def query_wolfram_alpha(expression: str) -> str: | Tool definitions assigned to hierarchical groups |
| tool_groups["Computation"]["tools"].append(query_wolfram_alpha) | Tool-to-group assignment mapping |
| def select_group_llm(query: str) -> str: | LLM function selecting appropriate tool group from query |
| def select_tool_llm(query: str, group_name: str) -> str: | LLM function selecting specific tool within chosen group |
| user_query = "Solve this equation: 2x + 3 = 7" | Example hierarchical selection execution flow |
| Parametrization is the process of defining and setting the parameters that will guide the execution of a tool | Tool parametrization process for filling function arguments from context |
| Today, the majority of chatbot systems rely on single tool execution without planning | Tool topologies as patterns for composing single and multiple tool executions |
| We'll begin with tasks that require precisely one tool | Single tool execution as foundational planning pattern |
| Figure 5-5. Single tool execution workflow | Four-step single tool workflow from query to response |
| Figure 5-6. Example of single tool execution for weather retrieval | Concrete weather retrieval example demonstrating single tool pattern |
| The first increase in complexity comes with tool parallelism | Parallel tool execution for independent simultaneous actions |
| Figure 5-7. Parallel tool execution pattern | Multi-source data gathering with consolidated response generation |
| The next increase in complexity brings us to chains | Sequential tool chains with dependent action steps |
| from langchain_core.runnables import RunnableLambda | LangChain Expression Language for declarative chain composition |
| Figure 5-8. Agentic chain execution pattern | Chain pattern with reasoning loop and tool observations |
| The planning of chains requires careful consideration of the dependencies between actions | Chain planning considerations including depth limits and dependency management |
| For support scenarios with multiple decision points, a graph topology models complex, nonhierarchical flows | Graph topology enabling branching, merging, and conditional transitions |
| def categorize_issue(state: dict) -> dict: | Graph node definitions for support workflow handling |
| graph = StateGraph() | Graph construction with conditional routing edges |
| def top_router(state): | Router functions for conditional edge transitions |
| graph.add_edge(handle_refund, summarize_response) | Consolidation edges merging parallel paths to summary node |
| Graphs offer the ultimate flexibility for modeling complex, nonlinear workflows | Graph topology tradeoffs between flexibility and complexity overhead |
| Context engineering is a core component of orchestration | Context engineering as dynamic assembly of inputs for effective agent execution |
| Effective context engineering requires several core practices | Context engineering practices including relevance prioritization and structured formatting |
| Context engineering sits at the intersection of memory, knowledge, and orchestration | Context engineering bridging memory, orchestration, and model performance |
| The success of agents relies heavily on the approach to orchestration | Orchestration best practices for latency, complexity, and adaptability tradeoffs |

---

## Chapter 6: Knowledge and Memory

| Paragraph | Concept |
|-----------|---------|
| Now that your agent has tools and orchestration, it is more than capable of taking actions to do real work | Distinction between knowledge as external information retrieval and memory as interaction history |
| In Chapter 5, we introduced context engineering as the discipline of dynamically selecting | Memory as foundational enabler for context engineering in agentic systems |
| This chapter will offer examples in LangGraph | LangGraph framework for stateful agentic workflows with checkpointing |
| By treating memory mechanisms as first-class graph nodes | Memory mechanisms as modular graph nodes with sequential updates |
| In this chapter, we will first cover the fundamentals of memory | Chapter roadmap covering memory systems from context windows to knowledge graphs |
| We begin by discussing the simplest approaches to memory | Foundational memory approaches using context windows and keyword search |
| We start with the simplest approach to memory: relying on the context window | Context window as working memory with token length limitations |
| The context window is a critical resource for developers to use effectively | Context window token budget allocation for task-relevant information |
| For simple use cases, you can use a rolling context window | Rolling context window with first-in-first-out ejection of oldest content |
| from typing import Annotated | LangGraph code example failing to maintain conversation state |
| Traditional full-text search forms the backbone of many large-scale retrieval systems | Inverted index structure for fast keyword-based message retrieval |
| To rank these results by relevance, most systems employ the BM25 scoring function | BM25 scoring weighting passages by term frequency and document length |
| # pip install rank_bm25 | BM25 code example for full-text search over message corpus |
| Semantic memory, a type of long-term memory that involves the storage and retrieval of general knowledge | Semantic memory enabling meaning-based storage and retrieval in vector databases |
| Unlike traditional keyword-based search, semantic search aims to understand the context and intent behind a query | Semantic search understanding query meaning beyond exact keyword matches |
| The foundation for these approaches is embeddings | Embeddings as dense vector representations capturing semantic meaning |
| We begin by generating semantic embeddings for the concepts and knowledge to be stored | Semantic memory pipeline from text embedding to vector database storage |
| Vector stores—such as VectorDB, FAISS, or Annoy | Vector stores optimized for high-dimensional similarity searches |
| from typing import Annotated | Code example implementing semantic memory with VectorDB |
| Incorporating memory into agentic systems not only involves storing and managing knowledge | RAG combining retrieval mechanisms with generative models for informed responses |
| First, we begin with a set of documents that might be useful | RAG indexing pipeline chunking documents and embedding into vector database |
| During retrieval, the system searches a large corpus of documents | RAG retrieval phase identifying relevant information from vector stores |
| During generation, the retrieved information is then fed into a generative foundation model | RAG generation phase synthesizing retrieved context with model knowledge |
| RAG represents a powerful approach for enhancing the capabilities of agentic systems | RAG value for domain-specific information integration in agent responses |
| While incorporating an external knowledge base with a semantic store is an effective way | Semantic experience memory preserving interaction context across sessions |
| With each user input, the text is turned into a vector representation | Semantic experience memory reserving context window for best matching interactions |
| We now turn to an advanced version of RAG that is more complex to incorporate | GraphRAG using knowledge graphs for multihop reasoning and relationship chaining |
| Baseline RAG systems operate by chunking documents | Baseline RAG limitations in connecting scattered information across documents |
| Within a few minutes, the GraphRAG CLI can deliver global insights | GraphRAG components: knowledge graph, retrieval system, and generative model |
| This component stores data in a graph format | Knowledge graph storing entities and relationships in connected node structure |
| The retrieval system in GraphRAG is designed to query the graph database | GraphRAG retrieval extracting relevant subgraphs for query context |
| Once relevant data is retrieved in the form of a graph | Generative model synthesizing graph-retrieved information into responses |
| GraphRAG represents a significant leap forward in the capabilities of agentic systems | GraphRAG benefits for complex multihop queries exceeding vector retrieval capabilities |
| Knowledge graphs are fundamental in providing structured and semantically rich information | Knowledge graph construction methodology from data collection to maintenance |
| The first step in building a knowledge graph is gathering the necessary data | Data collection from diverse sources for knowledge graph construction |
| Once data is collected, it needs to be cleaned and preprocessed | Data preprocessing removing noise and standardizing formats for entity extraction |
| This process involves identifying key elements (entities) from the data | Entity recognition extracting people, places, organizations as graph nodes |
| After identifying entities, the next step is to determine the relationships between them | Relationship extraction identifying predicates connecting entities as edges |
| An ontology defines the categories and relationships within the knowledge graph | Ontology design defining schema of entity types and relationship structures |
| With the ontology in place, the next step is to populate the graph | Graph population creating nodes and edges according to ontology structure |
| Once the graph is populated, it must be integrated with existing systems | Integration and validation ensuring graph accuracy and entity deduplication |
| A knowledge graph is not a static entity; it needs regular updates | Knowledge graph maintenance with automated updates and ontology refinement |
| Building a knowledge graph can significantly improve complex and multihop retrieval | Semantic triple extraction using subject-predicate-object data model |
| Figure 6-3. Knowledge graph construction workflow | Knowledge graph construction workflow from documents to structured triples |
| pip install graphrag | GraphRAG CLI workflow for indexing and querying document collections |
| While this is great for experimentation, many teams want to move from a prototype | Neo4j as enterprise-grade graph database for production GraphRAG deployments |
| Once you've defined your ontology and extracted entities and relationships | Cypher CREATE clause for populating nodes and relationships in Neo4j |
| // Create nodes for concepts and entities | Cypher code creating concept nodes and relationship edges |
| // Query for finding relationships between concepts | Cypher queries for multihop traversals and relationship discovery |
| Once loaded, your knowledge graph supports multihop traversals | Knowledge graph enabling multihop reasoning across relationship chains |
| Figure 6-4. Answering questions with knowledge graphs | Graph traversal workflow for complex multihop query answering |
| Dynamic knowledge graphs are a significant step forward in managing and utilizing knowledge | Dynamic knowledge graphs with real-time updates and adaptive learning capabilities |
| Recent advances in model architectures are pushing context windows to unprecedented lengths | Long context windows and retrieval-free approaches with tradeoff considerations |
| However, these retrieval-free approaches come with trade-offs | Retrieval-free tradeoffs in compute cost, latency, and accuracy guarantees |
| Dynamic real-time information processing is greatly enhanced by dynamic knowledge graphs | Real-time data integration and adaptive learning in dynamic knowledge graphs |
| Complexity in maintenance: Maintaining the accuracy and reliability of a dynamic knowledge graph | Dynamic graph maintenance challenges with error propagation risks |
| Resource intensity: The processes of updating, validating, and maintaining | Computational resource demands for dynamic graph updates and validation |
| Security and privacy concerns: Dynamic knowledge graphs that incorporate user data | Security and privacy compliance challenges in real-time graph systems |
| Dependency and overreliance: There is a risk of overreliance on dynamic knowledge graphs | Overreliance risks in automated decision-making without human oversight |
| To harness the benefits of dynamic knowledge graphs while mitigating their risks | Mitigation strategies including validation, scalability, and human oversight |
| Dynamic knowledge graphs offer substantial promise for enhancing the intelligence | Dynamic graph benefits balanced against complexity and risk management needs |
| With this technique, the foundation model is prompted to specifically inject notes | Note-taking technique generating marginal notes before answering questions |
| Figure 6-5. Note-taking workflows | Note-taking workflow interleaving context notes with reasoning steps |
| Memory is critical to the successful operation of agentic systems | Memory systems enabling grounded, capable, and contextually aware agents |
