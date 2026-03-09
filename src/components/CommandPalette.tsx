import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Calendar, Settings, TrendingUp, Compass, Columns, List, CheckSquare, Clock, PieChart, Users, Receipt, Building, FileText, UserCheck, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Types for Commands
interface Command {
  id: string;
  name: string;
  icon: React.ReactNode;
  group: 'Ações' | 'Navegação' | 'Configurações' | 'Sistema';
  action: () => void;
  shortcut?: string[];
  keywords?: string[];
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Helper macro
  const closeAndRun = (action: () => void) => {
    setIsOpen(false);
    setQuery('');
    action();
  };

  const commands: Command[] = [
    // Ações Rápidas
    {
      id: 'new-task',
      name: 'Nova Tarefa',
      icon: <Plus size={16} className="text-primary" />,
      group: 'Ações',
      shortcut: ['T'],
      keywords: ['criar', 'tarefa', 'card', 'kanban', 'adicionar'],
      action: () => {
        window.dispatchEvent(new CustomEvent('open-new-task'));
      }
    },
    {
      id: 'new-transaction',
      name: 'Novo Lançamento',
      icon: <TrendingUp size={16} className="text-green-400" />,
      group: 'Ações',
      shortcut: ['L'],
      keywords: ['criar', 'receita', 'despesa', 'financeiro', 'dinheiro'],
      action: () => {
        window.dispatchEvent(new CustomEvent('open-new-transaction'));
      }
    },

    // Navegação Principal
    {
      id: 'nav-dashboard',
      name: 'Ir para Atividades',
      icon: <Compass size={16} className="text-blue-400" />,
      group: 'Navegação',
      keywords: ['home', 'inicio', 'painel', 'atividades'],
      action: () => navigate('/atividades')
    },
    {
      id: 'nav-kanban',
      name: 'Ir para Kanban',
      icon: <Columns size={16} className="text-indigo-400" />,
      group: 'Navegação',
      keywords: ['quadro', 'trello', 'organizador', 'tarefas'],
      action: () => navigate('/organizador/kanban')
    },
    {
      id: 'nav-calendar',
      name: 'Ir para Calendário',
      icon: <Calendar size={16} className="text-orange-400" />,
      group: 'Navegação',
      keywords: ['eventos', 'mes', 'agenda', 'calendario'],
      action: () => navigate('/calendario')
    },
    {
      id: 'nav-finances',
      name: 'Ir para Visão Geral Financeira',
      icon: <PieChart size={16} className="text-emerald-400" />,
      group: 'Navegação',
      keywords: ['finanças', 'graficos', 'saldo', 'resumo'],
      action: () => navigate('/financeiro/visao-geral')
    },
    {
      id: 'nav-transactions',
      name: 'Ir para Lançamentos',
      icon: <Receipt size={16} className="text-teal-400" />,
      group: 'Navegação',
      keywords: ['contas', 'extrato', 'financeiro'],
      action: () => navigate('/financeiro/lancamentos')
    },

    // Navegação Organização
    {
      id: 'nav-list',
      name: 'Ir para Lista de Tarefas',
      icon: <List size={16} className="text-violet-400" />,
      group: 'Navegação',
      keywords: ['tabela', 'todas'],
      action: () => navigate('/organizador/lista')
    },
    {
      id: 'nav-history',
      name: 'Ir para Histórico',
      icon: <CheckSquare size={16} className="text-cyan-400" />,
      group: 'Navegação',
      action: () => navigate('/organizador/historico')
    },
    {
      id: 'nav-timeline',
      name: 'Ir para Cronograma',
      icon: <Clock size={16} className="text-fuchsia-400" />,
      group: 'Navegação',
      keywords: ['gantt', 'tempo', 'prazos'],
      action: () => navigate('/organizador/cronograma')
    },

    // Configurações
    {
      id: 'conf-company',
      name: 'Configurações da Empresa',
      icon: <Building size={16} className="text-amber-400" />,
      group: 'Configurações',
      action: () => navigate('/configuracao/empresa')
    },
    {
      id: 'conf-rules',
      name: 'Regras Financeiras',
      icon: <FileText size={16} className="text-rose-400" />,
      group: 'Configurações',
      action: () => navigate('/configuracao/regras-financeiras')
    },
    {
      id: 'conf-clients',
      name: 'Gestão de Clientes',
      icon: <Users size={16} className="text-sky-400" />,
      group: 'Configurações',
      action: () => navigate('/configuracao/clientes')
    },
    {
      id: 'conf-team',
      name: 'Gestão da Equipe',
      icon: <UserCheck size={16} className="text-lime-400" />,
      group: 'Configurações',
      keywords: ['usuarios', 'convites', 'membros'],
      action: () => navigate('/configuracao/equipe')
    },

    // Sistema
    {
      id: 'sys-support',
      name: 'Centro de Suporte',
      icon: <HelpCircle size={16} className="text-pink-400" />,
      group: 'Sistema',
      keywords: ['ajuda', 'ticket', 'duvidas', 'bug'],
      action: () => navigate('/suporte')
    },
    {
      id: 'sys-logout',
      name: 'Sair do Sistema (Logout)',
      icon: <Settings size={16} className="text-gray-400" />,
      group: 'Sistema',
      keywords: ['logout', 'deslogar', 'fechar'],
      action: () => logout()
    }
  ];

  // Filtering System
  const filteredCommands = query
    ? commands.filter(cmd => {
      const searchStr = `${cmd.name} ${cmd.keywords?.join(' ') || ''} ${cmd.group}`.toLowerCase();
      return searchStr.includes(query.toLowerCase());
    })
    : commands;

  // Render Groups Helper
  const groupsToRender = Array.from(new Set(filteredCommands.map(c => c.group)));

  // Global Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle palette: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }

      // Close on Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    const handleOpenEvent = () => {
      setIsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleOpenEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleOpenEvent);
    };
  }, [isOpen]);

  // Focus Input effect
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle Palette Navigation
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        closeAndRun(filteredCommands[selectedIndex].action);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const activeElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4">
      {/* Overlay Escuro com Desfoque */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />

      {/* Container Principal */}
      <div
        className="relative w-full max-w-2xl bg-[#0a0a1a]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_80px_-15px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/5 ring-inset flex flex-col max-h-[70vh]"
      >
        {/* Magic Glow Header Line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        {/* Header de Busca */}
        <div className="flex items-center px-4 py-4 border-b border-white/10 bg-white/[0.02]">
          <Search size={22} className="text-gray-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-lg text-white placeholder-gray-500 font-light"
            placeholder="O que você deseja fazer?"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
          />
          <div className="flex items-center gap-1.5 ml-3">
            <kbd className="px-2 py-1 bg-white/10 border border-white/10 rounded text-[10px] font-semibold text-gray-400 shadow-sm">ESC</kbd>
          </div>
        </div>

        {/* Lista de Comandos */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <Search size={32} className="text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">Nenhum comando encontrado para "{query}"</p>
            </div>
          ) : (
            groupsToRender.map((groupTitle, groupIndex) => {
              const itemsInGroup = filteredCommands.filter(c => c.group === groupTitle);
              return (
                <div key={groupTitle} className={groupIndex > 0 ? "mt-4" : ""}>
                  <div className="px-3 py-1 mb-1 text-[11px] font-semibold text-gray-500 uppercase tracking-widest bg-transparent">
                    {groupTitle}
                  </div>
                  {itemsInGroup.map((cmd) => {
                    const globalIndex = filteredCommands.indexOf(cmd);
                    const isSelected = globalIndex === selectedIndex;

                    return (
                      <button
                        key={cmd.id}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        onClick={() => closeAndRun(cmd.action)}
                        className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 text-left group
                          ${isSelected
                            ? 'bg-primary/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] border border-primary/20'
                            : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200 border border-transparent'
                          }
                        `}
                      >
                        <div className={`p-2 rounded-lg bg-[#0a0a1a] shadow-inner ${isSelected ? 'ring-1 ring-white/10' : ''}`}>
                          {cmd.icon}
                        </div>
                        <span className={`ml-3 text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                          {cmd.name}
                        </span>

                        <div className="ml-auto flex gap-1.5 items-center opacity-70 group-hover:opacity-100 transition-opacity">
                          {cmd.shortcut && cmd.shortcut.map(s => (
                            <kbd key={s} className="px-2 py-1 bg-white/[0.05] border border-white/[0.1] rounded text-[10px] font-semibold text-gray-400 min-w-[24px] text-center uppercase">
                              {s}
                            </kbd>
                          ))}
                          {isSelected && !cmd.shortcut && (
                            <span className="text-[10px] text-primary/80 font-medium px-2 py-1 rounded-md bg-primary/10 border border-primary/20">Enter ↵</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        
        <div className="px-4 py-3 border-t border-white/5 bg-[#0a0a1a] flex items-center justify-between text-[11px] text-gray-500 font-medium">
            <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">↑</kbd> <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">↓</kbd> Navegar</span>
                <span className="flex items-center gap-1.5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">↵</kbd> Confirmar</span>
            </div>
            <span>Nexum Intelligence</span>
        </div>
      </div>
    </div>
  );
}
