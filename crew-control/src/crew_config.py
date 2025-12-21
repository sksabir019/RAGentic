"""
CrewAI Configuration and Agent Definitions
Defines agents and their capabilities for the RAG pipeline
"""
import os
import json
from typing import Optional, List, Dict, Any

try:
    from crewai import Agent, Task, Crew, Process
    from langchain.llms import OpenAI
    from langchain.tools import Tool
except ImportError as e:
    print(f"Warning: CrewAI/LangChain imports not available: {e}")
    # Provide mock implementations for development
    class Agent:
        def __init__(self, **kwargs):
            self.role = kwargs.get('role')
            self.goal = kwargs.get('goal')
            self.backstory = kwargs.get('backstory')
    
    class Task:
        def __init__(self, **kwargs):
            self.description = kwargs.get('description')
            self.expected_output = kwargs.get('expected_output')

# Initialize LLM
llm = OpenAI(
    model_name=os.getenv('OPENAI_MODEL', 'gpt-4'),
    temperature=float(os.getenv('OPENAI_TEMPERATURE', '0.7')),
    api_key=os.getenv('OPENAI_API_KEY')
)

# ============ Agent Definitions ============

class RAGAgents:
    """Container for all RAG pipeline agents."""
    
    @staticmethod
    def query_parser_agent() -> Agent:
        """Agent responsible for parsing and understanding user queries."""
        return Agent(
            role="Query Parser",
            goal="Understand user queries and extract intent, entities, and required context",
            backstory="""You are an expert query analyst with deep understanding of information 
            retrieval systems. You excel at breaking down complex questions, identifying intent, 
            recognizing named entities, and determining what information is needed to answer the query.""",
            tools=[],  # Tools would be added from agent services
            llm=llm,
            allow_delegation=False
        )
    
    @staticmethod
    def retrieval_agent() -> Agent:
        """Agent responsible for finding relevant documents and chunks."""
        return Agent(
            role="Document Retrieval Specialist",
            goal="Find the most relevant documents and chunks for answering the user query",
            backstory="""You are a master of information retrieval with expertise in semantic search,
            hybrid search strategies, and relevance scoring. You know how to find needles in 
            haystacks and can work across multiple data sources and formats.""",
            tools=[],
            llm=llm,
            allow_delegation=False
        )
    
    @staticmethod
    def ranking_agent() -> Agent:
        """Agent responsible for ranking retrieved documents by relevance."""
        return Agent(
            role="Relevance Ranking Specialist",
            goal="Rank retrieved documents and chunks by their relevance to the query",
            backstory="""You are an expert in information ranking with a deep understanding of 
            relevance scoring, context matching, and importance measurement. You use multiple 
            ranking factors to produce optimal orderings.""",
            tools=[],
            llm=llm,
            allow_delegation=False
        )
    
    @staticmethod
    def generation_agent() -> Agent:
        """Agent responsible for generating answers from retrieved context."""
        return Agent(
            role="Response Generator",
            goal="Generate comprehensive and accurate answers using retrieved context",
            backstory="""You are a brilliant writer and synthesizer of information. You excel at
            combining multiple sources, maintaining accuracy, preserving citations, and producing
            clear, well-structured responses tailored to the user's needs.""",
            tools=[],
            llm=llm,
            allow_delegation=False
        )
    
    @staticmethod
    def validation_agent() -> Agent:
        """Agent responsible for validating generated responses."""
        return Agent(
            role="Quality Assurance Specialist",
            goal="Validate generated responses for accuracy, hallucinations, and quality",
            backstory="""You are a meticulous quality assurance expert with strong analytical skills.
            You can detect hallucinations, verify facts, check citations, analyze coherence, and
            ensure responses meet high quality standards before delivery.""",
            tools=[],
            llm=llm,
            allow_delegation=False
        )
    
    @staticmethod
    def ingestion_agent() -> Agent:
        """Agent responsible for processing and indexing documents."""
        return Agent(
            role="Document Ingestion Specialist",
            goal="Process, chunk, and prepare documents for retrieval",
            backstory="""You are an expert at data preparation with deep knowledge of document
            processing, text chunking strategies, embedding generation, and index optimization.
            You ensure documents are properly prepared for fast and accurate retrieval.""",
            tools=[],
            llm=llm,
            allow_delegation=False
        )


class RAGTasks:
    """Container for all RAG pipeline tasks."""
    
    @staticmethod
    def parse_query_task(query: str, context: Dict[str, Any]) -> Task:
        """Create a task for parsing the user's query."""
        return Task(
            description=f"""Analyze and parse the following user query:
            
Query: "{query}"

Extract:
1. User intent (what are they trying to accomplish?)
2. Key entities mentioned (people, places, concepts)
3. Question type (factual, analytical, exploratory)
4. Required context (what information is needed?)
5. Any constraints or preferences mentioned

Provide your analysis in JSON format with keys: intent, entities, questionType, requiredContext, constraints""",
            expected_output="JSON object with parsed query analysis",
            agent=RAGAgents.query_parser_agent()
        )
    
    @staticmethod
    def retrieve_documents_task(parsed_query: Dict[str, Any], document_ids: Optional[List[str]]) -> Task:
        """Create a task for retrieving relevant documents."""
        doc_filter = f"within documents: {document_ids}" if document_ids else "across all documents"
        
        return Task(
            description=f"""Retrieve the most relevant documents and chunks for this parsed query:

Intent: {parsed_query.get('intent', 'Unknown')}
Required Context: {parsed_query.get('requiredContext', 'General information')}

Search {doc_filter}

Use hybrid search combining:
1. Semantic similarity (vector search)
2. Keyword matching (BM25)
3. Metadata filtering
4. Relevance scoring

Return the top 10 most relevant chunks with their scores and source documents.""",
            expected_output="List of retrieved chunks with metadata and relevance scores",
            agent=RAGAgents.retrieval_agent()
        )
    
    @staticmethod
    def rank_documents_task(retrieved_docs: List[Dict[str, Any]], query: str) -> Task:
        """Create a task for ranking retrieved documents."""
        return Task(
            description=f"""Rank the following retrieved documents by relevance to the query:

Query: "{query}"

Consider multiple factors:
1. Semantic relevance to the query
2. Specificity and detail level
3. Recency and freshness
4. Source reliability
5. Complementary information value

Documents:
{json.dumps(retrieved_docs[:5], indent=2)}  # Show top 5 for brevity

Provide final ranking with justification for each document.""",
            expected_output="Ranked list of documents with relevance scores and justifications",
            agent=RAGAgents.ranking_agent()
        )
    
    @staticmethod
    def generate_response_task(query: str, ranked_docs: List[Dict[str, Any]]) -> Task:
        """Create a task for generating a response."""
        return Task(
            description=f"""Generate a comprehensive answer to this query using the provided context:

Query: "{query}"

Context (Top 3 sources):
{json.dumps(ranked_docs[:3], indent=2)}

Requirements:
1. Base answer strictly on provided context
2. Include citations for all factual claims
3. Be concise but thorough
4. Organize response logically
5. Flag any information gaps or limitations

Provide response in JSON format with:
- response: Main answer text
- citations: List of cited chunks with references
- confidence: Confidence level (0-1)
- limitations: Any gaps or caveats""",
            expected_output="JSON with generated response, citations, confidence, and limitations",
            agent=RAGAgents.generation_agent()
        )
    
    @staticmethod
    def validate_response_task(generated_response: Dict[str, Any], original_docs: List[Dict[str, Any]]) -> Task:
        """Create a task for validating the generated response."""
        return Task(
            description=f"""Validate this generated response for quality and accuracy:

Response: {generated_response.get('response', '')}
Citations: {generated_response.get('citations', [])}
Confidence: {generated_response.get('confidence', 0)}

Original Context:
{json.dumps(original_docs[:2], indent=2)}

Checks to perform:
1. Hallucination detection - facts not in context?
2. Citation verification - are citations accurate?
3. Coherence analysis - is response logical and clear?
4. Completeness - does it answer the question?
5. Bias check - is response balanced?

Provide validation report with:
- passed: Boolean (true if validation passes)
- confidence: Confidence in validation (0-1)
- issues: List of identified problems
- suggestions: Recommended improvements""",
            expected_output="JSON validation report with issues and suggestions",
            agent=RAGAgents.validation_agent()
        )
    
    @staticmethod
    def ingest_document_task(document_id: str, document_content: str) -> Task:
        """Create a task for ingesting a document."""
        return Task(
            description=f"""Prepare and process this document for the retrieval system:

Document ID: {document_id}
Content preview: {document_content[:500]}...

Processing steps:
1. Analyze document structure and content
2. Determine optimal chunk size and strategy
3. Generate descriptive metadata
4. Prepare for embedding generation
5. Optimize for search

Provide processing plan with:
- chunks: Recommended number of chunks
- chunkSize: Recommended chunk size (tokens)
- metadata: Key metadata to extract
- embeddingStrategy: How to handle embeddings
- indexOptimization: Search optimization tips""",
            expected_output="JSON document processing plan with chunking and embedding strategy",
            agent=RAGAgents.ingestion_agent()
        )
