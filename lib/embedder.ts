/**
 * @file TF-IDF Cosine Similarity Embedder
 *
 * Implements lightweight semantic similarity ranking using TF-IDF vectors
 * and cosine similarity. No external embedding API required.
 *
 * Process:
 * 1. Tokenize all paper abstracts + the student's idea
 * 2. Build a TF-IDF vocabulary from the corpus
 * 3. Compute cosine similarity between the idea vector and each paper vector
 * 4. Assign similarityScore (0–1) to each paper
 * 5. Return papers sorted descending by score
 *
 * @module embedder
 */

import { Paper } from './types';

/** Common English stopwords to exclude from TF-IDF vectors */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
  'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
  'they', 'them', 'their', 'what', 'which', 'who', 'when', 'where',
  'why', 'how', 'not', 'no', 'as', 'if', 'than', 'too', 'very',
  'just', 'about', 'also', 'so', 'up', 'out', 'only', 'more',
  'most', 'other', 'some', 'such', 'into', 'over', 'own', 'same',
  'through', 'under', 'until', 'while', 'all', 'each', 'both',
  'few', 'any', 'between', 'after', 'before', 'during', 'without',
  'within', 'among', 'then', 'there', 'here', 'again', 'further',
  'once', 'nor', 'yet', 'still', 'already', 'however', 'although',
  'though', 'whether', 'either', 'neither', 'much', 'many', 'such',
  'well', 'even', 'really', 'often', 'never', 'always', 'sometimes',
  'used', 'using', 'based', 'use', 'et', 'al', 'study', 'paper',
  'results', 'research', 'found', 'showed', 'data', 'method',
  'approach', 'proposed', 'conclusion', 'abstract', 'article',
]);

/**
 * Tokenizes text into lowercase word tokens.
 * Removes punctuation, stopwords, and single-character tokens.
 * Applies basic stemming by removing common suffixes.
 *
 * @param text - Input text to tokenize
 * @returns Array of cleaned word tokens
 */
export function tokenize(text: string): string[] {
  if (!text) return [];

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\d+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
    .map((word) => {
      // Basic suffix stripping for more effective matching
      if (word.endsWith('tion')) return word;
      if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
      if (word.endsWith('ness') && word.length > 6) return word.slice(0, -4);
      if (word.endsWith('ment') && word.length > 6) return word.slice(0, -4);
      if (word.endsWith('ous') && word.length > 5) return word.slice(0, -3);
      if (word.endsWith('ive') && word.length > 5) return word.slice(0, -3);
      if (word.endsWith('ity') && word.length > 5) return word.slice(0, -3);
      if (word.endsWith('ly') && word.length > 4) return word.slice(0, -2);
      if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
      if (word.endsWith('er') && word.length > 4) return word.slice(0, -2);
      if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
      if (word.endsWith('s') && word.length > 4) return word.slice(0, -1);
      return word;
    });
}

/**
 * Computes term frequency for a document.
 * Returns a map of token → normalized frequency (count / total tokens).
 *
 * @param tokens - Array of tokens from the document
 * @returns Map of token to normalized term frequency
 */
function computeTf(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  // Normalize by total token count
  const total = tokens.length;
  if (total > 0) {
    for (const [term, count] of tf) {
      tf.set(term, count / total);
    }
  }
  return tf;
}

/**
 * Computes inverse document frequency for a vocabulary across a corpus.
 *
 * IDF(t) = log(N / (1 + df(t))) where:
 * - N = total number of documents
 * - df(t) = number of documents containing term t
 *
 * @param corpusTokens - Array of tokenized documents
 * @param vocabulary - Set of all unique terms
 * @returns Map of token to IDF value
 */
function computeIdf(
  corpusTokens: string[][],
  vocabulary: Set<string>
): Map<string, number> {
  const idf = new Map<string, number>();
  const n = corpusTokens.length;

  for (const term of vocabulary) {
    let docCount = 0;
    for (const docTokens of corpusTokens) {
      if (docTokens.includes(term)) {
        docCount++;
      }
    }
    // Smoothed IDF: log(N / (1 + df))
    idf.set(term, Math.log(n / (1 + docCount)));
  }

  return idf;
}

/**
 * Builds a TF-IDF vector for a document given the IDF values and vocabulary order.
 *
 * @param tf - Term frequency map for the document
 * @param idf - Inverse document frequency map
 * @param vocabArray - Ordered array of vocabulary terms
 * @returns TF-IDF vector (number array aligned with vocabArray)
 */
function buildTfidfVector(
  tf: Map<string, number>,
  idf: Map<string, number>,
  vocabArray: string[]
): number[] {
  return vocabArray.map((term) => {
    const tfVal = tf.get(term) || 0;
    const idfVal = idf.get(term) || 0;
    return tfVal * idfVal;
  });
}

/**
 * Computes cosine similarity between two vectors.
 *
 * cos(A, B) = (A · B) / (|A| × |B|)
 *
 * @param vecA - First vector
 * @param vecB - Second vector
 * @returns Cosine similarity score between 0 and 1 (clamped)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  // Clamp to [0, 1] range (TF-IDF vectors are non-negative)
  return Math.max(0, Math.min(1, dotProduct / (magnitudeA * magnitudeB)));
}

/**
 * Computes TF-IDF similarity scores between a query and a corpus of documents.
 *
 * @param corpus - Array of document texts (paper abstracts)
 * @param query - The query text (student's research idea)
 * @returns Array of similarity scores (0–1), one per corpus document
 */
export function tfidf(corpus: string[], query: string): number[] {
  if (corpus.length === 0) return [];

  // Tokenize all documents and the query
  const corpusTokens = corpus.map(tokenize);
  const queryTokens = tokenize(query);

  // Build vocabulary from all documents + query
  const vocabulary = new Set<string>();
  for (const tokens of corpusTokens) {
    for (const token of tokens) vocabulary.add(token);
  }
  for (const token of queryTokens) vocabulary.add(token);

  const vocabArray = Array.from(vocabulary);

  // Compute IDF across the entire corpus (including query as a document)
  const allDocs = [...corpusTokens, queryTokens];
  const idf = computeIdf(allDocs, vocabulary);

  // Build TF-IDF vectors
  const queryTf = computeTf(queryTokens);
  const queryVector = buildTfidfVector(queryTf, idf, vocabArray);

  // Compute similarity for each document
  return corpusTokens.map((docTokens) => {
    const docTf = computeTf(docTokens);
    const docVector = buildTfidfVector(docTf, idf, vocabArray);
    return cosineSimilarity(queryVector, docVector);
  });
}

/**
 * Returns a human-readable similarity label based on the cosine similarity score.
 *
 * @param score - Cosine similarity score (0–1)
 * @returns Qualitative label string
 */
export function getSimilarityLabel(
  score: number
): 'Very Similar' | 'Related' | 'Tangentially Related' {
  if (score >= 0.5) return 'Very Similar';
  if (score >= 0.25) return 'Related';
  return 'Tangentially Related';
}

/**
 * Ranks papers by semantic similarity to the student's research idea.
 * Uses TF-IDF cosine similarity. Assigns similarityScore to each paper
 * and returns them sorted descending (most similar first).
 *
 * @param papers - Array of papers to rank
 * @param ideaText - The student's research idea text
 * @returns Papers sorted by similarity score (highest first)
 */
export function rankPapers(papers: Paper[], ideaText: string): Paper[] {
  if (papers.length === 0) return [];

  // Build corpus from titles + abstracts
  const corpus = papers.map(
    (p) => `${p.title} ${p.abstract}`
  );

  // Compute TF-IDF similarity scores
  const scores = tfidf(corpus, ideaText);

  // Assign scores and sort
  const rankedPapers = papers.map((paper, i) => ({
    ...paper,
    similarityScore: scores[i] || 0,
  }));

  // Sort descending by similarity score
  rankedPapers.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));

  return rankedPapers;
}
