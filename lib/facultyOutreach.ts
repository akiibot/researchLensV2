import { FacultyProfile, ResearchIdea } from './types';

export function buildOutreachPrompt(idea: ResearchIdea, faculty: FacultyProfile): string {
  return `Write a concise supervisor outreach email for a thesis student.

Student idea: ${idea.text}
Field: ${idea.field}
Academic level: ${idea.level}

Potential supervisor:
Name: ${faculty.name}
Institution: ${faculty.institution || 'Unknown'}
Country: ${faculty.country || 'Unknown'}
Topics: ${(faculty.topics || []).join(', ') || 'Unknown'}
Evidence papers: ${(faculty.evidencePapers || []).join(' | ') || 'Unknown'}

Rules:
- 120-160 words.
- Professional, specific, and respectful.
- Mention topic fit using the evidence, but do not claim the person has agreed to supervise.
- Do not invent an email address or private contact details.
- Return only the email body.`;
}
