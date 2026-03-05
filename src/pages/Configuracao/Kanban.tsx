import React, { useState, useEffect } from 'react';
import {
    DndContext, closestCenter, PointerSensor, KeyboardSensor,
    useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates,
    verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Columns, Plus, Trash2, GripVertical, CheckCircle2, Circle,
    Save, Users, ToggleLeft, ToggleRight, AlertTriangle, Info,
    ClipboardList, ChevronDown, ChevronUp, X, Pencil, User,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { supabase } from '../../lib/supabase';
import { useUI } from '../../context/UIContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KanbanColumnTemplate {
    id: string; title: string; color: string;
    is_done_column: boolean; position: number;
}
interface KanbanConfig {
    use_default: boolean; columns: KanbanColumnTemplate[];
}
interface Subtask {
    id: string; title: string; order: number;
}
interface TaskTemplate {
    id: string; company_id: string; title: string;
    description: string; priority: 'low' | 'medium' | 'high' | 'urgent';
    subtasks: Subtask[]; assignees: string[];
    created_at: string;
}
interface Member {
    user_id: string; name: string; avatar_url?: string; email: string;
}

const COLOR_PRESETS = [
    { label: 'Cinza', value: '#6b7280' }, { label: 'Azul', value: '#3b82f6' },
    { label: 'Verde', value: '#10b981' }, { label: 'Roxo', value: '#8b5cf6' },
    { label: 'Laranja', value: '#f59e0b' }, { label: 'Vermelho', value: '#ef4444' },
    { label: 'Rosa', value: '#ec4899' }, { label: 'Ciano', value: '#06b6d4' },
];
const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Baixa', color: 'text-gray-400' },
    { value: 'medium', label: 'Média', color: 'text-yellow-400' },
    { value: 'high', label: 'Alta', color: 'text-orange-400' },
    { value: 'urgent', label: 'Urgente', color: 'text-red-400' },
];

// ─── Sortable Column Row ───────────────────────────────────────────────────────

const SortableColumnRow = ({ col, onUpdate, onDelete, canDelete }: {
    col: KanbanColumnTemplate;
    onUpdate: (id: string, field: keyof KanbanColumnTemplate, value: any) => void;
    onDelete: (id: string) => void;
    canDelete: boolean;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
    const [showColorPicker, setShowColorPicker] = useState(false);
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

    return (
        <div ref={setNodeRef} style={style}
            className={`group flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${isDragging ? 'border-primary/50 bg-primary/10 shadow-lg' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}>
            <button {...listeners} {...attributes} className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none shrink-0">
                <GripVertical size={18} />
            </button>
            <div className="relative shrink-0">
                <button onClick={() => setShowColorPicker(!showColorPicker)}
                    className="w-6 h-6 rounded-full border-2 border-white/20 hover:scale-110 transition-transform"
                    style={{ backgroundColor: col.color }} title="Cor" />
                {showColorPicker && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />
                        <div className="absolute left-0 top-8 z-50 bg-[#161635] border border-white/10 rounded-xl p-3 shadow-2xl grid grid-cols-4 gap-2 w-[160px]">
                            {COLOR_PRESETS.map(p => (
                                <button key={p.value} onClick={() => { onUpdate(col.id, 'color', p.value); setShowColorPicker(false); }}
                                    className="w-7 h-7 rounded-full border-2 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: p.value, borderColor: col.color === p.value ? 'white' : 'transparent' }} title={p.label} />
                            ))}
                        </div>
                    </>
                )}
            </div>
            <input type="text" value={col.title} onChange={e => onUpdate(col.id, 'title', e.target.value)}
                className="flex-1 bg-transparent border-none text-white/90 text-sm font-medium focus:outline-none placeholder-gray-600 min-w-0"
                placeholder="Nome da coluna..." />
            <button onClick={() => onUpdate(col.id, 'is_done_column', !col.is_done_column)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all shrink-0 ${col.is_done_column ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-gray-500 border border-white/10 hover:border-white/20 hover:text-gray-300'
                    }`}>
                {col.is_done_column ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                <span className="hidden sm:inline">Conclusão</span>
            </button>
            <button onClick={() => onDelete(col.id)} disabled={!canDelete}
                className="text-gray-600 hover:text-red-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors shrink-0">
                <Trash2 size={16} />
            </button>
        </div>
    );
};

// ─── Task Template Card ────────────────────────────────────────────────────────

const TaskTemplateCard = ({ template, members, onEdit, onDelete }: {
    template: TaskTemplate; members: Member[];
    onEdit: (t: TaskTemplate) => void; onDelete: (id: string) => void;
}) => {
    const [expanded, setExpanded] = useState(false);
    const priorityOpt = PRIORITY_OPTIONS.find(p => p.value === template.priority);
    const assignedMembers = members.filter(m => template.assignees.includes(m.user_id));

    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden transition-all hover:border-white/20">
            <div className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-white font-semibold text-sm truncate">{template.title}</h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 ${priorityOpt?.color}`}>
                            {priorityOpt?.label}
                        </span>
                    </div>
                    {template.description && (
                        <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 mb-2">{template.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                        {template.subtasks.length > 0 && (
                            <span className="flex items-center gap-1">
                                <CheckCircle2 size={11} className="text-gray-600" /> {template.subtasks.length} subtarefa{template.subtasks.length !== 1 ? 's' : ''}
                            </span>
                        )}
                        {assignedMembers.length > 0 && (
                            <div className="flex items-center gap-1">
                                <div className="flex -space-x-1">
                                    {assignedMembers.slice(0, 3).map(m => (
                                        <div key={m.user_id} className="w-5 h-5 rounded-full bg-primary/30 border border-[#0a0a1a] flex items-center justify-center overflow-hidden text-[8px] font-bold text-white">
                                            {m.avatar_url ? <img src={m.avatar_url} alt={m.name} className="w-full h-full object-cover" /> : m.name.charAt(0).toUpperCase()}
                                        </div>
                                    ))}
                                </div>
                                {assignedMembers.length > 3 && <span>+{assignedMembers.length - 3}</span>}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {(template.subtasks.length > 0) && (
                        <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                    )}
                    <button onClick={() => onEdit(template)} className="p-1.5 text-gray-500 hover:text-primary transition-colors rounded-lg hover:bg-white/5">
                        <Pencil size={15} />
                    </button>
                    <button onClick={() => onDelete(template.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5">
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>
            {expanded && template.subtasks.length > 0 && (
                <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-1.5">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mb-2">Subtarefas</p>
                    {template.subtasks.sort((a, b) => a.order - b.order).map(sub => (
                        <div key={sub.id} className="flex items-center gap-2 text-xs text-gray-400">
                            <Circle size={11} className="text-gray-600 shrink-0" /> {sub.title}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Task Template Modal ───────────────────────────────────────────────────────

const TaskTemplateModal = ({ template, members, onSave, onClose }: {
    template: Partial<TaskTemplate> | null; members: Member[];
    onSave: (data: Partial<TaskTemplate>) => void; onClose: () => void;
}) => {
    const isNew = !template?.id;
    const [form, setForm] = useState<Partial<TaskTemplate>>({
        title: '', description: '', priority: 'medium', subtasks: [], assignees: [], ...template,
    });
    const addSubtask = () => {
        const nextNumber = (form.subtasks?.length ?? 0) + 1;
        const sub: Subtask = { id: `sub-${Date.now()}`, title: `Subtarefa ${nextNumber}`, order: (form.subtasks?.length ?? 0) };
        setForm(prev => ({ ...prev, subtasks: [...(prev.subtasks ?? []), sub] }));
    };
    const updateSubtask = (id: string, title: string) =>
        setForm(prev => ({ ...prev, subtasks: prev.subtasks?.map(s => s.id === id ? { ...s, title } : s) ?? [] }));
    const removeSubtask = (id: string) =>
        setForm(prev => ({ ...prev, subtasks: prev.subtasks?.filter(s => s.id !== id) ?? [] }));
    const toggleAssignee = (userId: string) =>
        setForm(prev => ({
            ...prev,
            assignees: prev.assignees?.includes(userId)
                ? prev.assignees.filter(id => id !== userId)
                : [...(prev.assignees ?? []), userId],
        }));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
            <div className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[22px] border border-white/10 bg-[#0a0a1a]/90 backdrop-blur-xl shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
                <div className="absolute top-[-40px] left-1/2 -translate-x-1/2 w-[50%] h-[80px] bg-primary/20 blur-[60px] pointer-events-none rounded-full" />

                {/* Header */}
                <div className="p-6 pb-4 flex items-center justify-between border-b border-white/5 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-white">{isNew ? 'Novo Template de Tarefa' : 'Editar Template'}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Configure a tarefa e suas subtarefas pré-definidas</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto p-6 space-y-5 flex-1 scrollbar-thin scrollbar-thumb-white/10">
                    {/* Title */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nome do Template *</label>
                        <input type="text" value={form.title ?? ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors placeholder-gray-600"
                            placeholder="Ex: Gestão de Tráfego — Setup Mensal" />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Descrição</label>
                        <textarea value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                            rows={2}
                            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors placeholder-gray-600 resize-none"
                            placeholder="Descrição opcional da tarefa..." />
                    </div>

                    {/* Priority */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Prioridade Padrão</label>
                        <div className="grid grid-cols-4 gap-2">
                            {PRIORITY_OPTIONS.map(opt => (
                                <button key={opt.value} onClick={() => setForm(p => ({ ...p, priority: opt.value as any }))}
                                    className={`py-2 rounded-xl border text-xs font-semibold transition-all ${form.priority === opt.value
                                        ? `${opt.color} border-current bg-white/5`
                                        : 'text-gray-500 border-white/10 hover:border-white/20'
                                        }`}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Subtasks */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            Subtarefas Pré-definidas ({form.subtasks?.length ?? 0})
                        </label>
                        <div className="space-y-1.5">
                            {(form.subtasks ?? []).map((sub, idx) => (
                                <div key={sub.id} className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 group hover:border-white/20 transition-colors">
                                    <span className="text-[10px] font-bold text-gray-600 w-4 shrink-0 text-center">{idx + 1}</span>
                                    <input
                                        type="text"
                                        value={sub.title}
                                        onChange={e => updateSubtask(sub.id, e.target.value)}
                                        className="flex-1 bg-transparent border-none text-sm text-gray-300 focus:text-white focus:outline-none placeholder-gray-600 min-w-0"
                                        placeholder={`Subtarefa ${idx + 1}`}
                                    />
                                    <button onClick={() => removeSubtask(sub.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all shrink-0">
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button onClick={addSubtask}
                            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-white/10 text-gray-600 hover:text-gray-300 hover:border-white/25 hover:bg-white/5 transition-all text-sm">
                            <Plus size={14} /> Adicionar Subtarefa
                        </button>
                    </div>

                    {/* Assignees */}
                    {members.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                Responsáveis Padrão ({form.assignees?.length ?? 0} selecionados)
                            </label>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                {members.map(m => {
                                    const selected = form.assignees?.includes(m.user_id) ?? false;
                                    return (
                                        <button key={m.user_id} onClick={() => toggleAssignee(m.user_id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-all text-left ${selected ? 'border-primary/40 bg-primary/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                                                }`}>
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 ${selected ? 'bg-primary/30 text-white' : 'bg-white/10 text-gray-400'
                                                }`}>
                                                {m.avatar_url ? <img src={m.avatar_url} alt={m.name} className="w-full h-full object-cover" /> : m.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate ${selected ? 'text-white' : 'text-gray-400'}`}>{m.name}</p>
                                                <p className="text-[10px] text-gray-600 truncate">{m.email}</p>
                                            </div>
                                            {selected && <CheckCircle2 size={15} className="text-primary shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 pt-4 border-t border-white/5 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                        Cancelar
                    </button>
                    <button onClick={() => onSave(form)} disabled={!form.title?.trim()}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/80 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed">
                        <Save size={15} /> {isNew ? 'Criar Template' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

const ConfiguracaoKanban = () => {
    const { selectedCompany } = useCompany();
    const { toast, confirm } = useUI();

    const [activeTab, setActiveTab] = useState<'colunas' | 'tarefas'>('colunas');

    // ── Colunas state ──
    const [config, setConfig] = useState<KanbanConfig>({
        use_default: false,
        columns: [
            { id: `col-${Date.now()}-1`, title: 'A Fazer', color: '#6b7280', is_done_column: false, position: 0 },
            { id: `col-${Date.now()}-2`, title: 'Em Progresso', color: '#3b82f6', is_done_column: false, position: 1 },
            { id: `col-${Date.now()}-3`, title: 'Concluído', color: '#10b981', is_done_column: true, position: 2 },
        ],
    });
    const [loadingCols, setLoadingCols] = useState(true);
    const [savingCols, setSavingCols] = useState(false);
    const [applying, setApplying] = useState(false);
    const [clientCount, setClientCount] = useState(0);

    // ── Tarefas state ──
    const [templates, setTemplates] = useState<TaskTemplate[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [members, setMembers] = useState<Member[]>([]);
    const [modalTemplate, setModalTemplate] = useState<Partial<TaskTemplate> | null | false>(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    useEffect(() => {
        if (selectedCompany) {
            loadColunas();
            loadClientCount();
            loadTaskTemplates();
            loadMembers();
        }
    }, [selectedCompany]);

    // ── Load Colunas ──────────────────────────────────────────────────────────

    const loadColunas = async () => {
        if (!selectedCompany) return;
        setLoadingCols(true);
        try {
            const { data, error } = await supabase
                .from('companies').select('kanban_columns').eq('id', selectedCompany.id).single();
            if (error) throw error;
            if (data?.kanban_columns?.columns?.length > 0) setConfig(data.kanban_columns as KanbanConfig);
        } catch {
            // Column may not exist yet — use defaults
        } finally {
            setLoadingCols(false);
        }
    };

    const loadClientCount = async () => {
        if (!selectedCompany) return;
        const { count } = await supabase.from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', selectedCompany.id).eq('status', 'active');
        setClientCount(count ?? 0);
    };

    // ── Load Task Templates ───────────────────────────────────────────────────

    const loadTaskTemplates = async () => {
        if (!selectedCompany) return;
        setLoadingTasks(true);
        try {
            const { data, error } = await supabase
                .from('kanban_task_templates').select('*')
                .eq('company_id', selectedCompany.id).order('created_at', { ascending: true });
            if (error) throw error;
            setTemplates(data ?? []);
        } catch {
            setTemplates([]);
        } finally {
            setLoadingTasks(false);
        }
    };

    const loadMembers = async () => {
        if (!selectedCompany) return;
        try {
            const { data: memberData } = await supabase
                .from('organization_members').select('user_id')
                .eq('company_id', selectedCompany.id).eq('status', 'active');
            if (!memberData?.length) return;
            const userIds = memberData.map(m => m.user_id);
            const { data: profiles } = await supabase
                .from('profiles').select('id, full_name, email, avatar_url').in('id', userIds);
            setMembers((profiles ?? []).map(p => ({
                user_id: p.id, name: p.full_name || p.email, email: p.email, avatar_url: p.avatar_url,
            })));
        } catch { /* ignore */ }
    };

    // ── Column CRUD ───────────────────────────────────────────────────────────

    const addColumn = () => {
        const c: KanbanColumnTemplate = { id: `col-${Date.now()}`, title: '', color: '#6b7280', is_done_column: false, position: config.columns.length };
        setConfig(prev => ({ ...prev, columns: [...prev.columns, c] }));
    };
    const updateColumn = (id: string, field: keyof KanbanColumnTemplate, value: any) =>
        setConfig(prev => ({ ...prev, columns: prev.columns.map(c => c.id === id ? { ...c, [field]: value } : c) }));
    const deleteColumn = (id: string) =>
        setConfig(prev => ({ ...prev, columns: prev.columns.filter(c => c.id !== id).map((c, i) => ({ ...c, position: i })) }));
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setConfig(prev => {
            const oi = prev.columns.findIndex(c => c.id === active.id);
            const ni = prev.columns.findIndex(c => c.id === over.id);
            return { ...prev, columns: arrayMove(prev.columns, oi, ni).map((c, i) => ({ ...c, position: i })) };
        });
    };

    const handleSaveColunas = async () => {
        if (!selectedCompany) return;
        if (config.columns.some(c => !c.title.trim())) { toast.error('Todos os nomes das colunas devem ser preenchidos'); return; }
        if (!config.columns.length) { toast.error('Adicione pelo menos uma coluna'); return; }
        setSavingCols(true);
        try {
            const { error } = await supabase.from('companies').update({ kanban_columns: config }).eq('id', selectedCompany.id);
            if (error) throw error;
            toast.success('Configuração de colunas salva!');
        } catch { toast.error('Erro ao salvar. Verifique se o SQL foi executado no Supabase.'); }
        finally { setSavingCols(false); }
    };

    const handleApplyToAll = async () => {
        if (!selectedCompany) return;
        const ok = await confirm('Aplicar a Todos os Clientes',
            `Esta ação sobrescreverá as colunas Kanban de ${clientCount} cliente(s) ativo(s). Deseja continuar?`,
            { type: 'warning', confirmText: 'Aplicar a Todos' });
        if (!ok) return;
        setApplying(true);
        try {
            const { data: clients } = await supabase.from('clients').select('id')
                .eq('company_id', selectedCompany.id).eq('status', 'active');
            if (!clients?.length) { toast.info('Nenhum cliente ativo'); return; }
            for (const client of clients) {
                await supabase.from('kanban_columns').delete().eq('client_id', client.id).eq('is_default', true);
                await supabase.from('kanban_columns').insert(
                    config.columns.map(col => ({
                        client_id: client.id, company_id: selectedCompany.id,
                        column_id: col.id, title: col.title, color: col.color,
                        order_index: col.position, is_default: true,
                    }))
                );
            }
            toast.success(`Template aplicado a ${clients.length} cliente(s)!`);
        } catch { toast.error('Erro ao aplicar template'); }
        finally { setApplying(false); }
    };

    // ── Task Template CRUD ────────────────────────────────────────────────────

    const handleSaveTemplate = async (data: Partial<TaskTemplate>) => {
        if (!selectedCompany || !data.title?.trim()) return;
        try {
            const payload = {
                company_id: selectedCompany.id,
                title: data.title.trim(),
                description: data.description ?? '',
                priority: data.priority ?? 'medium',
                subtasks: data.subtasks ?? [],
                assignees: data.assignees ?? [],
            };
            if (data.id) {
                const { error } = await supabase.from('kanban_task_templates').update(payload).eq('id', data.id);
                if (error) throw error;
                toast.success('Template atualizado!');
            } else {
                const { error } = await supabase.from('kanban_task_templates').insert(payload);
                if (error) throw error;
                toast.success('Template criado!');
            }
            setModalTemplate(false);
            loadTaskTemplates();
        } catch (err: any) {
            console.error(err);
            toast.error('Erro ao salvar template. Verifique se o SQL foi executado no Supabase.');
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        const ok = await confirm('Excluir Template', 'Tem certeza que deseja excluir este template de tarefa?',
            { type: 'danger', confirmText: 'Excluir' });
        if (!ok) return;
        try {
            await supabase.from('kanban_task_templates').delete().eq('id', id);
            toast.success('Template excluído');
            loadTaskTemplates();
        } catch { toast.error('Erro ao excluir template'); }
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    const hasDoneColumn = config.columns.some(c => c.is_done_column);

    return (
        <div className="p-8 max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                        <Columns className="w-5 h-5 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Configuração do Kanban</h1>
                </div>
                <p className="text-gray-400 text-sm mt-1 ml-[52px]">
                    Defina templates padrão de colunas e tarefas para o quadro Kanban.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/10 w-fit">
                {[
                    { key: 'colunas', label: 'Colunas', icon: <Columns size={15} /> },
                    { key: 'tarefas', label: 'Tarefas', icon: <ClipboardList size={15} /> },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                        className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ════════════════ TAB: COLUNAS ════════════════ */}
            {activeTab === 'colunas' && (
                <>
                    {/* Toggle */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                        <div className="p-6 flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <h2 className="text-white font-semibold text-base mb-1">Padronizar colunas para novos clientes</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Quando ativado, novos clientes receberão automaticamente as colunas configuradas abaixo.
                                </p>
                            </div>
                            <button onClick={() => setConfig(prev => ({ ...prev, use_default: !prev.use_default }))}
                                className="shrink-0 mt-1 focus:outline-none">
                                {config.use_default
                                    ? <ToggleRight size={44} className="text-primary drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                    : <ToggleLeft size={44} className="text-gray-600" />}
                            </button>
                        </div>
                        {config.use_default && (
                            <div className="border-t border-white/5 px-6 py-3 bg-primary/5 flex items-center gap-2">
                                <Info size={14} className="text-primary shrink-0" />
                                <p className="text-xs text-primary/80">Padronização ativa — novos clientes herdarão este template.</p>
                            </div>
                        )}
                    </div>

                    {/* Column Editor */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h2 className="text-white font-semibold text-base mb-0.5">Template de Colunas</h2>
                                <p className="text-gray-500 text-xs">Arraste para reordenar · Clique na cor para alterar</p>
                            </div>
                            <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                {config.columns.length} {config.columns.length === 1 ? 'coluna' : 'colunas'}
                            </span>
                        </div>
                        <div className="p-6 space-y-2">
                            {loadingCols ? (
                                <div className="flex justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={config.columns.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                        {config.columns.map(col => (
                                            <SortableColumnRow key={col.id} col={col} onUpdate={updateColumn}
                                                onDelete={deleteColumn} canDelete={config.columns.length > 1} />
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            )}
                            <button onClick={addColumn}
                                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-white/10 text-gray-500 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all text-sm mt-2">
                                <Plus size={16} /> Adicionar Coluna
                            </button>
                        </div>
                        {!hasDoneColumn && config.columns.length > 0 && (
                            <div className="border-t border-white/5 px-6 py-3 bg-amber-500/5 flex items-center gap-2">
                                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                                <p className="text-xs text-amber-400/80">Nenhuma coluna marcada como "Conclusão".</p>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <button onClick={handleApplyToAll} disabled={applying || !config.columns.length}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 hover:text-white transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                                {applying ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Users size={16} />}
                                {applying ? 'Aplicando...' : 'Aplicar a Todos os Clientes'}
                                {clientCount > 0 && !applying && (
                                    <span className="text-xs text-gray-500 bg-white/10 px-2 py-0.5 rounded-full">{clientCount}</span>
                                )}
                            </button>
                            <p className="text-[10px] text-gray-600 ml-1">Sobrescreve as colunas padrão dos clientes existentes.</p>
                        </div>
                        <button onClick={handleSaveColunas} disabled={savingCols || !config.columns.length}
                            className="flex items-center justify-center gap-2 px-7 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-white font-medium text-sm transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">
                            {savingCols ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
                            {savingCols ? 'Salvando...' : 'Salvar Configuração'}
                        </button>
                    </div>
                </>
            )}

            {/* ════════════════ TAB: TAREFAS ════════════════ */}
            {activeTab === 'tarefas' && (
                <>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h2 className="text-white font-semibold text-base mb-0.5">Templates de Tarefas</h2>
                                <p className="text-gray-500 text-xs">
                                    Crie modelos reutilizáveis com subtarefas e responsáveis pré-definidos
                                </p>
                            </div>
                            <button onClick={() => setModalTemplate({})}
                                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary/20">
                                <Plus size={15} /> Novo Template
                            </button>
                        </div>

                        <div className="p-6">
                            {loadingTasks ? (
                                <div className="flex justify-center py-10">
                                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : templates.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                                        <ClipboardList size={24} className="text-gray-600" />
                                    </div>
                                    <p className="text-white/60 font-medium mb-1">Nenhum template criado</p>
                                    <p className="text-gray-600 text-sm max-w-xs">
                                        Crie templates de tarefas para agilizar a criação de tarefas recorrentes no Kanban.
                                    </p>
                                    <button onClick={() => setModalTemplate({})}
                                        className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/80 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary/20">
                                        <Plus size={15} /> Criar Primeiro Template
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {templates.map(t => (
                                        <TaskTemplateCard key={t.id} template={t} members={members}
                                            onEdit={t => setModalTemplate(t)} onDelete={handleDeleteTemplate} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Info banner */}
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                        <Info size={15} className="text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-300/80 leading-relaxed">
                            Os templates criados aqui ficam disponíveis para seleção ao criar uma nova tarefa no Kanban,
                            preenchendo automaticamente o título, subtarefas e responsáveis.
                        </p>
                    </div>
                </>
            )}

            {/* Modal */}
            {modalTemplate !== false && (
                <TaskTemplateModal
                    template={modalTemplate || {}}
                    members={members}
                    onSave={handleSaveTemplate}
                    onClose={() => setModalTemplate(false)}
                />
            )}
        </div>
    );
};

export default ConfiguracaoKanban;
