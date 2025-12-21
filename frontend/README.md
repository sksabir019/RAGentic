# RAGentic Frontend

Modern React + TypeScript single page application that powers the RAGentic chat experience, document uploads, and analytics surfaces.

## Overview

The frontend focuses on delivering a fast, responsive user interface for document assisted conversations. It integrates tightly with the backend API gateway and exposes:

- Conversational RAG workspace with auto-resizing chat input, source citations, and confidence badges.
- Document management (upload, status feedback, removal) with drag-and-drop support.
- Authenticated routing with JWT-backed session handling.
- Responsive dark UI built with Tailwind utilities and reusable layout primitives.

## Tech Stack

- **Framework**: React 18 with functional components and hooks
- **Language**: TypeScript (strict mode)
- **Bundler**: Vite 5
- **Styling**: Tailwind CSS + custom utility layers
- **State**: Zustand stores for auth and documents
- **HTTP**: Axios client with interceptor-based token handling
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+
- npm 9+

If you rely on the backend API locally, ensure the API gateway is running at `http://localhost:3000` (default).

## Getting Started

```bash
cd frontend
npm install

# copy/adjust environment overrides as needed
cp .env.example .env.local  # if you maintain env templates

npm run dev
```

Vite exposes the app at `http://localhost:5173` by default. Update `REACT_APP_API_URL` if the backend is reachable on a different host or port.

## Environment Variables

Create a `.env`, `.env.local`, or use your hosting provider's environment manager. Common options:

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Base URL of the backend REST API | `http://localhost:3000/api` |
| `REACT_APP_WS_URL`  | WebSocket endpoint if realtime features are enabled | `ws://localhost:3000` |
| `REACT_APP_ENV`     | Arbitrary environment label for logging/diagnostics | `development` |

Vite exposes variables prefixed with `REACT_APP_` or `VITE_` to the browser. Remember to restart the dev server after changing env files.

## Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the Vite development server with hot module replacement |
| `npm run build` | Type-checks and builds the production bundle into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Runs ESLint across `.ts` and `.tsx` sources |
| `npm run type-check` | Executes the TypeScript compiler in no-emit mode |

## Project Structure

```
frontend/
├── src/
│   ├── components/      # UI primitives (layout, upload widgets, badges)
│   ├── pages/           # Route-level screens (Dashboard, Auth, Upload, etc.)
│   ├── services/        # Axios client + API helpers
│   ├── stores/          # Zustand state containers
│   ├── styles/          # Tailwind entry points and theme overrides
│   ├── App.tsx          # Route definitions
│   └── main.tsx         # React root bootstrap
├── public/              # Static assets served as-is
├── tailwind.config.ts   # Tailwind tokens + plugins
├── vite.config.ts       # Vite + React plugin config
└── README.md            # This document
```

## Development Notes

- Shared UI patterns are implemented as composable utility classes—prefer adding Tailwind utilities over bespoke CSS when possible.
- Zustand stores persist auth tokens and global settings. Access them via hooks (`useAuthStore`, `useDocumentStore`) instead of prop drilling.
- Axios client wraps request/response interceptors to inject the bearer token and handle 401 fallbacks.

## Testing & Quality

Currently the frontend relies on linting and TypeScript checks for guardrails. To extend quality gates:

1. Add component or integration tests with Vitest/React Testing Library.
2. Enable formatting enforcement (Prettier) if desired.
3. Consider Storybook for visual regression testing of the chat and upload widgets.

## Production Build & Deployment

```bash
npm run build
npm run preview  # sanity-check the production output
```

The `dist/` directory can be deployed to static hosting platforms (Netlify, Vercel, CloudFront/S3) or served through the provided Nginx container:

```bash
docker build -f Dockerfile -t ragentic-frontend .
docker run -p 80:80 ragentic-frontend
```

## Troubleshooting

- **Blank screen or network failures**: confirm `REACT_APP_API_URL` matches the backend origin and that CORS is configured in the API gateway.
- **Styling not updating**: stop the dev server, clear `.vite` cache, and re-run `npm run dev`.
- **ESLint errors**: run `npm run lint` locally and address the reported rules; the CI pipeline enforces zero warnings.

## Further Reading

- Repository-wide architecture: [../ARCHITECTURE.md](../ARCHITECTURE.md)
- Backend/API details: [../backend/README.md](../backend/README.md)
- Design principles and UX guidelines: [../DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md)
