import { GoogleGenAI, Type } from "@google/genai";
import { OCRResult, Variation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeQuestionImage(base64Image: string): Promise<OCRResult> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    你是一个专业的全科错题分析助手。请识别图片中的题目内容。
    提取以下信息：
    1. 题目文本 (text)
    2. 选项 (options, 如果是选择题)
    3. 用户的原答案 (userAnswer, 如果能识别出来)
    4. 标准答案 (correctAnswer, 如果能识别出来)
    5. 核心知识点 (knowledgePoint, 例如 "一元二次方程根的判别式")

    请以 JSON 格式返回。
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          userAnswer: { type: Type.STRING },
          correctAnswer: { type: Type.STRING },
          knowledgePoint: { type: Type.STRING },
        },
        required: ["text", "knowledgePoint"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function generateVariations(
  originalText: string,
  knowledgePoint: string
): Promise<Variation[]> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    基于以下原题和知识点，生成 3 道“举一反三”的变式题。
    
    原题：${originalText}
    知识点：${knowledgePoint}

    要求：
    1. 覆盖同一知识点的不同角度或变式。
    2. 难度与原题相当或略有梯度。
    3. 每道题附带正确答案。
    4. 每道题附带解析，解析需侧重“易错点分析”。

    请以 JSON 数组格式返回。
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer: { type: Type.STRING },
            analysis: { type: Type.STRING },
          },
          required: ["text", "answer", "analysis"],
        },
      },
    },
  });

  const variations = JSON.parse(response.text);
  return variations.map((v: any, index: number) => ({
    ...v,
    id: v.id || `var-${Date.now()}-${index}`,
  }));
}
