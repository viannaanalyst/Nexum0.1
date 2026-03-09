import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  User,
  Calendar,
  AlertCircle,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { supabase } from '../../lib/supabase';
import KanbanCardModal from './KanbanCardModal';

// --- Tipos ---
interface Column {
  id: string;
  title: string;
  color: string;
  is_done_column: boolean;
  position: number;
  client_id: string | null;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ChecklistItem {
  id: string;
  card_id: string;
  description: string;
  is_completed: boolean;
  position: number;
}

interface Card {
  id: string;
  column_id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  created_at: string;
  is_blocked: boolean;
  assigned_to?: string;
  client_id?: string;
  position: number;
  parent_id?: string | null;
  tags?: Tag[];
  checklist?: ChecklistItem[]; // Injected for list view
}

const OrganizadorLista = () => {
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(true);

  // Data
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [clientsMap, setClientsMap] = useState<Record<string, string>>({});
  const [membersMap, setMembersMap] = useState<Record<string, { name: string, email: string }>>({});

  // UI State
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientIdFilter, setSelectedClientIdFilter] = useState<string>(''); 
  const [updatingChecklist, setUpdatingChecklist] = useState<string | null>(null);
  const [showClientSelect, setShowClientSelect] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowClientSelect(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showClientSelect) {
      setClientSearchTerm('');
    }
  }, [showClientSelect]);

  useEffect(() => {
    if (selectedCompany) fetchData();
  }, [selectedCompany]);

  const fetchData = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      // 1. Fetch Columns
      const { data: cols } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('position');

      if (cols) {
        setColumns(cols);
        // Collapse 'Concluído' columns by default
        const initialCollapsed: Record<string, boolean> = {};
        cols.forEach(c => {
          if (c.is_done_column) initialCollapsed[c.id] = true;
        });
        setCollapsedColumns(prev => ({ ...initialCollapsed, ...prev }));
      }

      // 2. Fetch Cards
      const { data: crds } = await supabase
        .from('kanban_cards')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('position');

      let fetchedCards = crds || [];

      // 3. Fetch Tags
      if (fetchedCards.length > 0) {
        const { data: tagsData } = await supabase
          .from('kanban_card_tags')
          .select('card_id, kanban_tags(id, name, color)')
          .in('card_id', fetchedCards.map(c => c.id));

        // 4. Fetch Checklists (All items for visible cards)
        const { data: checklistsData } = await supabase
          .from('kanban_checklists')
          .select('*')
          .in('card_id', fetchedCards.map(c => c.id))
          .order('position');

        // Merge Data
        fetchedCards = fetchedCards.map(card => {
          const cardTags = (tagsData || [])
            .filter((t: any) => t.card_id === card.id)
            .map((t: any) => t.kanban_tags);

          const cardChecklist = (checklistsData || [])
            .filter((c: any) => c.card_id === card.id);

          return { ...card, tags: cardTags, checklist: cardChecklist };
        });
      }

      setCards(fetchedCards);

      // 5. Fetch Aux Data
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name')
        .eq('company_id', selectedCompany.id)
        .eq('status', 'active')
        .order('name');

      if (clientsData) {
        setClientsMap(clientsData.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {}));
        
        setSelectedClientIdFilter(current => {
          if (clientsData.length > 0 && (!current || !clientsData.find(c => c.id === current))) {
            return clientsData[0].id; // Select first active client by default
          }
          if (clientsData.length === 0) {
            return '';
          }
          return current;
        });
      }

      const { data: membersData } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('company_id', selectedCompany.id);

      if (membersData && membersData.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', membersData.map(m => m.user_id));

        if (profiles) {
          setMembersMap(profiles.reduce((acc, p) => ({
            ...acc,
            [p.id]: { name: p.full_name || p.email, email: p.email }
          }), {}));
        }
      }

    } catch (error) {
      console.error('Error fetching list data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleColumnCollapse = (colId: string) => {
    setCollapsedColumns(prev => ({ ...prev, [colId]: !prev[colId] }));
  };

  const toggleCardExpansion = (cardId: string) => {
    setExpandedCardId(prev => prev === cardId ? null : cardId);
  };

  const handleToggleChecklist = async (itemId: string, currentStatus: boolean, cardId: string) => {
    setUpdatingChecklist(itemId);

    // Optimistic Update
    setCards(prevCards => prevCards.map(c => {
      if (c.id !== cardId) return c;
      return {
        ...c,
        checklist: c.checklist?.map(item =>
          item.id === itemId ? { ...item, is_completed: !currentStatus } : item
        )
      };
    }));

    try {
      const { error } = await supabase
        .from('kanban_checklists')
        .update({ is_completed: !currentStatus })
        .eq('id', itemId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating checklist:', error);
      // Revert on error
      fetchData();
    } finally {
      setUpdatingChecklist(null);
    }
  };

  // Filter Logic
  const filteredColumns = useMemo(() => {
    return columns
      .filter(col => {
         if (selectedClientIdFilter && selectedClientIdFilter !== 'all') {
             return col.client_id === selectedClientIdFilter || col.client_id === null;
         }
         return col.client_id === null;
      })
      .map(col => {
      const colCards = cards.filter(c => {
        const matchesCol = c.column_id === col.id;
        const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.client_id && clientsMap[c.client_id]?.toLowerCase().includes(searchTerm.toLowerCase()));
        
        // Fix: Ensure we correctly filter by selected client. If 'all' was an option it would be here, 
        // but since we strictly use IDs, we match exactly.
        let matchesClient = !selectedClientIdFilter || selectedClientIdFilter === 'all' || c.client_id === selectedClientIdFilter;

        // If the card doesn't match directly, check if it's a subtask whose parent matches
        if (!matchesClient && c.parent_id) {
          const parent = cards.find(p => p.id === c.parent_id);
          if (parent && parent.client_id === selectedClientIdFilter) {
            matchesClient = true;
          }
        }

        return matchesCol && matchesSearch && matchesClient;
      });
      return { ...col, cards: colCards };
    }); // Restored: Keep all columns, even empty ones, as the user wants to see the full pipeline for the client
  }, [columns, cards, searchTerm, clientsMap, selectedClientIdFilter]);

  const getPriorityBadge = (priority: string) => {
    const config = {
      low: { label: 'Baixa', color: 'bg-blue-500/20 text-blue-400' },
      medium: { label: 'Média', color: 'bg-yellow-500/20 text-yellow-400' },
      high: { label: 'Alta', color: 'bg-orange-500/20 text-orange-400' },
      urgent: { label: 'Urgente', color: 'bg-red-500/20 text-red-400' }
    };
    // @ts-ignore
    const info = config[priority] || config['medium'];
    return <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${info.color}`}>{info.label}</span>;
  };

  const getDueDateStatus = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isLate = date < today;
    const isToday = date.toDateString() === today.toDateString();

    let colorClass = 'text-gray-400';
    if (isLate) colorClass = 'text-red-400 font-bold';
    if (isToday) colorClass = 'text-yellow-400 font-bold';

    return (
      <span className={`flex items-center gap-1 text-xs ${colorClass}`}>
        {isLate && <AlertCircle size={12} />}
        {date.toLocaleDateString('pt-BR')}
      </span>
    );
  };

  if (loading) return <div className="p-8 text-white">Carregando lista...</div>;

  return (
    <div className="p-8 h-full flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <div className="flex-1"></div>
        <div className="flex items-center gap-3">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowClientSelect(!showClientSelect)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary hover:bg-white/10 transition-colors flex items-center justify-between min-w-[200px]"
            >
              <div className="flex items-center gap-2 overflow-hidden mr-3">
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400 shrink-0">
                  {selectedClientIdFilter && clientsMap[selectedClientIdFilter] ? clientsMap[selectedClientIdFilter].charAt(0) : 'C'}
                </div>
                <span className="truncate text-sm font-medium">
                  {selectedClientIdFilter && clientsMap[selectedClientIdFilter] ? clientsMap[selectedClientIdFilter] : 'Selecione um Cliente'}
                </span>
              </div>
              <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform ${showClientSelect ? 'rotate-180' : ''}`} />
            </button>

            {showClientSelect && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-2 border-b border-white/5">
                  <input
                    autoFocus
                    placeholder="Buscar cliente..."
                    value={clientSearchTerm}
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-primary/50 outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
                  {Object.entries(clientsMap)
                    .filter(([, name]) => name.toLowerCase().includes(clientSearchTerm.toLowerCase()))
                    .sort(([, a], [, b]) => a.localeCompare(b))
                    .map(([id, name]) => (
                      <button
                        key={id}
                        onClick={() => {
                          setSelectedClientIdFilter(id);
                          setShowClientSelect(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left ${selectedClientIdFilter === id ? 'bg-primary/10 text-primary' : ''}`}
                      >
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {name.charAt(0)}
                        </div>
                        <span className="truncate flex-1">{name}</span>
                        {selectedClientIdFilter === id && <CheckSquare size={12} className="ml-auto text-primary shrink-0" />}
                      </button>
                    ))}
                  {Object.keys(clientsMap).filter(k => clientsMap[k].toLowerCase().includes(clientSearchTerm.toLowerCase())).length === 0 && (
                    <div className="p-2 text-xs text-center text-gray-500">Nenhum cliente encontrado</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Buscar tarefa ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-primary w-64"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
        {filteredColumns.map(column => (
          <div key={column.id} className="bg-[#0f0f1a] border border-white/10 rounded-xl overflow-hidden">
            {/* Column Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors select-none"
              onClick={() => toggleColumnCollapse(column.id)}
            >
              <div className="flex items-center gap-3">
                {collapsedColumns[column.id] ? <ChevronRight size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: column.is_done_column ? '#10b981' : '#3b82f6' }} />
                <h3 className="font-bold text-white text-lg">{column.title}</h3>
                <span className="bg-white/10 px-2 py-0.5 rounded text-xs text-gray-400">{column.cards.length}</span>
              </div>
            </div>

            {/* Cards Table */}
            {!collapsedColumns[column.id] && (
              <div className="border-t border-white/10">
                {column.cards.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">Nenhuma tarefa nesta etapa.</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5 text-xs uppercase text-gray-500 font-medium">
                      <tr>
                        <th className="px-4 py-3 w-1/3">Tarefa / Cliente</th>
                        <th className="px-4 py-3">Responsável</th>
                        <th className="px-4 py-3">Prioridade</th>
                        <th className="px-4 py-3">Prazo</th>
                        <th className="px-4 py-3">Checklist</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {column.cards.map(card => {
                        const isExpanded = expandedCardId === card.id;
                        const completedChecklist = card.checklist?.filter(i => i.is_completed).length || 0;
                        const totalChecklist = card.checklist?.length || 0;
                        const progress = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

                        return (
                          <React.Fragment key={card.id}>
                            <tr
                              className={`group hover:bg-white/5 transition-colors cursor-pointer ${isExpanded ? 'bg-white/5' : ''}`}
                              onClick={() => toggleCardExpansion(card.id)}
                            >
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="font-medium text-white group-hover:text-primary transition-colors">{card.title}</span>
                                  {card.client_id && (
                                    <span className="text-xs text-gray-500">{clientsMap[card.client_id]}</span>
                                  )}
                                  {card.tags && card.tags.length > 0 && (
                                    <div className="flex gap-1 mt-1">
                                      {card.tags.map(t => (
                                        <span key={t.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} title={t.name} />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {card.assigned_to && membersMap[card.assigned_to] ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                                      {membersMap[card.assigned_to].name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm text-gray-300 truncate max-w-[100px]">
                                      {membersMap[card.assigned_to].name.split(' ')[0]}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-600 text-sm">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {getPriorityBadge(card.priority)}
                              </td>
                              <td className="px-4 py-3">
                                {getDueDateStatus(card.due_date)}
                              </td>
                              <td className="px-4 py-3">
                                {totalChecklist > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-white/10 rounded-full w-20 overflow-hidden">
                                      <div className="h-full bg-green-500" style={{ width: `${progress}%` }} />
                                    </div>
                                    <span className="text-xs text-gray-400">{completedChecklist}/{totalChecklist}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-600">Sem itens</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCardId(card.id);
                                  }}
                                  className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"
                                  title="Abrir detalhes"
                                >
                                  <ExternalLink size={16} />
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Content (Checklist) */}
                            {isExpanded && (
                              <tr className="bg-[#0a0a1a]/50">
                                <td colSpan={6} className="px-4 py-4 border-l-2 border-primary">
                                  <div className="pl-4">
                                    <div className="flex justify-between items-center mb-3">
                                      <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                                        <CheckSquare size={14} className="text-primary" /> Checklist / Definition of Done
                                      </h4>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedCardId(card.id);
                                        }}
                                        className="text-xs text-primary hover:underline"
                                      >
                                        Editar Tarefa Completa
                                      </button>
                                    </div>

                                    {card.checklist && card.checklist.length > 0 ? (
                                      <div className="space-y-2">
                                        {card.checklist.map(item => (
                                          <div
                                            key={item.id}
                                            className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${item.is_completed ? 'bg-green-500/5' : 'hover:bg-white/5'}`}
                                          >
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleChecklist(item.id, item.is_completed, card.id);
                                              }}
                                              disabled={updatingChecklist === item.id}
                                              className={`mt-0.5 transition-colors ${item.is_completed ? 'text-green-500' : 'text-gray-500 hover:text-white'}`}
                                            >
                                              {item.is_completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                            </button>
                                            <span className={`text-sm ${item.is_completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                                              {item.description}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-gray-500 text-sm italic">Nenhum item na checklist.</div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedCardId && (
        <KanbanCardModal
          cardId={selectedCardId}
          onClose={() => {
            setSelectedCardId(null);
            fetchData(); // Refresh data when modal closes
          }}
        />
      )}
    </div>
  );
};

export default OrganizadorLista;
