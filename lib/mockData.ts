/**
 * @file Mock Data for Demo/Fallback Mode
 *
 * Provides pre-baked mock data for the application when ANTHROPIC_API_KEY is not configured
 * or when external APIs are slow/unavailable.
 * Includes a full set of mock academic papers and a pre-computed AnalysisResult.
 *
 * @module mockData
 */

import { Paper, AnalysisResult, FacultyProfile, ResearchIdea, ThesisMindmap } from './types';
import { getFundingConnectorUrl } from './fundingConnectors';

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
 * The research idea that the demo report below was "generated" for.
 * Used to seed sessionStorage for the instant hackathon demo path.
 */
export const MOCK_IDEA: ResearchIdea = {
  text: 'Social media use and exam anxiety in university students',
  field: 'Psychology',
  level: 'undergraduate',
  language: 'en',
  mode: 'student',
  evidenceScope: 'balanced',
};

export const MOCK_QUERIES: string[] = [
  'social media use exam anxiety university students',
  'social networking sites test anxiety academic performance',
  'smartphone distraction academic stress higher education',
  'screen time mental health undergraduate students',
  'digital wellbeing exam preparation college students',
];

/**
 * Faculty/supervisor matches for the demo report.
 */
export const MOCK_FACULTY: FacultyProfile[] = [
  {
    id: 'mock-faculty-1',
    openAlexAuthorId: 'A5023456789',
    name: 'Dr. Nusrat Jahan Chowdhury',
    institution: 'BRAC University',
    country: 'Bangladesh',
    orcid: '0000-0002-1234-5678',
    worksCount: 41,
    citedByCount: 612,
    hIndex: 13,
    topics: ['Educational psychology', 'Digital wellbeing', 'Adolescent mental health'],
    profileUrl: 'https://openalex.org/A5023456789',
    worksApiUrl: 'https://api.openalex.org/works?filter=author.id:A5023456789',
    relevanceScore: 92,
    evidencePapers: [
      'Academic stress, social networking sites, and mental health: A cross-sectional survey of university learners',
    ],
    fitSummary:
      'Published extensively on academic stress and social media in South Asian student populations — a direct match for the Bangladesh-focused pivot.',
    outreachDraft:
      'Dear Dr. Chowdhury,\n\nI am an undergraduate psychology student developing a thesis on social media use and exam anxiety among Bangladeshi university students. Your work on academic stress and social networking sites closely aligns with the direction I want to take, particularly the gap I found around private-university students in Dhaka. Would you be open to a short conversation about supervising or advising this project?\n\nThank you for your time,\n[Your name]',
    matchReasons: [
      'Institution: BRAC University.',
      '612 citations.',
      'Prior work directly on academic stress and social networking sites.',
    ],
    source: 'openalex',
  },
  {
    id: 'mock-faculty-2',
    openAlexAuthorId: 'A5034567890',
    name: 'Prof. Michael T. Alvarez',
    institution: 'University of Toronto',
    country: 'Canada',
    orcid: '0000-0003-2345-6789',
    worksCount: 87,
    citedByCount: 2140,
    hIndex: 24,
    topics: ['Human-computer interaction', 'Attention and distraction', 'Mobile technology use'],
    profileUrl: 'https://openalex.org/A5034567890',
    worksApiUrl: 'https://api.openalex.org/works?filter=author.id:A5034567890',
    relevanceScore: 81,
    evidencePapers: [
      'Understanding the relationship between TikTok usage patterns and cognitive test performance',
    ],
    fitSummary:
      'Leading researcher on short-form video and attention; a strong fit for the platform-specific algorithmic-effects pivot.',
    outreachDraft:
      'Dear Prof. Alvarez,\n\nI am developing an undergraduate thesis examining how short-form video platforms like TikTok affect pre-exam cognitive performance and anxiety. Your research on attention and mobile technology use would be extremely valuable context for narrowing my methodology. I would welcome the chance to discuss this with you.\n\nBest regards,\n[Your name]',
    matchReasons: [
      'Institution: University of Toronto.',
      '2,140 citations.',
      'Directly studies short-form video and cognitive performance.',
    ],
    source: 'openalex',
  },
  {
    id: 'mock-faculty-3',
    openAlexAuthorId: 'A5045678901',
    name: 'Dr. Priya Nair',
    institution: 'University of Delhi',
    country: 'India',
    orcid: '0000-0004-3456-7890',
    worksCount: 29,
    citedByCount: 344,
    hIndex: 10,
    topics: ['South Asian mental health', 'Academic counselling', 'Cross-cultural psychology'],
    profileUrl: 'https://openalex.org/A5045678901',
    worksApiUrl: 'https://api.openalex.org/works?filter=author.id:A5045678901',
    relevanceScore: 76,
    evidencePapers: [
      'Examining academic anxiety and social media usage among South Asian university cohorts',
    ],
    fitSummary:
      'Cross-cultural counselling researcher whose South Asian cohort study is the closest regional precedent for the proposed geography pivot.',
    matchReasons: [
      'Institution: University of Delhi.',
      '344 citations.',
      'Closest existing study on South Asian student cohorts.',
    ],
    source: 'openalex',
  },
];

/**
 * Builds the Canvas-tool thesis mindmap for the demo report, matching the
 * gap matrix / pivots defined below.
 */
function buildMockThesisMindmap(): ThesisMindmap {
  return {
    center: 'Social media use and exam anxiety in university students',
    bestOpportunityNodeId: 'geography-open',
    warnings: [],
    branches: [
      {
        id: 'branch-topic',
        label: 'Topic',
        kind: 'topic',
        summary: 'The core topic is heavily saturated across 47 retrieved papers.',
        nodes: [
          {
            id: 'topic-crowded',
            label: 'Topic: crowded',
            status: 'crowded',
            paperCount: 47,
            description: '47 papers closely investigate social media distraction and test anxiety.',
            supportingPaperIds: ['mock-paper-1', 'mock-paper-2'],
          },
        ],
      },
      {
        id: 'branch-method',
        label: 'Method',
        kind: 'method',
        summary: 'Nearly all existing studies rely on the same cross-sectional survey design.',
        nodes: [
          {
            id: 'method-crowded',
            label: 'Method: crowded',
            status: 'crowded',
            paperCount: 38,
            description: '38 of 47 papers use self-report cross-sectional survey methodology.',
            supportingPaperIds: ['mock-paper-4'],
            action: 'narrow_scope',
          },
        ],
      },
      {
        id: 'branch-population',
        label: 'Population',
        kind: 'population',
        summary: 'Most studies target general undergraduate cohorts rather than a specific group.',
        nodes: [
          {
            id: 'population-moderate',
            label: 'Population: moderate',
            status: 'moderate',
            paperCount: 32,
            description: '32 papers focus on general undergraduate cohorts, while only 3 target South Asian students.',
            supportingPaperIds: ['mock-paper-8'],
          },
        ],
      },
      {
        id: 'branch-geography',
        label: 'Geography',
        kind: 'geography',
        summary: 'No papers evaluate this topic in the Bangladesh higher-education context — the strongest gap.',
        nodes: [
          {
            id: 'geography-open',
            label: 'Geography: open',
            status: 'open',
            paperCount: 0,
            description: 'Zero papers evaluate this phenomenon specifically within Bangladeshi higher education.',
            action: 'explore_pivot',
            pivotIndex: 0,
          },
        ],
      },
      {
        id: 'branch-evidence',
        label: 'Evidence',
        kind: 'evidence',
        summary: 'Evidence strength is high thanks to broad source coverage.',
        nodes: [
          {
            id: 'evidence-strength',
            label: 'Evidence strength',
            status: 'strong',
            description: '47 papers retrieved across 5 sources give strong support for the baseline claim.',
          },
          {
            id: 'evidence-diversity',
            label: 'Source diversity',
            status: 'strong',
            description: 'Results span OpenAlex, Semantic Scholar, and DataCite.',
          },
        ],
      },
      {
        id: 'branch-risk',
        label: 'Risk',
        kind: 'risk',
        summary: 'Presenting the general topic as novel would invite immediate pushback.',
        nodes: [
          {
            id: 'risk-claim',
            label: 'Claim risk',
            status: 'risk',
            description: 'Proposing this topic without narrowing would read as unaware of existing saturated literature.',
          },
        ],
      },
      {
        id: 'branch-pivots',
        label: 'Pivots',
        kind: 'pivots',
        summary: 'Three evidence-backed pivots target the open gaps above.',
        nodes: [
          {
            id: 'pivot-0',
            label: 'Geographic Focus on private universities in Dhaka',
            status: 'open',
            description: 'Reformulate around private-university students in Dhaka, Bangladesh.',
            action: 'explore_pivot',
            pivotIndex: 0,
          },
          {
            id: 'pivot-1',
            label: 'Longitudinal pre-exam micro-study',
            status: 'open',
            description: 'Track students daily for two weeks leading up to finals instead of a one-time survey.',
            action: 'explore_pivot',
            pivotIndex: 1,
          },
          {
            id: 'pivot-2',
            label: 'Platform-specific algorithmic effects',
            status: 'open',
            description: "Isolate TikTok's algorithmic feed design from chat-centric platforms like WhatsApp.",
            action: 'explore_pivot',
            pivotIndex: 2,
          },
        ],
      },
    ],
  };
}

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
  journalTargeting: {
    targets: [
      {
        outletName: 'Computers in Human Behavior',
        outletType: 'journal',
        fitScore: 88,
        evidenceStrength: 'strong',
        scopeMatch:
          'The retrieved corpus includes a close paper on social media addiction, academic performance, and exam anxiety in this venue.',
        articleTypeFit:
          'Empirical article fit is plausible for a quantitative or longitudinal study; verify author guidelines before submission.',
        openAccessStatus: 'unknown',
        similarAcceptedPapers: [
          {
            title:
              'The impact of social media addiction on academic performance and exam anxiety among college students',
            year: 2021,
            doi: '10.1016/j.chb.2021.106894',
            url: 'https://doi.org/10.1016/j.chb.2021.106894',
            venue: 'Computers in Human Behavior',
          },
        ],
        citationStyle: 'Not verified',
        submissionChecklist: ['Not verified - check author guidelines'],
        verificationUrl: null,
        metadataNote:
          'Outlet and similar paper are from retrieved metadata; citation style and checklist were not verified.',
      },
      {
        outletName: 'Current Psychology',
        outletType: 'journal',
        fitScore: 80,
        evidenceStrength: 'strong',
        scopeMatch:
          'The retrieved corpus includes a similar cross-sectional mental-health and academic-stress paper in this venue.',
        articleTypeFit:
          'Empirical psychology article fit is plausible; verify word limits, reporting standards, and article categories.',
        openAccessStatus: 'unknown',
        similarAcceptedPapers: [
          {
            title:
              'Academic stress, social networking sites, and mental health: A cross-sectional survey of university learners',
            year: 2022,
            doi: '10.1007/s12144-022-03120-w',
            url: 'https://doi.org/10.1007/s12144-022-03120-w',
            venue: 'Current Psychology',
          },
        ],
        citationStyle: 'Not verified',
        submissionChecklist: ['Not verified - check author guidelines'],
        verificationUrl: null,
        metadataNote:
          'Outlet and similar paper are from retrieved metadata; open access policy and submission rules were not verified.',
      },
      {
        outletName: 'International Journal of Human-Computer Interaction',
        outletType: 'journal',
        fitScore: 74,
        evidenceStrength: 'strong',
        scopeMatch:
          'The retrieved corpus includes platform-specific TikTok and cognitive test performance work in this venue.',
        articleTypeFit:
          'Empirical human-computer interaction article fit is plausible if the project focuses on platform mechanics and measurable behavior.',
        openAccessStatus: 'unknown',
        similarAcceptedPapers: [
          {
            title:
              'Understanding the relationship between TikTok usage patterns and cognitive test performance',
            year: 2023,
            doi: '10.1080/10447318.2023.2189090',
            url: 'https://doi.org/10.1080/10447318.2023.2189090',
            venue: 'International Journal of Human-Computer Interaction',
          },
        ],
        citationStyle: 'Not verified',
        submissionChecklist: ['Not verified - check author guidelines'],
        verificationUrl: null,
        metadataNote:
          'Outlet and similar paper are from retrieved metadata; author instructions still need manual verification.',
      },
    ],
    notes: [
      'Demo targets are grounded in retrieved paper venues.',
      'Citation style, APCs, deadlines, and submission checklist items require manual verification.',
    ],
  },
  studentSummary:
    'This is a great, relevant topic that many people are interested in! The good news is there\'s a lot of research to build on. The challenge is that because it\'s a popular topic, you\'ll need to find a unique angle to make your thesis stand out. Your idea has strong novelty potential if you focus on a specific group of students, a specific location, or a "how" or "why" question instead of just confirming that a link exists. Use the pivots below to brainstorm a more focused research question.',
  facultySummary:
    'The retrieved corpus (47 papers, 5 sources) shows the general social-media/exam-anxiety relationship is well-established and methodologically homogeneous (81% cross-sectional self-report surveys). Evidence strength is high, but novelty is low without a clearer population, geography, or methodological pivot. The Bangladesh/South-Asian angle and platform-specific mechanisms remain underexplored and represent the most defensible gaps for a student proposal.',
  recommendedUseCases: [
    {
      title: 'Narrow before proposing',
      audience: 'student',
      description:
        'Use the gap matrix to pick one of the three open pivots before drafting a formal thesis proposal, rather than proposing the general topic as-is.',
      suggestedAction: 'Open the Pivots tab and pick the geography or method pivot.',
    },
    {
      title: 'Screen for redundancy',
      audience: 'faculty',
      description:
        'Use the Evidence tab to quickly confirm whether an incoming student proposal on this topic duplicates existing cross-sectional survey work.',
      suggestedAction: 'Check the Evidence tab for the closest three papers before a first meeting.',
    },
    {
      title: 'Draft supervisor outreach',
      audience: 'both',
      description:
        'The approval packet and faculty outreach drafts are ready to copy into an email to a supervisor or collaborator.',
      suggestedAction: 'Open the Report tab and copy the approval packet.',
    },
  ],
  limitations: [
    'This demo report is based on a fixed sample of 8 illustrative papers, not a live search of your own idea.',
    'Faculty matches and outreach drafts are illustrative examples, not verified real contact information.',
  ],
  nextActions: [
    'Pick one pivot (geography, method, or platform-specific) and rewrite the idea around it.',
    'Read the top 3 related papers before making any novelty claims to a supervisor.',
    'Draft a one-paragraph proposal using the approval packet as a starting point.',
  ],
  fundingFit: {
    readiness: 'medium',
    score: 58,
    biggestBlocker: 'The topic is too broad and overlaps heavily with existing funded work in this area.',
    nextBestAction: 'Narrow to the Bangladesh/private-university angle before approaching funders.',
    bestAngles: [
      'Regional mental-health gap in Bangladeshi higher education',
      'Platform-specific (TikTok vs. WhatsApp) intervention design',
      'Longitudinal digital-wellbeing pilot ahead of exam season',
    ],
    funderCategories: [
      'University internal research grants',
      'Regional mental-health research funds',
      'Small seed grants for pilot studies',
    ],
    searchLinks: [
      {
        label: 'Grants.gov search',
        url: getFundingConnectorUrl('Grants.gov'),
        purpose: 'Search US federal funding opportunities by keyword.',
      },
      {
        label: 'NIH RePORTER',
        url: getFundingConnectorUrl('NIH RePORTER'),
        purpose: 'Find funded behavioral and public-health precedents.',
      },
      {
        label: 'CORDIS projects',
        url: getFundingConnectorUrl('CORDIS'),
        purpose: 'Review EU-funded project examples and framing.',
      },
    ],
    internalRoutes: [
      {
        label: 'Faculty Directory',
        href: '/faculty',
        purpose: 'Find collaborators or supervisors who strengthen funding fit.',
      },
      {
        label: 'Saved Reports',
        href: '/reports',
        purpose: 'Review saved analyses before preparing funding materials.',
      },
    ],
    connectorSuggestions: [
      {
        name: 'Grants.gov',
        type: 'government',
        purpose: 'Live opportunity search for US federal grants.',
        status: 'future_integration',
      },
      {
        name: 'NIH RePORTER',
        type: 'grant_database',
        purpose: 'Find funded behavioral research precedents.',
        status: 'future_integration',
      },
    ],
    grantReadyFraming:
      'Fundable as a small pilot once narrowed to the Bangladesh/private-university population and framed around a specific platform mechanism rather than "social media" broadly.',
    weaknesses: [
      'The general topic is heavily saturated and unlikely to attract funders on its own.',
      'No pilot data yet on the proposed longitudinal method.',
    ],
    collaboratorProfiles: [
      'Educational psychologist with South Asian student population expertise',
      'HCI researcher studying attention and short-form video',
    ],
    outreachDrafts: [
      {
        title: 'Funding office inquiry',
        recipientType: 'funding_office',
        body: 'Hello, I am preparing a small research pilot on social media use and exam anxiety among Bangladeshi university students and would appreciate guidance on internal funding opportunities that support early-stage thesis research. Could you advise which schemes or deadlines may be appropriate?',
      },
      {
        title: 'Potential collaborator note',
        recipientType: 'potential_collaborator',
        body: 'Dear Dr. Chowdhury, I am developing a thesis pilot on social media and exam anxiety with a focus on private universities in Dhaka, and noticed your work closely aligns with this direction. I would value a brief conversation about whether the framing is feasible and whether a collaboration or supervision pathway makes sense.',
      },
    ],
    miniGrantAbstract:
      'This pilot project will examine how platform-specific social media use relates to exam anxiety among private-university students in Dhaka, Bangladesh — a population and geography absent from the existing literature. Using a two-week longitudinal design with daily mobile logging, the study will identify which platform mechanisms (algorithmic feeds vs. direct messaging) most strongly predict pre-exam anxiety, producing actionable guidance for university digital-wellbeing programs.',
    specificAims: [
      'Quantify platform-specific (TikTok vs. WhatsApp) engagement patterns among Bangladeshi undergraduates.',
      'Track daily anxiety fluctuations across a two-week pre-exam period using mobile logging.',
      'Produce a supervisor-ready proposal narrowing scope, method, and population.',
    ],
    impactStatement:
      'Findings would give Bangladeshi universities the first locally-grounded evidence base for designing digital-wellbeing interventions ahead of exam periods.',
    budgetScale: 'small_internal',
  },
  facultyMatches: MOCK_FACULTY,
  sanityMatrix: {
    noveltyPotential: {
      score: 35,
      level: 'weak',
      rationale: 'The core topic is heavily saturated; novelty depends entirely on picking one of the three identified pivots.',
    },
    evidenceStrength: {
      score: 86,
      level: 'strong',
      rationale: '47 papers retrieved across 5 sources give strong support for the baseline claim that social media use correlates with exam anxiety.',
    },
    feasibility: {
      score: 72,
      level: 'strong',
      rationale: 'A survey or short longitudinal design is achievable at the undergraduate level within a single semester.',
    },
    supervisorFit: {
      score: 78,
      level: 'strong',
      rationale: 'Three relevant faculty matches were found, including one with directly overlapping South Asian cohort research.',
    },
    claimRisk: {
      score: 62,
      level: 'moderate',
      rationale: 'Presenting this as a novel topic without narrowing would invite immediate "this has been done" pushback from a supervisor.',
    },
    overallScore: 71,
    verdict: 'Promising but needs narrowing',
    reasons: [
      '47 papers closely investigate the same general relationship.',
      '38 of 47 papers rely on cross-sectional self-report surveys.',
      'Zero papers focus on Bangladesh specifically, despite strong regional relevance.',
      'Three faculty matches strengthen supervisor-fit confidence.',
    ],
    recommendedActions: [
      'Narrow the idea into a clearer method, population, or context before proposing.',
      'Consider the geography pivot (Bangladesh/private universities) — it has the strongest gap signal.',
      'Read the top 3 related papers before making any novelty claims to a supervisor.',
    ],
    fullTextCoverage: {
      readableCount: 5,
      totalKeyPapers: 8,
      label: '5 of 8 key papers have full text available',
    },
  },
  evidenceScopeDiagnostics: {
    scope: 'balanced',
    label: 'Balanced',
    detectedGeographyTerms: ['Bangladesh', 'Dhaka', 'South Asian'],
    top10LocalMatches: 1,
    top20LocalMatches: 2,
    localEvidenceCount: 2,
    globalEvidenceCount: 8,
    summary: 'Balanced mode lightly preferred papers mentioning Bangladesh, Dhaka, South Asian without excluding global evidence.',
  },
  searchDiagnostics: {
    problem: ['exam anxiety', 'test anxiety', 'academic stress'],
    domain: ['educational psychology', 'digital wellbeing'],
    languageContext: ['English-language surveys'],
    method: ['cross-sectional survey', 'longitudinal cohort', 'qualitative interview'],
    intervention: ['social media use', 'screen time', 'mobile notifications'],
    geography: ['Bangladesh', 'South Asia', 'United Kingdom'],
    generatedQueries: MOCK_QUERIES,
    skippedSources: [],
  },
  thesisMindmap: buildMockThesisMindmap(),
  credibilityReasons: [
    '8 unique papers were retrieved and ranked for this demo.',
    '3 scholarly sources contributed results (OpenAlex, Semantic Scholar, DataCite).',
    '8 retrieved papers include DOI links.',
    '4 papers were published in the last five years.',
  ],
  modelStatus: {
    reasoningModel: 'Gemini 2.5 Pro',
    summaryModel: 'Gemini 2.5 Flash',
    note: 'Demo report — no live model calls were made.',
  },
  demoData: true,
  totalPapersRetrieved: 47,
  sourceCounts: {
    openalex: 24,
    semanticscholar: 18,
    datacite: 5,
  },
};
