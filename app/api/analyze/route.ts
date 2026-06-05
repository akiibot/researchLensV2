/**
 * @file LLM Gap Analysis API Route
 *
 * POST /api/analyze
 *
 * Accepts a ResearchIdea, retrieved papers, and pre-computed gap matrix,
 * then calls Claude (claude-sonnet-4-20250514) to generate:
 *   - Overlap risk assessment
 *   - Evidence confidence level
 *   - Novelty signal
 *   - Overlap explanation citing real papers
 *   - Three evidence-backed research pivots
 *   - Supervisor-ready note
 *
 * The LLM only reasons over real retrieved papers — it never invents papers.
 * All API calls happen server-side.
 *
 * @module api/analyze
 */

import { NextRequest, NextResponse } from 'next/server';
import { AnalyzeRequest, AnalysisResult, ApiError, Paper, GapDimension } from '@/lib/types';
import { MOCK_ANALYSIS_RESULT } from '@/lib/mockData';

/**
 * Builds the system prompt for Claude that constrains it to reason
 * only about real retrieved papers.
 *
 * @returns System prompt string
 */
function buildSystemPrompt(): string {
  return `You are ResearchLens, an AI research coach for graduate students.
You ONLY reason about papers that are explicitly provided to you below.
You NEVER invent paper titles, authors, or citations.
You write in a coach voice: problem + rescue, never just criticism.
You return output as a valid JSON object matching the schema provided.
Do not wrap the JSON in markdown code fences or add any text before/after it.`;
}

/**
 * Builds the user prompt with the student's idea, papers, and gap matrix.
 * Formats papers as a numbered list with title, year, abstract snippet, and DOI.
 *
 * @param ideaText - Student's research idea
 * @param field - Academic field
 * @param level - Academic level
 * @param papers - Top papers (max 20) to include as context
 * @param gapMatrix - Pre-computed gap matrix
 * @returns Formatted user prompt string
 */
function buildUserPrompt(
  ideaText: string,
  field: string,
  level: string,
  papers: Paper[],
  gapMatrix: GapDimension[]
): string {
  const paperList = papers
    .slice(0, 20)
    .map(
      (p, i) =>
        `${i + 1}. "${p.title}" (${p.year}) — ${(p.abstract || '').slice(0, 200)}... DOI: ${p.doi || 'N/A'}`
    )
    .join('\n');

  return `## Student Research Idea
${ideaText}

## Field
${field}

## Academic Level
${level}

## Retrieved Papers (real, from academic APIs — do not invent any others)
${paperList}

## Pre-computed Gap Matrix
${JSON.stringify(gapMatrix, null, 2)}

## Task
Analyze the research idea against the retrieved corpus above. Return a JSON object with exactly these fields:
{
  "overlapRisk": "high" or "medium" or "low",
  "evidenceConfidence": "high" or "medium" or "low",
  "noveltySignal": "strong" or "moderate" or "weak",
  "overlapExplanation": "2-3 sentences explaining overlap with specific paper titles from above",
  "pivots": [
    {
      "title": "Short pivot title",
      "description": "Specific, concrete reformulated research direction",
      "rationale": "Why this fills a gap — cite specific papers from above",
      "targetGap": "topic" or "method" or "population" or "geography"
    }
  ],
  "supervisorNote": "3-4 sentence formal academic paragraph citing real papers above, ready to email to advisor"
}

Rules:
- Return exactly 3 pivots
- All 3 pivots must target different gap dimensions from: topic, method, population, geography
- Pivots must be specific (name a country, method, population, or mechanism — not just 'study a different group')
- supervisorNote must cite at least 2 real paper titles from the list above
- overlapExplanation must reference specific paper titles from the list
- Return ONLY the JSON object, no markdown fences, no preamble, no commentary`;
}

/**
 * Parses the LLM's JSON response, stripping any markdown fences or extra text.
 *
 * @param text - Raw response text from the LLM
 * @returns Parsed JSON object or null if parsing fails
 */
function parseLLMResponse(text: string): Record<string, unknown> | null {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {
    // Strip markdown code fences if present
    const cleaned = text
      .replace(/^```json?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      // Try to extract JSON object from text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          console.error('Failed to parse LLM response as JSON');
          return null;
        }
      }
      return null;
    }
  }
}

/**
 * Creates a fallback AnalysisResult when Claude is unavailable.
 * Uses only the pre-computed gap matrix and top papers.
 *
 * @param papers - Retrieved papers (already ranked)
 * @param gapMatrix - Pre-computed gap matrix
 * @returns Minimal AnalysisResult without LLM insights
 */
function createFallbackResult(
  papers: Paper[],
  gapMatrix: GapDimension[]
): AnalysisResult {
  // Determine overlap risk from gap matrix
  const crowdedCount = gapMatrix.filter((g) => g.saturation === 'crowded').length;
  const overlapRisk =
    crowdedCount >= 3 ? 'high' : crowdedCount >= 2 ? 'medium' : 'low';

  return {
    overlapRisk,
    evidenceConfidence: papers.length >= 30 ? 'high' : papers.length >= 15 ? 'medium' : 'low',
    noveltySignal: crowdedCount >= 3 ? 'weak' : crowdedCount >= 2 ? 'moderate' : 'strong',
    overlapExplanation:
      'AI-powered analysis is currently unavailable. The gap matrix above was computed from keyword analysis of the retrieved papers. Please review the gap matrix and top related papers for manual assessment.',
    topRelatedPapers: papers.slice(0, 3),
    gapMatrix,
    pivots: [],
    supervisorNote:
      'AI-generated supervisor note is unavailable at this time. Please review the gap matrix and retrieved papers to assess overlap risk and identify potential research gaps.',
    totalPapersRetrieved: papers.length,
    sourceCounts: {},
  };
}

/**
 * Handles POST requests for LLM-powered gap analysis.
 *
 * @param request - Next.js request containing { idea, papers, gapMatrix }
 * @returns JSON response with complete AnalysisResult
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<AnalysisResult | ApiError>> {
  try {
    const body: AnalyzeRequest = await request.json();
    const { idea, papers, gapMatrix } = body;

    // Validate input
    if (!idea?.text || !papers?.length) {
      return NextResponse.json(
        { error: 'Research idea and papers are required', code: 'MISSING_INPUT' },
        { status: 400 }
      );
    }

    // Check for API key
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey || apiKey === 'your_key_here' || apiKey === '') {
      console.warn('[analyze] No GOOGLE_API_KEY set — returning mock analysis result');
      return NextResponse.json(MOCK_ANALYSIS_RESULT);
    }

    console.log(`[analyze] Starting Gemini analysis with ${papers.length} papers`);

    try {
      // Dynamically import Google SDK (server-side only)
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);

      // Build prompts
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(
        idea.text,
        idea.field,
        idea.level,
        papers,
        gapMatrix
      );

      // Call Gemini
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
      });

      const response = await model.generateContent(userPrompt);
      const responseText = response.response.text();

      if (!responseText) {
        console.error('[analyze] Empty response from Gemini');
        const fallback = createFallbackResult(papers, gapMatrix);
        return NextResponse.json({
          ...fallback,
          totalPapersRetrieved: papers.length,
          sourceCounts: {},
        });
      }

      // Parse JSON response
      const parsed = parseLLMResponse(responseText);
      if (!parsed) {
        console.error('[analyze] Failed to parse Gemini response:', responseText.slice(0, 200));
        const fallback = createFallbackResult(papers, gapMatrix);
        return NextResponse.json({
          ...fallback,
          totalPapersRetrieved: papers.length,
          sourceCounts: {},
        });
      }

      // Validate and construct result
      const pivots = Array.isArray(parsed.pivots)
        ? parsed.pivots.slice(0, 3).map((p: Record<string, unknown>) => ({
            title: String(p.title || 'Untitled Pivot'),
            description: String(p.description || ''),
            rationale: String(p.rationale || ''),
            targetGap: (['topic', 'method', 'population', 'geography'].includes(
              String(p.targetGap)
            )
              ? String(p.targetGap)
              : 'topic') as 'topic' | 'method' | 'population' | 'geography',
          }))
        : [];

      const result: AnalysisResult = {
        overlapRisk: (['high', 'medium', 'low'].includes(String(parsed.overlapRisk))
          ? String(parsed.overlapRisk)
          : 'medium') as 'high' | 'medium' | 'low',
        evidenceConfidence: (['high', 'medium', 'low'].includes(
          String(parsed.evidenceConfidence)
        )
          ? String(parsed.evidenceConfidence)
          : 'medium') as 'high' | 'medium' | 'low',
        noveltySignal: (['strong', 'moderate', 'weak'].includes(
          String(parsed.noveltySignal)
        )
          ? String(parsed.noveltySignal)
          : 'moderate') as 'strong' | 'moderate' | 'weak',
        overlapExplanation: String(
          parsed.overlapExplanation || 'Analysis completed but explanation unavailable.'
        ),
        topRelatedPapers: papers.slice(0, 3),
        gapMatrix,
        pivots,
        supervisorNote: String(
          parsed.supervisorNote || 'Supervisor note generation failed.'
        ),
        totalPapersRetrieved: papers.length,
        sourceCounts: {},
      };

      console.log(`[analyze] Analysis complete: overlapRisk=${result.overlapRisk}, pivots=${result.pivots.length}`);
      return NextResponse.json(result);
    } catch (llmError) {
      console.error('[analyze] Gemini API call failed:', llmError);
      const fallback = createFallbackResult(papers, gapMatrix);
      return NextResponse.json({
        ...fallback,
        totalPapersRetrieved: papers.length,
        sourceCounts: {},
      });
    }
  } catch (error) {
    console.error('[analyze] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze research gap', code: 'ANALYSIS_ERROR' },
      { status: 500 }
    );
  }
}
