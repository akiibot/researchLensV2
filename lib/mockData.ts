/**
 * @file Mock Data for Demo/Fallback Mode
 *
 * Provides pre-baked mock data for the application when ANTHROPIC_API_KEY is not configured
 * or when external APIs are slow/unavailable.
 * Includes a full set of mock academic papers and a pre-computed AnalysisResult.
 *
 * @module mockData
 */

import { Paper, AnalysisResult } from './types';

/**
 * Realistic mock papers representing search results for:
 * "Social media use and exam anxiety in university students"
 */
export const MOCK_PAPERS: Paper[] = [
  {
    id: 'mock-paper-1',
    title: 'The impact of social media addiction on academic performance and exam anxiety among college students',
    abstract: 'This study investigates the relationship between social media addiction, academic engagement, and exam-related anxiety. Using a survey of 350 undergraduate students, we find that excessive smartphone and social media use (specifically Instagram and TikTok) strongly correlates with high levels of pre-exam anxiety and lower GPAs. A regression analysis indicates that sleep disruption mediates this relationship.',
    year: 2021,
    authors: ['Sarah Jenkins', 'David Miller'],
    doi: '10.1016/j.chb.2021.106894',
    url: 'https://doi.org/10.1016/j.chb.2021.106894',
    citationCount: 142,
    source: 'semanticscholar',
    type: 'journal-article',
    venue: 'Computers in Human Behavior',
    similarityScore: 0.89,
  },
  {
    id: 'mock-paper-2',
    title: 'Academic stress, social networking sites, and mental health: A cross-sectional survey of university learners',
    abstract: 'We conducted a cross-sectional survey of 500 undergraduate students across three universities to examine how time spent on social networking sites (SNS) influences test anxiety and overall psychological well-being. Our findings suggest that passive browsing of peers\' academic achievements on LinkedIn and Instagram increases feelings of inadequacy and academic stress, leading to heightened anxiety during final examination periods.',
    year: 2022,
    authors: ['Amina Rahman', 'Tariq Al-Mansoor'],
    doi: '10.1007/s12144-022-03120-w',
    url: 'https://doi.org/10.1007/s12144-022-03120-w',
    citationCount: 68,
    source: 'openalex',
    type: 'journal-article',
    venue: 'Current Psychology',
    similarityScore: 0.82,
  },
  {
    id: 'mock-paper-3',
    title: 'Understanding the relationship between TikTok usage patterns and cognitive test performance',
    abstract: 'Short-form video content has exploded in popularity among tertiary students. This experimental study measures the short-term cognitive effects of TikTok scrolling immediately prior to academic testing. Results from a sample of 120 students show that 15 minutes of video scrolling significantly decreases working memory capacity and increases self-reported test-taking anxiety compared to the control group.',
    year: 2023,
    authors: ['Emily Chen', 'Marcus Vance', 'Robert K. Yin'],
    doi: '10.1080/10447318.2023.2189090',
    url: 'https://doi.org/10.1080/10447318.2023.2189090',
    citationCount: 45,
    source: 'semanticscholar',
    type: 'journal-article',
    venue: 'International Journal of Human–Computer Interaction',
    similarityScore: 0.78,
  },
  {
    id: 'mock-paper-4',
    title: 'Self-report measures of test anxiety and mobile notification distraction: A longitudinal analysis',
    abstract: 'While previous studies rely on one-time cross-sectional surveys, this research presents a longitudinal cohort study tracking 180 graduate students over a 16-week semester. Using mobile logging apps and daily diary entries, we show that push notifications from WhatsApp and Instagram during study sessions predict exam-week anxiety spikes and procrastination behavior, suggesting temporal dynamics are crucial.',
    year: 2020,
    authors: ['John H. Schwarz', 'Elena Rostova'],
    doi: '10.1016/j.iheduc.2020.100752',
    url: 'https://doi.org/10.1016/j.iheduc.2020.100752',
    citationCount: 95,
    source: 'openalex',
    type: 'journal-article',
    venue: 'The Internet and Higher Education',
    similarityScore: 0.71,
  },
  {
    id: 'mock-paper-5',
    title: 'An investigation into digital wellbeing and academic assessment stress in UK higher education',
    abstract: 'This report details the findings of a large-scale project evaluating digital wellbeing initiatives. We survey 1,200 students across the United Kingdom. Although students report using social media to cope with academic stress, path analysis reveals that high screen-time is predictive of increased test-related distress and lower self-efficacy. Recommended interventions focus on university-led digital detox programs.',
    year: 2022,
    authors: ['William Turner', 'Sophia Sterling'],
    doi: '10.11120/ndls.2022.00183',
    url: 'https://doi.org/10.11120/ndls.2022.00183',
    citationCount: 18,
    source: 'datacite',
    type: 'Report',
    venue: 'UK Higher Education Academy',
    similarityScore: 0.65,
  },
  {
    id: 'mock-paper-6',
    title: 'The role of social media in exam preparation: Academic helper or distraction?',
    abstract: 'This qualitative inquiry explores how master\'s students utilize Facebook groups for collaborative exam preparation. Through semi-structured interviews with 24 postgraduate students, we uncover a dual effect: while groups facilitate peer support and resource sharing, the constant exposure to distracting feeds increases anxiety and feelings of falling behind, creating a counterproductive cycle.',
    year: 2019,
    authors: ['Liam O\'Connor', 'Fiona Fitzpatrick'],
    doi: '10.1108/ils-04-2019-0032',
    url: 'https://doi.org/10.1108/ils-04-2019-0032',
    citationCount: 37,
    source: 'semanticscholar',
    type: 'journal-article',
    venue: 'Information Discovery and Delivery',
    similarityScore: 0.62,
  },
  {
    id: 'mock-paper-7',
    title: 'Exploring the link between active vs passive social media consumption and exam distress',
    abstract: 'Active communication on social media has different psychological effects than passive scrolling. This study examines these differences during exam periods among 280 undergraduate students. Using self-reported anxiety scales, we find that passive consumption (scrolling feeds) is associated with higher social comparison and test anxiety, whereas active posting and chatting show no significant correlation with distress.',
    year: 2021,
    authors: ['Hiroshi Tanaka', 'Kenji Sato'],
    doi: '10.2196/mental.30129',
    url: 'https://doi.org/10.2196/mental.30129',
    citationCount: 52,
    source: 'openalex',
    type: 'journal-article',
    venue: 'JMIR Mental Health',
    similarityScore: 0.58,
  },
  {
    id: 'mock-paper-8',
    title: 'Examining academic anxiety and social media usage among South Asian university cohorts',
    abstract: 'This paper presents a cross-cultural study comparing social media-induced test anxiety in Indian and Pakistani university students (N=400). The study highlights how collectivist family pressure and academic expectations interact with social media comparison, creating high-stress environments during finals. The findings emphasize the need for localized mental health strategies in South Asian universities.',
    year: 2022,
    authors: ['Rajesh Sharma', 'Zainab Patel'],
    doi: '10.1007/s10447-022-09477-y',
    url: 'https://doi.org/10.1007/s10447-022-09477-y',
    citationCount: 24,
    source: 'openalex',
    type: 'journal-article',
    venue: 'International Journal for the Advancement of Counselling',
    similarityScore: 0.53,
  }
];

/**
 * Pre-baked gap analysis report matching the demo idea:
 * "Social media and exam anxiety in university students"
 */
export const MOCK_ANALYSIS_RESULT: AnalysisResult = {
  overlapRisk: 'high',
  evidenceConfidence: 'high',
  noveltySignal: 'weak',
  overlapExplanation: 'Your research idea overlaps heavily with existing literature, specifically Jenkins & Miller (2021) and Rahman & Al-Mansoor (2022), which have extensively established that social media usage increases pre-exam anxiety and negatively correlates with GPA. The topic of general social media distraction during exams is heavily saturated, with most studies relying on cross-sectional self-report surveys.',
  topRelatedPapers: MOCK_PAPERS.slice(0, 3),
  gapMatrix: [
    {
      dimension: 'topic',
      saturation: 'crowded',
      paperCount: 47,
      evidence: '47 papers closely investigate the relationship between social media distraction and test anxiety.',
    },
    {
      dimension: 'method',
      saturation: 'crowded',
      paperCount: 38,
      evidence: '38 of 47 papers use self-report cross-sectional survey methodology.',
    },
    {
      dimension: 'population',
      saturation: 'moderate',
      paperCount: 32,
      evidence: '32 papers focus on general undergraduate cohorts, while only 3 target South Asian students.',
    },
    {
      dimension: 'geography',
      saturation: 'open',
      paperCount: 0,
      evidence: 'Zero papers evaluate this phenomenon specifically within the Higher Education context of Bangladesh.',
    },
  ],
  pivots: [
    {
      title: 'Geographic Focus on private universities in Dhaka',
      description: 'Reformulate the study to focus on private university students in Dhaka, Bangladesh, exploring how unique structural factors (session jams, high tuition stress, and urban commute times) interact with TikTok usage and exam anxiety.',
      rationale: 'The retrieved corpus contains zero papers investigating this relationship in the Bangladesh context. Surfacing these regional factors fills a significant geographic gap, as highlighted by Sharma & Patel (2022) regarding localized South Asian pressures.',
      targetGap: 'geography',
    },
    {
      title: 'Longitudinal pre-exam micro-study',
      description: 'Instead of a one-time survey, conduct a 2-week longitudinal study tracking students daily leading up to final exams using daily diary entries and mobile screentime logging to observe temporal anxiety fluctuations.',
      rationale: 'Over 80% of existing studies (e.g., Jenkins & Miller, 2021) are cross-sectional and cannot establish directionality. Tracking pre-exam anxiety trends on a daily scale resolves the methodological saturation noted in Schwarz & Rostova (2020).',
      targetGap: 'method',
    },
    {
      title: 'Platform-specific algorithmic effects',
      description: 'Shift the focus from general "screentime" to platform-specific mechanisms. Investigate how TikTok\'s algorithmic feed design (infinite scroll, content-agnostic autoplay) triggers pre-exam study procrastination compared to chat-centric platforms like WhatsApp.',
      rationale: 'Most literature aggregates "social media" into a single variable. Isolating specific algorithmic engagement mechanics addresses a major topical gap and builds on preliminary platform studies such as Chen et al. (2023).',
      targetGap: 'topic',
    },
  ],
  supervisorNote: 'Dear Advisor, I am formulating my thesis proposal. While many studies link general social media usage to test anxiety, such as Jenkins & Miller (2021) and Rahman & Al-Mansoor (2022), I have identified a key gap: there is almost no research on how this affects students under the unique educational framework of private universities in Bangladesh. I plan to conduct a longitudinal study during the pre-exam period to isolate how platform-specific algorithmic designs (specifically TikTok vs. WhatsApp) contribute to academic procrastination and anxiety. I would appreciate your feedback on this direction.',
  totalPapersRetrieved: 47,
  sourceCounts: {
    openalex: 24,
    semanticscholar: 18,
    datacite: 5,
  },
};
