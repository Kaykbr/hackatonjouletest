import { GoogleGenAI, Chat, Schema, Type, Modality } from "@google/genai";
import { SCREENING_SYSTEM_PROMPT, CONSULTANT_SYSTEM_PROMPT } from "../constants";
import { UserProfile, JobOpportunity, MarketAnalytics } from "../types";

const MODEL_NAME = 'gemini-3-pro-preview';

// Helper to get AI instance dynamically
const getAI = (apiKey: string) => new GoogleGenAI({ apiKey });

// --- DATA SANITIZATION HELPERS ---
const sanitizeProfile = (data: any): UserProfile => {
  const safeArray = (arr: any) => Array.isArray(arr) ? arr : [];
  const safeObj = (obj: any) => obj || {};
  const safeString = (str: any) => str || "";

  const p = safeObj(data);
  
  // Strategy
  p.strategy = safeObj(p.strategy);
  p.strategy.summary = safeString(p.strategy.summary);
  p.strategy.shortTermGoal = safeString(p.strategy.shortTermGoal);
  p.strategy.midTermGoal = safeString(p.strategy.midTermGoal);
  p.strategy.suggestedAreas = safeArray(p.strategy.suggestedAreas).map((area: any) => ({
      ...area,
      nextSteps: safeArray(area.nextSteps)
  }));

  // Skills
  p.skillsAndGaps = safeObj(p.skillsAndGaps);
  p.skillsAndGaps.strengths = safeArray(p.skillsAndGaps.strengths);
  p.skillsAndGaps.weaknesses = safeArray(p.skillsAndGaps.weaknesses);
  p.skillsAndGaps.inferredGaps = safeArray(p.skillsAndGaps.inferredGaps);

  // PDI
  p.pdi = safeObj(p.pdi);
  p.pdi.executiveSummary = safeString(p.pdi.executiveSummary);
  p.pdi.axes = safeArray(p.pdi.axes).map((axis: any) => ({
      ...axis,
      objectives: safeArray(axis.objectives).map((obj: any) => ({
          ...obj,
          actions: safeArray(obj.actions)
      }))
  }));

  // Resume
  p.resume = safeObj(p.resume);
  p.resume.fullName = safeString(p.resume.fullName);
  p.resume.experience = safeArray(p.resume.experience).map((exp: any) => ({
      ...exp,
      highlights: safeArray(exp.highlights)
  }));
  p.resume.education = safeArray(p.resume.education);
  p.resume.skills = safeObj(p.resume.skills);
  p.resume.skills.hard = safeArray(p.resume.skills.hard);
  p.resume.skills.soft = safeArray(p.resume.skills.soft);
  p.resume.languages = safeArray(p.resume.languages);
  p.resume.certifications = safeArray(p.resume.certifications);
  p.resume.keywords = safeArray(p.resume.keywords);
  
  return p as UserProfile;
};

const sanitizeMarketAnalytics = (data: any): MarketAnalytics => {
  const safeArray = (arr: any) => Array.isArray(arr) ? arr : [];
  const safeObj = (obj: any) => obj || {};
  
  const m = safeObj(data);
  
  m.overview = safeObj(m.overview);
  m.overview.trends = safeArray(m.overview.trends);
  
  m.salary = safeObj(m.salary);
  m.salary.growthProjection = safeArray(m.salary.growthProjection);
  // Ensure salary objects exist
  m.salary.junior = m.salary.junior || { min:0, max:0, avg:0 };
  m.salary.pleno = m.salary.pleno || { min:0, max:0, avg:0 };
  m.salary.senior = m.salary.senior || { min:0, max:0, avg:0 };

  m.topCompanies = safeArray(m.topCompanies);
  m.skillsDemand = safeArray(m.skillsDemand);
  m.insights = safeObj(m.insights);

  return m as MarketAnalytics;
}

// Helper to extract JSON from potentially chatty response
const extractJSON = (text: string): any => {
  if (!text) return null;
  
  // 1. Try parsing plain text
  try {
    return JSON.parse(text);
  } catch (e) {
    // Not plain JSON
  }

  // 2. Try extracting from markdown code block
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      // Block content invalid
    }
  }

  // 3. Try finding first '{' and last '}'
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.substring(start, end + 1));
    } catch (e) {
      // Failed to extract
    }
  }
  
  throw new Error("Falha ao extrair JSON da resposta da IA.");
};

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
              matchScore: { type: Type.INTEGER },
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
              type: { type: Type.STRING },
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
              type: { type: Type.STRING },
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
              type: { type: Type.STRING },
              priority: { type: Type.STRING },
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
                    priority: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      },
    },
    // Initial basic market info placeholder
    marketInfo: {
      type: Type.OBJECT,
      properties: {
        overview: {
           type: Type.OBJECT,
           properties: {
             summary: { type: Type.STRING },
             demandLevel: { type: Type.STRING, enum: ['Alta', 'Média', 'Baixa'] },
             trends: { type: Type.ARRAY, items: { type: Type.STRING } }
           }
        }
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
        seniorityLevel: { type: Type.STRING, enum: ['Estágio', 'Júnior', 'Pleno', 'Sênior', 'Especialista'] },
        education: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              course: { type: Type.STRING },
              institution: { type: Type.STRING },
              period: { type: Type.STRING },
              status: { type: Type.STRING },
              details: { type: Type.STRING },
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
        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    },
  },
};

export const createScreeningChat = (apiKey: string): Chat => {
  const ai = getAI(apiKey);
  return ai.chats.create({
    model: MODEL_NAME,
    config: {
      systemInstruction: SCREENING_SYSTEM_PROMPT,
    },
  });
};

export const createConsultantChat = (apiKey: string, profile: UserProfile): Chat => {
  const ai = getAI(apiKey);
  const context = `
  DADOS DO USUÁRIO PARA CONTEXTO:
  ${JSON.stringify(profile, null, 2)}
  `;
  
  return ai.chats.create({
    model: MODEL_NAME,
    config: {
      systemInstruction: CONSULTANT_SYSTEM_PROMPT + context,
    },
  });
};

export const generateProfileAnalysis = async (apiKey: string, chatHistory: string): Promise<UserProfile> => {
  const ai = getAI(apiKey);

  const prompt = `
  Analise a transcrição e gere um perfil profissional altamente detalhado.
  
  CONTEXTO GEOGRÁFICO: BRASIL.
  Considere tendências, terminologias e padrões do mercado de trabalho BRASILEIRO.
  
  REGRA DE OURO (CURRÍCULO): 
  NUNCA INVENTE EXPERIÊNCIA PROFISSIONAL. Se o usuário não mencionou empregos anteriores, a lista 'experience' deve ser VAZIA ou conter apenas projetos acadêmicos/pessoais explicitamente citados.
  - Para 'seniorityLevel', classifique rigorosamente: 
    * Estágio/Júnior: 0-3 anos ou transição.
    * Pleno: 3-6 anos.
    * Sênior: 6+ anos.
  
  Use o método STAR para os bullets de experiência.
  Para a ESTRATÉGIA e PDI: Seja extremamente específico tecnicamente. Evite clichês genéricos. Dê nomes de certificações reais e tecnologias específicas em alta no Brasil.

  TRANSCRIÇÃO:
  ${chatHistory}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Switched to flash for reliable speed
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: profileSchema,
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  let partial: any;
  try {
     partial = JSON.parse(text);
  } catch(e) {
     partial = extractJSON(text);
  }
  
  const profile = sanitizeProfile(partial);
  
  // Initialize market structure
  profile.marketInfo = {
    overview: { summary: "Carregando...", demandLevel: "Média", trends: [] },
    salary: { junior: {min:0,max:0,avg:0}, pleno: {min:0,max:0,avg:0}, senior: {min:0,max:0,avg:0}, growthProjection: [] },
    topCompanies: [],
    skillsDemand: [],
    insights: { growthPerspective: "", roiCertifications: "", challenges: "" }
  };
  return profile;
};

export const transcribeUserAudio = async (apiKey: string, base64Audio: string, mimeType: string): Promise<string> => {
  const ai = getAI(apiKey);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Use flash for fast transcription
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Audio } },
        { text: "Transcreva o áudio para português." }
      ]
    }
  });

  return response.text || "";
};

// --- Deep Market Analytics ---

export const generateDeepMarketAnalysis = async (apiKey: string, role: string, location: string): Promise<MarketAnalytics> => {
  const ai = getAI(apiKey);

  // FORCE BRAZIL CONTEXT regardless of user input for better trends
  const searchScope = "Brasil"; 

  const schemaStructure = {
      overview: {
        summary: "string (Detelhado panorama do mercado brasileiro para a área)",
        demandLevel: "Alta | Média | Baixa",
        trends: ["string"]
      },
      salary: {
        junior: { min: 0, max: 0, avg: 0 },
        pleno: { min: 0, max: 0, avg: 0 },
        senior: { min: 0, max: 0, avg: 0 },
        growthProjection: [0, 0, 0, 0, 0, 0] // 5 years
      },
      topCompanies: [{ name: "string", vacancies: 0, url: "string" }],
      skillsDemand: [{ name: "string", percentage: 0 }],
      insights: {
        growthPerspective: "string",
        roiCertifications: "string",
        challenges: "string"
      },
      reportHtml: "string (markdown summary of sources)"
  };

  const prompt = `
  Realize uma pesquisa profunda de mercado (Deep Research) para o cargo "${role}".
  ESCOPO GEOGRÁFICO: BRASIL (Ignore cidades específicas, foque no cenário nacional).
  
  Busque em fontes confiáveis (Glassdoor Brasil, LinkedIn Brasil, Robert Half, Tech news BR) para preencher o JSON.
  
  1. SALÁRIOS (R$ Mensal): Encontre faixas reais para o mercado BRASILEIRO.
  2. EMPRESAS: Empresas com forte presença no Brasil contratando.
  3. SKILLS: Tecnologias mais pedidas nas vagas brasileiras.
  
  Retorne EXCLUSIVAMENTE um JSON válido.
  ${JSON.stringify(schemaStructure, null, 2)}
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    }
  });

  const text = response.text || "{}";
  
  try {
    const json = extractJSON(text);
    return sanitizeMarketAnalytics(json);
  } catch (e) {
    console.error("Failed to parse Deep Research JSON", text);
    throw new Error("Falha ao estruturar dados da pesquisa.");
  }
};

export const generateTextToSpeech = async (apiKey: string, text: string): Promise<string> => {
  const ai = getAI(apiKey);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: { parts: [{ text }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Failed to generate audio");
  
  return base64Audio;
};

export const searchJobs = async (apiKey: string, role: string, location: string): Promise<JobOpportunity[]> => {
  const ai = getAI(apiKey);

  const schemaStructure = {
      jobs: [{
        title: "string",
        company: "string",
        location: "string",
        fitScore: 0,
        url: "string"
      }]
  };

  const prompt = `
  Encontre 5 vagas RECENTES para "${role}" no BRASIL (considere vagas Remotas e nas principais capitais).
  Priorize vagas abertas nos últimos 7 dias.
  
  Retorne EXCLUSIVAMENTE um JSON válido.
  ${JSON.stringify(schemaStructure, null, 2)}
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    }
  });

  const text = response.text || "{}";
  
  try {
    const data = extractJSON(text);
    return data.jobs || [];
  } catch (e) {
    console.error("Failed to parse Jobs JSON", text);
    return [];
  }
};