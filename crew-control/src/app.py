from flask import Flask, jsonify, request
import os
import asyncio
import uuid
from datetime import datetime
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import workflows
try:
    from workflows import QueryWorkflow, IngestionWorkflow, WorkflowContext
    WORKFLOWS_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Workflows not available: {e}")
    WORKFLOWS_AVAILABLE = False

app = Flask(__name__)

# Configuration
AGENT_ENDPOINTS = {
    'query-parser': os.getenv('AGENT_QUERY_PARSER_URL', 'http://query-parser-agent:3002'),
    'ingestion': os.getenv('AGENT_INGESTION_URL', 'http://ingestion-agent:3001'),
    'retrieval': os.getenv('AGENT_RETRIEVAL_URL', 'http://retrieval-agent:3003'),
    'ranking': os.getenv('AGENT_RANKING_URL', 'http://ranking-agent:3004'),
    'generation': os.getenv('AGENT_GENERATION_URL', 'http://generation-agent:3005'),
    'validation': os.getenv('AGENT_VALIDATION_URL', 'http://validation-agent:3006')
}


# ============ Health Checks ============

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'crew-control',
        'timestamp': datetime.now().isoformat(),
        'version': os.getenv('APP_VERSION', '1.0.0')
    })


@app.route('/ready', methods=['GET'])
def ready():
    """Readiness check endpoint."""
    agents_status = {}
    for agent_name, endpoint in AGENT_ENDPOINTS.items():
        try:
            import requests
            response = requests.get(f"{endpoint}/health", timeout=2)
            agents_status[agent_name] = response.status_code == 200
        except:
            agents_status[agent_name] = False
    
    all_ready = all(agents_status.values())
    
    return jsonify({
        'ready': all_ready,
        'workflowsAvailable': WORKFLOWS_AVAILABLE,
        'agents': agents_status,
        'reason': 'All dependencies initialized' if all_ready else 'Some agents unavailable'
    }), 200 if all_ready else 503


# ============ Workflow Orchestration Endpoints ============

@app.route('/api/workflows/query', methods=['POST'])
def execute_query_workflow():
    """
    Execute the complete query processing workflow.
    
    Request body:
    {
        "query": "What is machine learning?",
        "documentIds": ["doc1", "doc2"],  # Optional: filter by documents
        "context": {
            "userId": "user123",
            "sessionId": "session456"
        }
    }
    """
    try:
        data = request.json
        query = data.get('query')
        document_ids = data.get('documentIds')
        context_data = data.get('context', {})
        
        if not query:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'INVALID_REQUEST',
                    'message': 'Query is required'
                }
            }), 400
        
        # Create workflow context
        trace_id = str(uuid.uuid4())
        user_id = context_data.get('userId', 'anonymous')
        context = WorkflowContext(trace_id=trace_id, user_id=user_id, metadata=context_data)
        
        logger.info(f"[{trace_id}] Executing query workflow: {query}")
        
        # Execute workflow
        workflow = QueryWorkflow()
        
        # Run async workflow
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                workflow.execute(
                    query=query,
                    document_ids=document_ids,
                    context=context,
                    agent_endpoints=AGENT_ENDPOINTS
                )
            )
        finally:
            loop.close()
        
        return jsonify(result), 200 if result.get('success') else 500
        
    except Exception as e:
        logger.error(f"Query workflow error: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': {
                'code': 'INTERNAL_SERVER_ERROR',
                'message': str(e)
            }
        }), 500


@app.route('/api/workflows/ingest', methods=['POST'])
def execute_ingest_workflow():
    """
    Execute the document ingestion workflow.
    
    Request body:
    {
        "documentId": "doc123",
        "content": "Full document content here...",
        "context": {
            "userId": "user123",
            "filename": "document.pdf"
        }
    }
    """
    try:
        data = request.json
        document_id = data.get('documentId')
        content = data.get('content')
        context_data = data.get('context', {})
        
        if not document_id or not content:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'INVALID_REQUEST',
                    'message': 'documentId and content are required'
                }
            }), 400
        
        # Create workflow context
        trace_id = str(uuid.uuid4())
        user_id = context_data.get('userId', 'anonymous')
        context = WorkflowContext(trace_id=trace_id, user_id=user_id, metadata=context_data)
        
        logger.info(f"[{trace_id}] Executing ingestion workflow for document: {document_id}")
        
        # Execute workflow
        workflow = IngestionWorkflow()
        
        # Run async workflow
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                workflow.execute(
                    document_id=document_id,
                    document_content=content,
                    context=context,
                    agent_endpoints=AGENT_ENDPOINTS
                )
            )
        finally:
            loop.close()
        
        return jsonify(result), 200 if result.get('success') else 500
        
    except Exception as e:
        logger.error(f"Ingestion workflow error: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': {
                'code': 'INTERNAL_SERVER_ERROR',
                'message': str(e)
            }
        }), 500


@app.route('/api/workflows/batch-ingest', methods=['POST'])
def execute_batch_ingest_workflow():
    """
    Execute batch ingestion for multiple documents.
    
    Request body:
    {
        "documents": [
            {
                "documentId": "doc1",
                "content": "..."
            },
            ...
        ]
    }
    """
    try:
        data = request.json
        documents = data.get('documents', [])
        
        if not documents:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'INVALID_REQUEST',
                    'message': 'documents array is required'
                }
            }), 400
        
        trace_id = str(uuid.uuid4())
        logger.info(f"[{trace_id}] Starting batch ingestion of {len(documents)} documents")
        
        results = []
        for doc in documents:
            doc_id = doc.get('documentId')
            content = doc.get('content')
            
            if not doc_id or not content:
                results.append({
                    'documentId': doc_id,
                    'success': False,
                    'error': 'Missing documentId or content'
                })
                continue
            
            context = WorkflowContext(
                trace_id=f"{trace_id}-{doc_id}",
                user_id='batch-ingest'
            )
            
            workflow = IngestionWorkflow()
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(
                    workflow.execute(
                        document_id=doc_id,
                        document_content=content,
                        context=context,
                        agent_endpoints=AGENT_ENDPOINTS
                    )
                )
                results.append({
                    'documentId': doc_id,
                    **result
                })
            finally:
                loop.close()
        
        successful = sum(1 for r in results if r.get('success', False))
        failed = len(documents) - successful
        
        logger.info(f"[{trace_id}] Batch ingestion completed: {successful} successful, {failed} failed")
        
        return jsonify({
            'success': failed == 0,
            'summary': {
                'total': len(documents),
                'successful': successful,
                'failed': failed
            },
            'results': results
        }), 200
        
    except Exception as e:
        logger.error(f"Batch ingestion error: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': {
                'code': 'INTERNAL_SERVER_ERROR',
                'message': str(e)
            }
        }), 500


# ============ Status & Management Endpoints ============

@app.route('/api/agents/status', methods=['GET'])
def get_agents_status():
    """Get status of all connected agents."""
    import requests
    
    status = {}
    for agent_name, endpoint in AGENT_ENDPOINTS.items():
        try:
            response = requests.get(f"{endpoint}/health", timeout=3)
            status[agent_name] = {
                'online': response.status_code == 200,
                'endpoint': endpoint,
                'lastChecked': datetime.now().isoformat()
            }
        except Exception as e:
            status[agent_name] = {
                'online': False,
                'endpoint': endpoint,
                'error': str(e),
                'lastChecked': datetime.now().isoformat()
            }
    
    online_count = sum(1 for s in status.values() if s.get('online'))
    
    return jsonify({
        'agents': status,
        'summary': {
            'total': len(AGENT_ENDPOINTS),
            'online': online_count,
            'offline': len(AGENT_ENDPOINTS) - online_count
        }
    })


@app.route('/api/config/agents', methods=['GET'])
def get_agent_config():
    """Get current agent endpoint configuration."""
    return jsonify({
        'agents': AGENT_ENDPOINTS,
        'environment': os.getenv('NODE_ENV', 'development')
    })


# ============ Error Handlers ============

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        'success': False,
        'error': {
            'code': 'NOT_FOUND',
            'message': 'Endpoint not found'
        }
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return jsonify({
        'success': False,
        'error': {
            'code': 'INTERNAL_SERVER_ERROR',
            'message': 'An internal server error occurred'
        }
    }), 500


# ============ Application Entry Point ============

if __name__ == '__main__':
    port = int(os.getenv('CREW_CONTROL_PORT', 3007))
    debug = os.getenv('NODE_ENV', 'development') == 'development'
    
    logger.info(f"Starting CrewAI Orchestration Service on port {port}")
    logger.info(f"Agent endpoints: {AGENT_ENDPOINTS}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug,
        use_reloader=False
    )

        }
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': {
            'code': 'INTERNAL_ERROR',
            'message': 'An unexpected error occurred'
        }
    }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=os.getenv('FLASK_DEBUG') == '1')
