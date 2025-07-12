// This file is for client-side OpenAI integration if needed
// Currently, all OpenAI requests are handled on the server side
export interface ChatMessage {
  id: number;
  sessionId: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: number;
  userId: number;
  subjectId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: number;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string;
}
