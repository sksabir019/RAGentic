# RAGentic Backend

TypeScript Express API that authenticates users, manages document ingestion, and orchestrates retrieval-augmented generation requests across the multi-agent pipeline.

## Overview

The backend exposes a JWT-protected REST API that:

- Handles user registration, authentication, and session validation.
- Accepts document uploads, enqueues asynchronous ingestion jobs, extracts text, chunks content, and stores embeddings in a persistent vector index.
- Coordinates RAG queries using the AI service abstraction (OpenAI and Groq with graceful fallback).
- Persists query history and document metadata through a database adapter that supports PostgreSQL or MongoDB.
- Publishes structured logs, rate limiting, and trace identifiers for production observability.

## Tech Stack

- **Runtime**: Node.js 18+, Express 4, TypeScript
- **Persistence**: TypeORM adapter targeting PostgreSQL or MongoDB (async ingestion + vector search require PostgreSQL with pgvector)
- **Caching**: Redis (sessions, rate limiting, temporary storage)
- **AI Providers**: OpenAI, Groq (pluggable)
- **Storage**: Multer for uploads, optional S3 integration
- **Testing**: Jest + Supertest
- **Linting**: ESLint with TypeScript rules

## Prerequisites

- Node.js 18+ and npm 9+
- Redis instance (local or container)
- PostgreSQL 14+ with the `vector` and `pgcrypto` extensions enabled (MongoDB is supported for legacy synchronous mode only)
- Optional LLM keys (`OPENAI_API_KEY`, `GROQ_API_KEY`)

For containerized workflows use the provided Docker Compose file (`docker-compose.dev.yml`).

## Setup

```bash
cd backend
npm install

# Copy and edit environment config
cp ../.env.example .env    # or craft a backend-specific .env
```

Important environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `BACKEND_PORT` | HTTP port for the API gateway | `3000` |
| `DATABASE_TYPE` | `postgres` or `mongodb` | `postgres` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Postgres connection | `localhost`, `5432`, `postgres`, `postgres`, `ragentic_dev` |
| `MONGO_URI` | Mongo connection string if using MongoDB | `mongodb://localhost:27017/ragentic` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `OPENAI_API_KEY`, `GROQ_API_KEY` | LLM provider credentials | `sk-...` |
| `LLM_PROVIDER` | Default provider (`openai` or `groq`) | `groq` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `52428800` |
| `VECTOR_DIMENSION` | Embedding size for pgvector storage | `1536` |
| `DOCUMENT_INGESTION_CONCURRENCY` | Worker concurrency for ingestion jobs | `2` |
| `DOCUMENT_INGESTION_RETRY_ATTEMPTS` | Retries per ingestion job | `3` |
| `DOCUMENT_INGESTION_RETRY_DELAY_MS` | Backoff delay for retries | `5000` |
| `DOCUMENT_INGESTION_RETAIN_FAILED` | Failed-job retention before cleanup | `10` |

Refer to [../DATABASE_SETUP.md](../DATABASE_SETUP.md) for in-depth database guidance and to `.env.example` for the full variable list.

## Running the Server

### Development (ts-node-dev)

```bash
npm run dev
```

The server listens on `http://localhost:3000` by default. It will attempt to connect to the configured database and Redis instances on startup. Document uploads are acknowledged immediately and processed by the ingestion worker.

### Document Ingestion Worker

The worker consumes the BullMQ queue, performs text extraction, generates embeddings, and writes chunk vectors into pgvector:

```bash
npm run worker:documents
```

Run at least one worker alongside the API when accepting uploads.

### Production Build

```bash
npm run build
npm start
```

### With Docker

The root `docker-compose.dev.yml` spins up the backend, frontend, agents, and supporting services. Execute from the repository root:

```bash
docker-compose -f docker-compose.dev.yml up backend
```

## Project Structure

```
backend/
├── src/
│   ├── routes/            # REST endpoints (auth, documents, queries, health)
│   ├── services/          # Domain services (AIService, RAGService, etc.)
│   ├── database/          # Adapter, entities, migrations/seeds
│   ├── cache/             # Redis setup
│   ├── middleware/        # Auth, error handling, logging
│   ├── utils/             # Auth utilities, helpers
│   ├── queues/            # BullMQ queue definitions
│   └── workers/           # Background ingestion worker
│   └── index.ts           # Express bootstrapper
├── dist/                  # Compiled JS output
├── package.json
└── tsconfig.json
```

### Core Services

- **AIService**: Delegates to OpenAI or Groq for chat completions and embeddings with provider selection via env variables.
- **DocumentProcessingService**: Extracts text (PDF via `pdf-parse`, DOCX via `mammoth`), chunks content, and generates embeddings with keyword fallback.
- **VectorStoreService**: Persists and queries chunk embeddings using pgvector with cosine similarity search.
- **RAGService**: Uses the vector store for semantic retrieval (with keyword fallback), constructs prompts, calls AIService, and assembles citations/confidence scores.
- **QueryHistoryService**: Persists user interactions for analytics and replays.

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/api/auth/register` | Create a new user | Public |
| `POST` | `/api/auth/login` | Authenticate, returns JWT | Public |
| `GET`  | `/api/auth/me` | Current user profile | Bearer |
| `POST` | `/api/auth/change-password` | Update password | Bearer |
| `POST` | `/api/documents/upload` | Upload a document (multipart) | Bearer |
| `GET`  | `/api/documents` | List documents | Bearer |
| `GET`  | `/api/documents/:id/status` | Fetch ingestion status + queue info | Bearer |
| `GET`  | `/api/documents/:id/ingestion-jobs` | List ingestion job history | Bearer |
| `POST` | `/api/documents/:id/reprocess` | Reprocess an existing document | Bearer |
| `DELETE` | `/api/documents/:id` | Remove document | Bearer |
| `POST` | `/api/queries` | Execute a RAG query | Bearer |
| `GET`  | `/api/queries/history` | Paginated query history | Bearer |
| `GET`  | `/api/queries/ai/providers` | Discover configured LLM providers | Public |
| `GET`  | `/api/queries/ai/stats` | Document + provider stats for the user | Bearer |
| `GET`  | `/api/system/queues/document-ingestion` | Queue metrics (admin only) | Bearer + Admin |
| `GET`  | `/api/system/queues/document-ingestion/jobs/:jobId` | Inspect ingestion job (admin only) | Bearer + Admin |
| `GET`  | `/health` | Health check | Public |

Inspect `src/routes` for the full handler implementations and additional endpoints (e.g., validation, agent invocations).

## Testing & Quality

```bash
npm run lint             # ESLint over TypeScript sources
npm test                 # Jest test suite
npm run test:watch       # Jest watch mode
npm run test:coverage    # Generate coverage report
npm run migrate          # Apply database migrations
npm run worker:documents # Start ingestion worker (development convenience)
```

### Useful Logs

The backend emits combined logs to `backend.log` and structured transport via Winston. Tail logs during development:

```bash
tail -f backend.log
```

## Troubleshooting

- **Database connection failures**: confirm `DATABASE_TYPE` matches available services and credentials; ensure the target DB is running and that the `vector` extension is installed.
- **Redis unavailable**: update `REDIS_URL` or run `docker-compose up redis`.
- **LLM provider errors**: verify API keys and default provider settings (`LLM_PROVIDER`, `OPENAI_MODEL`, `GROQ_MODEL`).
- **File upload limits**: adjust `MAX_FILE_SIZE` and `ALLOWED_FILE_TYPES` in `.env`.
- **Stuck processing status**: verify the ingestion worker is running and review BullMQ/Redis connectivity.

## Related Documentation

- High-level architecture: [../ARCHITECTURE.md](../ARCHITECTURE.md)
- Agent specifications: [../AGENT_SPEC.md](../AGENT_SPEC.md)
- Implementation roadmap: [../IMPLEMENTATION.md](../IMPLEMENTATION.md)
- Crew workflows: [../WORKFLOW.md](../WORKFLOW.md)
