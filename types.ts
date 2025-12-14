export type AppStage = 'intro' | 'screening' | 'analyzing' | 'dashboard';

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
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

export interface ResumeData {
  fullName: string;
  title: string;
  location: string;
  contactPlaceholder: string;
  summary: string;
  education: {
    course: string;
    institution: string;
    period: string;
    status: string;
  }[];
  experience: {
    role: string;
    company: string;
    period: string;
    highlights: string[];
  }[];
  skills: {
    hard: string[];
    soft: string[];
  };
  certifications: string[];
  languages: string[];
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
    weaknesses: Skill[]; // Explicitly cited by user
    inferredGaps: Gap[]; // Inferred by AI based on market
  };
  pdi: {
    executiveSummary: string;
    axes: PDIAxis[];
  };
  marketInfo: {
    demandLevel: 'Alta' | 'Média' | 'Baixa';
    salaryRange: string;
    targetCompanies: string[];
    jobTitles: string[];
    trends: string[];
    marketReport?: {
      content: string;
      sources: { title: string; uri: string }[];
    };
  };
  resume: ResumeData;
}
