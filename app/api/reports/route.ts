import { NextRequest, NextResponse } from 'next/server';
import { AnalysisResult, ApiError, ResearchIdea, SavedReport } from '@/lib/types';
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabaseServer';
import { readOwnerIdFromRequest } from '@/lib/ownerToken';
import { enforceRateLimit, readJsonWithLimit } from '@/lib/apiGuards';

interface SaveReportResponse {
  id: string | null;
  configured: boolean;
}

function mapReport(row: Record<string, unknown>): SavedReport {
  return {
    id: String(row.id),
    idea: row.idea as ResearchIdea,
    result: row.result as AnalysisResult,
    queries: Array.isArray(row.queries) ? row.queries.map(String) : [],
    createdAt: String(row.created_at),
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<SaveReportResponse | ApiError>> {
  try {
    const limited = enforceRateLimit(request, 'reports-save', 20, 60_000);
    if (limited) return limited;

    let body: { idea?: ResearchIdea; result?: AnalysisResult; queries?: unknown };
    try {
      body = await readJsonWithLimit(request, 3 * 1024 * 1024);
    } catch {
      return NextResponse.json(
        { error: 'Request body is too large', code: 'BODY_TOO_LARGE' },
        { status: 413 }
      );
    }
    const idea = body.idea;
    const result = body.result;
    const queries = Array.isArray(body.queries) ? body.queries : [];
    const ownerId = readOwnerIdFromRequest(request);

    if (!idea?.text || !result) {
      return NextResponse.json(
        { error: 'Idea and result are required', code: 'MISSING_REPORT_INPUT' },
        { status: 400 }
      );
    }

    if (!ownerId) {
      return NextResponse.json(
        { error: 'Missing owner identity', code: 'MISSING_OWNER_ID' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ id: null, configured: false });
    }

    const { data, error } = await supabase
      .from('saved_reports')
      .insert({ idea, result, queries, owner_id: ownerId })
      .select('id')
      .single();

    if (error) {
      console.error('[reports] Supabase save failed:', error.message);
      return NextResponse.json(
        { error: 'Failed to save report', code: 'REPORT_SAVE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data.id, configured: true });
  } catch (error) {
    console.error('[reports] Save failed:', error);
    return NextResponse.json(
      { error: 'Failed to save report', code: 'REPORT_SAVE_ERROR' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<{ reports: SavedReport[]; configured: boolean } | ApiError>> {
  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json({ reports: [], configured: false });
    }

    const ownerId = readOwnerIdFromRequest(request);
    if (!ownerId) {
      return NextResponse.json({ reports: [], configured: true });
    }

    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ reports: [], configured: false });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    let query = supabase
      .from('saved_reports')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(40);

    if (mode === 'student' || mode === 'faculty') {
      query = query.eq('mode', mode);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[reports] Supabase list failed:', error.message);
      return NextResponse.json(
        { error: 'Failed to load reports', code: 'REPORT_LIST_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reports: (data || []).map((row) => mapReport(row)),
      configured: true,
    });
  } catch (error) {
    console.error('[reports] List failed:', error);
    return NextResponse.json(
      { error: 'Failed to load reports', code: 'REPORT_LIST_ERROR' },
      { status: 500 }
    );
  }
}
