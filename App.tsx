import React, { useState, useRef, useEffect } from 'react';
import { AppStage, Message, UserProfile } from './types';
import ChatWindow from './components/ChatWindow';
import Dashboard from './components/Dashboard';
import { createScreeningChat, createConsultantChat, generateProfileAnalysis, transcribeUserAudio } from './services/geminiService';
import { Chat } from '@google/genai';

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>('intro');
  
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
          const text = await transcribeUserAudio(base64String, audioBlob.type);
          resolve(text);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
  };

  const startScreening = async () => {
    setError(null);
    setStage('screening');
    setIsLoading(true);
    try {
      if (!process.env.API_KEY) {
        throw new Error("API Key is missing. Please configure metadata.json or env.");
      }
      screeningChatRef.current = createScreeningChat();
      if (screeningChatRef.current) {
        // Kickoff
        const response = await screeningChatRef.current.sendMessage({ message: "Olá. Pode iniciar a entrevista." });
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
    if (screeningMessages.length < 3) {
      alert("Precisamos conversar um pouco mais antes de gerar uma análise.");
      return;
    }
    setStage('analyzing');
    setIsLoading(true);
    
    try {
      const historyText = screeningMessages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
      const profile = await generateProfileAnalysis(historyText);
      setUserProfile(profile);
      
      // Initialize consultant chat with new profile
      consultantChatRef.current = createConsultantChat(profile);
      setConsultantMessages([{
        role: 'model',
        text: `Olá! Analisei seu perfil e gerei sua estratégia. Como posso te ajudar agora? Podemos falar sobre seu PDI, vagas ou dúvidas específicas.`,
        timestamp: Date.now()
      }]);
      
      setStage('dashboard');
    } catch (e: any) {
      setError("Falha ao gerar análise: " + e.message);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-9"></path><path d="M14 17H5"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">AI Career Architect</h1>
          <p className="text-slate-600 mb-8">
            Seu consultor de carreira inteligente. Vamos mapear suas habilidades, definir sua estratégia e gerar seu currículo perfeito através de uma conversa simples.
          </p>
          <button
            onClick={startScreening}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg"
          >
            Começar Triagem
          </button>
          {!process.env.API_KEY && (
            <p className="mt-4 text-xs text-red-500 bg-red-50 p-2 rounded">
              Aviso: API_KEY não encontrada. O app não funcionará sem ela.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (stage === 'analyzing') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-800">Analisando seu perfil...</h2>
            <p className="text-slate-500 mt-2">Estamos construindo sua estratégia, mapa de skills e currículo.</p>
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
           <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center no-print">
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">AI</div>
               <h1 className="font-bold text-slate-800 text-lg hidden sm:block">Career Architect</h1>
             </div>
             <button 
               onClick={() => setShowConsultant(!showConsultant)}
               className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
               {showConsultant ? 'Ocultar Consultor' : 'Falar com Consultor'}
             </button>
           </header>
           
           <main className="flex-1 overflow-hidden relative">
             <Dashboard profile={userProfile} />
           </main>
        </div>

        {/* Consultant Sidebar / Overlay */}
        <div className={`
          fixed inset-y-0 right-0 w-full md:w-[400px] bg-white shadow-2xl transform transition-transform duration-300 z-40 border-l border-slate-200 flex flex-col
          ${showConsultant ? 'translate-x-0' : 'translate-x-full'}
          md:relative md:transform-none md:shadow-none ${!showConsultant && 'md:hidden'}
        `}>
           <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
             <h3 className="font-bold text-slate-800 flex items-center gap-2">
               <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
               Consultor Online
             </h3>
             <button onClick={() => setShowConsultant(false)} className="md:hidden text-slate-400 hover:text-slate-600">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
             </button>
           </div>
           <div className="flex-1 overflow-hidden bg-slate-50 p-2 md:p-4">
              <ChatWindow 
                messages={consultantMessages}
                onSendMessage={handleConsultantMessage}
                loading={isLoading}
                placeholder="Pergunte sobre PDI, vagas..."
                onAudioInput={handleAudioInput}
              />
           </div>
        </div>
      </div>
    );
  }

  // Screening View
  return (
    <div className="h-screen bg-slate-50 flex flex-col">
       <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
         <div className="flex items-center gap-2">
           <span className="text-slate-400 text-sm font-mono">ETAPA 1/2</span>
           <h2 className="font-bold text-slate-800">Triagem de Perfil</h2>
         </div>
         <button 
           onClick={finishScreeningAndAnalyze}
           className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
           title="Clique quando sentir que já passou informações suficientes"
         >
           <span>Gerar Análise</span>
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
         </button>
       </header>
       
       <div className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-6 overflow-hidden">
          <ChatWindow 
            messages={screeningMessages}
            onSendMessage={handleScreeningMessage}
            loading={isLoading}
            placeholder="Responda ou fale sobre sua carreira..."
            onAudioInput={handleAudioInput}
          />
       </div>
    </div>
  );
};

export default App;