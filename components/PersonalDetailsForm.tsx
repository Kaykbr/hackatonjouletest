import React, { useState } from 'react';
import { PersonalData } from '../types';

interface PersonalDetailsFormProps {
  onSubmit: (data: PersonalData) => void;
}

const PersonalDetailsForm: React.FC<PersonalDetailsFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<PersonalData>({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    linkedin: '',
    github: '',
    portfolio: ''
  });

  const [errors, setErrors] = useState<Partial<PersonalData>>({});

  const validate = (): boolean => {
    const newErrors: Partial<PersonalData> = {};
    let isValid = true;

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Nome completo é obrigatório';
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email)) {
      newErrors.email = 'Email válido é obrigatório';
      isValid = false;
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Localização é obrigatória';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side - Hero */}
        <div className="bg-indigo-600 md:w-1/3 p-8 flex flex-col justify-between text-white">
          <div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-6 backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            <h2 className="text-3xl font-bold mb-4">Vamos começar</h2>
            <p className="text-indigo-100 leading-relaxed">
              Para criar um currículo incrível e personalizado, precisamos de alguns dados básicos. 
              Fique tranquilo, suas informações são usadas apenas nesta sessão.
            </p>
          </div>
          <div className="mt-8">
            <div className="flex items-center gap-3 text-indigo-200 text-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              IA pronta para análise
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="md:w-2/3 p-8 md:p-12">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2">Informações Pessoais</h3>
              <div className="grid md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    className={`w-full p-3 rounded-lg border ${errors.fullName ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'} focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all`}
                    placeholder="Seu nome"
                    value={formData.fullName}
                    onChange={e => setFormData({...formData, fullName: e.target.value})}
                  />
                  {errors.fullName && <span className="text-red-500 text-xs">{errors.fullName}</span>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    className={`w-full p-3 rounded-lg border ${errors.email ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'} focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all`}
                    placeholder="voce@email.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Telefone (Opcional)</label>
                   <input
                    type="tel"
                    className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Onde você mora?</label>
                  <input
                    type="text"
                    className={`w-full p-3 rounded-lg border ${errors.address ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'} focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all`}
                    placeholder="Cidade, Estado (Ex: São Paulo, SP)"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2 pt-4">Presença Online (Opcional)</h3>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn</label>
                   <input
                    type="url"
                    className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="URL do perfil"
                    value={formData.linkedin}
                    onChange={e => setFormData({...formData, linkedin: e.target.value})}
                  />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">GitHub / Behance</label>
                   <input
                    type="url"
                    className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="URL do portfólio"
                    value={formData.github}
                    onChange={e => setFormData({...formData, github: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                   <label className="block text-sm font-medium text-slate-700 mb-1">Site Pessoal / Portfólio</label>
                   <input
                    type="url"
                    className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="https://..."
                    value={formData.portfolio}
                    onChange={e => setFormData({...formData, portfolio: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg transform transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
              >
                <span>Salvar e Continuar</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default PersonalDetailsForm;
