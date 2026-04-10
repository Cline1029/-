export interface Question {
  id: string;
  originalImage?: string;
  originalText: string;
  options?: string[];
  userAnswer?: string;
  correctAnswer: string;
  knowledgePoint: string;
  variations: Variation[];
  createdAt: number;
}

export interface Variation {
  id: string;
  text: string;
  options?: string[];
  answer: string;
  analysis: string;
}

export interface OCRResult {
  text: string;
  options?: string[];
  userAnswer?: string;
  correctAnswer?: string;
  knowledgePoint: string;
}
