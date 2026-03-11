import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { supabase } from '../../lib/supabase';
import {
    CheckCircle2,
    Clock,
    TrendingUp,
    Calendar as CalendarIcon,
    AlertCircle,
    ArrowRight,
    Plus,
    Rocket,
    ChevronDown
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { format, isSameDay, parseISO, addDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import KanbanCardModal from '../Organizador/KanbanCardModal';

// --- Components ---

const Atividades = () => {
    const { selectedCompany } = useCompany();
    const { user } = useAuth();

    // Use Global Dashboard Context
    const {
        metrics,
        priorityTasks,
        productivityData,
        upcomingDeadlines,
        completedTasksToday,
        completedParentTasksToday,
        completedSubtasksToday,
        loading,
        filterRange,
        setFilterRange,
        userProfile,
        refreshDashboard
    } = useDashboard();

    // Calendar State (Local UI state is fine)
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Dropdown state
    const [isRangeDropdownOpen, setIsRangeDropdownOpen] = useState(false);

    // Modal State
    const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
    const [defaultColumnId, setDefaultColumnId] = useState<string>('');
    const [teamMembers, setTeamMembers] = useState<any[]>([]);

    useEffect(() => {
        if (selectedCompany) {
            fetchDefaultColumn();
            fetchTeamMembers();
        }
    }, [selectedCompany]);

    const fetchTeamMembers = async () => {
        if (!selectedCompany) return;
        const { data } = await supabase
            .from('organization_members')
            .select('user_id, status')
            .eq('company_id', selectedCompany.id)
            .eq('status', 'active')
            .limit(20);

        if (data) {
            const userIds = data.map(d => d.user_id);
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url')
                .in('id', userIds);

            const merged = data.map(member => ({
                ...member,
                profile: profiles?.find(p => p.id === member.user_id)
            }));
            setTeamMembers(merged);
        }
    };

    const fetchDefaultColumn = async () => {
        if (!selectedCompany) return;
        const { data } = await supabase
            .from('kanban_columns')
            .select('id')
            .eq('company_id', selectedCompany.id)
            .order('position')
            .limit(1)
            .single();

        if (data) setDefaultColumnId(data.id);
    };

    // --- Render Helpers ---

    const renderCalendar = () => {
        const start = startOfWeek(new Date(), { weekStartsOn: 0 });
        const end = endOfWeek(new Date(), { weekStartsOn: 0 });
        const days = eachDayOfInterval({ start, end });

        return (
            <div className="mb-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                        <div key={`${d}-${i}`} className="text-xs text-gray-500 font-bold text-center h-8 flex items-center justify-center">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, idx) => {
                        const isToday = isSameDay(day, new Date());
                        const isSelected = isSameDay(day, selectedDate);
                        const hasDeadline = upcomingDeadlines.some(t => t.due_date && isSameDay(parseISO(t.due_date), day));

                        return (
                            <div key={idx} className="flex justify-center">
                                <button
                                    onClick={() => setSelectedDate(day)}
                                    className={`
                                    h-8 w-8 rounded-full flex items-center justify-center text-sm relative transition-all
                                    ${isSelected ? 'bg-primary text-white font-bold shadow-lg shadow-primary/30' : 'text-gray-300 hover:bg-white/5'}
                                    ${isToday && !isSelected ? 'border border-primary text-primary' : ''}
                                `}
                                >
                                    {format(day, 'd')}
                                    {hasDeadline && !isSelected && (
                                        <div className="absolute bottom-0.5 w-1 h-1 bg-red-500 rounded-full"></div>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // if (loading) {
    //    return <div className="p-8 text-white">Carregando painel...</div>;
    // }

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">

            {/* 1. Welcome Banner */}
            <div className="glass-card rounded-3xl p-8 border border-white/10 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                <div className="relative z-10 flex justify-between items-center">
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-white mb-2">
                            Bem-vindo(a), {userProfile?.full_name || 'Usuário'}!
                        </h1>
                        <p className="text-gray-400 max-w-md">
                            Seu painel está atualizado. Você tem <span className="text-primary font-bold">{metrics.totalAssigned}</span> tarefas atribuídas e já concluiu <span className="text-emerald-400 font-bold">{metrics.completedToday}</span> hoje.
                        </p>
                    </div>

                    {/* Efficiency Widget */}
                    <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/5 text-center min-w-[160px] relative group overflow-hidden transition-all hover:bg-white/10 hover:border-primary/30">
                        {/* Glow Effect */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                        <div className="relative z-10">
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner border border-white/5 group-hover:scale-110 transition-transform duration-300">
                                <Rocket size={28} className="text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            </div>
                            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1 group-hover:text-gray-300 transition-colors">Eficiência</div>
                            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 group-hover:from-white group-hover:to-white transition-all min-h-[40px]">
                                {loading ? (
                                    <span className="animate-pulse bg-white/10 h-8 w-16 rounded inline-block"></span>
                                ) : (
                                    `${metrics.efficiency}%`
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">

                {/* LEFT COLUMN */}
                <div className="space-y-6">
                    {/* Em Andamento / Prioridades */}
                    <div className="glass-card p-6 rounded-2xl border border-white/10 h-[400px] flex flex-col">
                        <div className="flex items-center gap-2 mb-6">
                            <AlertCircle size={20} className="text-yellow-500" />
                            <h3 className="text-lg font-bold text-white">Pendências Prioritárias</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5 animate-pulse h-24"></div>
                                ))
                            ) : priorityTasks.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm">
                                    <CheckCircle2 size={32} className="mb-2 opacity-50" />
                                    Tudo em dia por aqui!
                                </div>
                            ) : (
                                priorityTasks.map(task => (
                                    <div key={task.id} className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-primary/30 transition-colors group cursor-pointer">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${task.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                                                }`}>
                                                {task.priority === 'urgent' ? 'Urgente' : 'Alta'}
                                            </span>
                                            <span className="text-[10px] text-gray-500">{task.column?.title}</span>
                                        </div>
                                        <h4 className="text-white font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">{task.title}</h4>
                                        {task.due_date && (
                                            <div className="text-xs text-gray-400 flex items-center gap-1">
                                                <Clock size={12} /> {format(parseISO(task.due_date), "d 'de' MMM", { locale: ptBR })}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* MIDDLE COLUMN */}
                <div className="space-y-6">
                    {/* Concluídos Hoje */}
                    <div className="glass-card p-6 rounded-2xl border border-white/10 h-[400px] flex flex-col relative overflow-hidden">
                        <div className="flex items-center gap-2 mb-2 z-10">
                            <CheckCircle2 size={20} className="text-emerald-500" />
                            <h3 className="text-lg font-bold text-white">Concluídos</h3>
                        </div>
                        <p className="text-xs text-gray-400 mb-6 z-10">Progresso diário</p>

                        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none"></div>

                        <div className="flex-1 flex flex-col items-center justify-center z-10 w-full">
                            <div className="flex gap-8 w-full justify-center">
                                {/* Tasks PAI */}
                                <div className="flex flex-col items-center">
                                    <div className="relative w-28 h-28 flex items-center justify-center">
                                        {loading ? (
                                            <div className="w-20 h-20 rounded-full border-4 border-white/10 animate-spin border-t-emerald-500"></div>
                                        ) : (
                                            <div style={{ width: '100%', height: '100%' }}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={80} minHeight={80}>
                                                    <PieChart>
                                                        <Pie
                                                            data={[
                                                                { name: 'Tasks', value: metrics.completedParentToday },
                                                                { name: 'Restante', value: Math.max(1, 10 - metrics.completedParentToday) }
                                                            ]}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={35}
                                                            outerRadius={50}
                                                            startAngle={90}
                                                            endAngle={-270}
                                                            dataKey="value"
                                                            stroke="none"
                                                        >
                                                            <Cell fill="#10b981" />
                                                            <Cell fill="#ffffff10" />
                                                        </Pie>
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                    <span className="text-2xl font-bold text-white">{metrics.completedParentToday}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-widest mt-2">Tasks PAI</span>
                                </div>

                                {/* Subtarefas */}
                                <div className="flex flex-col items-center">
                                    <div className="relative w-28 h-28 flex items-center justify-center">
                                        {loading ? (
                                            <div className="w-20 h-20 rounded-full border-4 border-white/10 animate-spin border-t-amber-500"></div>
                                        ) : (
                                            <div style={{ width: '100%', height: '100%' }}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={80} minHeight={80}>
                                                    <PieChart>
                                                        <Pie
                                                            data={[
                                                                { name: 'Subs', value: metrics.completedSubtasksToday },
                                                                { name: 'Restante', value: Math.max(1, 10 - metrics.completedSubtasksToday) }
                                                            ]}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={35}
                                                            outerRadius={50}
                                                            startAngle={90}
                                                            endAngle={-270}
                                                            dataKey="value"
                                                            stroke="none"
                                                        >
                                                            <Cell fill="#f59e0b" />
                                                            <Cell fill="#ffffff10" />
                                                        </Pie>
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                    <span className="text-2xl font-bold text-white">{metrics.completedSubtasksToday}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-widest mt-2">Subtarefas</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                    <span>Tasks PAI</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                    <span>Subtarefas</span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Completed List */}
                        <div className="mt-4 border-t border-white/10 pt-4 z-10">
                            <div className="text-xs font-bold text-emerald-400 mb-2 uppercase">Finalizados Hoje</div>
                            <div className="space-y-2 max-h-[80px] overflow-y-auto custom-scrollbar">
                                {loading ? (
                                    <div className="space-y-2">
                                        <div className="h-4 bg-white/5 rounded w-3/4 animate-pulse"></div>
                                        <div className="h-4 bg-white/5 rounded w-1/2 animate-pulse"></div>
                                    </div>
                                ) : completedTasksToday.length === 0 ? (
                                    <span className="text-xs text-gray-500 italic">Nenhuma tarefa finalizada ainda.</span>
                                ) : (
                                    completedTasksToday.map((title, i) => (
                                        <div key={i} className="text-xs text-gray-300 truncate flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                            {title}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                    {/* Calendar & Deadlines */}
                    <div className="glass-card p-6 rounded-2xl border border-white/10 h-full min-h-[400px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white capitalize">{format(new Date(), 'MMMM', { locale: ptBR })}</h3>
                            <div className="flex gap-1">
                                {/* Calendar Navigation placeholders */}
                            </div>
                        </div>

                        {renderCalendar()}

                        <div className="flex-1 mt-4">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-sm font-bold text-white">Próximas Entregas</h4>
                                <Link to="/calendario" className="text-[10px] text-primary hover:underline uppercase font-bold">Ver Todas</Link>
                            </div>

                            <div className="space-y-3">
                                {loading ? (
                                    [1, 2].map(i => (
                                        <div key={i} className="bg-white/5 p-3 rounded-lg h-12 animate-pulse"></div>
                                    ))
                                ) : upcomingDeadlines.length === 0 ? (
                                    <div className="text-center text-gray-500 text-xs py-4">Sem prazos próximos.</div>
                                ) : (
                                    upcomingDeadlines.map(task => (
                                        <Link key={task.id} to="/calendario" className="bg-white/5 p-3 rounded-lg border-l-2 border-primary flex justify-between items-center group cursor-pointer hover:bg-white/10 transition-all">
                                            <div className="overflow-hidden mr-2">
                                                <div className="text-white text-xs font-medium truncate group-hover:text-primary transition-colors">{task.title}</div>
                                                <div className="text-[10px] text-gray-400">{format(parseISO(task.due_date!), "d 'de' MMM", { locale: ptBR })}</div>
                                            </div>
                                            <ArrowRight size={14} className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </Link>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Team Status (Mini) */}
                        <div className="mt-6 pt-4 border-t border-white/10">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-gray-400 uppercase">Equipe</span>
                                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> {teamMembers.length > 0 ? `${teamMembers.length} Ativos` : 'Offline'}
                                </span>
                            </div>
                            <div className="flex -space-x-2">
                                {teamMembers.length === 0 ? (
                                    <div className="text-xs text-gray-500 pl-1">...</div>
                                ) : (
                                    teamMembers.slice(0, 5).map((member, i) => (
                                        <div
                                            key={i}
                                            className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 border-2 border-[#0f0f1a] flex items-center justify-center text-xs font-bold text-white cursor-help relative group overflow-hidden"
                                            title={member.profile?.full_name || member.profile?.email}
                                        >
                                            {member.profile?.avatar_url ? (
                                                <img
                                                    src={member.profile.avatar_url}
                                                    alt={member.profile.full_name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                member.profile?.full_name?.charAt(0).toUpperCase() || '?'
                                            )}
                                        </div>
                                    ))
                                )}
                                {teamMembers.length > 5 && (
                                    <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-[#0f0f1a] flex items-center justify-center text-xs text-gray-400">
                                        +{teamMembers.length - 5}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Chart: Productivity */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 h-[300px]">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <TrendingUp size={20} className="text-primary" /> Produtividade
                        </h3>
                        <p className="text-xs text-gray-400">Análise de desempenho temporal ({filterRange === 7 ? 'Últimos 7 dias' : 'Mês atual'})</p>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setIsRangeDropdownOpen(!isRangeDropdownOpen)}
                            className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-primary/50 transition-all rounded-xl px-4 py-2 text-sm text-white group"
                        >
                            <CalendarIcon size={16} className="text-primary" />
                            <span>{filterRange === 7 ? 'Esta Semana' : 'Este Mês'}</span>
                            <ChevronDown size={14} className={`text-gray-500 transition-transform duration-300 ${isRangeDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isRangeDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsRangeDropdownOpen(false)}></div>
                                <div className="absolute right-0 mt-2 w-48 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2 z-20 animate-in fade-in zoom-in-95 duration-200">
                                    <button
                                        onClick={() => { setFilterRange(7); setIsRangeDropdownOpen(false); }}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all ${filterRange === 7 ? 'bg-primary/20 text-primary font-bold' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                    >
                                        Esta Semana
                                        {filterRange === 7 && <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(99,102,241,1)]"></div>}
                                    </button>
                                    <button
                                        onClick={() => { setFilterRange(30); setIsRangeDropdownOpen(false); }}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all ${filterRange === 30 ? 'bg-primary/20 text-primary font-bold' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                    >
                                        Este Mês
                                        {filterRange === 30 && <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(99,102,241,1)]"></div>}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="w-full h-[200px]" style={{ minHeight: '200px' }}>
                    {loading ? (
                        <div className="w-full h-full bg-white/5 animate-pulse rounded-xl"></div>
                    ) : (
                        <div style={{ width: '100%', height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                                <AreaChart data={productivityData}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                        labelStyle={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px', fontWeight: 'bold' }}
                                    />
                                    <Area name="Atividades" type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* New Task Modal */}
            {isNewTaskModalOpen && (
                <KanbanCardModal
                    cardId="new"
                    columnId={defaultColumnId} // Pass fetched default column
                    onClose={() => {
                        setIsNewTaskModalOpen(false);
                        refreshDashboard(); // Refresh data after close
                    }}
                />
            )}
        </div>
    );
};

export default Atividades;
