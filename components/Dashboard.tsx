import React, { useState } from 'react';
import { UserProfile, PDIObjective } from '../types';
import { generateMarketReport, extractMarketData, generateTextToSpeech } from '../services/geminiService';

interface DashboardProps {
  profile: UserProfile;
}

type TabName = 'strategy' | 'skills' | 'market' | 'resume';

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

const Dashboard: React.FC<DashboardProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<TabName>('strategy');
  
  // Market Report State
  const [marketReport, setMarketReport] = useState<{ content: string; sources: { title: string; uri: string }[] } | null>(null);
  const [isSearchingMarket, setIsSearchingMarket] = useState(false);

  // Audio State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  // Local Profile State (to allow updates from Research)
  const [localProfile, setLocalProfile] = useState<UserProfile>(profile);

  const printResume = () => {
    window.print();
  };

  const handleDeepResearch = async () => {
    setIsSearchingMarket(true);
    try {
      const location = localProfile.resume.location || "Brasil";
      const role = localProfile.resume.title || localProfile.strategy.suggestedAreas[0]?.title || "Tecnologia";
      
      // 1. Get Text Report with Sources
      const report = await generateMarketReport(role, location);
      setMarketReport(report);

      // 2. Extract Structured Data to Update Dashboard
      const newData = await extractMarketData(report.content);
      
      // 3. Update Local Profile
      setLocalProfile(prev => ({
        ...prev,
        marketInfo: {
          ...prev.marketInfo,
          ...newData, // Overwrite with fresh data
          marketReport: report // Store report for persistence if needed
        }
      }));

    } catch (e) {
      console.error(e);
      alert("Erro ao pesquisar dados de mercado.");
    } finally {
      setIsSearchingMarket(false);
    }
  };

  const handlePlayPDI = async () => {
    if (isPlayingAudio) return;
    setIsGeneratingAudio(true);
    try {
      const textToRead = localProfile.pdi.executiveSummary;
      if (!textToRead) return;
      
      const base64Audio = await generateTextToSpeech(textToRead);
      
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
      alert("Erro ao reproduzir áudio. Verifique se o navegador suporta Web Audio API.");
      setIsPlayingAudio(false);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const renderPDICard = (obj: PDIObjective, idx: number) => {
    const priorityColor = 
      obj.priority === 'Alta' ? 'border-red-500 bg-red-50' : 
      obj.priority === 'Média' ? 'border-amber-500 bg-amber-50' : 
      'border-blue-500 bg-blue-50';
      
    const badgeColor = 
      obj.priority === 'Alta' ? 'bg-red-100 text-red-700' : 
      obj.priority === 'Média' ? 'bg-amber-100 text-amber-700' : 
      'bg-blue-100 text-blue-700';

    return (
      <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
        <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${obj.priority === 'Alta' ? 'bg-red-500' : obj.priority === 'Média' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
        
        <div className="pl-3">
          <div className="flex justify-between items-start mb-3">
            <h5 className="font-bold text-slate-800 text-base leading-tight pr-8">{obj.description}</h5>
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap ${badgeColor}`}>
              {obj.priority}
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-slate-500 mb-4">
             <div className="flex items-center gap-1.5">
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
               <span className="font-medium">{obj.deadline}</span>
             </div>
             <div className="flex items-center gap-1.5">
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
               <span className="font-medium truncate max-w-[150px]">{obj.indicators}</span>
             </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <h6 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
              Plano de Ação
            </h6>
            <ul className="space-y-1.5">
              {obj.actions.map((act, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-1.5 w-1 h-1 bg-slate-400 rounded-full flex-shrink-0"></span>
                  <span className="leading-snug">{act}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 flex items-start gap-2 text-xs text-slate-500 bg-slate-50/50 p-2 rounded">
             <svg className="w-4 h-4 text-blue-400 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             <span><span className="font-semibold text-slate-700">Recurso:</span> {obj.resources}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'strategy':
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Resumo Estratégico</h3>
              <p className="text-slate-600 leading-relaxed">{localProfile.strategy.summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                <h4 className="font-semibold text-blue-800 mb-2">Curto Prazo (1-2 anos)</h4>
                <p className="text-blue-900">{localProfile.strategy.shortTermGoal}</p>
              </div>
              <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                <h4 className="font-semibold text-indigo-800 mb-2">Médio Prazo (3-5 anos)</h4>
                <p className="text-indigo-900">{localProfile.strategy.midTermGoal}</p>
              </div>
            </div>

            <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">Áreas Sugeridas</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {localProfile.strategy.suggestedAreas.map((area, idx) => (
                <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">{area.title}</h4>
                      <span className="text-sm font-medium text-slate-500 uppercase tracking-wide">{area.level}</span>
                    </div>
                    <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-700 font-bold text-lg">
                      {Math.round(area.matchScore)}%
                    </div>
                  </div>
                  <p className="text-slate-600 mb-4 text-sm">{area.justification}</p>
                  
                  <div className="mb-4">
                    <h5 className="text-xs font-bold text-slate-400 uppercase mb-2">Próximos Passos</h5>
                    <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                      {area.nextSteps.map((step, sIdx) => (
                        <li key={sIdx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                    <h5 className="text-xs font-bold text-red-700 uppercase mb-1">Riscos</h5>
                    <p className="text-xs text-red-800">{area.risks}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'skills':
        return (
          <div className="space-y-8 animate-fadeIn">
            
            {/* Skills Analysis Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Strengths */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-6 bg-green-500 rounded-full"></span>
                  Pontos Fortes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {localProfile.skillsAndGaps.strengths.map((skill, idx) => (
                    <div key={idx} className="group relative">
                      <span className="px-3 py-1.5 bg-green-50 text-green-800 rounded-lg text-sm font-medium border border-green-100 flex items-center gap-2 cursor-help">
                        {skill.name}
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                      </span>
                      {skill.evidence && (
                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                           {skill.evidence}
                         </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Weaknesses */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-6 bg-amber-500 rounded-full"></span>
                  Pontos a Melhorar
                </h3>
                <div className="flex flex-wrap gap-2">
                  {localProfile.skillsAndGaps.weaknesses.length > 0 ? localProfile.skillsAndGaps.weaknesses.map((skill, idx) => (
                    <span key={idx} className="px-3 py-1.5 bg-amber-50 text-amber-800 rounded-lg text-sm font-medium border border-amber-100 flex items-center gap-2">
                       {skill.name}
                    </span>
                  )) : (
                    <p className="text-slate-500 text-sm italic">Nenhum ponto fraco citado explicitamente.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Inferred Gaps Table */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                 <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 Análise de Gaps & Mercado
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Com base nos seus objetivos, identificamos skills essenciais que você não mencionou ou precisa desenvolver.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">Skill Faltante</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Prioridade</th>
                      <th className="px-4 py-3 w-1/3">Impacto</th>
                      <th className="px-4 py-3 w-1/3 rounded-tr-lg">Recomendação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {localProfile.skillsAndGaps.inferredGaps.map((gap, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-800">{gap.skillName}</td>
                        <td className="px-4 py-3 text-xs uppercase text-slate-500">{gap.type}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase tracking-wide ${
                            gap.priority === 'Alta' ? 'bg-red-50 text-red-700 border-red-100' :
                            gap.priority === 'Média' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            'bg-blue-50 text-blue-700 border-blue-100'
                          }`}>
                            {gap.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 leading-snug text-xs">{gap.impact}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium text-xs">{gap.suggestion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* NEW PDI DESIGN */}
            <div className="space-y-6">
               <div className="flex justify-between items-center">
                   <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                     <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-indigo-200 shadow-md">
                       <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                     </span>
                     Plano de Desenvolvimento (PDI)
                   </h3>
                   <button 
                     onClick={handlePlayPDI}
                     disabled={isGeneratingAudio || isPlayingAudio}
                     className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm ${
                       isPlayingAudio 
                       ? 'bg-red-100 text-red-600 hover:bg-red-200 ring-2 ring-red-200' 
                       : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 hover:shadow-lg'
                     } disabled:opacity-50 disabled:cursor-not-allowed`}
                   >
                     {isGeneratingAudio ? (
                       <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Gerando Áudio...
                       </span>
                     ) : isPlayingAudio ? (
                       <span className="flex items-center gap-2">
                          <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>
                          Ouvindo...
                       </span>
                     ) : (
                       <span className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                          Ouvir Resumo
                       </span>
                     )}
                   </button>
               </div>

               {/* Executive Summary Quote */}
               <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-6 rounded-2xl relative">
                  <svg className="absolute top-4 left-4 w-8 h-8 text-indigo-200 -z-0" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H15.017C14.4647 8 14.017 8.44772 14.017 9V11C14.017 11.5523 13.5693 12 13.017 12H12.017V5H16.017C18.2261 5 20.017 6.79086 20.017 9V15C20.017 17.2091 18.2261 19 16.017 19H14.017V21ZM5.0166 21L5.0166 18C5.0166 16.8954 5.91203 16 7.0166 16H10.0166C10.5689 16 11.0166 15.5523 11.0166 15V9C11.0166 8.44772 10.5689 8 10.0166 8H6.0166C5.46432 8 5.0166 8.44772 5.0166 9V11C5.0166 11.5523 4.56889 12 4.0166 12H3.0166V5H7.0166C9.22574 5 11.0166 6.79086 11.0166 9V15C11.0166 17.2091 9.22574 19 7.0166 19H5.0166V21Z" /></svg>
                  <p className="relative z-10 text-indigo-900 font-medium leading-relaxed italic text-center px-4">
                    "{localProfile.pdi.executiveSummary}"
                  </p>
               </div>
               
               {/* PDI AXES */}
               <div className="grid gap-8">
                 {localProfile.pdi.axes.map((axis, idx) => (
                   <div key={idx} className="animate-fadeIn">
                     <h4 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200 flex items-center justify-between">
                       {axis.axisName}
                       <span className="text-xs font-normal text-slate-400 bg-slate-50 px-2 py-1 rounded-full">{axis.objectives.length} objetivos</span>
                     </h4>
                     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {axis.objectives.map((obj, oIdx) => renderPDICard(obj, oIdx))}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        );

      case 'market':
        return (
          <div className="space-y-8 animate-fadeIn">
            {/* Real-time Research Button */}
             <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
               <div className="relative z-10">
                 <h3 className="font-bold text-2xl flex items-center gap-3 mb-2">
                   <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                   Pesquisa Profunda (Deep Research)
                 </h3>
                 <p className="text-blue-100 max-w-lg leading-relaxed">
                   Conecte-se ao Google Search para buscar vagas reais, salários atualizados e tendências do momento. 
                   A IA irá reescrever os dados abaixo com base na pesquisa.
                 </p>
               </div>
               <button 
                 onClick={handleDeepResearch}
                 disabled={isSearchingMarket}
                 className="relative z-10 bg-white text-blue-700 font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-75 disabled:scale-100 flex items-center gap-3 whitespace-nowrap"
               >
                 {isSearchingMarket ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Pesquisando...
                    </>
                 ) : (
                    'Atualizar Dados com Pesquisa Real'
                 )}
               </button>
             </div>

             {/* Live Data Grid */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Demand */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Demanda Atual</span>
                   <div className={`text-4xl font-black mb-1 ${
                     localProfile.marketInfo.demandLevel === 'Alta' ? 'text-green-500' : 
                     localProfile.marketInfo.demandLevel === 'Média' ? 'text-amber-500' : 'text-slate-500'
                   }`}>
                     {localProfile.marketInfo.demandLevel}
                   </div>
                   <p className="text-xs text-slate-400">Nível de procura</p>
                </div>
                
                {/* Salary */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm md:col-span-2 flex flex-col justify-center">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Faixa Salarial Estimada</span>
                   <div className="text-3xl font-bold text-slate-800 tracking-tight">
                     {localProfile.marketInfo.salaryRange}
                   </div>
                   <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                     {marketReport ? (
                       <span className="text-blue-500 font-bold flex items-center gap-1">
                         <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                         Verificado via Deep Research
                       </span>
                     ) : (
                       '*Estimativa IA (Clique em Atualizar para dados reais)'
                     )}
                   </p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Companies */}
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                   <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                   Empresas em Alta
                 </h3>
                 <div className="flex flex-wrap gap-2">
                    {localProfile.marketInfo.targetCompanies.map((company, idx) => (
                      <span key={idx} className="bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200">
                        {company}
                      </span>
                    ))}
                 </div>
               </div>
               
               {/* Trends */}
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                   <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                   Tendências Identificadas
                 </h3>
                 <ul className="space-y-3">
                   {localProfile.marketInfo.trends.map((trend, idx) => (
                     <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                       <span className="mt-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0"></span>
                       {trend}
                     </li>
                   ))}
                 </ul>
               </div>
             </div>

             {/* Research Report Card */}
             {marketReport && (
               <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 animate-fadeIn relative">
                 <h4 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2">
                   Relatório de Pesquisa Completo
                 </h4>
                 <div className="prose prose-slate prose-sm max-w-none text-slate-600">
                   <div dangerouslySetInnerHTML={{ __html: marketReport.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                 </div>
                 
                 {marketReport.sources.length > 0 && (
                   <div className="mt-6 pt-4 border-t border-slate-200">
                     <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">Fontes Utilizadas</h5>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                       {marketReport.sources.map((source, idx) => (
                         <a 
                           key={idx} 
                           href={source.uri} 
                           target="_blank" 
                           rel="noreferrer"
                           className="flex items-center gap-2 text-xs bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 px-3 py-2 rounded-lg transition-colors truncate"
                           title={source.title}
                         >
                           <img src={`https://www.google.com/s2/favicons?domain=${new URL(source.uri).hostname}`} alt="" className="w-4 h-4 opacity-70" />
                           <span className="truncate">{source.title}</span>
                         </a>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
             )}
          </div>
        );

      case 'resume':
        return (
          <div className="animate-fadeIn pb-12">
            <div className="mb-6 flex justify-end no-print">
              <button 
                onClick={printResume}
                className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Imprimir / PDF
              </button>
            </div>

            {/* Resume Page Container - A4-ish proportions */}
            <div className="bg-white w-full max-w-[21cm] mx-auto p-8 md:p-12 shadow-lg print:shadow-none print:p-0 print:max-w-none">
              
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-6 mb-6">
                <h1 className="text-4xl font-bold text-slate-900 uppercase tracking-tight mb-2">{localProfile.resume.fullName}</h1>
                <p className="text-xl text-slate-600 font-medium">{localProfile.resume.title}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                  {localProfile.resume.location && <span>📍 {localProfile.resume.location}</span>}
                  <span>📧 {localProfile.resume.contactPlaceholder}</span>
                </div>
              </div>

              {/* Summary */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-slate-900 uppercase border-b border-slate-200 mb-3 pb-1">Resumo Profissional</h2>
                <p className="text-slate-700 text-sm leading-relaxed text-justify">
                  {localProfile.resume.summary}
                </p>
              </div>

              {/* Experience */}
              {localProfile.resume.experience.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-slate-900 uppercase border-b border-slate-200 mb-4 pb-1">Experiência Profissional</h2>
                  <div className="space-y-5">
                    {localProfile.resume.experience.map((exp, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between items-baseline mb-1">
                          <h3 className="font-bold text-slate-800">{exp.role}</h3>
                          <span className="text-sm text-slate-500 italic">{exp.period}</span>
                        </div>
                        <p className="text-slate-700 font-medium text-sm mb-2">{exp.company}</p>
                        <ul className="list-disc list-outside ml-4 text-sm text-slate-600 space-y-1">
                          {exp.highlights.map((bullet, bIdx) => (
                            <li key={bIdx}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-slate-900 uppercase border-b border-slate-200 mb-4 pb-1">Formação Acadêmica</h2>
                <div className="space-y-3">
                  {localProfile.resume.education.map((edu, idx) => (
                     <div key={idx}>
                       <div className="flex justify-between items-baseline">
                         <h3 className="font-bold text-slate-800 text-sm">{edu.course}</h3>
                         <span className="text-xs text-slate-500">{edu.period}</span>
                       </div>
                       <p className="text-sm text-slate-600">{edu.institution} <span className="text-slate-400 mx-1">•</span> <span className="italic">{edu.status}</span></p>
                     </div>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                   <h2 className="text-lg font-bold text-slate-900 uppercase border-b border-slate-200 mb-3 pb-1">Hard Skills</h2>
                   <div className="flex flex-wrap gap-2">
                     {localProfile.resume.skills.hard.map((skill, idx) => (
                       <span key={idx} className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-700 font-medium">{skill}</span>
                     ))}
                   </div>
                </div>
                <div>
                   <h2 className="text-lg font-bold text-slate-900 uppercase border-b border-slate-200 mb-3 pb-1">Soft Skills</h2>
                   <div className="flex flex-wrap gap-2">
                     {localProfile.resume.skills.soft.map((skill, idx) => (
                       <span key={idx} className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-700 font-medium">{skill}</span>
                     ))}
                   </div>
                </div>
              </div>
              
              {/* Optional Sections */}
               {(localProfile.resume.certifications.length > 0 || localProfile.resume.languages.length > 0) && (
                 <div className="grid grid-cols-2 gap-8">
                    {localProfile.resume.certifications.length > 0 && (
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 uppercase border-b border-slate-200 mb-3 pb-1">Certificações</h2>
                        <ul className="list-disc list-inside text-sm text-slate-600">
                          {localProfile.resume.certifications.map((cert, idx) => <li key={idx}>{cert}</li>)}
                        </ul>
                      </div>
                    )}
                     {localProfile.resume.languages.length > 0 && (
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 uppercase border-b border-slate-200 mb-3 pb-1">Idiomas</h2>
                        <ul className="list-disc list-inside text-sm text-slate-600">
                          {localProfile.resume.languages.map((lang, idx) => <li key={idx}>{lang}</li>)}
                        </ul>
                      </div>
                    )}
                 </div>
               )}

            </div>
          </div>
        );
    }
  };

  const tabs: { id: TabName; label: string }[] = [
    { id: 'strategy', label: 'Estratégia' },
    { id: 'skills', label: 'Skills & PDI' },
    { id: 'market', label: 'Mercado' },
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
                   ? 'border-blue-600 text-blue-600'
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