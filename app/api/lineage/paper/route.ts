import { NextRequest, NextResponse } from 'next/server';
import { buildEvidenceLineageGraph } from '@/lib/evidenceLineage';
import { Paper } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      originPaper?: Paper;
      thesisIdea?: string;
      reportPapers?: Paper[];
      depth?: 'fast' | 'expanded';
      maxNodes?: number;
      includeNetworkEdges?: boolean;
    };

    if (!body.originPaper?.title) {
      return NextResponse.json(
        { error: 'originPaper with a title is required.' },
        { status: 400 }
      );
    }

    const graph = await buildEvidenceLineageGraph({
      originPaper: body.originPaper,
      thesisIdea: body.thesisIdea,
      reportPapers: Array.isArray(body.reportPapers)
        ? body.reportPapers.slice(0, 40)
        : [],
      depth: body.depth || 'fast',
      maxNodes: body.maxNodes,
      includeNetworkEdges: body.includeNetworkEdges,
    });

    return NextResponse.json(graph);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to build evidence lineage graph.',
      },
      { status: 500 }
    );
  }
}
