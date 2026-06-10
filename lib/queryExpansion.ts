/**
 * @file Query Expansion Module
 *
 * Accepts a research idea text and field, then generates 5–8 search queries
 * using a hardcoded synonym map, simple NLP extraction, and optionally
 * Claude API for additional synonym queries.
 *
 * @module queryExpansion
 */

import { ResearchIdea } from './types';
import { generateGeminiText, hasGeminiCredentials } from './geminiClient';

/** Common English stopwords to filter out during keyword extraction */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
  'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
  'she', 'her', 'they', 'them', 'their', 'what', 'which', 'who',
  'when', 'where', 'why', 'how', 'not', 'no', 'nor', 'as', 'if',
  'then', 'than', 'too', 'very', 'just', 'about', 'above', 'after',
  'again', 'all', 'also', 'am', 'any', 'because', 'before', 'between',
  'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'into', 'over', 'own', 'same', 'so', 'up', 'out', 'only', 'during',
  'further', 'here', 'there', 'once', 'through', 'under', 'until',
  'while', 'against', 'among', 'across', 'within', 'without',
  'using', 'based', 'study', 'research', 'impact', 'effect', 'effects',
  'role', 'analysis', 'among', 'use', 'examine', 'explore', 'investigate',
]);

/**
 * Synonym map organized by common academic terms.
 * Each key maps to an array of synonymous or closely-related phrases
 * used to generate variant search queries.
 */
const SYNONYM_MAP: Record<string, string[]> = {
  // Social media platforms
  'social media': ['social networking site', 'Facebook', 'Instagram', 'TikTok', 'Twitter', 'online social network'],
  'social network': ['social media', 'social networking site', 'online community'],
  'facebook': ['social media', 'social networking site', 'Meta platform'],
  'tiktok': ['short-form video', 'social media', 'video sharing platform'],
  'instagram': ['social media', 'photo sharing', 'social networking'],

  // Mental health
  'anxiety': ['stress', 'mental health', 'psychological well-being', 'psychological distress'],
  'stress': ['anxiety', 'burnout', 'mental health', 'psychological strain'],
  'depression': ['mental health', 'depressive symptoms', 'psychological distress'],
  'mental health': ['psychological well-being', 'emotional health', 'psychiatric'],
  'well-being': ['wellbeing', 'quality of life', 'life satisfaction'],

  // Education
  'exam': ['test', 'assessment', 'examination', 'academic evaluation'],
  'student': ['learner', 'undergraduate', 'pupil', 'scholar'],
  'university': ['higher education', 'college', 'tertiary education', 'academic institution'],
  'academic performance': ['GPA', 'grades', 'scholastic achievement', 'learning outcomes'],
  'learning': ['education', 'knowledge acquisition', 'pedagogy', 'instruction'],
  'e-learning': ['online learning', 'distance education', 'digital learning', 'remote education'],
  'classroom': ['learning environment', 'educational setting', 'school'],

  // Work & productivity
  'remote work': ['work from home', 'telecommuting', 'telework', 'hybrid work'],
  'productivity': ['work performance', 'efficiency', 'output', 'work effectiveness'],
  'employee': ['worker', 'staff', 'workforce', 'personnel'],
  'job satisfaction': ['work satisfaction', 'career satisfaction', 'occupational well-being'],

  // Technology
  'machine learning': ['artificial intelligence', 'deep learning', 'neural network', 'predictive modeling'],
  'artificial intelligence': ['AI', 'machine learning', 'computational intelligence'],
  'deep learning': ['neural network', 'convolutional neural network', 'transformer model'],
  'smartphone': ['mobile phone', 'cell phone', 'mobile device', 'handheld device'],

  // Healthcare
  'disease detection': ['diagnosis', 'disease screening', 'early diagnosis', 'medical imaging'],
  'healthcare': ['health care', 'medical', 'clinical', 'health services'],
  'patient': ['individual', 'subject', 'participant', 'client'],

  // Methods
  'survey': ['questionnaire', 'cross-sectional study', 'self-report measure'],
  'interview': ['semi-structured interview', 'qualitative inquiry', 'in-depth interview'],
  'experiment': ['randomized controlled trial', 'experimental design', 'laboratory study'],
  'longitudinal': ['panel study', 'cohort study', 'follow-up study', 'prospective study'],

  // Business
  'organization': ['company', 'firm', 'enterprise', 'corporation'],
  'management': ['leadership', 'administration', 'governance'],
  'innovation': ['technological innovation', 'R&D', 'new product development'],
  'entrepreneurship': ['startup', 'new venture', 'business creation'],
};

/**
 * Detects whether the input text is primarily in Bangla (Bengali).
 * Uses a simple heuristic: if >20% of characters fall in the Unicode
 * Bengali range (U+0980–U+09FF), the text is classified as Bangla.
 *
 * @param text - The input text to classify
 * @returns true if the text is predominantly Bangla
 */
export function isBangla(text: string): boolean {
  if (!text || text.length === 0) return false;
  const banglaChars = text.split('').filter(
    (ch) => ch.charCodeAt(0) >= 0x0980 && ch.charCodeAt(0) <= 0x09ff
  ).length;
  return banglaChars / text.length > 0.2;
}

/**
 * Translates Bangla text to English using the Gemini API.
 * Returns the original text unchanged if GOOGLE_API_KEY is not set.
 *
 * @param text - Bangla text to translate
 * @returns English translation of the input
 */
export async function translateBangla(text: string): Promise<string> {
  if (!hasGeminiCredentials()) {
    return text;
  }

  try {
    const translatedText = await generateGeminiText({
      prompt: `Translate this academic research idea from Bangla to English. Return only the translation, nothing else:\n\n"${text}"`,
      purpose: 'translation',
    });
    
    const cleanTranslation = translatedText.trim().replace(/^"|"$/g, '');
    if (cleanTranslation) {
      console.log(`[translateBangla] Translated: "${text}" -> "${cleanTranslation}"`);
      return cleanTranslation;
    }
    return text;
  } catch (error) {
    console.warn('Bangla translation failed, using original text:', error);
    return text;
  }
}

/**
 * Extracts meaningful keywords from a research idea text.
 * Removes stopwords, punctuation, and single-character tokens.
 *
 * @param text - Raw research idea text
 * @returns Array of cleaned keyword strings
 */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

/**
 * Finds matching synonyms for keywords present in the idea text.
 * Checks both single-word and multi-word phrase matches.
 *
 * @param text - The research idea text (lowercased)
 * @param keywords - Extracted keywords from the idea
 * @returns Array of synonym phrases found
 */
function findSynonyms(text: string, keywords: string[]): string[] {
  const lowerText = text.toLowerCase();
  const synonymResults: string[] = [];

  // Check multi-word phrase matches first
  for (const [phrase, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (lowerText.includes(phrase)) {
      synonymResults.push(...synonyms.slice(0, 2));
    }
  }

  // Check single-word keyword matches
  for (const keyword of keywords) {
    if (SYNONYM_MAP[keyword]) {
      synonymResults.push(...SYNONYM_MAP[keyword].slice(0, 1));
    }
  }

  // Deduplicate
  return [...new Set(synonymResults)];
}

/**
 * Attempts to generate additional synonym queries using Gemini API.
 * Falls back gracefully if the API key is not set or the call fails.
 *
 * @param ideaText - The student's research idea
 * @param field - Academic field
 * @returns Array of 0–3 additional query strings
 */
async function getLLMQueries(
  ideaText: string,
  field: string
): Promise<string[]> {
  if (!hasGeminiCredentials()) {
    return [];
  }

  try {
    const text = await generateGeminiText({
      prompt: `Generate exactly 3 academic search queries for finding related papers on this research idea in the field of ${field}. Each query should use different synonyms or related terms. Return ONLY the 3 queries, one per line, no numbering or bullets.\n\nResearch idea: "${ideaText}"`,
      purpose: 'queryExpansion',
    });
    
    return text
      .split('\n')
      .map((q) => q.trim())
      .filter((q) => q.length > 5)
      .slice(0, 3);
  } catch (error) {
    console.warn('LLM query expansion failed, continuing without:', error);
    return [];
  }
}

/**
 * Expands a research idea into 5–8 search queries for academic API retrieval.
 *
 * Strategy:
 * 1. Use the original idea text (cleaned) as query 1
 * 2. Extract keywords and find synonyms to create variant queries
 * 3. Create field-specific variant
 * 4. Optionally call Claude API for 3 extra synonym queries
 * 5. Deduplicate and return 5–8 unique queries
 *
 * @param idea - The student's research idea
 * @returns Array of 5–8 search query strings
 */
export async function expandQueries(idea: ResearchIdea): Promise<string[]> {
  const queries: string[] = [];
  let workingText = idea.text.trim();

  // Handle Bangla input
  if (isBangla(workingText)) {
    workingText = await translateBangla(workingText);
  }

  // Query 1: Original idea text (cleaned)
  const cleanedIdea = workingText.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  queries.push(cleanedIdea);

  // Extract keywords for synonym matching
  const keywords = extractKeywords(workingText);
  const synonyms = findSynonyms(workingText, keywords);

  // Queries 2–4: Synonym-substituted variants
  if (synonyms.length > 0) {
    // Create a variant by replacing the first matching phrase with its synonym
    const lowerText = cleanedIdea.toLowerCase();
    for (const [phrase, syns] of Object.entries(SYNONYM_MAP)) {
      if (lowerText.includes(phrase) && syns.length > 0) {
        const variant = lowerText.replace(phrase, syns[0]);
        queries.push(variant);
        if (syns.length > 1) {
          queries.push(lowerText.replace(phrase, syns[1]));
        }
        break;
      }
    }
  }

  // Create a keywords-only query (top 4 keywords)
  if (keywords.length >= 3) {
    queries.push(keywords.slice(0, 4).join(' '));
  }

  // Query: field-specific variant
  if (idea.field && idea.field !== 'Other') {
    queries.push(`${idea.field} ${keywords.slice(0, 3).join(' ')}`);
  }

  // Additional keyword permutations
  if (keywords.length >= 4) {
    queries.push(`${keywords[0]} ${keywords[2]} ${keywords[3]}`);
  }
  if (keywords.length >= 2) {
    queries.push(`${keywords[0]} ${keywords[keywords.length - 1]} outcomes`);
  }

  // Optional: LLM-generated queries (3 extra)
  const llmQueries = await getLLMQueries(workingText, idea.field);
  queries.push(...llmQueries);

  // Deduplicate by exact match (case-insensitive)
  const seen = new Set<string>();
  const unique = queries.filter((q) => {
    const key = q.toLowerCase().trim();
    if (seen.has(key) || key.length < 5) return false;
    seen.add(key);
    return true;
  });

  // Ensure we return 5–8 queries
  return unique.slice(0, 8);
}
