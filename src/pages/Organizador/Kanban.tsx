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
  X
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { supabase } from '../../lib/supabase';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import KanbanCardModal from './KanbanCardModal';

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
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  created_at: string;
  is_blocked: boolean;
  assigned_to?: string;
  client_id?: string;
  position: number;
  tags?: Tag[];
}

// ... existing interfaces ...

// --- Componente Principal ---
const OrganizadorKanban = () => {
  const { selectedCompany } = useCompany();
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | { id: string; columnId?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Auxiliary Data Maps
  const [clientsMap, setClientsMap] = useState<Record<string, string>>({});
  const [membersMap, setMembersMap] = useState<Record<string, string>>({});

  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [isNewColumnModalOpen, setIsNewColumnModalOpen] = useState(false);
  const [editColumnTitle, setEditColumnTitle] = useState('');
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [isEditColumnModalOpen, setIsEditColumnModalOpen] = useState(false);

  // Sensores para Drag and Drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (selectedCompany) fetchKanbanData();
  }, [selectedCompany]);

  const fetchKanbanData = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      // 1. Fetch Columns
      const { data: cols } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('position');

      // 2. Fetch Cards
      const { data: crds } = await supabase
        .from('kanban_cards')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('position');

      if (cols && cols.length > 0) {
        setColumns(cols);
      } else {
        // Create default columns if none exist
        const defaultCols = [
          { title: 'A Fazer', color: 'gray', position: 0, is_done_column: false },
          { title: 'Em Progresso', color: 'blue', position: 1, is_done_column: false },
          { title: 'Concluído', color: 'green', position: 2, is_done_column: true }
        ];
        // Insert default columns logic here
      }
      
      setCards(crds || []);

      // 3. Fetch Tags for Cards
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

      // 4. Fetch Auxiliary Data (Clients and Members)
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name')
        .eq('company_id', selectedCompany.id);

      if (clientsData) {
        const clientMap = clientsData.reduce((acc, client) => ({ ...acc, [client.id]: client.name }), {});
        setClientsMap(clientMap);
      }

      const { data: membersData } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('company_id', selectedCompany.id);

      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (profilesData) {
          const memberMap = profilesData.reduce((acc, profile) => ({ 
            ...acc, 
            [profile.id]: profile.full_name || profile.email 
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
        title: newColumnTitle,
        position: columns.length,
        color: 'gray'
      });
      
      if (error) throw error;
      
      setNewColumnTitle('');
      setIsNewColumnModalOpen(false);
      fetchKanbanData();
    } catch (error) {
      console.error('Error creating column:', error);
      alert('Erro ao criar coluna');
    }
  };

  const handleUpdateColumn = async () => {
    if (!editColumnTitle.trim() || !editingColumn) return;

    try {
      const { error } = await supabase
        .from('kanban_columns')
        .update({ title: editColumnTitle })
        .eq('id', editingColumn.id);

      if (error) throw error;

      setIsEditColumnModalOpen(false);
      setEditingColumn(null);
      setEditColumnTitle('');
      fetchKanbanData();
    } catch (error) {
      console.error('Error updating column:', error);
      alert('Erro ao atualizar coluna');
    }
  };

  const handleOpenEditColumn = (column: Column) => {
    setEditingColumn(column);
    setEditColumnTitle(column.title);
    setIsEditColumnModalOpen(true);
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm('Tem certeza? Todos os cards desta coluna serão apagados.')) return;

    try {
      const { error } = await supabase.from('kanban_columns').delete().eq('id', columnId);
      if (error) throw error;
      fetchKanbanData();
    } catch (error) {
      console.error('Error deleting column:', error);
      alert('Erro ao excluir coluna.');
    }
  };

  const handleAddCard = (columnId: string) => {
    setSelectedCardId({ id: 'new', columnId });
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Tem certeza que deseja excluir este card?')) return;
    try {
        const { error } = await supabase.from('kanban_cards').delete().eq('id', cardId);
        if (error) throw error;
        setCards(cards.filter(c => c.id !== cardId));
    } catch (error) {
        console.error('Error deleting card:', error);
        alert('Erro ao excluir card.');
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
      alert('Este card está bloqueado e não pode ser concluído!');
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

  if (loading) return <div className="p-8 text-white">Carregando quadro...</div>;

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Quadro Kanban</h1>
          <p className="text-gray-400 mt-2">Gerencie tarefas com fluxo de aprovação.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsNewColumnModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={18} /> Nova Coluna
          </button>
        </div>
      </div>

      <DndContext 
        sensors={sensors} 
        collisionDetection={customCollisionDetection} 
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-4 h-full">
          {columns.map(col => (
            <KanbanColumn 
              key={col.id} 
              column={col} 
              cards={cards.filter(c => c.column_id === col.id)}
              onCardClick={(card) => setSelectedCardId(card.id)}
              onDeleteColumn={handleDeleteColumn}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
              onEditColumn={handleOpenEditColumn}
              clientsMap={clientsMap}
              membersMap={membersMap}
            />
          ))}
        </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 rounded-2xl border border-white/10 relative bg-[#0a0a1a]">
            <h2 className="text-xl font-bold text-white mb-4">Nova Coluna</h2>
            <input 
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none mb-4"
              placeholder="Nome da coluna (ex: Em Revisão)"
              value={newColumnTitle}
              onChange={e => setNewColumnTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateColumn()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsNewColumnModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
              <button onClick={handleCreateColumn} className="bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg font-bold">Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Coluna */}
      {isEditColumnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 rounded-2xl border border-white/10 relative bg-[#0a0a1a]">
            <h2 className="text-xl font-bold text-white mb-4">Editar Coluna</h2>
            <input 
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none mb-4"
              placeholder="Nome da coluna"
              value={editColumnTitle}
              onChange={e => setEditColumnTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdateColumn()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsEditColumnModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
              <button onClick={handleUpdateColumn} className="bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg font-bold">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Card */}
      {selectedCardId && (
        <KanbanCardModal 
          cardId={typeof selectedCardId === 'string' ? selectedCardId : selectedCardId.id}
          columnId={typeof selectedCardId === 'object' ? selectedCardId.columnId : undefined}
          onClose={() => {
            setSelectedCardId(null);
            fetchKanbanData(); // Refresh after close
          }} 
        />
      )}
    </div>
  );
};

// --- Sub-componentes ---

const KanbanColumn = ({ 
  column, 
  cards, 
  onCardClick, 
  onDeleteColumn, 
  onAddCard,
  onDeleteCard,
  onEditColumn,
  clientsMap,
  membersMap
}: { 
  column: Column, 
  cards: Card[], 
  onCardClick: (c: Card) => void, 
  onDeleteColumn: (id: string) => void, 
  onAddCard: (colId: string) => void,
  onDeleteCard: (cardId: string) => void,
  onEditColumn: (column: Column) => void,
  clientsMap: Record<string, string>,
  membersMap: Record<string, string>
}) => {
  const { setNodeRef } = useSortable({ id: column.id });

  return (
    <div ref={setNodeRef} className="min-w-[320px] w-[320px] flex flex-col h-full">
      {/* Header da Coluna */}
      <div className={`flex justify-between items-center mb-4 p-3 rounded-xl bg-white/5 border border-white/10 ${column.is_done_column ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${column.is_done_column ? 'bg-emerald-500' : 'bg-blue-500'}`} />
          <h3 className="font-bold text-white">{column.title}</h3>
          <span className="bg-white/10 px-2 py-0.5 rounded text-xs text-gray-400">{cards.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => onAddCard(column.id)}
            className="text-gray-500 hover:text-white p-1 rounded hover:bg-white/5"
            title="Adicionar tarefa nesta coluna"
          >
            <Plus size={18} />
          </button>
          <div className="relative group">
            <button className="text-gray-500 hover:text-white p-1">
              <MoreHorizontal size={18} />
            </button>
            {/* Menu de Ações da Coluna */}
            <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="p-1">
                <button 
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg flex items-center gap-2"
                  onClick={() => onEditColumn(column)}
                >
                  <Filter size={14} /> Editar
                </button>
                <button 
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2"
                  onClick={() => onDeleteColumn(column.id)}
                >
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Área de Drop */}
      <div className="flex-1 bg-white/5 rounded-2xl p-3 border border-white/5 overflow-y-auto custom-scrollbar space-y-3">
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <KanbanCard 
              key={card.id} 
              card={card} 
              onClick={() => onCardClick(card)} 
              onDelete={() => onDeleteCard(card.id)}
              clientName={card.client_id ? clientsMap[card.client_id] : undefined}
              memberName={card.assigned_to ? membersMap[card.assigned_to] : undefined}
            />
          ))}
        </SortableContext>
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
  onClick,
  onDelete,
  clientName,
  memberName
}: { 
  card: Card, 
  onClick: () => void,
  onDelete: () => void,
  clientName?: string,
  memberName?: string
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityInfo = priorityConfig[card.priority] || priorityConfig['medium'];

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      onClick={onClick}
      className={`bg-[#1a1a2e] p-4 rounded-xl border group hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing shadow-lg ${card.is_blocked ? 'border-red-500/30 bg-red-500/5' : 'border-white/10'}`}
    >
      {/* Tags e Bloqueio */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${priorityInfo.color}`}>
            {priorityInfo.label}
          </span>
          {clientName && (
              <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-white/10 text-gray-400 max-w-[100px] truncate">
                {clientName}
              </span>
          )}
        </div>
        <div className="flex items-center gap-2">
            {card.is_blocked && <Lock size={14} className="text-red-400" />}
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                title="Excluir Card"
            >
                <Trash2 size={14} />
            </button>
        </div>
      </div>

      <h4 className="text-white font-medium mb-3 line-clamp-2 text-sm">{card.title}</h4>

      {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
              {card.tags.map(tag => (
                  <span 
                    key={tag.id} 
                    className="text-[9px] px-1.5 py-0.5 rounded font-bold border border-white/10"
                    style={{ backgroundColor: tag.color + '40', color: tag.color }}
                  >
                      {tag.name}
                  </span>
              ))}
          </div>
      )}

      <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1">
                <Calendar size={12} />
                Criação: {new Date(card.created_at).toLocaleDateString('pt-BR')}
            </span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
             <span className={`flex items-center gap-1 ${card.due_date ? 'text-gray-300' : 'text-gray-600'}`}>
                <AlertCircle size={12} />
                Prev: {card.due_date ? new Date(card.due_date).toLocaleDateString('pt-BR') : 'S/ Data'}
            </span>

            {/* Avatar (Mock ou Real) */}
            {memberName ? (
                <div className="flex items-center gap-1" title={memberName}>
                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-[10px]">
                        {memberName.charAt(0).toUpperCase()}
                    </div>
                </div>
            ) : (
                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-gray-500 border border-white/10" title="Sem responsável">
                    <User size={12} />
                </div>
            )}
        </div>
      </div>
      
      {/* Menu de Ações do Card (Hover) */}
      <div 
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onPointerDown={(e) => e.stopPropagation()} // Impede que o clique inicie o drag
      >
        <div className="relative group/menu">
          <button className="text-gray-400 hover:text-white p-1 bg-[#1a1a2e] rounded-full shadow-sm border border-white/5">
            <MoreHorizontal size={16} />
          </button>
          <div className="absolute right-0 top-full mt-1 w-32 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl overflow-hidden z-20 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all">
            <div className="p-1">
              <button className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 rounded flex items-center gap-2" onClick={onClick}>
                <Filter size={12} /> Editar
              </button>
              <button className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded flex items-center gap-2">
                <Trash2 size={12} /> Excluir
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizadorKanban;
