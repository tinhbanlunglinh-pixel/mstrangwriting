import { GoogleGenAI } from "@google/genai";

export interface GradingCriteria {
  score: number;
  feedback: string;
}

export interface EssayError {
  original: string;
  correction: string;
  explanation: string;
  type: 'grammar' | 'spelling' | 'vocabulary' | 'punctuation';
}

export interface GradingResult {
  task_achievement: GradingCriteria;
  grammar: GradingCriteria;
  vocabulary: GradingCriteria;
  coherence: GradingCriteria;
  spelling: GradingCriteria;
  total: number;
  demonstrated_cefr: string;
  cefr_comment: string;
  overall: string;
  skills_to_practise: string[];
  topics_to_study: string[];
  improved_essay: string;
  identified_errors: EssayError[];
}

export async function gradeEssay(
  essay: string,
  targetLevel: string,
  apiKey: string,
  topic?: string
): Promise<GradingResult> {
  const ai = new GoogleGenAI({ apiKey });
  
  const systemInstruction = `You are a certified English writing examiner using the Common European Framework of Reference (CEFR) and Cambridge English Qualifications (YLE).
Grade the student essay on a scale of 10 using EXACTLY these 5 criteria (each scored out of 2.0):
1. Task Achievement — Does the essay fully address the topic/task?
2. Grammar — Grammatical range and accuracy appropriate for level ${targetLevel}
3. Vocabulary — Lexical resource: range, precision, appropriacy for level ${targetLevel}
4. Coherence & Cohesion — Organisation, paragraphing, use of linking devices
5. Spelling & Mechanics — Spelling accuracy and punctuation

Note for levels:
- Starters: Pre-A1 level, focus on basic words and very simple sentences.
- Movers: A1 level, focus on basic descriptions and simple connectors.
- Flyers: A2 level, focus on more detailed descriptions and past/future tenses.
- Slogan of the center: "Xây nền từ móng, chinh phục đỉnh cao"

Grading principle: 
1. Adjust expectations strictly to the stated level (${targetLevel}).
2. The "cefr_comment" should be professional yet encouraging. Start with a compliment on what the student did well, then gently point out the main areas for improvement (linking to why they got that specific level), and end with an encouraging remark.

IMPORTANT: You must identify specific errors in the student paper for the "identified_errors" field. For each error, provide the EXACT text from the student paper.

Return ONLY valid JSON:
{
  "task_achievement": { "score": number, "feedback": "Vietnamese" },
  "grammar": { "score": number, "feedback": "Vietnamese" },
  "vocabulary": { "score": number, "feedback": "Vietnamese" },
  "coherence": { "score": number, "feedback": "Vietnamese" },
  "spelling": { "score": number, "feedback": "Vietnamese" },
  "total": number,
  "demonstrated_cefr": "Starters|Movers|Flyers|A1|A2|B1|B2|C1",
  "cefr_comment": "Vietnamese short evaluation",
  "overall": "Vietnamese overview",
  "skills_to_practise": ["Skill 1", "Skill 2"],
  "topics_to_study": ["Topic 1", "Topic 2"],
  "improved_essay": "Full improved essay in English",
  "identified_errors": [
    {
      "original": "substring from essay",
      "correction": "corrected substring",
      "explanation": "Vietnamese explanation",
      "type": "grammar|spelling|vocabulary|punctuation"
    }
  ]
} (Note: identified_errors can be empty if no errors are found)`;

  const prompt = `Topic/Task: ${topic || "Not specified"}
Target CEFR Level: ${targetLevel}
Student Essay:
${essay}`;

  const models = [
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-flash"
  ];

  let lastError = null;

  for (const modelName of models) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `${systemInstruction}\n\n${prompt}`,
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      const cleanJson = text.replace(/```json|```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (err) {
      console.warn(`Model ${modelName} failed, trying next...`, err);
      lastError = err;
    }
  }

  throw lastError || new Error("Tất cả các model AI đều gặp lỗi. Vui lòng kiểm tra API key hoặc thử lại sau.");
}
