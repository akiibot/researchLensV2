# ResearchLens

ResearchLens is a Next.js research-gap assistant for thesis students and supervisors. It searches open scholarly metadata, ranks related papers, identifies gap dimensions, suggests pivots, and recommends relevant faculty/researchers.

## Current Capabilities

- Student Mode: thesis idea validation, overlap risk, gap matrix, potential supervisor/researcher discovery, outreach drafts, and student-friendly next steps.
- Faculty Mode: topic review, evidence quality checks, faculty-friendly summaries, and related researcher/collaborator discovery.
- Grant / Funding Fit: fundability score, funding angles, funder categories, search links, internal routes, connector suggestions, outreach drafts, collaborator profiles, specific aims, impact statement, and mini grant abstract.
- Gemini model routing:
  - reasoning/gap finding: `GEMINI_REASONING_MODEL` with fallback
  - summaries, translation, and query expansion: Flash-class models
- Scholarly retrieval from OpenAlex, Semantic Scholar, and DataCite.
- Faculty directory powered by OpenAlex author metadata and optional Supabase persistence.
- Supabase migration for a public-read, server-write faculty database.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Gemini / Vertex AI
- OpenAlex, Semantic Scholar, DataCite
- Supabase
- Tailwind CSS 4

## Setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment

Use either a Gemini API key or Vertex AI service-account credentials. The current implementation supports service-account auth through:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account","project_id":"your-google-cloud-project"}
GOOGLE_CLOUD_PROJECT=your-google-cloud-project
GOOGLE_CLOUD_LOCATION=us-central1
```

Use `GOOGLE_APPLICATION_CREDENTIALS` for local development. Use
`GOOGLE_APPLICATION_CREDENTIALS_JSON` for Vercel or any hosted deployment where
a local credential file path is not available.

Model routing:

```env
GEMINI_REASONING_MODEL=gemini-3.1-pro-preview
GEMINI_REASONING_FALLBACK_MODEL=gemini-2.5-pro
GEMINI_SUMMARY_MODEL=gemini-2.5-flash
GEMINI_TRANSLATION_MODEL=gemini-2.5-flash
GEMINI_QUERY_MODEL=gemini-2.5-flash
```

Scholarly APIs:

```env
OPENALEX_EMAIL=your-email@example.com
SEMANTIC_SCHOLAR_API_KEY=optional
```

Supabase faculty directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Apply the migrations in `supabase/migrations/` in order:

- `001_faculty_directory.sql` creates `faculty_profiles`, `faculty_topic_scores`, `faculty_outreach_drafts`.
- `002_reports_and_shortlists.sql` creates `saved_reports` and `faculty_shortlist`.
- `003_owner_scoping.sql` adds an `owner_id` column to `saved_reports`/`faculty_shortlist` and removes public client-side read access to them. Reads/writes to these two tables go exclusively through the app's API routes (using the service-role key), scoped by an opaque per-browser id generated client-side (`lib/ownerToken.ts`) — this is a lightweight anti-leak measure, not a real accounts system.

If Supabase is not configured, the app still runs. Faculty discovery returns live matches for reports, but `/faculty` will show an empty unconfigured state.

## Pipeline

1. User chooses Student Mode or Faculty Mode and submits an idea or topic.
2. `/api/retrieve` expands queries and searches scholarly APIs.
3. Client ranks papers with TF-IDF and computes the 4D gap matrix.
4. `/api/faculty/search` discovers and enriches relevant OpenAlex authors, then persists them to Supabase if configured.
5. `/api/analyze` uses Gemini reasoning to generate student and faculty summaries, pivots, use cases, limitations, next actions, and supervisor note.
6. `/results` displays the report from session storage.
7. `/faculty` browses persisted faculty profiles.

## Product Bucket List

- Recursive Research Map: visualize the original idea and explored pivots as a branching topic tree.
- Novelty Score Evolution: compare overlap risk, evidence confidence, and gap signals across recursive pivots.
- Supervisor Fit Timeline: show how supervisor/researcher matches change as a topic is refined.
- Make It Thesis-Ready Mode: turn a promising pivot into a title, problem statement, research questions, objectives, method sketch, contribution, limitations, and supervisor email.
- Journal / Funding Fit Mode: deepen journal targeting, open-access verification, funder fit, grant framing, and collaborator discovery.
- Evidence Notebook: convert retrieved papers into structured notes covering topic, method, population, geography, limitations, and relevance to the idea.
- Red Team Review: critique a topic like a strict reviewer and suggest concrete repairs for scope, novelty, method, population, and feasibility.

## Verification

```bash
npm run build
```

The faculty directory requires Supabase env vars and the migration to be applied before it can persist data.
