import { NextRequest, NextResponse } from 'next/server';
import {
  buildCopilotSystemPrompt,
  buildCopilotUserPrompt,
  buildLimitedCopilotFallback,
  CopilotChatRequest,
  isValidCopilotRequest,
} from '@/lib/copilot';
import { generateGeminiText, hasGeminiCredentials } from '@/lib/geminiClient';
import { enforceRateLimit, readJsonWithLimit } from '@/lib/apiGuards';

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, 'copilot-chat', 20, 60_000);
    if (limited) return limited;

    let body: Partial<CopilotChatRequest>;
    try {
      body = await readJsonWithLimit<Partial<CopilotChatRequest>>(request, 1024 * 1024);
    } catch {
      return NextResponse.json(
        { error: 'Request body is too large', code: 'BODY_TOO_LARGE' },
        { status: 413 }
      );
    }

    if (!body.message || !body.message.trim()) {
      return NextResponse.json(
        { error: 'Message is required', code: 'MISSING_MESSAGE' },
        { status: 400 }
      );
    }

    if (!isValidCopilotRequest(body)) {
      return NextResponse.json(
        { error: 'Copilot context is incomplete', code: 'INVALID_CONTEXT' },
        { status: 400 }
      );
    }

    const fallbackAnswer = buildLimitedCopilotFallback(body);

    if (!hasGeminiCredentials()) {
      return NextResponse.json({
        answer: fallbackAnswer,
        mode: 'fallback',
        warning: 'AI credentials are not configured; returned limited fallback.',
      });
    }

    try {
      const answer = await generateGeminiText({
        purpose: 'summary',
        systemInstruction: buildCopilotSystemPrompt(),
        prompt: buildCopilotUserPrompt(body),
      });

      return NextResponse.json({
        answer: answer.trim() || fallbackAnswer,
        mode: answer.trim() ? 'ai' : 'fallback',
      });
    } catch (error) {
      console.warn('[copilot/chat] Gemini failed; using fallback:', error);
      return NextResponse.json({
        answer: fallbackAnswer,
        mode: 'fallback',
        warning: 'AI answer failed; returned limited fallback.',
      });
    }
  } catch (error) {
    console.error('[copilot/chat] failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Copilot chat failed',
        code: 'COPILOT_CHAT_ERROR',
      },
      { status: 500 }
    );
  }
}
