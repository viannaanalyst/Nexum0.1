import React from 'react';
import { useCompany } from '../../context/CompanyContext';

const Atividades = () => {
  const { selectedCompany } = useCompany();

  return (
    <div className="text-white">
      <h2 className="text-2xl font-bold mb-4">Dashboard de Atividades</h2>
      <p className="text-gray-400 mb-8">Bem-vindo ao painel da empresa {selectedCompany?.name}.</p>
      
      {/* 
        Mocked data removed as requested.
        When real activity data is available, we can display stats here.
      */}
      
      <div className="glass-card p-8 rounded-xl flex flex-col items-center justify-center text-center h-64 border border-white/10">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
           </svg>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Nenhuma atividade recente</h3>
        <p className="text-gray-400 max-w-md">
          Suas atividades e tarefas aparecerão aqui quando você começar a usar o sistema.
        </p>
      </div>
    </div>
  );
};

export default Atividades;
