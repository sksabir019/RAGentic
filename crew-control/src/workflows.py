"""
RAG Workflow Orchestration using CrewAI
Implements end-to-end query processing and document ingestion workflows
"""
import os
import json
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

try:
    from crewai import Agent, Task, Crew, Process
    CREWAI_AVAILABLE = True
except ImportError:
    CREWAI_AVAILABLE = False
    logger.warning("CrewAI not installed - running in mock mode")


class WorkflowContext:
    """Context object passed through workflow execution."""
    
    def __init__(self, trace_id: str, user_id: str, metadata: Dict[str, Any] = None):
        self.trace_id = trace_id
        self.user_id = user_id
        self.metadata = metadata or {}
        self.start_time = datetime.now()
        self.steps = []
        self.errors = []
    
    def add_step(self, step_name: str, result: Dict[str, Any], duration_ms: float):
        """Record a workflow step execution."""
        self.steps.append({
            'name': step_name,
            'result': result,
            'durationMs': duration_ms,
            'timestamp': datetime.now().isoformat()
        })
    
    def add_error(self, step_name: str, error: str):
        """Record a workflow error."""
        self.errors.append({
            'step': step_name,
            'error': error,
            'timestamp': datetime.now().isoformat()
        })
    
    def get_duration_ms(self) -> float:
        """Get total execution time in milliseconds."""
        return (datetime.now() - self.start_time).total_seconds() * 1000


class QueryWorkflow:
    """Orchestrates the complete query processing workflow."""
    
    def __init__(self):
        self.context = None
        self.parsed_query = None
        self.retrieved_docs = None
        self.ranked_docs = None
        self.generated_response = None
        self.validation_result = None
    
    async def execute(
        self,
        query: str,
        document_ids: Optional[List[str]] = None,
        context: Optional[WorkflowContext] = None,
        agent_endpoints: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Execute the complete query workflow.
        
        Pipeline:
        1. Parse Query (Query Parser Agent)
        2. Retrieve Documents (Retrieval Agent)
        3. Rank Documents (Ranking Agent)
        4. Generate Response (Generation Agent)
        5. Validate Response (Validation Agent)
        """
        if not context:
            context = WorkflowContext(trace_id='unknown', user_id='unknown')
        
        self.context = context
        
        try:
            # Step 1: Parse Query
            logger.info(f"[{context.trace_id}] Starting query workflow for: {query}")
            self.parsed_query = await self._parse_query(query, agent_endpoints)
            
            # Step 2: Retrieve Documents
            self.retrieved_docs = await self._retrieve_documents(
                query,
                self.parsed_query,
                document_ids,
                agent_endpoints
            )
            
            # Step 3: Rank Documents
            self.ranked_docs = await self._rank_documents(
                query,
                self.retrieved_docs,
                agent_endpoints
            )
            
            # Step 4: Generate Response
            self.generated_response = await self._generate_response(
                query,
                self.ranked_docs,
                agent_endpoints
            )
            
            # Step 5: Validate Response
            self.validation_result = await self._validate_response(
                self.generated_response,
                self.retrieved_docs,
                agent_endpoints
            )
            
            # Build final response
            final_response = self._build_final_response()
            
            logger.info(f"[{context.trace_id}] Query workflow completed successfully")
            return {
                'success': True,
                'data': final_response,
                'metadata': {
                    'executionTimeMs': context.get_duration_ms(),
                    'traceId': context.trace_id,
                    'steps': context.steps,
                    'errors': context.errors
                }
            }
            
        except Exception as e:
            logger.error(f"[{context.trace_id}] Query workflow failed: {str(e)}")
            context.add_error('workflow', str(e))
            
            return {
                'success': False,
                'error': {
                    'code': 'QUERY_WORKFLOW_FAILED',
                    'message': str(e),
                    'traceId': context.trace_id
                },
                'metadata': {
                    'executionTimeMs': context.get_duration_ms(),
                    'steps': context.steps,
                    'errors': context.errors
                }
            }
    
    async def _parse_query(
        self,
        query: str,
        agent_endpoints: Optional[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Parse query using Query Parser Agent."""
        import time
        start = time.time()
        
        try:
            if agent_endpoints and 'query-parser' in agent_endpoints:
                # Call actual agent service
                import requests
                response = requests.post(
                    f"{agent_endpoints['query-parser']}/parse",
                    json={'query': query},
                    timeout=10
                )
                result = response.json()
            else:
                # Mock response
                result = {
                    'intent': 'information_seeking',
                    'entities': [],
                    'questionType': 'factual',
                    'requiredContext': 'Factual information',
                    'constraints': {}
                }
            
            duration = (time.time() - start) * 1000
            self.context.add_step('parse_query', result, duration)
            return result
            
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.context.add_error('parse_query', str(e))
            self.context.add_step('parse_query', {}, duration)
            raise
    
    async def _retrieve_documents(
        self,
        query: str,
        parsed_query: Dict[str, Any],
        document_ids: Optional[List[str]],
        agent_endpoints: Optional[Dict[str, str]]
    ) -> List[Dict[str, Any]]:
        """Retrieve documents using Retrieval Agent."""
        import time
        start = time.time()
        
        try:
            if agent_endpoints and 'retrieval' in agent_endpoints:
                import requests
                response = requests.post(
                    f"{agent_endpoints['retrieval']}/search",
                    json={
                        'query': query,
                        'documentIds': document_ids,
                        'filters': parsed_query.get('constraints', {})
                    },
                    timeout=15
                )
                result = response.json().get('results', [])
            else:
                # Mock response
                result = [
                    {
                        'chunkId': 'chunk_1',
                        'documentId': 'doc_1',
                        'content': f'Sample content matching: {query}',
                        'relevanceScore': 0.95,
                        'metadata': {}
                    }
                ]
            
            duration = (time.time() - start) * 1000
            self.context.add_step('retrieve_documents', {'count': len(result)}, duration)
            return result
            
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.context.add_error('retrieve_documents', str(e))
            self.context.add_step('retrieve_documents', {}, duration)
            raise
    
    async def _rank_documents(
        self,
        query: str,
        retrieved_docs: List[Dict[str, Any]],
        agent_endpoints: Optional[Dict[str, str]]
    ) -> List[Dict[str, Any]]:
        """Rank documents using Ranking Agent."""
        import time
        start = time.time()
        
        try:
            if agent_endpoints and 'ranking' in agent_endpoints:
                import requests
                response = requests.post(
                    f"{agent_endpoints['ranking']}/rank",
                    json={
                        'query': query,
                        'documents': retrieved_docs[:10]  # Top 10 only
                    },
                    timeout=10
                )
                result = response.json().get('ranked', retrieved_docs)
            else:
                # Mock: return as-is (assuming already scored)
                result = retrieved_docs
            
            duration = (time.time() - start) * 1000
            self.context.add_step('rank_documents', {'count': len(result)}, duration)
            return result
            
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.context.add_error('rank_documents', str(e))
            self.context.add_step('rank_documents', {}, duration)
            raise
    
    async def _generate_response(
        self,
        query: str,
        ranked_docs: List[Dict[str, Any]],
        agent_endpoints: Optional[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Generate response using Generation Agent."""
        import time
        start = time.time()
        
        try:
            if agent_endpoints and 'generation' in agent_endpoints:
                import requests
                response = requests.post(
                    f"{agent_endpoints['generation']}/generate",
                    json={
                        'query': query,
                        'context': ranked_docs[:5]  # Top 5 chunks
                    },
                    timeout=20
                )
                result = response.json()
            else:
                # Mock response
                result = {
                    'response': f'Answer to "{query}" based on provided context.',
                    'citations': [{'chunkId': doc.get('chunkId'), 'relevance': doc.get('relevanceScore', 0.9)} for doc in ranked_docs[:3]],
                    'confidence': 0.85,
                    'limitations': []
                }
            
            duration = (time.time() - start) * 1000
            self.context.add_step('generate_response', {'textLength': len(result.get('response', ''))}, duration)
            return result
            
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.context.add_error('generate_response', str(e))
            self.context.add_step('generate_response', {}, duration)
            raise
    
    async def _validate_response(
        self,
        generated_response: Dict[str, Any],
        context_docs: List[Dict[str, Any]],
        agent_endpoints: Optional[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Validate response using Validation Agent."""
        import time
        start = time.time()
        
        try:
            if agent_endpoints and 'validation' in agent_endpoints:
                import requests
                response = requests.post(
                    f"{agent_endpoints['validation']}/validate",
                    json={
                        'response': generated_response,
                        'context': context_docs[:5]
                    },
                    timeout=15
                )
                result = response.json()
            else:
                # Mock validation
                result = {
                    'passed': True,
                    'confidence': 0.92,
                    'issues': [],
                    'suggestions': []
                }
            
            duration = (time.time() - start) * 1000
            self.context.add_step('validate_response', result, duration)
            return result
            
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.context.add_error('validate_response', str(e))
            self.context.add_step('validate_response', {}, duration)
            raise
    
    def _build_final_response(self) -> Dict[str, Any]:
        """Build the final response from workflow results."""
        return {
            'response': self.generated_response.get('response', ''),
            'citations': self.generated_response.get('citations', []),
            'confidence': self.generated_response.get('confidence', 0),
            'validation': {
                'passed': self.validation_result.get('passed', False),
                'confidence': self.validation_result.get('confidence', 0),
                'issues': self.validation_result.get('issues', [])
            },
            'context': {
                'parsedQuery': self.parsed_query,
                'documentsRetrieved': len(self.retrieved_docs),
                'topDocuments': self.ranked_docs[:3] if self.ranked_docs else []
            }
        }


class IngestionWorkflow:
    """Orchestrates the document ingestion workflow."""
    
    def __init__(self):
        self.context = None
        self.processing_plan = None
        self.chunks = None
    
    async def execute(
        self,
        document_id: str,
        document_content: str,
        context: Optional[WorkflowContext] = None,
        agent_endpoints: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Execute the document ingestion workflow.
        
        Pipeline:
        1. Plan Processing (Ingestion Agent)
        2. Generate Chunks
        3. Generate Embeddings
        4. Index in Vector Database
        """
        if not context:
            context = WorkflowContext(trace_id='unknown', user_id='unknown')
        
        self.context = context
        
        try:
            logger.info(f"[{context.trace_id}] Starting ingestion workflow for document: {document_id}")
            
            # Step 1: Create processing plan
            self.processing_plan = await self._plan_processing(
                document_id,
                document_content,
                agent_endpoints
            )
            
            # Step 2: Generate chunks
            self.chunks = await self._generate_chunks(
                document_id,
                document_content,
                self.processing_plan,
                agent_endpoints
            )
            
            # Step 3: Generate embeddings (handled by ingestion agent)
            embedding_result = await self._generate_embeddings(
                self.chunks,
                agent_endpoints
            )
            
            logger.info(f"[{context.trace_id}] Ingestion workflow completed successfully")
            return {
                'success': True,
                'data': {
                    'documentId': document_id,
                    'chunksCount': len(self.chunks),
                    'embeddingsGenerated': embedding_result.get('count', 0),
                    'processingPlan': self.processing_plan
                },
                'metadata': {
                    'executionTimeMs': context.get_duration_ms(),
                    'traceId': context.trace_id,
                    'steps': context.steps
                }
            }
            
        except Exception as e:
            logger.error(f"[{context.trace_id}] Ingestion workflow failed: {str(e)}")
            context.add_error('workflow', str(e))
            
            return {
                'success': False,
                'error': {
                    'code': 'INGESTION_WORKFLOW_FAILED',
                    'message': str(e),
                    'traceId': context.trace_id
                },
                'metadata': {
                    'executionTimeMs': context.get_duration_ms(),
                    'steps': context.steps,
                    'errors': context.errors
                }
            }
    
    async def _plan_processing(
        self,
        document_id: str,
        document_content: str,
        agent_endpoints: Optional[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Create processing plan using Ingestion Agent."""
        import time
        start = time.time()
        
        try:
            if agent_endpoints and 'ingestion' in agent_endpoints:
                import requests
                response = requests.post(
                    f"{agent_endpoints['ingestion']}/plan",
                    json={
                        'documentId': document_id,
                        'contentPreview': document_content[:1000]
                    },
                    timeout=10
                )
                result = response.json()
            else:
                # Mock plan
                result = {
                    'chunks': 10,
                    'chunkSize': 512,
                    'metadata': ['title', 'author', 'date'],
                    'embeddingStrategy': 'semantic',
                    'indexOptimization': 'hierarchical'
                }
            
            duration = (time.time() - start) * 1000
            self.context.add_step('plan_processing', result, duration)
            return result
            
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.context.add_error('plan_processing', str(e))
            self.context.add_step('plan_processing', {}, duration)
            raise
    
    async def _generate_chunks(
        self,
        document_id: str,
        document_content: str,
        plan: Dict[str, Any],
        agent_endpoints: Optional[Dict[str, str]]
    ) -> List[Dict[str, Any]]:
        """Generate chunks from document."""
        import time
        start = time.time()
        
        try:
            chunk_size = plan.get('chunkSize', 512)
            # Simple chunking: split by sentences/paragraphs
            chunks = []
            words = document_content.split()
            
            current_chunk = []
            for word in words:
                current_chunk.append(word)
                if len(' '.join(current_chunk)) >= chunk_size:
                    chunks.append({
                        'documentId': document_id,
                        'content': ' '.join(current_chunk),
                        'chunkIndex': len(chunks),
                        'tokens': len(current_chunk)
                    })
                    current_chunk = []
            
            if current_chunk:
                chunks.append({
                    'documentId': document_id,
                    'content': ' '.join(current_chunk),
                    'chunkIndex': len(chunks),
                    'tokens': len(current_chunk)
                })
            
            duration = (time.time() - start) * 1000
            self.context.add_step('generate_chunks', {'count': len(chunks)}, duration)
            return chunks
            
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.context.add_error('generate_chunks', str(e))
            raise
    
    async def _generate_embeddings(
        self,
        chunks: List[Dict[str, Any]],
        agent_endpoints: Optional[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Generate embeddings for chunks."""
        import time
        start = time.time()
        
        try:
            if agent_endpoints and 'ingestion' in agent_endpoints:
                import requests
                response = requests.post(
                    f"{agent_endpoints['ingestion']}/embed",
                    json={'chunks': chunks[:10]},  # Embed first 10
                    timeout=20
                )
                result = response.json()
            else:
                # Mock embeddings
                result = {'count': len(chunks)}
            
            duration = (time.time() - start) * 1000
            self.context.add_step('generate_embeddings', result, duration)
            return result
            
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.context.add_error('generate_embeddings', str(e))
            raise
