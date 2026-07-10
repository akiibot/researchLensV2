/**
 * Shared Gemini client.
 *
 * Supports GOOGLE_API_KEY for the Gemini API and
 * GOOGLE_APPLICATION_CREDENTIALS for local Vertex AI service-account auth,
 * or GOOGLE_APPLICATION_CREDENTIALS_JSON / GOOGLE_SERVICE_ACCOUNT_JSON in
 * hosted environments where credential files are not available.
 */

import { createSign } from 'crypto';
import { readFileSync } from 'fs';

interface GenerateTextOptions {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  purpose?: GeminiPurpose;
}

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

export type GeminiPurpose =
  | 'reasoning'
  | 'summary'
  | 'translation'
  | 'queryExpansion';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_REASONING_MODEL = 'gemini-2.5-pro';
// Deliberately a different (lighter) model than the primary reasoning model:
// if gemini-2.5-pro is erroring/rate-limited, retrying the identical model
// wastes the retry window instead of degrading to something that's likely
// still healthy.
const DEFAULT_REASONING_FALLBACK_MODEL = 'gemini-2.5-flash';
const DEFAULT_SUMMARY_MODEL = 'gemini-2.5-flash';
const DEFAULT_LOCATION = 'us-central1';

function resolveModel(
  model: string | undefined,
  purpose: GeminiPurpose | undefined,
  fallback = false
): string {
  if (model) return model;

  if (purpose === 'reasoning') {
    return fallback
      ? process.env.GEMINI_REASONING_FALLBACK_MODEL ||
          DEFAULT_REASONING_FALLBACK_MODEL
      : process.env.GEMINI_REASONING_MODEL || DEFAULT_REASONING_MODEL;
  }

  if (purpose === 'summary') {
    return process.env.GEMINI_SUMMARY_MODEL || DEFAULT_SUMMARY_MODEL;
  }

  if (purpose === 'translation') {
    return process.env.GEMINI_TRANSLATION_MODEL || DEFAULT_SUMMARY_MODEL;
  }

  if (purpose === 'queryExpansion') {
    return process.env.GEMINI_QUERY_MODEL || DEFAULT_SUMMARY_MODEL;
  }

  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

function base64Url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function loadServiceAccount(): ServiceAccountCredentials | null {
  const credentialsJson =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (credentialsJson) {
    const parsed = JSON.parse(credentialsJson) as Partial<ServiceAccountCredentials>;

    if (
      !parsed.client_email ||
      !parsed.private_key ||
      !parsed.project_id ||
      !parsed.token_uri
    ) {
      throw new Error('Google service account credentials are incomplete');
    }

    return parsed as ServiceAccountCredentials;
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) return null;

  const raw = readFileSync(credentialsPath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<ServiceAccountCredentials>;

  if (
    !parsed.client_email ||
    !parsed.private_key ||
    !parsed.project_id ||
    !parsed.token_uri
  ) {
    throw new Error('Google service account credentials are incomplete');
  }

  return parsed as ServiceAccountCredentials;
}

interface CachedVertexToken {
  token: string;
  clientEmail: string;
  expiresAtMs: number;
}

let cachedVertexToken: CachedVertexToken | null = null;
// Refresh a bit before the token's real 1-hour expiry to avoid using a token
// that expires mid-request.
const VERTEX_TOKEN_REFRESH_BUFFER_MS = 60_000;

async function getVertexAccessToken(
  credentials: ServiceAccountCredentials
): Promise<string> {
  if (
    cachedVertexToken &&
    cachedVertexToken.clientEmail === credentials.client_email &&
    cachedVertexToken.expiresAtMs > Date.now()
  ) {
    return cachedVertexToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: credentials.token_uri,
      exp: now + 3600,
      iat: now,
    })
  );

  const unsignedJwt = `${header}.${claim}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer
    .sign(credentials.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const tokenResponse = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsignedJwt}.${signature}`,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Vertex token request failed: ${tokenResponse.status}`);
  }

  const tokenJson = (await tokenResponse.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!tokenJson.access_token) {
    throw new Error('Vertex token response did not include an access token');
  }

  const expiresInMs = (tokenJson.expires_in ?? 3600) * 1000;
  cachedVertexToken = {
    token: tokenJson.access_token,
    clientEmail: credentials.client_email,
    expiresAtMs: Date.now() + expiresInMs - VERTEX_TOKEN_REFRESH_BUFFER_MS,
  };

  return tokenJson.access_token;
}

async function generateWithVertex({
  prompt,
  systemInstruction,
  model,
  purpose,
}: GenerateTextOptions): Promise<string> {
  const credentials = loadServiceAccount();
  if (!credentials) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not configured');
  }

  const accessToken = await getVertexAccessToken(credentials);
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || credentials.project_id;
  const location = process.env.GOOGLE_CLOUD_LOCATION || DEFAULT_LOCATION;
  const modelName = resolveModel(model, purpose);
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelName}:generateContent`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...(systemInstruction
        ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
        : {}),
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Vertex Gemini request failed: ${response.status} ${errorText.slice(0, 300)}`
    );
  }

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return (
    json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('') || ''
  );
}

async function generateWithApiKey({
  prompt,
  systemInstruction,
  model,
  purpose,
}: GenerateTextOptions): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('GOOGLE_API_KEY is not configured');
  }

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model: resolveModel(model, purpose),
    ...(systemInstruction ? { systemInstruction } : {}),
  });

  const response = await geminiModel.generateContent(prompt);
  return response.response.text();
}

export function hasGeminiCredentials(): boolean {
  const apiKey = process.env.GOOGLE_API_KEY;
  return Boolean(
    (apiKey && apiKey !== 'your_key_here') ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

export async function generateGeminiText(
  options: GenerateTextOptions
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  try {
    if (apiKey && apiKey !== 'your_key_here') {
      return await generateWithApiKey(options);
    }

    return await generateWithVertex(options);
  } catch (error) {
    if (options.model || options.purpose !== 'reasoning') {
      throw error;
    }

    console.warn(
      '[gemini] Reasoning model failed; retrying with fallback model',
      error
    );
    const fallbackOptions = {
      ...options,
      model: resolveModel(undefined, 'reasoning', true),
    };

    if (apiKey && apiKey !== 'your_key_here') {
      return generateWithApiKey(fallbackOptions);
    }

    return generateWithVertex(fallbackOptions);
  }
}
