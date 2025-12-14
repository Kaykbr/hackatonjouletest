import React, { useState, useRef } from 'react';
import { AppStage, Message, UserProfile, PersonalData } from './types';
import ChatWindow from './components/ChatWindow';
import Dashboard from './components/Dashboard';
import PersonalDetailsForm from './components/PersonalDetailsForm';
import { createScreeningChat, createConsultantChat, generateProfileAnalysis, transcribeUserAudio } from './services/geminiService';
import { Chat } from '@google/genai';

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>('intro');
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  
  // API Key State
  const [apiKey, setApiKey] = useState(process.env.API_KEY || '');
  const [tempKey, setTempKey] = useState('');
  
  // Chat States
  const [screeningMessages, setScreeningMessages] = useState<Message[]>([]);
  const [consultantMessages, setConsultantMessages] = useState<Message[]>([]);
  
  // Gemini Chat Instances
  const screeningChatRef = useRef<Chat | null>(null);
  const consultantChatRef = useRef<Chat | null>(null);

  // Data
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sidebar state for Consultant Chat on desktop
  const [showConsultant, setShowConsultant] = useState(false);

  // --- Methods ---

  const handleAudioInput = async (audioBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          // Extracts the base64 part of the data URL (e.g., "data:audio/webm;base64,AAAA...")
          const base64String = (reader.result as string).split(',')[1];
          const text = await transcribeUserAudio(apiKey, base64String, audioBlob.type);
          resolve(text);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
  };

  const handlePersonalDetailsSubmit = (data: PersonalData) => {
    setPersonalData(data);
    startScreening(data.fullName);
  };

  const startScreening = async (userName?: string) => {
    setError(null);
    setStage('screening');
    setIsLoading(true);
    try {
      if (!apiKey) {
        throw new Error("API Key ausente.");
      }
      screeningChatRef.current = createScreeningChat(apiKey);
      if (screeningChatRef.current) {
        // Kickoff
        const initialMsg = userName 
          ? `Olá, meu nome é ${userName}. Vamos começar a triagem rápida.` 
          : "Olá. Pode iniciar a entrevista.";
          
        const response = await screeningChatRef.current.sendMessage({ message: initialMsg });
        const text = response.text || "Olá! Vamos começar?";
        setScreeningMessages([{ role: 'model', text, timestamp: Date.now() }]);
      }
    } catch (e: any) {
      setError(e.message || "Failed to start screening.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleScreeningMessage = async (text: string) => {
    setIsLoading(true);
    const userMsg: Message = { role: 'user', text, timestamp: Date.now() };
    setScreeningMessages(prev => [...prev, userMsg]);

    try {
      if (screeningChatRef.current) {
        const response = await screeningChatRef.current.sendMessage({ message: text });
        const modelMsg: Message = { role: 'model', text: response.text || "...", timestamp: Date.now() };
        setScreeningMessages(prev => [...prev, modelMsg]);
      }
    } catch (e) {
      setError("Erro de comunicação com a IA.");
    } finally {
      setIsLoading(false);
    }
  };

  const finishScreeningAndAnalyze = async () => {
    if (screeningMessages.length < 2) {
      alert("Por favor, responda pelo menos a primeira pergunta antes de gerar.");
      return;
    }
    setStage('analyzing');
    setIsLoading(true);
    
    try {
      const historyText = screeningMessages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
      const profile = await generateProfileAnalysis(apiKey, historyText);
      
      // Merge Pre-screening Personal Data into the AI Generated Resume
      if (personalData) {
        profile.resume = {
          ...profile.resume,
          fullName: personalData.fullName,
          location: personalData.address,
          email: personalData.email,
          phone: personalData.phone,
          linkedin: personalData.linkedin,
          github: personalData.github,
          portfolio: personalData.portfolio,
          contactPlaceholder: `${personalData.email} | ${personalData.phone}`
        };
      }

      setUserProfile(profile);
      
      // Initialize consultant chat with new profile
      consultantChatRef.current = createConsultantChat(apiKey, profile);
      setConsultantMessages([{
        role: 'model',
        text: `Olá! Analisei seu perfil e gerei sua estratégia completa. O que achou do plano? Posso ajudar a refinar o currículo ou treinar para entrevistas.`,
        timestamp: Date.now()
      }]);
      
      setStage('dashboard');
    } catch (e: any) {
      console.error(e);
      alert("Houve um erro ao gerar a análise. Tente novamente ou verifique se respondeu as perguntas. Erro: " + e.message);
      setStage('screening'); // Go back on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsultantMessage = async (text: string) => {
    setIsLoading(true);
    const userMsg: Message = { role: 'user', text, timestamp: Date.now() };
    setConsultantMessages(prev => [...prev, userMsg]);

    try {
      if (consultantChatRef.current) {
        const response = await consultantChatRef.current.sendMessage({ message: text });
        const modelMsg: Message = { role: 'model', text: response.text || "...", timestamp: Date.now() };
        setConsultantMessages(prev => [...prev, modelMsg]);
      }
    } catch (e) {
      setError("Consultor indisponível no momento.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render ---

  if (stage === 'intro') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        
        <div className="bg-white/10 backdrop-blur-lg border border-white/10 rounded-3xl shadow-2xl p-8 md:p-12 max-w-5xl w-full grid md:grid-cols-2 gap-12 relative z-10">
          
          {/* Left: Branding */}
          <div className="flex flex-col justify-center text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-widest w-fit mb-6">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
              Gemini 3.0 Preview
            </div>
            <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight">
              Sua Carreira <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Potencializada</span>
            </h1>
            <p className="text-lg text-slate-300 mb-8 leading-relaxed">
              Use a inteligência artificial mais avançada do Google para construir seu currículo, analisar gaps de mercado e desenhar seu plano de desenvolvimento individual (PDI) com dados reais do Brasil.
            </p>
            
            <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
               <div>
                  <div className="text-2xl font-bold">3 Min</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Triagem</div>
               </div>
               <div>
                  <div className="text-2xl font-bold">CV</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Otimizado ATS</div>
               </div>
               <div>
                  <div className="text-2xl font-bold">Deep</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Market Data</div>
               </div>
            </div>
          </div>

          {/* Right: Action Card */}
          <div className="bg-white rounded-2xl p-8 flex flex-col justify-center shadow-xl">
             <h2 className="text-2xl font-bold text-slate-900 mb-2">Acesso ao Sistema</h2>
             <p className="text-slate-500 text-sm mb-6">Insira sua chave API para desbloquear o modelo Gemini 3.0 Preview.</p>

             {!apiKey ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Google Gemini API Key</label>
                    <input 
                      type="password" 
                      value={tempKey} 
                      onChange={(e) => setTempKey(e.target.value)}
                      className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                      placeholder="Cole sua chave (AIza...)"
                    />
                  </div>
                  
                  <button 
                    onClick={() => setApiKey(tempKey)}
                    disabled={!tempKey}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:shadow-none"
                  >
                    Entrar e Iniciar
                  </button>

                  <p className="text-xs text-center text-slate-400 mt-4">
                    Não tem uma chave? <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-600 font-bold hover:underline">Gerar no Google AI Studio</a>
                  </p>
                </div>
             ) : (
               <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Chave Configurada!</h3>
                  <p className="text-slate-500 text-sm mb-6">Você está pronto para iniciar a triagem.</p>
                  
                  <button
                    onClick={() => setStage('personal-details')}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    Iniciar Triagem
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                  </button>
                  
                  <button onClick={() => setApiKey('')} className="text-xs text-red-400 mt-4 hover:underline">Remover chave</button>
               </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'personal-details') {
    return <PersonalDetailsForm onSubmit={handlePersonalDetailsSubmit} />;
  }

  if (stage === 'analyzing') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-6 animate-fadeIn">
          <div className="relative w-32 h-32">
            <div className="absolute inset-0 border-8 border-slate-200 rounded-full"></div>
            <div className="absolute inset-0 border-8 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-2xl">🧠</span>
            </div>
          </div>
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold text-slate-800">Processando Inteligência</h2>
            <p className="text-slate-500 mt-2">
              O Gemini 3.0 está estruturando seu currículo, consultando salários no Brasil e definindo sua estratégia...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard & Consulting View
  if (stage === 'dashboard' && userProfile) {
    return (
      <div className="h-screen flex flex-col md:flex-row overflow-hidden relative">
        {/* Main Content Area */}
        <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${showConsultant ? 'md:w-2/3 lg:w-3/4' : 'w-full'}`}>
           <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center no-print sticky top-0 z-20">
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-indigo-200 shadow-md">AI</div>
               <div>
                  <h1 className="font-bold text-slate-800 text-lg leading-tight">Career Architect</h1>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Gemini 3.0 Powered</span>
               </div>
             </div>
             <button 
               onClick={() => setShowConsultant(!showConsultant)}
               className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full transition-colors border ${showConsultant ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
             >
               {showConsultant ? 'Fechar Chat' : 'Falar com Consultor'}
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
             </button>
           </header>
           
           <main className="flex-1 overflow-hidden relative">
             <Dashboard profile={userProfile} apiKey={apiKey} />
           </main>
        </div>

        {/* Consultant Sidebar / Overlay */}
        <div className={`
          fixed inset-y-0 right-0 w-full md:w-[400px] bg-white shadow-2xl transform transition-transform duration-300 z-40 border-l border-slate-200 flex flex-col
          ${showConsultant ? 'translate-x-0' : 'translate-x-full'}
          md:relative md:transform-none md:shadow-none ${!showConsultant && 'md:hidden'}
        `}>
           <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
             <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Consultor Online
                </h3>
                <p className="text-xs text-slate-500">Especialista em Carreira & Mercado</p>
             </div>
             <button onClick={() => setShowConsultant(false)} className="md:hidden p-2 bg-white rounded-full text-slate-400 shadow-sm">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
             </button>
           </div>
           <div className="flex-1 overflow-hidden bg-white p-2 md:p-4">
              <ChatWindow 
                messages={consultantMessages}
                onSendMessage={handleConsultantMessage}
                loading={isLoading}
                placeholder="Ex: Como melhorar meu LinkedIn?"
                onAudioInput={async (blob) => await handleAudioInput(blob)}
              />
           </div>
        </div>
      </div>
    );
  }

  // Screening View
  return (
    <div className="h-screen bg-slate-50 flex flex-col">
       <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
         <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 border border-slate-200">2</div>
           <div>
              <h2 className="font-bold text-slate-800 leading-tight">Triagem Rápida</h2>
              <p className="text-xs text-slate-400">Responda as perguntas da IA</p>
           </div>
         </div>
         <button 
           onClick={finishScreeningAndAnalyze}
           className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-green-500/30 flex items-center gap-2 animate-bounce-slight"
           title="Clique aqui assim que a IA disser que terminou"
         >
           <span>Gerar Análise Completa</span>
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
         </button>
       </header>
       
       <div className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-6 overflow-hidden flex flex-col">
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-4 text-sm text-indigo-800 flex items-start gap-2">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <p>A IA fará perguntas estratégicas. Responda de forma sincera e detalhada para que possamos construir a melhor análise de carreira para você.</p>
          </div>
          <div className="flex-1 overflow-hidden relative rounded-2xl border border-slate-200 shadow-sm bg-white">
            <ChatWindow 
                messages={screeningMessages}
                onSendMessage={handleScreeningMessage}
                loading={isLoading}
                placeholder="Digite sua resposta..."
                onAudioInput={async (blob) => await handleAudioInput(blob)}
            />
          </div>
       </div>
    </div>
  );
};

export default App;