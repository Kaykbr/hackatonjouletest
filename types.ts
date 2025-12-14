export type AppStage = 'intro' | 'personal-details' | 'screening' | 'analyzing' | 'dashboard';

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface PersonalData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

export interface Skill {
  name: string;
  type: 'hard' | 'soft';
  level: 'Iniciante' | 'Intermediário' | 'Avançado' | 'Especialista';
  evidence?: string; // Why user has this or why it was inferred
}

export interface Gap {
  skillName: string;
  type: 'hard' | 'soft';
  priority: 'Alta' | 'Média' | 'Baixa';
  impact: string; // Explanation of impact on career
  suggestion: string; // Actionable initial step
}

export interface PDIObjective {
  description: string;
  deadline: string;
  actions: string[];
  resources: string;
  indicators: string; // How to measure success
  priority: 'Alta' | 'Média' | 'Baixa';
}

export interface PDIAxis {
  axisName: string; // e.g., "Desenvolvimento Técnico", "Comportamental"
  objectives: PDIObjective[];
}

export interface StrategyArea {
  title: string;
  level: string;
  justification: string;
  matchScore: number; // Integer 0-100
  risks: string;
  nextSteps: string[];
}

export interface JobOpportunity {
  title: string;
  company: string;
  location: string;
  fitScore: number;
  url: string;
}

export interface ResumeData {
  fullName: string;
  title: string;
  location: string;
  contactPlaceholder: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  summary: string;
  seniorityLevel: 'Estágio' | 'Júnior' | 'Pleno' | 'Sênior' | 'Especialista';
  education: {
    course: string;
    institution: string;
    period: string;
    status: string;
    details?: string; // For junior profiles (TCC, etc)
  }[];
  experience: {
    role: string;
    company: string;
    period: string;
    highlights: string[]; // STAR method
  }[];
  skills: {
    hard: string[];
    soft: string[];
  };
  certifications: string[];
  languages: string[];
  keywords: string[]; // ATS keywords
}

export interface MarketAnalytics {
  overview: {
    summary: string;
    demandLevel: 'Alta' | 'Média' | 'Baixa';
    trends: string[];
  };
  salary: {
    junior: { min: number; max: number; avg: number };
    pleno: { min: number; max: number; avg: number };
    senior: { min: number; max: number; avg: number };
    growthProjection: number[]; // 5 years
  };
  topCompanies: {
    name: string;
    vacancies: number;
    url: string;
  }[];
  skillsDemand: {
    name: string;
    percentage: number;
    userHas: boolean;
  }[];
  insights: {
    growthPerspective: string;
    roiCertifications: string;
    challenges: string;
  };
  reportHtml?: string;
}

export interface UserProfile {
  strategy: {
    summary: string;
    suggestedAreas: StrategyArea[];
    shortTermGoal: string;
    midTermGoal: string;
  };
  skillsAndGaps: {
    strengths: Skill[];
    weaknesses: Skill[];
    inferredGaps: Gap[];
  };
  pdi: {
    executiveSummary: string;
    axes: PDIAxis[];
  };
  marketInfo: MarketAnalytics;
  resume: ResumeData;
}
