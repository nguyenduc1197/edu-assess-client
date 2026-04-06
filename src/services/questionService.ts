export const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5188';

export type QuestionDto = {
  id?: number;
  content: string;
  type?: string;
  difficulty?: string;
  // add other fields returned by API as needed
};

export async function fetchQuestionsWithoutExam(): Promise<QuestionDto[]> {
  const res = await fetch(`${API_BASE}/questions/without-exam`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to fetch questions: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function createQuestion(q: QuestionDto, token?: string) {
  const res = await fetch(`${API_BASE}/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(q),
  });
  if (!res.ok) throw new Error(`Create question failed: ${res.status}`);
  return res.json();
}

export async function createQuestionsBatch(qs: QuestionDto[], token?: string) {
  const res = await fetch(`${API_BASE}/questions/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(qs),
  });
  // if backend doesn't support batch endpoint, return res.status so caller can fallback
  if (!res.ok) throw new Error(`Batch create failed: ${res.status}`);
  return res.json();
}