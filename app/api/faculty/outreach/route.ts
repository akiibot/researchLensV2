import { NextRequest, NextResponse } from 'next/server';
import { ApiError, FacultyProfile, ResearchIdea } from '@/lib/types';
import { generateGeminiText, hasGeminiCredentials } from '@/lib/geminiClient';
import { buildOutreachPrompt } from '@/lib/facultyOutreach';
import { enforceRateLimit, readJsonWithLimit } from '@/lib/apiGuards';

interface OutreachRequestBody {
  topic?: string;
  field?: string;
  level?: ResearchIdea['level'];
  faculty?: FacultyProfile;
}

/**
 * Generates a single outreach draft on demand for a faculty profile browsed
 * directly from the directory (i.e. outside of a freshly-run analysis,
 * which is the only place outreach drafts were previously available).
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<{ outreachDraft: string } | ApiError>> {
  try {
    const limited = enforceRateLimit(request, 'faculty-outreach', 15, 60_000);
    if (limited) return limited;

    if (!hasGeminiCredentials()) {
      return NextResponse.json(
        { error: 'AI outreach drafting is not configured for this deployment', code: 'GEMINI_UNAVAILABLE' },
        { status: 503 }
      );
    }

    let body: OutreachRequestBody;
    try {
      body = await readJsonWithLimit(request, 32 * 1024);
    } catch {
      return NextResponse.json(
        { error: 'Request body is too large', code: 'BODY_TOO_LARGE' },
        { status: 413 }
      );
    }

    const topic = body.topic?.trim();
    const faculty = body.faculty;

    if (!topic || topic.length < 10) {
      return NextResponse.json(
        { error: 'A short research topic (at least 10 characters) is required', code: 'MISSING_TOPIC' },
        { status: 400 }
      );
    }

    if (!faculty?.name) {
      return NextResponse.json(
        { error: 'Faculty profile is required', code: 'MISSING_FACULTY' },
        { status: 400 }
      );
    }

    const idea: ResearchIdea = {
      text: topic,
      field: body.field || 'General',
      level: body.level || 'undergraduate',
      language: 'en',
      mode: 'student',
    };

    const outreachDraft = await generateGeminiText({
      prompt: buildOutreachPrompt(idea, faculty),
      purpose: 'summary',
    });

    return NextResponse.json({ outreachDraft: outreachDraft.trim() });
  } catch (error) {
    console.error('[faculty/outreach] failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate outreach draft', code: 'OUTREACH_ERROR' },
      { status: 500 }
    );
  }
}
