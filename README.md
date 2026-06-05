# ResearchLens 🔍

ResearchLens is an AI-powered research gap finder designed for undergraduate and graduate thesis students. It helps students explore, refine, and validate their research ideas by scanning real academic literature to identify overlap risk, construct a 4D gap matrix, and suggest evidence-backed research pivots.

ResearchLens is built as a Next.js 14 web application using TypeScript and Vanilla CSS. It connects to multiple academic databases, performs similarity ranking, and analyzes potential gaps.

---

## 🌟 Key Features

- **Multi-Source Parallel Retrieval**: Queries OpenAlex, Semantic Scholar, and DataCite in parallel to collect a comprehensive corpus of related papers.
- **Robust Deduplication**: Deduplicates retrieved papers by matching normalized DOIs and title Jaccard similarity.
- **TF-IDF & Cosine Similarity Ranking**: Computes term-frequency/inverse-document-frequency vectors client-side to rank papers by semantic relevance.
- **4D Gap Matrix Classifier**: Classifies papers across four dimensions (**Topic**, **Method**, **Population**, and **Geography**) and computes saturation level (Crowded, Moderate, or Open).
- **Bangla Language Support**: Auto-detects input language, translates Bangla research ideas to English using Claude, and displays a translation notice banner in the results.
- **Grounded LLM Analysis**: Calls Claude 3.5 Sonnet to perform a detailed overlap risk assessment, generate three distinct pivots across different gap dimensions, and write a supervisor-ready email draft.
- **Polite API Client Integration**: Connects politely to public APIs (includes contact details, batch sequence delays, and exponential backoff retry logic).
- **Interactive UI**: A sleek glassmorphism dashboard featuring color-coded badges, copy-to-clipboard functionality, and expandable details.
- **Demo Mode**: Works instantly without Anthropic API keys by serving realistic mock search results and analysis for testing.

---

## 🛠️ Tech Stack

- **Core**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Vanilla CSS (Premium glassmorphic dashboard, slate dark-theme aesthetics)
- **API Clients**: Axios (with custom retry and backoff logic), Cheerio (for HTML stripping)
- **AI/LLM**: Anthropic TypeScript SDK

---

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org) (v18+ recommended) installed.

### Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```
   Open `.env.local` and configure your API keys (optional):
   ```env
   ANTHROPIC_API_KEY=your_key_here
   SEMANTIC_SCHOLAR_API_KEY=optional
   OPENALEX_EMAIL=your-email@example.com
   ```
   *Note: If `ANTHROPIC_API_KEY` is left as `"your_key_here"` or blank, the app will run in **Demo Mode** using realistic pre-baked papers and analysis results for "Social media and exam anxiety in university students".*

3. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

4. **Verify the Production Build**:
   ```bash
   npm run build
   ```

---

## 📁 Project Structure

```text
researchlens/
├── app/                     # Next.js App Router
│   ├── api/                 # API Routes
│   │   ├── analyze/         # Calls Claude for gap analysis / pivot generation
│   │   └── retrieve/        # Queries OpenAlex, Semantic Scholar, DataCite
│   ├── results/             # Analysis report presentation page
│   ├── globals.css          # Core CSS, theme variables, glassmorphic styles
│   ├── layout.tsx           # Global layout, header, footer, SEO metadata
│   └── page.tsx             # Home / landing page and loading state coordinator
├── components/              # React Components
│   ├── ConfidenceBadge.tsx  # Overlap risk, evidence confidence, and novelty indicators
│   ├── GapMatrix.tsx        # Grid for Topic, Method, Population, Geography gaps
│   ├── LoadingSteps.tsx     # 7-step stagger loading animation during search
│   ├── PaperCard.tsx        # Display card for a cited academic paper
│   ├── PivotCard.tsx        # Detailed pivot recommendation card
│   ├── ResultsPanel.tsx     # Main wrapper dashboard compiling all results sections
│   └── SearchForm.tsx       # Textarea, field/level select, language switch, and examples
├── lib/                     # Library & Utility functions
│   ├── crossrefClient.ts    # Crossref API client for DOI lookup & verification
│   ├── dataciteClient.ts    # DataCite API client for thesis and dissertation records
│   ├── deduplicator.ts      # Normalizes DOIs and computes title Jaccard similarity
│   ├── embedder.ts          # TF-IDF cosine similarity paper ranker
│   ├── gapAnalyzer.ts       # 4D keyword-based gap matrix classifier
│   ├── mockData.ts          # Full mock papers and analysis for demo mode
│   ├── openalexClient.ts    # OpenAlex API client with abstract reconstruction
│   ├── queryExpansion.ts    # Query generator with synonyms and Bangla translation
│   ├── retry.ts             # Exponential backoff and jitter retry utility
│   ├── semanticScholarClient.ts # Semantic Scholar API client
│   └── types.ts             # TypeScript interfaces for request/response payloads
└── README.md                # Project documentation
```

---

## 🔬 How the Pipeline Works

1. **Query Expansion**: The user's input is cleaned, and keywords are extracted. Synonym-rich variants (5–8 unique queries) are created to maximize database coverage. If input is in Bangla, it is translated into English first.
2. **Parallel Fetching**: The queries are sent to OpenAlex, Semantic Scholar, and DataCite in parallel. API requests are throttled and wrapped in retry logic.
3. **Deduplication**: Papers are merged using DOIs and a title Jaccard similarity index to remove duplicate publications across databases.
4. **TF-IDF & Cosine Similarity**: A client-side term-frequency matrix ranks the deduplicated papers based on their closeness to the student's original idea.
5. **Matrix Classification**: The ranked corpus is scanned against dictionaries for Method, Population, Geography, and Topic to evaluate which segments are over-saturated (crowded) or under-researched (gaps).
6. **Claude Grounded Analysis**: The top-ranked papers, idea, and gap matrix are sent to Claude. The model evaluates overlap risk, drafts exactly three concrete, different-dimensional pivots, and formats a supervisor note citing real DOIs.
7. **Interactive Dashboard**: The frontend parses the output into a cohesive, interactive workspace.
