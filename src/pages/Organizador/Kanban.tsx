import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  rectIntersection,
  pointerWithin,
  getFirstCollision
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy
} from '@dnd-kit/sortable';
import {
  Plus,
  MoreHorizontal,
  Calendar,
  CheckSquare,
  Lock,
  AlertCircle,
  Filter,
  User,
  Trash2,
  X,
  GitBranch,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Pencil,
  ArrowLeftRight
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { supabase } from '../../lib/supabase';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import KanbanCardModal from './KanbanCardModal';
import { useUI } from '../../context/UIContext';
import { Select } from '../../components/ui/Select';


// --- Tipos ---
interface Column {
  id: string;
  title: string;
  color: string;
  is_done_column: boolean;
  position: number;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Card {
  id: string;
  column_id: string;
  title: string;
  description: string;
  position: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  due_date?: string;
  delivery_date?: string;
  start_date?: string;
  client_id?: string;
  is_blocked: boolean;
  parent_id?: string;
  tags?: Tag[];
}

// ... existing interfaces ...

// --- Componente Principal ---
const OrganizadorKanban = () => {
  const { alert, confirm, toast } = useUI();
  const { selectedCompany } = useCompany();
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | { id: string; columnId?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Client Filter State
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');

  // Auxiliary Data Maps
  const [clientsMap, setClientsMap] = useState<Record<string, string>>({});
  const [membersMap, setMembersMap] = useState<Record<string, { name: string; avatar_url?: string }>>({});

  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [isNewColumnModalOpen, setIsNewColumnModalOpen] = useState(false);
  const [editColumnTitle, setEditColumnTitle] = useState('');
  const [editColumnColor, setEditColumnColor] = useState('#3b82f6');
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [isEditColumnModalOpen, setIsEditColumnModalOpen] = useState(false);

  // Permissions
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isApprover, setIsApprover] = useState(false);

  // Mapa de contagem de subtarefas por pai (global)
  const subtasksMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    cards.forEach(c => {
      if (c.parent_id) {
        map[c.parent_id] = (map[c.parent_id] || 0) + 1;
      }
    });
    return map;
  }, [cards]);

  // Estado para controlar quais cards estão expandidos (mostrando subtarefas)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleCardExpanded = (cardId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  // Sensores para Drag and Drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    // Load saved client filter
    const savedClient = localStorage.getItem('kanban_selected_client');
    if (savedClient) {
      setSelectedClient(savedClient);
    }
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      fetchKanbanData();
      fetchUserPermissions();
    }
  }, [selectedCompany, selectedClient]);

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId);
    if (clientId) {
      localStorage.setItem('kanban_selected_client', clientId);
    } else {
      localStorage.removeItem('kanban_selected_client');
    }
  };

  const fetchUserPermissions = async () => {
    if (!selectedCompany) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('organization_members')
          .select('role, is_approver')
          .eq('user_id', user.id)
          .eq('company_id', selectedCompany.id)
          .single();

        if (data) {
          setUserRole(data.role);
          setIsApprover(data.is_approver || false);
        }
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  useEffect(() => {
    const handleGlobalNewTask = () => {
      if (columns.length > 0) {
        handleAddCard(columns[0].id);
      }
    };

    const handleGlobalNewColumn = () => {
      setIsNewColumnModalOpen(true);
    };

    window.addEventListener('open-new-task', handleGlobalNewTask);
    window.addEventListener('open-new-column', handleGlobalNewColumn);
    return () => {
      window.removeEventListener('open-new-task', handleGlobalNewTask);
      window.removeEventListener('open-new-column', handleGlobalNewColumn);
    };
  }, [columns]);

  const fetchKanbanData = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      // 1. Fetch Auxiliary Data (Clients and Members) - MOVE TO TOP
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name')
        .eq('company_id', selectedCompany.id)
        .eq('status', 'active')
        .order('name');

      let currentClient = selectedClient;

      if (clientsData) {
        setClients(clientsData);
        if (!selectedClient && clientsData.length > 0) {
          currentClient = clientsData[0].id;
          setSelectedClient(currentClient);
          localStorage.setItem('kanban_selected_client', currentClient);
        }
        const clientMap = clientsData.reduce((acc, client) => ({ ...acc, [client.id]: client.name }), {});
        setClientsMap(clientMap);
      }

      // 2. Fetch Columns using currentClient
      let colQuery = supabase
        .from('kanban_columns')
        .select('*')
        .eq('company_id', selectedCompany.id);

      if (currentClient) {
        colQuery = colQuery.eq('client_id', currentClient);
      } else {
        colQuery = colQuery.is('client_id', null);
      }

      const { data: cols } = await colQuery.order('position');

      // 3. Fetch Cards using currentClient
      let cardQuery = supabase
        .from('kanban_cards')
        .select('*')
        .eq('company_id', selectedCompany.id);

      if (currentClient) {
        cardQuery = cardQuery.eq('client_id', currentClient);
      }

      const { data: crds } = await cardQuery.order('position');

      if (cols && cols.length > 0) {
        setColumns(cols);
      } else {
        setColumns([]);
      }

      setCards(crds || []);

      // 4. Fetch Tags for Cards
      const { data: tagsData } = await supabase
        .from('kanban_card_tags')
        .select('card_id, kanban_tags(id, name, color)')
        .in('card_id', crds?.map(c => c.id) || []);

      setCards(prevCards => prevCards.map(card => {
        const cardTags = (tagsData || [])
          .filter((t: any) => t.card_id === card.id)
          .map((t: any) => t.kanban_tags);
        return { ...card, tags: cardTags };
      }));

      const { data: membersData } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('company_id', selectedCompany.id);

      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', userIds);

        if (profilesData) {
          const memberMap = profilesData.reduce((acc, profile) => ({
            ...acc,
            [profile.id]: {
              name: profile.full_name || profile.email,
              avatar_url: profile.avatar_url
            }
          }), {});
          setMembersMap(memberMap);
        }
      }

    } catch (error) {
      console.error('Error fetching kanban:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateColumn = async () => {
    if (!newColumnTitle.trim() || !selectedCompany) return;

    try {
      const { error } = await supabase.from('kanban_columns').insert({
        company_id: selectedCompany.id,
        client_id: selectedClient || null,
        title: newColumnTitle,
        position: columns.length,
        color: 'gray'
      });

      if (error) throw error;

      // Audit Log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('audit_logs').insert({
          company_id: selectedCompany.id,
          user_id: user.id,
          action_type: 'create',
          entity_type: 'column',
          entity_id: null,
          details: { title: newColumnTitle }
        });
      }

      setNewColumnTitle('');
      setIsNewColumnModalOpen(false);
      fetchKanbanData();
    } catch (error) {
      console.error('Error creating column:', error);
      toast.error('Erro ao criar coluna');
    }
  };

  const handleUpdateColumn = async () => {
    if (!editColumnTitle.trim() || !editingColumn) return;

    try {
      const { error } = await supabase
        .from('kanban_columns')
        .update({ title: editColumnTitle, color: editColumnColor })
        .eq('id', editingColumn.id);

      if (error) throw error;

      setIsEditColumnModalOpen(false);
      setEditingColumn(null);
      setEditColumnTitle('');
      setEditColumnColor('#3b82f6');
      fetchKanbanData();
    } catch (error) {
      console.error('Error updating column:', error);
      toast.error('Erro ao atualizar coluna');
    }
  };

  const handleOpenEditColumn = (column: Column) => {
    setEditingColumn(column);
    setEditColumnTitle(column.title);
    setEditColumnColor(column.color || '#3b82f6');
    setIsEditColumnModalOpen(true);
  };

  const handleMoveColumn = async (columnId: string, direction: 'left' | 'right') => {
    const idx = columns.findIndex(c => c.id === columnId);
    if (idx < 0) return;
    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= columns.length) return;

    const newColumns = [...columns];
    [newColumns[idx], newColumns[swapIdx]] = [newColumns[swapIdx], newColumns[idx]];
    setColumns(newColumns);

    try {
      await supabase.from('kanban_columns').update({ position: swapIdx }).eq('id', columns[idx].id);
      await supabase.from('kanban_columns').update({ position: idx }).eq('id', columns[swapIdx].id);
    } catch (error) {
      console.error('Error moving column:', error);
      fetchKanbanData();
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!await confirm(
      'Excluir Coluna',
      'Tem certeza? Todos os cards desta coluna serão apagados permanentemente.',
      { type: 'danger', confirmText: 'Excluir Coluna' }
    )) return;

    const colToDelete = columns.find(c => c.id === columnId);

    try {
      const { error } = await supabase.from('kanban_columns').delete().eq('id', columnId);
      if (error) throw error;

      // Audit Log
      const { data: { user } } = await supabase.auth.getUser();
      if (user && selectedCompany) {
        await supabase.from('audit_logs').insert({
          company_id: selectedCompany.id,
          user_id: user.id,
          action_type: 'delete',
          entity_type: 'column',
          entity_id: columnId,
          details: { title: colToDelete?.title }
        });
      }

      toast.success('Coluna excluída com sucesso');
      fetchKanbanData();
    } catch (error) {
      console.error('Error deleting column:', error);
      toast.error('Erro ao excluir coluna.');
    }
  };

  const handleAddCard = (columnId: string) => {
    setSelectedCardId({ id: 'new', columnId });
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!await confirm(
      'Excluir Card',
      'Tem certeza que deseja excluir este card? Esta ação não pode ser desfeita.',
      { type: 'danger', confirmText: 'Excluir' }
    )) return;

    const cardToDelete = cards.find(c => c.id === cardId);

    try {
      const { error } = await supabase.from('kanban_cards').delete().eq('id', cardId);
      if (error) throw error;

      // Audit Log
      const { data: { user } } = await supabase.auth.getUser();
      if (user && selectedCompany && cardToDelete) {
        await supabase.from('audit_logs').insert({
          company_id: selectedCompany.id,
          user_id: user.id,
          action_type: 'delete',
          entity_type: 'card',
          entity_id: cardId,
          details: {
            card_title: cardToDelete.title,
            column_title: columns.find(c => c.id === cardToDelete.column_id)?.title
          }
        });
      }

      setCards(cards.filter(c => c.id !== cardId));
      toast.success('Card excluído');
    } catch (error) {
      console.error('Error deleting card:', error);
      toast.error('Erro ao excluir card.');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dragging a column
    const activeColumn = columns.find(c => c.id === activeId);
    const overColumn = columns.find(c => c.id === overId);

    if (activeColumn && overColumn && activeId !== overId) {
      const oldIdx = columns.findIndex(c => c.id === activeId);
      const newIdx = columns.findIndex(c => c.id === overId);
      const newColumns = arrayMove(columns, oldIdx, newIdx);
      setColumns(newColumns);
      setActiveId(null);

      // Persist new positions
      try {
        for (let i = 0; i < newColumns.length; i++) {
          await supabase.from('kanban_columns').update({ position: i }).eq('id', newColumns[i].id);
        }
      } catch (error) {
        console.error('Error reordering columns:', error);
        fetchKanbanData();
      }
      return;
    }

    // Encontrar o card ativo
    const activeCard = cards.find(c => c.id === activeId);
    if (!activeCard) return;

    // Encontrar a coluna de destino
    // Se 'over' for uma coluna
    let overColumnId = columns.find(c => c.id === overId)?.id;

    // Se 'over' for outro card, pegamos a coluna desse card
    if (!overColumnId) {
      const overCard = cards.find(c => c.id === overId);
      if (overCard) overColumnId = overCard.column_id;
    }

    // Se 'over' for a área de drop da coluna (caso a coluna esteja vazia ou drop no espaço em branco)
    if (!overColumnId) {
      // Tenta encontrar se o ID do over corresponde a uma coluna (mesmo que não tenha cards)
      const columnFound = columns.find(col => col.id === overId);
      if (columnFound) overColumnId = columnFound.id;
    }

    if (!overColumnId) return;

    // --- Lógica de Bloqueio (Super Card) ---
    // Se o card estiver bloqueado, impedir movimento para coluna de "Concluído"
    const targetColumn = columns.find(c => c.id === overColumnId);
    if (activeCard.is_blocked && targetColumn?.is_done_column) {
      toast.warning('Ação bloqueada', 'Este card está bloqueado e não pode ser concluído!');
      return;
    }

    // Atualizar estado local
    setCards((items) => {
      const oldIndex = items.findIndex((item) => item.id === activeId);

      // Se mudou de coluna
      if (activeCard.column_id !== overColumnId) {
        // Encontrar índice na nova coluna
        // Se estiver soltando sobre um card, pega o índice dele
        // Se estiver soltando na coluna vazia, vai para o final
        let newIndex;
        if (columns.find(c => c.id === overId)) {
          newIndex = items.length; // Final da lista (simplificação)
        } else {
          const overCardIndex = items.findIndex((item) => item.id === overId);
          newIndex = overCardIndex >= 0 ? overCardIndex : items.length;
        }

        const updatedItems = items.map(item => {
          if (item.id === activeId) return { ...item, column_id: overColumnId! };
          return item;
        });

        return arrayMove(updatedItems, oldIndex, newIndex);
      }

      // Mesma coluna
      const newIndex = items.findIndex((item) => item.id === overId);
      return arrayMove(items, oldIndex, newIndex);
    });

    setActiveId(null);

    // Persistir no Supabase
    await supabase
      .from('kanban_cards')
      .update({ column_id: overColumnId })
      .eq('id', activeId);

    // Audit Log
    const { data: { user } } = await supabase.auth.getUser();
    if (user && selectedCompany) {
      const fromColumn = columns.find(c => c.id === activeCard.column_id)?.title;
      const toColumn = columns.find(c => c.id === overColumnId)?.title;

      await supabase.from('audit_logs').insert({
        company_id: selectedCompany.id,
        user_id: user.id,
        action_type: 'move',
        entity_type: 'card',
        entity_id: activeId,
        details: {
          card_title: activeCard.title,
          from: fromColumn,
          to: toColumn,
          column_title: toColumn
        }
      });
    }
  };

  // Custom Collision Detection Strategy
  const customCollisionDetection = React.useCallback((args: any) => {
    // First, look for a pointer intersection
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    // If no pointer intersection, fallback to rectangle intersection
    return rectIntersection(args);
  }, []);

  // Organizar subtasks para renderização (Global)
  // Criar um mapa de ID do pai -> Lista de Subtarefas
  const parentToSubtasksMap = React.useMemo(() => {
    const map: Record<string, Card[]> = {};
    cards.forEach(c => {
      if (c.parent_id) {
        if (!map[c.parent_id]) map[c.parent_id] = [];
        map[c.parent_id].push(c);
      }
    });
    return map;
  }, [cards]);

  if (loading) return <div className="p-8 text-white">Carregando quadro...</div>;

  // Filter cards by client
  const filteredCards = selectedClient
    ? cards.filter(c => c.client_id === selectedClient)
    : cards;

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex-1"></div>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-primary ml-1 flex-shrink-0" />
              <Select
                value={selectedClient}
                onChange={(v) => handleClientChange(v as string)}
                options={clients.map(client => ({
                  value: client.id,
                  label: client.name
                }))}
              />
            </div>
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-6 overflow-x-auto pb-4 h-full">
            {columns.map(col => (
              <KanbanColumn
                key={col.id}
                column={col}
                columnIndex={columns.indexOf(col)}
                totalColumns={columns.length}
                cards={filteredCards.filter(c => c.column_id === col.id)}
                allSubtasksMap={parentToSubtasksMap}
                expandedCards={expandedCards}
                onToggleExpanded={toggleCardExpanded}
                onCardClick={(card) => setSelectedCardId(card.id)}
                onDeleteColumn={handleDeleteColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
                onEditColumn={handleOpenEditColumn}
                onMoveColumn={handleMoveColumn}
                clientsMap={clientsMap}
                membersMap={membersMap}
                userRole={userRole}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div className="transform rotate-3 cursor-grabbing">
              {/* Clone visual do card sendo arrastado */}
              <div className="bg-[#1a1a2e] p-4 rounded-xl border border-white/20 shadow-2xl w-[300px]">
                <div className="h-4 w-3/4 bg-white/20 rounded mb-2"></div>
                <div className="h-20 w-full bg-white/5 rounded"></div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modal Nova Coluna */}
      {isNewColumnModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* 1. Overlay Premium */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md z-0 animate-in fade-in duration-300"
            onClick={() => setIsNewColumnModalOpen(false)}
          >
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
          </div>

          {/* 2. Container Glass Premium */}
          <div className="relative z-10 w-full max-w-md rounded-[22px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300 border border-white/10 bg-[#0a0a1a]/10 backdrop-blur-xl ring-1 ring-white/10 ring-inset">

            {/* Grain Texture Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0"></div>

            {/* Glow Effects */}
            <div className="absolute inset-0 rounded-[22px] border border-white/5 pointer-events-none"></div>
            <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[60%] h-[100px] bg-primary/30 blur-[80px] pointer-events-none rounded-[100%]"></div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

            <div className="p-8 pb-4 relative z-20">
              <h2 className="text-xl font-bold text-[#EEEEEE] mb-1">Nova coluna</h2>
              <p className="text-xs text-[#6e6e6e] font-light">Adicione uma nova etapa ao seu fluxo de trabalho.</p>
            </div>

            <div className="p-8 pt-2 relative z-20">
              <div className="space-y-1.5 mb-6">
                <label className="block text-[10px] font-bold text-[#6e6e6e] uppercase tracking-wide ml-1">Nome da Coluna</label>
                <input
                  autoFocus
                  className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light placeholder-gray-600"
                  placeholder="Ex: Em Revisão"
                  value={newColumnTitle}
                  onChange={e => setNewColumnTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateColumn()}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  onClick={() => setIsNewColumnModalOpen(false)}
                  className="px-5 py-2.5 text-sm text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-xl font-light"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateColumn}
                  className="px-6 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-xl border border-white/5 hover:border-white/20 transition-all duration-300 font-medium text-sm flex items-center gap-2 group shadow-lg"
                >
                  <span>Criar</span>
                  <span className="text-primary group-hover:translate-x-1 transition-transform">→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Coluna */}
      {isEditColumnModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* 1. Overlay Premium */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md z-0 animate-in fade-in duration-300"
            onClick={() => setIsEditColumnModalOpen(false)}
          >
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
          </div>

          {/* 2. Container Glass Premium */}
          <div className="relative z-10 w-full max-w-md rounded-[22px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300 border border-white/10 bg-[#0a0a1a]/10 backdrop-blur-xl ring-1 ring-white/10 ring-inset">

            {/* Glow Effects */}
            <div className="absolute inset-0 rounded-[22px] border border-white/5 pointer-events-none"></div>
            <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[60%] h-[100px] bg-primary/30 blur-[80px] pointer-events-none rounded-[100%]"></div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

            <div className="p-8 pb-4 relative z-20">
              <h2 className="text-xl font-bold text-[#EEEEEE] mb-1">Editar coluna</h2>
              <p className="text-xs text-[#6e6e6e] font-light">Personalize as configurações desta etapa.</p>
            </div>

            <div className="p-8 pt-2 relative z-20">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-[#6e6e6e] uppercase tracking-wide ml-1">Nome da Coluna</label>
                  <input
                    autoFocus
                    className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light placeholder-gray-600"
                    placeholder="Nome da coluna"
                    value={editColumnTitle}
                    onChange={e => setEditColumnTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUpdateColumn()}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-[#6e6e6e] uppercase tracking-wide ml-1">Cor da Coluna</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={editColumnColor}
                      onChange={e => setEditColumnColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-2 border-white/10 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
                    />
                    <span className="text-xs text-gray-400 font-mono">{editColumnColor}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                  <button
                    onClick={() => setIsEditColumnModalOpen(false)}
                    className="px-5 py-2.5 text-sm text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-xl font-light"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdateColumn}
                    className="px-6 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-xl border border-white/5 hover:border-white/20 transition-all duration-300 font-medium text-sm flex items-center gap-2 group shadow-lg"
                  >
                    <span>Salvar</span>
                    <span className="text-primary group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Card */}
      {selectedCardId && (
        <KanbanCardModal
          cardId={typeof selectedCardId === 'string' ? selectedCardId : selectedCardId.id}
          columnId={typeof selectedCardId === 'object' ? selectedCardId.columnId : undefined}
          defaultClientId={selectedClient || undefined}
          onClose={() => {
            setSelectedCardId(null);
            fetchKanbanData(); // Refresh after close
          }}
          onOpenCard={(id) => setSelectedCardId(id)}
        />
      )}
    </div>
  );
};

// --- Sub-componentes ---

const KanbanColumn = ({
  column,
  columnIndex,
  totalColumns,
  cards,
  allSubtasksMap,
  expandedCards,
  onToggleExpanded,
  onCardClick,
  onDeleteColumn,
  onAddCard,
  onDeleteCard,
  onEditColumn,
  onMoveColumn,
  clientsMap,
  membersMap,
  userRole
}: {
  column: Column,
  columnIndex: number,
  totalColumns: number,
  cards: Card[],
  allSubtasksMap: Record<string, Card[]>,
  expandedCards: Record<string, boolean>,
  onToggleExpanded: (id: string) => void,
  onCardClick: (c: Card) => void,
  onDeleteColumn: (id: string) => void,
  onAddCard: (colId: string) => void,
  onDeleteCard: (cardId: string) => void,
  onEditColumn: (column: Column) => void,
  onMoveColumn: (columnId: string, direction: 'left' | 'right') => void,
  clientsMap: Record<string, string>,
  membersMap: Record<string, { name: string; avatar_url?: string }>,
  userRole: string | null
}) => {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Filtrar apenas cards de nível superior (sem parent_id)
  // Subtarefas serão renderizadas dentro dos pais
  const topLevelCards = React.useMemo(() =>
    cards.filter(c => !c.parent_id),
    [cards]);

  return (
    <div ref={setNodeRef} style={style} className={`min-w-[320px] w-[320px] flex flex-col transition-all ${isDragging ? 'opacity-50' : ''}`}>
      <div className={`
        flex flex-col rounded-2xl backdrop-blur-sm border border-white/5 overflow-hidden transition-all hover:brightness-110
      `} style={{
          backgroundColor: column.color ? `${column.color}0D` : '#16163366',
        }}>
        {/* Integrated Header */}
        <div
          {...attributes}
          {...listeners}
          className="flex justify-between items-center p-4 cursor-grab active:cursor-grabbing group/header"
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold tracking-tight shadow-sm" style={{ backgroundColor: column.color + '20', color: column.color || '#3b82f6', border: `1px solid ${column.color}30` }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: column.color || '#3b82f6' }} />
              {column.title}
            </div>
            <span className="text-[10px] text-gray-500 font-bold bg-white/5 px-2 py-0.5 rounded-full">{cards.length}</span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
            {userRole !== 'visualizador' && (
              <div className="relative group">
                <button className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors">
                  <MoreHorizontal size={16} />
                </button>
                {/* Menu de Ações da Coluna */}
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a2e]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="p-1">
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg flex items-center gap-2"
                      onClick={() => onEditColumn(column)}
                    >
                      <Pencil size={14} /> Editar
                    </button>
                    {columnIndex > 0 && (
                      <button
                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg flex items-center gap-2"
                        onClick={() => onMoveColumn(column.id, 'left')}
                      >
                        <ChevronLeft size={14} /> Mover para esquerda
                      </button>
                    )}
                    {columnIndex < totalColumns - 1 && (
                      <button
                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg flex items-center gap-2"
                        onClick={() => onMoveColumn(column.id, 'right')}
                      >
                        <ChevronRight size={14} /> Mover para direita
                      </button>
                    )}
                    <div className="h-px bg-white/5 my-1" />
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2"
                      onClick={() => onDeleteColumn(column.id)}
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card List Area with Dynamic Height */}
        <div className="px-3 pb-3 space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
          <SortableContext items={topLevelCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {topLevelCards.map(card => (
              <KanbanCard
                key={card.id}
                card={card}
                subtasks={allSubtasksMap[card.id] || []}
                isExpanded={expandedCards[card.id] || false}
                onToggleExpanded={() => onToggleExpanded(card.id)}
                onClick={() => onCardClick(card)}
                onDelete={() => onDeleteCard(card.id)}
                clientName={card.client_id ? clientsMap[card.client_id] : undefined}
                member={card.assigned_to ? membersMap[card.assigned_to] : undefined}
                userRole={userRole}
              />
            ))}
          </SortableContext>

          {/* Add Task Button at the Bottom */}
          {userRole !== 'visualizador' && (
            <button
              onClick={() => onAddCard(column.id)}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-white/5 text-gray-500 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 text-xs mt-2 group"
            >
              <Plus size={14} className="group-hover:rotate-90 transition-transform duration-300" />
              <span>Adicionar Tarefa</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const priorityConfig = {
  low: { label: 'Baixa', color: 'bg-blue-500/20 text-blue-400' },
  medium: { label: 'Média', color: 'bg-yellow-500/20 text-yellow-400' },
  high: { label: 'Alta', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: 'Urgente', color: 'bg-red-500/20 text-red-400' }
};

const KanbanCard = ({
  card,
  subtasks = [],
  isExpanded = false,
  onToggleExpanded,
  onClick,
  onDelete,
  clientName,
  member,
  userRole,
  isSubtask = false
}: {
  card: Card,
  subtasks?: Card[],
  isExpanded?: boolean,
  onToggleExpanded?: () => void,
  onClick: () => void,
  onDelete: () => void,
  clientName?: string,
  member?: { name: string; avatar_url?: string },
  userRole: string | null,
  isSubtask?: boolean
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: userRole === 'visualizador' || isSubtask
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityInfo = priorityConfig[card.priority] || priorityConfig['medium'];

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={onClick}
        className={`
        bg-[#13132B]/80 backdrop-blur-md rounded-2xl border border-white/5 group hover:border-primary/40 hover:bg-[#1a1a3a]/90 transition-all duration-300 cursor-grab active:cursor-grabbing shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_30px_rgba(99,102,241,0.15)]
        ${card.is_blocked ? 'border-red-500/30 bg-red-500/5' : ''} 
        ${userRole === 'visualizador' ? 'cursor-pointer hover:border-white/10' : ''}
        ${isSubtask ? 'p-3 scale-[0.98] ml-4 border-l-2 border-l-primary/40 rounded-l-md' : 'p-4'}
      `}
      >
        {/* Tags e Bloqueio */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-1 rounded-md font-medium tracking-tight bg-white/5 text-gray-400 border border-white/5 max-w-[100px] truncate shadow-sm">
              {priorityInfo.label}
            </span>
            {clientName && (
              <span className="text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/5 max-w-[100px] truncate shadow-sm">
                {clientName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {card.is_blocked && <Lock size={14} className="text-red-400" />}
            {userRole !== 'visualizador' && !isSubtask && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-white/5"
                title="Excluir Card"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        <h4 className={`text-white/90 font-medium mb-3 line-clamp-2 leading-relaxed tracking-wide ${isSubtask ? 'text-xs' : 'text-sm'}`}>{card.title}</h4>

        {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {card.tags.map(tag => (
              <span
                key={tag.id}
                className="text-[9px] px-2 py-0.5 rounded-md font-bold tracking-wide"
                style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40` }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        <div className={`flex items-center justify-between pt-4 border-t border-white/5 ${isSubtask ? 'mt-2' : 'mt-4'}`}>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide transition-colors ${card.due_date ? 'text-blue-400 bg-blue-400/10 border border-blue-400/20' : 'text-gray-500 bg-white/5 border border-white/5'}`}>
            <Calendar size={12} strokeWidth={2.5} />
            <span>{card.due_date ? new Date(card.due_date.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR').slice(0, 5) : 'S/ Data'}</span>
          </div>

          {/* Avatar */}
          <div className="flex items-center">
            {member ? (
              <div className="flex items-center gap-1" title={member.name}>
                {member.avatar_url ? (
                  <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-[#13132B] shadow-sm transform hover:scale-110 transition-transform">
                    <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-[10px] border-2 border-[#13132B] shadow-sm transform hover:scale-110 transition-transform">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-gray-400 border border-white/10 border-dashed" title="Sem responsável">
                <User size={13} strokeWidth={2} />
              </div>
            )}
          </div>
        </div>

        {/* Menu de Ações do Card (Hover) */}

        {/* Botão de Subtarefas (ClickUp Style) */}
        {!isSubtask && subtasks.length > 0 && (
          <div
            className="mt-2 -mb-1 flex items-center gap-1 cursor-pointer hover:bg-white/5 rounded px-2 py-1 w-fit transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded && onToggleExpanded();
            }}
          >
            <div className={`bg-gray-700 text-[10px] text-white px-1.5 rounded flex items-center justify-center h-4 min-w-[16px]`}>
              {subtasks.length}
            </div>
            <span className="text-[10px] text-gray-400 font-medium">subtarefa{subtasks.length > 1 ? 's' : ''}</span>
            {isExpanded ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
          </div>
        )}
      </div>

      {/* Renderização das Subtarefas */}
      {isExpanded && subtasks.length > 0 && (
        <div className="flex flex-col gap-2 relative">
          {/* Linha conectora vertical */}
          <div className="absolute left-6 top-0 bottom-4 w-px bg-white/10 -z-10" />

          {subtasks.map(subtask => (
            <KanbanCard
              key={subtask.id}
              card={subtask}
              onClick={onClick}
              onDelete={onDelete}
              userRole={userRole}
              isSubtask={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default OrganizadorKanban;
