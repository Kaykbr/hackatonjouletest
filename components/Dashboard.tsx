import React, { useState, useEffect } from 'react';
import { UserProfile, PDIObjective, JobOpportunity } from '../types';
import { generateDeepMarketAnalysis, generateTextToSpeech, searchJobs } from '../services/geminiService';

interface DashboardProps {
  profile: UserProfile;
  apiKey: string;
}

type TabName = 'overview' | 'strategy' | 'skills' | 'market' | 'resume';

// --- Audio Helper Functions (Raw PCM Decoding) ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const Dashboard: React.FC<DashboardProps> = ({ profile, apiKey }) => {
  const [activeTab, setActiveTab] = useState<TabName>('overview');
  
  // Market Report State (Deep Analytics)
  const [localProfile, setLocalProfile] = useState<UserProfile>(profile);
  const [isSearchingMarket, setIsSearchingMarket] = useState(false);

  // Audio State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  // Overview Widgets State
  const [jobs, setJobs] = useState<JobOpportunity[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  
  // Resume State
  const [showResumeDisclaimer, setShowResumeDisclaimer] = useState(true);

  // --- Initial Data Loading ---
  
  useEffect(() => {
    if (activeTab === 'overview' && jobs.length === 0) {
      loadJobs();
    }
  }, [activeTab]);

  const loadJobs = async () => {
    if (!apiKey) return;
    setIsLoadingJobs(true);
    try {
      // Ignore user location for search, default to Brasil as per requirements
      const location = "Brasil"; 
      const role = localProfile.strategy.suggestedAreas[0]?.title || localProfile.resume.title || "Tecnologia";
      const foundJobs = await searchJobs(apiKey, role, location);
      setJobs(foundJobs);
    } catch (e) {
      console.error("Error loading jobs", e);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const handleDeepResearch = async () => {
    if (!apiKey) {
      alert("API Key necessária.");
      return;
    }
    
    setIsSearchingMarket(true);
    try {
      const location = "Brasil"; // Enforce national scope
      const role = localProfile.resume.title || localProfile.strategy.suggestedAreas[0]?.title || "Profissional";
      
      const analysis = await generateDeepMarketAnalysis(apiKey, role, location);
      
      setLocalProfile(prev => ({
        ...prev,
        marketInfo: analysis
      }));

    } catch (e) {
      console.error(e);
      alert("Erro ao realizar pesquisa de mercado.");
    } finally {
      setIsSearchingMarket(false);
    }
  };

  const handlePlayPDI = async () => {
    if(!apiKey) return;

    if (isPlayingAudio) return;
    setIsGeneratingAudio(true);
    try {
      const textToRead = localProfile.pdi.executiveSummary;
      if (!textToRead) return;
      
      const base64Audio = await generateTextToSpeech(apiKey, textToRead);
      
      // Decode and Play
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        audioContext,
        24000,
        1
      );
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = () => setIsPlayingAudio(false);
      source.start();
      setIsPlayingAudio(true);

    } catch (e) {
      console.error(e);
      alert("Erro ao reproduzir áudio.");
      setIsPlayingAudio(false);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const printResume = () => {
    window.print();
  };

  const exportToWord = () => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Resume</title></head><body>";
    const footer = "</body></html>";
    const resumeContent = document.getElementById('resume-content')?.innerHTML;
    
    if (!resumeContent) return;

    const sourceHTML = header + resumeContent + footer;
    
    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = `Curriculo_${localProfile.resume.fullName.replace(/\s+/g, '_')}.doc`;
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
  };

  // --- RENDERERS ---

  // 1. Resume Renderer
  const renderResume = () => {
    const { seniorityLevel } = localProfile.resume;
    
    const experienceData = localProfile.resume.experience?.length > 0 
      ? localProfile.resume.experience 
      : [{ 
          role: "[SEU CARGO AQUI]", 
          company: "[NOME DA EMPRESA]", 
          period: "[MÊS/ANO] - [MÊS/ANO]", 
          highlights: ["Utilize este espaço para descrever suas atividades.", "Foque em resultados e projetos realizados."] 
        }];
    
    const educationData = localProfile.resume.education?.length > 0
      ? localProfile.resume.education
      : [{
          course: "[NOME DO CURSO]",
          institution: "[INSTITUIÇÃO]",
          period: "[ANO INÍCIO] - [ANO FIM]",
          status: "Completo",
          details: "TCC ou Projetos Relevantes"
      }];

    const Header = () => (
      <div className="border-b-2 border-slate-900 pb-6 mb-6">
        <h1 className="text-4xl font-bold text-slate-900 uppercase tracking-tight mb-2">{localProfile.resume.fullName}</h1>
        <p className="text-xl text-slate-600 font-medium">{localProfile.resume.title || "[SEU TÍTULO PROFISSIONAL]"}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
           {localProfile.resume.location && <span>📍 {localProfile.resume.location}</span>}
           {localProfile.resume.phone && <span>📱 {localProfile.resume.phone}</span>}
           {localProfile.resume.email && <span>📧 {localProfile.resume.email}</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-indigo-600">
            {localProfile.resume.linkedin && <a href={localProfile.resume.linkedin} target="_blank" rel="noreferrer" className="hover:underline">LinkedIn</a>}
            {localProfile.resume.github && <a href={localProfile.resume.github} target="_blank" rel="noreferrer" className="hover:underline">GitHub</a>}
            {localProfile.resume.portfolio && <a href={localProfile.resume.portfolio} target="_blank" rel="noreferrer" className="hover:underline">Portfólio</a>}
        </div>
      </div>
    );

    // Default to Template B structure for simplicity in this view, customizable by logic
    return (
        <div id="resume-content" className="bg-white w-full max-w-[21cm] mx-auto p-12 shadow-lg print:shadow-none print:max-w-none print:p-0">
            <Header />
            <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900 uppercase border-b border-slate-200 mb-2">Resumo Profissional</h2>
                <p className="text-slate-700 text-sm leading-relaxed">{localProfile.resume.summary}</p>
            </div>
            
            <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900 uppercase border-b border-slate-200 mb-3">Skills & Tecnologias</h2>
                <div className="flex flex-wrap gap-2">
                   {localProfile.resume.skills?.hard?.map((s, i) => (
                       <span key={i} className="text-sm text-slate-800 bg-slate-100 px-2 py-1 rounded-sm">• {s}</span>
                   ))}
                </div>
            </div>

            <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900 uppercase border-b border-slate-200 mb-4">Experiência Profissional</h2>
                <div className="space-y-6">
                    {experienceData.map((exp, i) => (
                        <div key={i}>
                            <div className="flex justify-between items-baseline mb-1">
                                <h3 className="font-bold text-slate-800 text-base">{exp.role}</h3>
                                <span className="text-sm text-slate-500 font-medium whitespace-nowrap ml-4">{exp.period}</span>
                            </div>
                            <p className="text-indigo-700 font-semibold text-sm mb-2">{exp.company}</p>
                            <ul className="list-disc list-outside ml-4 text-sm text-slate-700 space-y-1">
                                {exp.highlights?.map((h, hi) => <li key={hi} className="leading-snug">{h}</li>)}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mb-6">
                 <h2 className="text-lg font-bold text-slate-900 uppercase border-b border-slate-200 mb-3">Formação Acadêmica</h2>
                 {educationData.map((edu, i) => (
                    <div key={i} className="flex flex-col sm:flex-row justify-between text-sm mb-2">
                        <div>
                            <span className="font-bold text-slate-800">{edu.course}</span>
                            <span className="block text-slate-600">{edu.institution}</span>
                        </div>
                        <span className="text-slate-500 mt-1 sm:mt-0">{edu.period}</span>
                    </div>
                 ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                     <h2 className="text-lg font-bold text-slate-900 uppercase border-b border-slate-200 mb-3">Idiomas</h2>
                     <ul className="text-sm text-slate-700 space-y-1">
                        {localProfile.resume.languages?.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                </div>
                 {localProfile.resume.certifications && localProfile.resume.certifications.length > 0 && (
                     <div>
                         <h2 className="text-lg font-bold text-slate-900 uppercase border-b border-slate-200 mb-3">Certificações</h2>
                         <ul className="text-sm text-slate-700 space-y-1">
                            {localProfile.resume.certifications.slice(0, 4).map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                    </div>
                 )}
            </div>
        </div>
    );
  };

  const renderMarketChart = () => {
    const { junior, pleno, senior } = localProfile.marketInfo.salary;
    const maxVal = Math.max(senior.max, 25000); 
    
    const Bar = ({ label, data, color }: { label: string, data: {min: number, max: number, avg: number}, color: string }) => (
       <div className="mb-6 relative">
          <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
             <span className="uppercase tracking-wider">{label}</span>
             <span className="text-slate-900">Média: R$ {data.avg.toLocaleString('pt-BR')}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-8 relative overflow-hidden">
             {/* Range Bar */}
             <div 
               className={`absolute h-full opacity-20 ${color}`}
               style={{ left: `${(data.min/maxVal)*100}%`, width: `${((data.max - data.min)/maxVal)*100}%` }}
             ></div>
             {/* Average Marker */}
             <div 
               className={`absolute h-full w-1.5 bg-slate-800 z-10 shadow-lg`}
               style={{ left: `${(data.avg/maxVal)*100}%` }}
             ></div>
             {/* Min Marker */}
             <div 
               className={`absolute h-full w-0.5 bg-slate-400 z-0`}
               style={{ left: `${(data.min/maxVal)*100}%` }}
             ></div>
              {/* Max Marker */}
             <div 
               className={`absolute h-full w-0.5 bg-slate-400 z-0`}
               style={{ left: `${(data.max/maxVal)*100}%` }}
             ></div>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span style={{ marginLeft: `${Math.max(0, (data.min/maxVal)*100 - 5)}%` }}>R${data.min}</span>
              <span style={{ marginRight: `${Math.max(0, 100 - ((data.max/maxVal)*100) - 5)}%` }}>R${data.max}</span>
          </div>
       </div>
    );

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                Faixas Salariais (Brasil)
            </h4>
            <Bar label="Júnior" data={junior} color="bg-blue-600" />
            <Bar label="Pleno" data={pleno} color="bg-indigo-600" />
            <Bar label="Sênior" data={senior} color="bg-purple-600" />
            <p className="text-xs text-slate-400 mt-4 text-center">* Dados estimados baseados no mercado nacional.</p>
        </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        const priorityObjective = localProfile.pdi.axes
          .flatMap(axis => axis.objectives)
          .find(obj => obj.priority === 'Alta');

        return (
             <div className="space-y-8 animate-fadeIn">
                 {/* Hero Section */}
                 <div className="relative bg-gradient-to-r from-slate-900 to-indigo-900 rounded-3xl p-8 md:p-10 text-white shadow-2xl overflow-hidden">
                     <div className="relative z-10">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-bold mb-2">Olá, {localProfile.resume.fullName.split(' ')[0]} 👋</h2>
                                <p className="text-indigo-200 text-lg mb-6 max-w-xl">
                                    Sua análise de carreira está pronta. Você está posicionado como <span className="text-white font-bold bg-white/20 px-2 py-0.5 rounded">{localProfile.resume.seniorityLevel}</span>.
                                </p>
                            </div>
                            <div className="hidden md:block text-right">
                                <div className="text-sm text-indigo-300 uppercase tracking-widest font-semibold mb-1">Score de Perfil</div>
                                <div className="text-5xl font-black text-white">85<span className="text-2xl text-indigo-400">/100</span></div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                             <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                                 <div className="text-indigo-300 text-xs font-bold uppercase mb-1">Próximo Nível</div>
                                 <div className="font-bold text-lg">{localProfile.strategy.shortTermGoal}</div>
                             </div>
                             <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                                 <div className="text-indigo-300 text-xs font-bold uppercase mb-1">Foco Principal</div>
                                 <div className="font-bold text-lg">{priorityObjective ? priorityObjective.description : "Desenvolvimento Contínuo"}</div>
                             </div>
                             <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                                 <div className="text-indigo-300 text-xs font-bold uppercase mb-1">Top Skill a Aprender</div>
                                 <div className="font-bold text-lg">{localProfile.skillsAndGaps.inferredGaps[0]?.skillName || "Gestão"}</div>
                             </div>
                        </div>
                     </div>
                     {/* Decorative circles */}
                     <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500 rounded-full opacity-20 blur-3xl"></div>
                     <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-blue-500 rounded-full opacity-20 blur-3xl"></div>
                 </div>
                 
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Market & Jobs Column */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-800">Oportunidades no Brasil</h3>
                            <button onClick={loadJobs} disabled={isLoadingJobs} className="text-sm text-indigo-600 font-bold hover:underline">
                                {isLoadingJobs ? 'Atualizando...' : 'Atualizar Vagas'}
                            </button>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4">
                           {isLoadingJobs ? (
                               [1,2,3,4].map(n => <div key={n} className="h-32 bg-slate-100 rounded-xl animate-pulse"></div>)
                           ) : jobs.length > 0 ? (
                               jobs.slice(0, 4).map((job, i) => (
                                   <a key={i} href={job.url} target="_blank" className="group bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all block">
                                       <div className="flex justify-between items-start mb-2">
                                           <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                               {job.company.substring(0,2).toUpperCase()}
                                           </div>
                                           {job.fitScore > 80 && <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">Alta Compatibilidade</span>}
                                       </div>
                                       <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">{job.title}</h4>
                                       <p className="text-sm text-slate-500 mb-2">{job.company}</p>
                                       <div className="flex items-center gap-2 text-xs text-slate-400">
                                           <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                           {job.location}
                                       </div>
                                   </a>
                               ))
                           ) : (
                               <div className="col-span-2 text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                   <p className="text-slate-500">Nenhuma vaga encontrada no momento.</p>
                               </div>
                           )}
                        </div>
                    </div>

                    {/* Quick Stats Column */}
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold text-slate-800">Resumo de Competências</h3>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-slate-700">Hard Skills</span>
                                        <span className="text-indigo-600 font-bold">{localProfile.skillsAndGaps.strengths.filter(s => s.type?.toLowerCase().includes('hard')).length}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full">
                                        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '70%' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-slate-700">Soft Skills</span>
                                        <span className="text-emerald-600 font-bold">{localProfile.skillsAndGaps.strengths.filter(s => s.type?.toLowerCase().includes('soft')).length}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full">
                                        <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-slate-700">Gaps Críticos</span>
                                        <span className="text-amber-600 font-bold">{localProfile.skillsAndGaps.inferredGaps.filter(g => g.priority === 'Alta').length}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full">
                                        <div className="bg-amber-500 h-2 rounded-full" style={{ width: '40%' }}></div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setActiveTab('skills')} className="w-full mt-6 py-2 text-sm font-bold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                                Ver Mapa Completo
                            </button>
                        </div>
                    </div>
                 </div>
             </div>
        );
      
      case 'strategy':
        return (
          <div className="space-y-10 animate-fadeIn max-w-5xl mx-auto">
             <div className="text-center max-w-2xl mx-auto mb-8">
                <h2 className="text-3xl font-bold text-slate-800 mb-3">Seu Plano Estratégico</h2>
                <p className="text-slate-600 leading-relaxed">{localProfile.strategy.summary}</p>
             </div>

             {/* Visual Roadmap */}
             <div className="relative">
                 {/* Connecting Line */}
                 <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gradient-to-b from-indigo-200 to-slate-200 rounded-full hidden md:block"></div>

                 {/* Short Term */}
                 <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-24 mb-12">
                     <div className="text-right hidden md:block pt-6">
                         <div className="text-indigo-600 font-bold tracking-widest uppercase text-sm mb-2">Fase 1: 6-12 Meses</div>
                         <h3 className="text-2xl font-bold text-slate-800">Objetivo de Curto Prazo</h3>
                     </div>
                     <div className="md:hidden">
                         <div className="text-indigo-600 font-bold tracking-widest uppercase text-sm mb-2">Fase 1: 6-12 Meses</div>
                         <h3 className="text-2xl font-bold text-slate-800 mb-4">Objetivo de Curto Prazo</h3>
                     </div>
                     
                     {/* Center Node */}
                     <div className="absolute left-1/2 top-8 transform -translate-x-1/2 w-6 h-6 bg-indigo-600 border-4 border-white rounded-full shadow-lg hidden md:block"></div>

                     <div className="bg-white p-8 rounded-2xl border border-indigo-100 shadow-lg relative">
                         <div className="absolute top-6 -left-3 w-6 h-6 bg-white transform rotate-45 border-l border-b border-indigo-100 hidden md:block"></div>
                         <p className="text-lg text-slate-700 font-medium leading-relaxed">{localProfile.strategy.shortTermGoal}</p>
                         <div className="mt-4 flex flex-wrap gap-2">
                             {(localProfile.pdi.axes[0]?.objectives || []).slice(0,2).map((obj, i) => (
                                 <span key={i} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100">
                                     🎯 {obj.description.substring(0, 30)}...
                                 </span>
                             ))}
                         </div>
                     </div>
                 </div>

                 {/* Mid Term */}
                 <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-24">
                     <div className="order-2 md:order-1 bg-white p-8 rounded-2xl border border-purple-100 shadow-lg relative">
                         <div className="absolute top-6 -right-3 w-6 h-6 bg-white transform rotate-45 border-r border-t border-purple-100 hidden md:block"></div>
                         <p className="text-lg text-slate-700 font-medium leading-relaxed">{localProfile.strategy.midTermGoal}</p>
                         <div className="mt-4 flex flex-wrap gap-2">
                             <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-bold border border-purple-100">
                                 🚀 Liderança
                             </span>
                             <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-bold border border-purple-100">
                                 💎 Especialização
                             </span>
                         </div>
                     </div>
                     
                     {/* Center Node */}
                     <div className="absolute left-1/2 top-8 transform -translate-x-1/2 w-6 h-6 bg-purple-600 border-4 border-white rounded-full shadow-lg hidden md:block mt-2"></div>

                     <div className="order-1 md:order-2 md:pt-6">
                         <div className="text-purple-600 font-bold tracking-widest uppercase text-sm mb-2">Fase 2: 2-3 Anos</div>
                         <h3 className="text-2xl font-bold text-slate-800">Visão de Médio Prazo</h3>
                     </div>
                 </div>
             </div>

             {/* Career Options Cards */}
             <div className="mt-16">
                 <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
                     Caminhos Sugeridos
                 </h3>
                 <div className="grid md:grid-cols-2 gap-6">
                     {localProfile.strategy.suggestedAreas.map((area, idx) => (
                         <div key={idx} className="bg-slate-50 p-6 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all group">
                             <div className="flex justify-between items-start mb-4">
                                 <h4 className="font-bold text-lg text-slate-900">{area.title}</h4>
                                 <span className="bg-white text-slate-800 text-xs font-bold px-3 py-1 rounded border border-slate-200 shadow-sm">{area.matchScore}% Match</span>
                             </div>
                             <p className="text-sm text-slate-600 mb-4">{area.justification}</p>
                             <div className="space-y-3">
                                 <div>
                                     <span className="text-xs font-bold text-slate-500 uppercase">Riscos</span>
                                     <p className="text-xs text-slate-700">{area.risks}</p>
                                 </div>
                                 <div>
                                     <span className="text-xs font-bold text-slate-500 uppercase">Próximos Passos</span>
                                     <ul className="mt-1 space-y-1">
                                         {area.nextSteps?.slice(0, 2).map((step, sIdx) => (
                                             <li key={sIdx} className="text-xs text-indigo-700 flex items-center gap-2">
                                                 <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                                 {step}
                                             </li>
                                         ))}
                                     </ul>
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
          </div>
        );

      case 'skills':
        return (
          <div className="space-y-8 animate-fadeIn">
             <div className="flex flex-col md:flex-row gap-8">
                {/* Left Column: Skills Inventory */}
                <div className="flex-1 space-y-8">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">💪</span>
                            Fortalezas
                        </h3>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex flex-wrap gap-3">
                                {localProfile.skillsAndGaps.strengths.map((s, i) => (
                                    <div key={i} className="flex flex-col bg-slate-50 border border-slate-100 rounded-lg px-4 py-2 min-w-[120px]">
                                        <span className="font-bold text-slate-800 text-sm">{s.name}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${s.level === 'Especialista' ? 'bg-green-500 w-full' : s.level === 'Avançado' ? 'bg-green-400 w-3/4' : 'bg-green-300 w-1/2'}`}></div>
                                            </div>
                                            <span className="text-[10px] text-slate-500 uppercase">{s.level}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">🚧</span>
                            Pontos de Atenção (Gaps)
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            {localProfile.skillsAndGaps.inferredGaps.map((g, i) => (
                                <div key={i} className="bg-white p-5 rounded-xl border-l-4 border-amber-400 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-slate-800">{g.skillName}</h4>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${g.priority === 'Alta' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>Prioridade {g.priority}</span>
                                        </div>
                                        <p className="text-sm text-slate-600">{g.impact}</p>
                                    </div>
                                    <div className="bg-slate-50 px-4 py-2 rounded-lg text-xs text-slate-700 max-w-xs border border-slate-100">
                                        <strong>Sugestão:</strong> {g.suggestion}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: PDI */}
                <div className="md:w-[400px] flex flex-col h-full">
                    <div className="bg-indigo-900 text-white p-6 rounded-t-2xl flex justify-between items-center">
                        <h3 className="text-lg font-bold">Plano de Ação (PDI)</h3>
                        <button 
                            onClick={handlePlayPDI}
                            className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                            title="Ouvir Resumo"
                        >
                            {isGeneratingAudio ? <span className="animate-spin block">⏳</span> : isPlayingAudio ? '🔊' : '🎧'}
                        </button>
                    </div>
                    <div className="bg-white border-x border-b border-slate-200 rounded-b-2xl p-6 flex-1 space-y-6">
                        {localProfile.pdi.axes.map((axis, i) => (
                            <div key={i}>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{axis.axisName}</h4>
                                <div className="space-y-4">
                                    {axis.objectives.map((obj, j) => (
                                        <div key={j} className="relative pl-6 pb-2 border-l-2 border-slate-100 last:border-0">
                                            <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${obj.priority === 'Alta' ? 'bg-red-500 shadow-red-200 shadow' : 'bg-indigo-400'}`}></div>
                                            <p className="text-sm font-bold text-slate-800 leading-tight mb-1">{obj.description}</p>
                                            <p className="text-xs text-slate-500 mb-2">Prazo: {obj.deadline}</p>
                                            <ul className="space-y-1">
                                                {obj.actions.map((act, k) => (
                                                    <li key={k} className="flex items-start gap-2 text-xs text-slate-600">
                                                        <input type="checkbox" className="mt-0.5 rounded text-indigo-600 focus:ring-0" />
                                                        <span className="flex-1">{act}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
             </div>
          </div>
        );

      case 'market':
        // Calculate max projection safely for chart scaling
        const growthProj = localProfile.marketInfo.salary.growthProjection || [];
        const maxProjection = Math.max(...growthProj, 1);

        return (
          <div className="space-y-8 animate-fadeIn">
            {/* Deep Research Header */}
            <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
               <div>
                 <h3 className="font-bold text-2xl mb-2">Análise Profunda de Mercado</h3>
                 <p className="text-slate-300 max-w-lg">
                   Dados em tempo real sobre salários, demanda e empresas contratando para {localProfile.resume.title} no Brasil.
                 </p>
               </div>
               <button 
                 onClick={handleDeepResearch}
                 disabled={isSearchingMarket}
                 className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-8 py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
               >
                 {isSearchingMarket ? 'Pesquisando...' : 'Atualizar Dados Agora'}
               </button>
            </div>

            {/* 1. Overview */}
            <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
                    <h4 className="font-bold text-slate-800 mb-2">Panorama Geral</h4>
                    <p className="text-slate-600 leading-relaxed">{localProfile.marketInfo.overview.summary}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                    <span className="text-sm font-bold text-slate-400 uppercase">Demanda</span>
                    <span className={`text-4xl font-black my-2 ${localProfile.marketInfo.overview.demandLevel === 'Alta' ? 'text-green-500' : 'text-amber-500'}`}>
                        {localProfile.marketInfo.overview.demandLevel}
                    </span>
                </div>
            </div>

            {/* 2. Salary Analysis */}
            <div className="grid md:grid-cols-2 gap-6">
                {renderMarketChart()}
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-slate-800 mb-6">Projeção de Crescimento (5 Anos)</h4>
                    {/* Updated CSS Line Chart with Visible Labels */}
                    <div className="h-56 flex items-end justify-between gap-2 px-2 border-b border-slate-100 pb-4">
                        {growthProj.length > 0 ? growthProj.map((val, i) => (
                            <div key={i} className="flex flex-col items-center flex-1 h-full justify-end">
                                <div className="mb-1 text-[10px] font-bold text-slate-600">
                                    {val > 0 ? (val >= 1000 ? `${(val/1000).toFixed(1)}k` : val) : ''}
                                </div>
                                <div 
                                    className="w-full bg-emerald-400 rounded-t-sm transition-all duration-700 ease-out hover:bg-emerald-500 relative group" 
                                    style={{ height: `${val > 0 ? (val / maxProjection) * 100 : 2}%` }}
                                >
                                   {/* Tooltip for exact value on hover */}
                                   <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs rounded py-1 px-2 pointer-events-none whitespace-nowrap z-10">
                                     R$ {val.toLocaleString('pt-BR')}
                                   </div>
                                </div>
                                <span className="text-[10px] text-slate-400 mt-2 font-medium">Ano {i+1}</span>
                            </div>
                        )) : (
                             <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs italic">
                                 Sem dados de projeção disponíveis
                             </div>
                        )}
                    </div>
                    <p className="text-xs text-slate-400 mt-4 text-center">Tendência estimada de vagas/salários.</p>
                </div>
            </div>

            {/* 3. Companies & 4. Skills */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-slate-800 mb-4">Top Empresas Contratando</h4>
                    <div className="space-y-3">
                        {localProfile.marketInfo.topCompanies?.map((comp, i) => (
                            <div key={i} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-all">
                                <div>
                                    <h5 className="font-bold text-slate-800">{comp.name}</h5>
                                    <a href={comp.url} target="_blank" className="text-xs text-indigo-600 hover:underline">Ver vagas ({comp.vacancies})</a>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-slate-800 mb-4">Skills em Alta</h4>
                    <div className="space-y-4">
                        {localProfile.marketInfo.skillsDemand?.map((skill, i) => (
                            <div key={i}>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="font-semibold text-slate-700">
                                        {skill.name}
                                        {skill.userHas && <span className="ml-2 text-green-600 font-bold text-[10px]">✓ VOCÊ TEM</span>}
                                    </span>
                                    <span className="text-slate-500">{skill.percentage}% demanda</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full ${skill.userHas ? 'bg-green-500' : 'bg-slate-400'}`} 
                                      style={{ width: `${skill.percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 5. Insights */}
            <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                    <h5 className="font-bold text-indigo-800 mb-2 text-sm uppercase">Perspectiva</h5>
                    <p className="text-sm text-indigo-900">{localProfile.marketInfo.insights.growthPerspective}</p>
                </div>
                <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100">
                    <h5 className="font-bold text-emerald-800 mb-2 text-sm uppercase">Melhor ROI</h5>
                    <p className="text-sm text-emerald-900">{localProfile.marketInfo.insights.roiCertifications}</p>
                </div>
                <div className="bg-amber-50 p-6 rounded-xl border border-amber-100">
                    <h5 className="font-bold text-amber-800 mb-2 text-sm uppercase">Desafios</h5>
                    <p className="text-sm text-amber-900">{localProfile.marketInfo.insights.challenges}</p>
                </div>
            </div>
          </div>
        );

      case 'resume':
        return (
          <div className="animate-fadeIn pb-12 relative">
            {showResumeDisclaimer && (
                <div className="absolute inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full border-l-4 border-amber-500">
                        <div className="flex items-start gap-4">
                            <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 mb-2">Atenção: Este é um rascunho</h3>
                                <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                                    Este currículo foi gerado por IA com base na nossa conversa. 
                                    É fundamental que você <strong>leia, revise e edite</strong> as datas, nomes de empresas e detalhes específicos.
                                    <br/><br/>
                                    Adicionamos textos de exemplo (ex: [Nome da Empresa]) onde faltaram informações.
                                </p>
                                <button 
                                  onClick={() => setShowResumeDisclaimer(false)}
                                  className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800"
                                >
                                    Entendi, vou revisar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-6 flex justify-between items-center no-print bg-slate-200 p-4 rounded-xl">
              <span className="text-sm font-bold text-slate-600">Formato: {localProfile.resume.seniorityLevel}</span>
              <div className="flex gap-2">
                <button 
                    onClick={exportToWord}
                    className="flex items-center gap-2 bg-white text-blue-700 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors font-medium text-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Baixar Word (.doc)
                </button>
                <button 
                    onClick={printResume}
                    className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors font-medium text-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    Salvar PDF
                </button>
              </div>
            </div>
            {renderResume()}
          </div>
        );
        
      default:
         return (
             <div className="flex items-center justify-center h-64 text-slate-500">
                 Carregando aba...
             </div>
         );
    }
  };

  const tabs: { id: TabName; label: string }[] = [
    { id: 'overview', label: 'Início' },
    { id: 'strategy', label: 'Estratégia' },
    { id: 'skills', label: 'Skills & PDI' },
    { id: 'market', label: 'Mercado (Deep)' },
    { id: 'resume', label: 'Currículo' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-4 md:px-8 pt-4 sticky top-0 z-10 no-print">
         <div className="flex space-x-1 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
           {tabs.map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id)}
               className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                 activeTab === tab.id
                   ? 'border-indigo-600 text-indigo-600'
                   : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
               }`}
             >
               {tab.label}
             </button>
           ))}
         </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
