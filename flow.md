# RAGentic Execution Flow

This document captures how requests move through the system, when each agent participates, and the fallbacks that keep responses flowing even when components are offline.

## 1. Document Ingestion

1. **User Action**: The frontend upload page sends a multipart request to `POST /api/documents/upload` on the API gateway.
2. **Gateway Validation**: The Express backend enforces JWT authentication, checks file size/type limits, and writes logs with a new trace ID.
3. **Processing Path**:
   - **With Ingestion Agent**: The gateway forwards the file reference to the ingestion agent (port 3001). The agent extracts text, splits it into chunks, and generates embeddings before handing processed chunks back to the gateway.
   - **Without Agent**: The gateway runs the same logic internally through `DocumentProcessingService` (pdf-parse, Mammoth, tokenizer, embedding fallback).
4. **Storage**: Chunks, metadata, and embeddings are persisted through the database adapter (PostgreSQL or MongoDB) and cached in memory for quick lookup. Status updates are sent back to the client so the UI can show progress.

## 2. Authentication Context

- All subsequent API calls include the JWT issued during login (`/api/auth/login`).
- The backend resolves the token into `userId`, attaches the value to downstream requests, and applies rate limiting based on the user identity.

## 3. Query Execution Overview

When the user submits a question from the dashboard, the frontend calls `POST /api/queries`.

1. **Request Initialization**: The backend stamps the request with a trace ID and stores the start time for telemetry.
2. **Microservice Availability Check**: The gateway inspects environment variables to decide whether the CrewAI agent pipeline is enabled. If any required agent URL is missing, it transparently falls back to the internal RAG route.
3. **Context Assembly**: User ID, optional document filters, and routing hints (`provider`, `model`) are collected into a `context` payload shared with each agent.

## 4. CrewAI Agent Pipeline (When Enabled)

The following agents execute sequentially. Each agent receives the prior output and may enrich or transform the payload.

1. **Query Parser Agent (3002)**
   - Refines the natural language question, identifies intents, resets ambiguous phrasing, and may split compound questions.
   - Output: `parsedQuery`, canonicalized filters, optional sub-queries.

2. **Retrieval Agent (3003)**
   - Combines dense vector similarity and optional BM25 lexical scoring to fetch candidate chunks from persistence.
   - Output: `results` list with document IDs, chunk text, and similarity signals.

3. **Ranking Agent (3004)**
   - Reorders the candidate chunks using advanced heuristics or reranker models to surface the most relevant evidence first.
   - Output: `rankedDocuments`, trimmed to the desired top-K.

4. **Generation Agent (3005)**
   - Builds a structured prompt from the ranked chunks and user question.
   - Calls the backend AI service abstraction which routes to Groq (`llama-3.x`) or OpenAI (`gpt-4o-mini`, etc.) depending on `LLM_PROVIDER` and request overrides.
   - Output: Draft answer with inline references to chunk identifiers.

5. **Validation Agent (3006)**
   - Evaluates the generated answer for hallucinations, citation mismatches, and confidence thresholds.
   - Output: Validation score, warnings, and the final response payload.

6. **Gateway Response**
   - The backend stores the full exchange via `QueryHistoryService`, including citations and confidence score.
   - The API returns the answer, citation metadata, confidence, and execution timing to the frontend.

## 5. Internal RAG Fallback (Agents Offline)

If the agent suite is not running, the backend performs the entire flow locally:

1. Retrieve candidate chunks using cosine similarity over stored embeddings. If embeddings are missing, fall back to keyword matching.
2. Compute aggregate similarity and create a prompt that enumerates sources.
3. Invoke `AIService.chatCompletion` against the default provider (Groq or OpenAI) to generate the answer.
4. Build citations from the selected chunks and compute confidence via average similarity.
5. Persist query history and return the response as in the agent path.

## 6. Response Rendering

- The frontend receives JSON containing the assistant answer, citations, confidence score, and trace metadata.
- Messages are appended to local UI state; citations are rendered as clickable reference badges, and the confidence value drives the progress-bar indicator.

## 7. Observability & Resilience

- **Logging**: Each stage logs with the same trace ID (`x-trace-id` header), enabling cross-service debugging.
- **Rate Limiting**: `express-rate-limit` protects the gateway from excessive queries.
- **Timeouts**: Agent requests include per-stage timeouts; a timeout triggers fallback to internal RAG or returns a controlled error depending on the stage.
- **Graceful Degradation**: If validation fails or returns low confidence, the response still reaches the user with a warning flag so the frontend can notify them.

## 8. Key Interactions Summary

| Stage | Component | Trigger | Output |
|-------|-----------|---------|--------|
| Upload | Frontend → Backend | User selects files and submits | Stored chunks, upload status |
| Extraction | Ingestion Agent or Backend | File accepted | Chunk text + embeddings |
| Query | Frontend → Backend | User question | Routed to CrewAI pipeline or local RAG |
| Parser | Query Parser Agent | Parsed query intent | Normalized query payload |
| Retrieval | Retrieval Agent | Query context | Candidate chunks |
| Ranking | Ranking Agent | Candidate list | Ordered top-K |
| Generation | Generation Agent → AI provider | Prompt | Draft answer |
| Validation | Validation Agent | Draft answer | Final answer + confidence |
| History | Backend | Final response | Persisted query log |
| UI Update | Frontend | API response | Chat message with citations |

## 9. Runtime Controls

- **Agent toggle**: `useMicroservices()` in `backend/src/routes/queries.ts` checks for `QUERY_PARSER_AGENT_URL`, `RETRIEVAL_AGENT_URL`, `RANKING_AGENT_URL`, `GENERATION_AGENT_URL`, and `VALIDATION_AGENT_URL`. If any are missing, the backend automatically uses the internal RAG flow.
- **Default LLM**: `LLM_PROVIDER` selects `groq` or `openai`. Request-level overrides can be passed via the `provider` and `model` fields in the query payload. The backend logs the active provider at startup.
- **Embeddings**: When `OPENAI_API_KEY` is absent the system falls back to keyword search; upload responses include warnings when embeddings are skipped.
- **Rate limits**: `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW` guard `/api/queries` and `/api/documents/upload` via Express middleware.

## 10. Persistence Touchpoints

- **Database**: The `DatabaseAdapter` (Postgres or MongoDB) stores Users, Documents, Chunks, QueryHistory, and Sessions. Switching providers requires only `.env` changes and a restart.
- **Cache / Message Bus**: Redis is used for request throttling, temporary session data, and can be extended for job queues. Ensure `REDIS_URL` resolves to a live instance before starting the backend.
- **File storage**: Uploaded binaries may be kept locally (`backend/uploads/`) or forwarded to S3 depending on environment variables (`AWS_*`, `S3_BUCKET_NAME`).
- **Cleanup**: Document deletions remove chunks from the adapter and clear cached entries; if external storage is used, ensure lifecycle rules delete the raw binary.

## 11. Agent Contract Snapshots

The backend exchanges JSON payloads with each agent. Typical request/response shapes are:

```json
// Parser request
{ "payload": { "query": "What does Annexure C say?" }, "context": { "userId": "u123", "traceId": "..." } }

// Retrieval response
{ "data": { "results": [ { "documentId": "doc1", "text": "Chunk text", "score": 0.82 } ] } }

// Generation request
{ "payload": { "query": "...", "context": [ /* ranked chunks */ ], "style": "professional", "includeReferences": true }, "context": { ... } }
```

Consistency in key names (`payload`, `context`, `data`) is important; the gateway relies on these when chaining agents.

## 12. Error Handling & Fallbacks

- **Timeouts**: Each agent call sets a timeout (5–30 seconds depending on step). Expired calls throw and trigger fallback or error propagation.
- **Partial failure**: If any agent beyond retrieval fails, the backend may reuse available data (e.g., skip validation but return the generated answer with a warning).
- **Confidence guard**: Responses with confidence below `CONFIDENCE_THRESHOLD` include a warning field so the frontend can signal reduced reliability.
- **LLM errors**: Provider-specific failures (quota, network) fall back to alternative providers when configured or respond with HTTP 503 and a descriptive message.
- **Rate limit**: Exceeded thresholds return HTTP 429 with retry information.

## 13. Observability

- **Structured logs**: Winston + Morgan write combined logs to console and rotating files (`backend.log`, `error.log`). Trace IDs surface in each line.
- **Monitoring hooks**: `ENABLE_METRICS=true` makes the backend expose metrics endpoints suitable for Prometheus (extend as needed).
- **Client correlation**: Frontend includes the `x-trace-id` header when resending a query, making debug sessions easier across retries.
- **Log review**: Use `docker-compose logs backend` or `tail -f backend/backend.log` during development; ship logs to centralized systems in production.

## 14. Crew Control Orchestration

- The repository includes `crew-control/`, a Python service intended to supervise agent orchestration and recovery loops. At present the Express gateway coordinates agents directly; future iterations can delegate orchestration to Crew Control via REST/WebSocket calls.
- When integrating Crew Control, align its workflow definitions with the agent contract schema described above to preserve compatibility.

This flow ensures RAGentic can answer document-grounded questions with clear provenance while remaining resilient to partial outages of its microservices.
