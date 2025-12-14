import { GoogleGenAI, Chat, Schema, Type, Modality } from "@google/genai";
import { SCREENING_SYSTEM_PROMPT, CONSULTANT_SYSTEM_PROMPT } from "../constants";
import { UserProfile } from "../types";

const apiKey = process.env.API_KEY || '';

// Initialize client only if key is present (handled in UI if missing)
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Schema for the Analysis Step
const profileSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    strategy: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        suggestedAreas: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              level: { type: Type.STRING },
              justification: { type: Type.STRING },
              matchScore: { type: Type.INTEGER, description: "Score from 0 to 100" }, 
              risks: { type: Type.STRING },
              nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
        shortTermGoal: { type: Type.STRING },
        midTermGoal: { type: Type.STRING },
      },
    },
    skillsAndGaps: {
      type: Type.OBJECT,
      properties: {
        strengths: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['hard', 'soft'] },
              level: { type: Type.STRING },
              evidence: { type: Type.STRING },
            },
          },
        },
        weaknesses: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['hard', 'soft'] },
              level: { type: Type.STRING },
              evidence: { type: Type.STRING },
            },
          },
        },
        inferredGaps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              skillName: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['hard', 'soft'] },
              priority: { type: Type.STRING, enum: ['Alta', 'Média', 'Baixa'] },
              impact: { type: Type.STRING },
              suggestion: { type: Type.STRING },
            },
          },
        },
      },
    },
    pdi: {
      type: Type.OBJECT,
      properties: {
        executiveSummary: { type: Type.STRING },
        axes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              axisName: { type: Type.STRING },
              objectives: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    description: { type: Type.STRING },
                    deadline: { type: Type.STRING },
                    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    resources: { type: Type.STRING },
                    indicators: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['Alta', 'Média', 'Baixa'] },
                  },
                },
              },
            },
          },
        },
      },
    },
    marketInfo: {
      type: Type.OBJECT,
      properties: {
        demandLevel: { type: Type.STRING },
        salaryRange: { type: Type.STRING },
        targetCompanies: { type: Type.ARRAY, items: { type: Type.STRING } },
        jobTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
        trends: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    },
    resume: {
      type: Type.OBJECT,
      properties: {
        fullName: { type: Type.STRING },
        title: { type: Type.STRING },
        location: { type: Type.STRING },
        contactPlaceholder: { type: Type.STRING },
        summary: { type: Type.STRING },
        education: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              course: { type: Type.STRING },
              institution: { type: Type.STRING },
              period: { type: Type.STRING },
              status: { type: Type.STRING },
            },
          },
        },
        experience: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              role: { type: Type.STRING },
              company: { type: Type.STRING },
              period: { type: Type.STRING },
              highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
        skills: {
          type: Type.OBJECT,
          properties: {
            hard: { type: Type.ARRAY, items: { type: Type.STRING } },
            soft: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
        certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
        languages: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    },
  },
};

export const createScreeningChat = (): Chat | null => {
  if (!ai) return null;
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SCREENING_SYSTEM_PROMPT,
    },
  });
};

export const createConsultantChat = (profile: UserProfile): Chat | null => {
  if (!ai) return null;
  const context = `
  DADOS DO USUÁRIO PARA CONTEXTO:
  ${JSON.stringify(profile, null, 2)}
  `;
  
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: CONSULTANT_SYSTEM_PROMPT + context,
    },
  });
};

export const generateProfileAnalysis = async (chatHistory: string): Promise<UserProfile> => {
  if (!ai) throw new Error("API Key not set");

  const prompt = `
  Analise a seguinte transcrição de entrevista de carreira e gere um perfil estruturado completo.
  O output deve ser estritamente JSON.

  REGRAS CRÍTICAS DE ANÁLISE:
  
  1. SKILLS & GAPS (Inferência Obrigatória):
     - 'strengths' e 'weaknesses': Liste o que o usuário citou explicitamente.
     - 'inferredGaps': NÃO repita apenas o que o usuário disse. Você DEVE analisar a vaga desejada vs perfil atual e inferir o que falta.
       Inclua Hard Skills (ferramentas, techs) e Soft Skills (negociação, liderança) essenciais que o usuário não possui ou não citou.
       Para cada gap, explique o 'impact' (por que isso trava a carreira dele).

  2. PDI (Plano de Desenvolvimento Individual):
     - Seja robusto e detalhado. Não dê dicas genéricas.
     - 'executiveSummary': 3-5 frases com o "plano de ataque" geral.
     - 'axes': Divida o plano em eixos como "Desenvolvimento Técnico", "Comportamental", "Portfólio/Visibilidade", "Empregabilidade".
     - Para cada objetivo dentro dos eixos, defina prazo, ações concretas, recursos (livros, cursos genéricos) e indicadores de sucesso.

  3. ÁREAS SUGERIDAS (Score):
     - 'matchScore' deve ser um NÚMERO INTEIRO entre 0 e 100. (Ex: 85, 90). NÃO use decimais (0.9).

  TRANSCRIÇÃO:
  ${chatHistory}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: profileSchema,
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as UserProfile;
};

export const transcribeUserAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  if (!ai) throw new Error("API Key not set");

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Audio } },
        { text: "Transcreva o áudio fornecido fielmente para o português do Brasil. Retorne apenas o texto transcrito, sem formatação ou comentários adicionais." }
      ]
    }
  });

  return response.text || "";
};

// --- New Features (Grounding & TTS) ---

export const generateMarketReport = async (role: string, location: string): Promise<{ content: string; sources: { title: string; uri: string }[] }> => {
  if (!ai) throw new Error("API Key not set");

  const prompt = `
  Pesquise o mercado de trabalho atual para o cargo de "${role}" em "${location}".
  Foque em:
  1. Faixa salarial atualizada e real (Junior, Pleno, Senior).
  2. Principais empresas contratando neste momento.
  3. Tecnologias ou skills mais pedidas nas descrições de vaga recentes.
  4. Tendência de crescimento para 2024/2025.
  
  Responda com um relatório curto e direto em Markdown.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }] // Enable Google Search Grounding
    }
  });

  const content = response.text || "Não foi possível gerar o relatório.";
  
  // Extract grounding sources if available
  const sources: { title: string; uri: string }[] = [];
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  
  if (groundingChunks) {
    groundingChunks.forEach(chunk => {
      if (chunk.web?.uri) {
        sources.push({
          title: chunk.web.title || chunk.web.uri,
          uri: chunk.web.uri
        });
      }
    });
  }

  return { content, sources };
};

export const extractMarketData = async (text: string): Promise<Partial<UserProfile['marketInfo']>> => {
  if (!ai) throw new Error("API Key not set");
  
  const prompt = `
  Com base no relatório de mercado abaixo, extraia os dados estruturados no formato JSON.
  
  RELATÓRIO:
  ${text}
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      demandLevel: { type: Type.STRING, enum: ['Alta', 'Média', 'Baixa'] },
      salaryRange: { type: Type.STRING },
      targetCompanies: { type: Type.ARRAY, items: { type: Type.STRING } },
      jobTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
      trends: { type: Type.ARRAY, items: { type: Type.STRING } },
    }
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema
    }
  });

  const jsonText = response.text;
  if (!jsonText) return {};
  return JSON.parse(jsonText);
};

export const generateTextToSpeech = async (text: string): Promise<string> => {
  if (!ai) throw new Error("API Key not set");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: { parts: [{ text }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }, // 'Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Failed to generate audio");
  
  return base64Audio;
};