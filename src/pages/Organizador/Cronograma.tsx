import React, { useState, useEffect, useRef } from 'react';
import {
    Calendar,
    Plus,
    FileText,
    MoreHorizontal,
    Trash2,
    Edit3,
    Download,
    Share2,
    Mail,
    MessageCircle,
    ChevronLeft,
    LayoutGrid,
    Presentation,
    Save,
    CheckCircle2,
    X
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useUI } from '../../context/UIContext';

// --- Types ---
interface MonthlySchedule {
    id: string;
    company_id: string;
    client_id: string;
    month: number;
    year: number;
    status: 'draft' | 'pending' | 'approved';
    strategy_focus: string;
    strategy_dates: string;
    strategy_offer: string;
    strategy_creative: string;
    created_at: string;
    client?: { name: string };
}

interface SchedulePost {
    id: string;
    schedule_id: string;
    week_number: number;
    position: number;
    format: string; // 'reels', 'static', 'carousel', 'story'
    theme: string;
    objective: string;
    hook: string;
    pain_desire: string;
    caption_idea?: string;
}

interface Client {
    id: string;
    name: string;
}

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const FORMATS = [
    { id: 'reels', label: 'Reels', color: 'bg-pink-500/20 text-pink-400' },
    { id: 'static', label: 'Estático', color: 'bg-blue-500/20 text-blue-400' },
    { id: 'carousel', label: 'Carrossel', color: 'bg-purple-500/20 text-purple-400' },
    { id: 'story', label: 'Story', color: 'bg-yellow-500/20 text-yellow-400' }
];

const OrganizadorCronograma = () => {
    const { selectedCompany } = useCompany();
    const { confirm, toast } = useUI();
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [schedules, setSchedules] = useState<MonthlySchedule[]>([]);
    const [currentSchedule, setCurrentSchedule] = useState<MonthlySchedule | null>(null);
    const [posts, setPosts] = useState<SchedulePost[]>([]);
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);

    // New Schedule Modal
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1); // 1-12
    const [newYear, setNewYear] = useState(new Date().getFullYear());
    const [newClientId, setNewClientId] = useState('');

    // Editor State
    const [activeTab, setActiveTab] = useState<'strategy' | 'content' | 'visualize'>('strategy');
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false); // Feedback state

    // PDF Ref - Using multiple refs for pages
    const pagesRef = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        if (selectedCompany) {
            fetchSchedules();
            fetchClients();
        }
    }, [selectedCompany]);

    useEffect(() => {
        const handleGlobalNewSchedule = () => {
            setIsNewModalOpen(true);
        };

        window.addEventListener('open-new-schedule', handleGlobalNewSchedule);
        return () => window.removeEventListener('open-new-schedule', handleGlobalNewSchedule);
    }, []);

    const fetchSchedules = async () => {
        if (!selectedCompany) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('monthly_schedules')
                .select('*, client:clients(name)')
                .eq('company_id', selectedCompany.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSchedules(data || []);
        } catch (error) {
            console.error('Error fetching schedules:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchClients = async () => {
        if (!selectedCompany) return;
        const { data } = await supabase
            .from('clients')
            .select('id, name')
            .eq('company_id', selectedCompany.id)
            .eq('status', 'active');
        if (data) setClients(data);
    };

    const fetchPosts = async (scheduleId: string) => {
        const { data } = await supabase
            .from('schedule_posts')
            .select('*')
            .eq('schedule_id', scheduleId)
            .order('week_number')
            .order('position');
        setPosts(data || []);
    };

    const handleCreateSchedule = async () => {
        if (!selectedCompany || !newClientId) return;
        try {
            const { data, error } = await supabase
                .from('monthly_schedules')
                .insert({
                    company_id: selectedCompany.id,
                    client_id: newClientId,
                    month: newMonth,
                    year: newYear,
                    status: 'draft'
                })
                .select('*, client:clients(name)')
                .single();

            if (error) throw error;

            setSchedules([data, ...schedules]);
            setIsNewModalOpen(false);
            handleOpenSchedule(data);
        } catch (error) {
            console.error('Error creating schedule:', error);
            toast.error('Erro ao criar cronograma.', 'Erro');
        }
    };

    const handleOpenSchedule = async (schedule: MonthlySchedule) => {
        setCurrentSchedule(schedule);
        await fetchPosts(schedule.id);
        setView('edit');
        setActiveTab('strategy');
    };

    const handleDeleteSchedule = async (id: string) => {
        if (!await confirm('Excluir Cronograma', 'Isso apagará todo o planejamento. Deseja continuar?', { type: 'danger' })) return;
        try {
            await supabase.from('monthly_schedules').delete().eq('id', id);
            setSchedules(schedules.filter(s => s.id !== id));
        } catch (error) {
            console.error('Error deleting:', error);
        }
    };

    // --- Editor Functions ---

    const handleSaveAll = async () => {
        if (!currentSchedule) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('monthly_schedules')
                .update({
                    strategy_focus: currentSchedule.strategy_focus,
                    strategy_dates: currentSchedule.strategy_dates,
                    strategy_offer: currentSchedule.strategy_offer,
                    strategy_creative: currentSchedule.strategy_creative,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentSchedule.id);

            if (error) throw error;
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            console.error('Error saving strategy:', error);
        } finally {
            setSaving(false);
        }
    };

    const markAsDelivered = async () => {
        if (!currentSchedule || currentSchedule.status !== 'draft') return;
        try {
            const { error } = await supabase
                .from('monthly_schedules')
                .update({ status: 'pending' })
                .eq('id', currentSchedule.id);

            if (!error) {
                setCurrentSchedule(prev => prev ? ({ ...prev, status: 'pending' }) : null);
                setSchedules(prev => prev.map(s => s.id === currentSchedule.id ? { ...s, status: 'pending' } : s));
            }
        } catch (e) {
            console.error("Error updating status", e);
        }
    };

    const handleAddPost = async (week: number) => {
        if (!currentSchedule) return;
        try {
            const { data, error } = await supabase
                .from('schedule_posts')
                .insert({
                    schedule_id: currentSchedule.id,
                    week_number: week,
                    position: posts.filter(p => p.week_number === week).length,
                    format: 'static',
                    theme: '',
                    objective: '',
                    hook: '',
                    pain_desire: ''
                })
                .select()
                .single();

            if (error) throw error;
            setPosts([...posts, data]);
        } catch (error) {
            console.error('Error adding post:', error);
        }
    };

    const handleUpdatePost = async (postId: string, field: string, value: string) => {
        // Optimistic update
        setPosts(posts.map(p => p.id === postId ? { ...p, [field]: value } : p));

        // Debounce could be added here for performance
        try {
            await supabase
                .from('schedule_posts')
                .update({ [field]: value })
                .eq('id', postId);
        } catch (error) {
            console.error('Error updating post:', error);
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!await confirm('Excluir Post', 'Excluir este post do cronograma?', { type: 'danger' })) return;
        try {
            await supabase.from('schedule_posts').delete().eq('id', postId);
            setPosts(posts.filter(p => p.id !== postId));
        } catch (error) {
            console.error('Error deleting post:', error);
        }
    };

    // --- Export Functions ---

    const handleDownloadPDF = async () => {
        // Switch to visualize tab first to ensure refs are populated
        setActiveTab('visualize');

        // Wait for render
        setTimeout(async () => {
            if (pagesRef.current.length === 0) return;

            try {
                // A4 Landscape dimensions in pixels (approximate for screen match)
                // standard A4 is 297mm x 210mm. 
                // jsPDF default is mm, but we used 'px'. 
                // Let's rely on the aspect ratio of the captured element.

                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'px',
                    format: [1123, 794] // A4 at 96 DPI approx, or just match container size
                });

                const pdfWidth = 1123;
                const pdfHeight = 794;

                for (let i = 0; i < pagesRef.current.length; i++) {
                    const pageEl = pagesRef.current[i];
                    if (!pageEl) continue;

                    const canvas = await html2canvas(pageEl, {
                        scale: 2, // High resolution
                        backgroundColor: '#0f0f1a',
                        logging: false,
                        useCORS: true,
                        width: 1123, // Force width to match A4 ratio container
                        height: 794
                    });

                    const imgData = canvas.toDataURL('image/png');

                    if (i > 0) pdf.addPage();

                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                }

                pdf.save(`Cronograma_${currentSchedule?.client?.name}_${MONTHS[(currentSchedule?.month || 1) - 1]}.pdf`);
                markAsDelivered();
            } catch (error) {
                console.error("Error generating PDF", error);
                toast.error('Erro ao gerar PDF.', 'Erro');
            }
        }, 1000);
    };

    const handleSendWhatsapp = () => {
        if (!currentSchedule) return;
        markAsDelivered();
        const clientName = currentSchedule.client?.name || 'Cliente';
        const monthName = MONTHS[currentSchedule.month - 1];
        const text = `Olá ${clientName}, segue o planejamento estratégico de ${monthName} para aprovação. Por favor, confira o PDF em anexo!`;
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const handleSendEmail = () => {
        if (!currentSchedule) return;
        markAsDelivered();
        const monthName = MONTHS[currentSchedule.month - 1];
        const subject = `Planejamento Estratégico - ${monthName}`;
        const body = `Olá,\n\nSegue em anexo o cronograma de ${monthName} para revisão.\n\nAtenciosamente,`;
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    };

    // --- Views ---

    if (view === 'list') {
        return (
            <div className="p-8 h-full max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex-1"></div>
                </div>

                {loading ? (
                    <div className="text-white">Carregando...</div>
                ) : schedules.length === 0 ? (
                    <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
                        <Calendar size={48} className="mx-auto text-gray-500 mb-4" />
                        <h3 className="text-xl font-bold text-white">Nenhum cronograma encontrado</h3>
                        <p className="text-gray-400 mt-2">Crie o primeiro planejamento para seus clientes.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {schedules.map(schedule => (
                            <div key={schedule.id} className="bg-[#0f0f1a] border border-white/10 rounded-xl p-6 hover:border-primary/50 transition-all group relative">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-lg border border-primary/20">
                                        {schedule.month.toString().padStart(2, '0')}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(schedule.id); }}
                                        className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">{schedule.client?.name || 'Cliente Removido'}</h3>
                                <p className="text-gray-400 text-sm mb-4">{MONTHS[schedule.month - 1]} / {schedule.year}</p>

                                <div className="flex items-center gap-2 mb-6">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${schedule.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                        schedule.status === 'pending' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                                            'bg-gray-500/10 border-gray-500/20 text-gray-400'
                                        }`}>
                                        {schedule.status === 'approved' ? 'Aprovado' : schedule.status === 'pending' ? 'Pendente' : 'Rascunho'}
                                    </span>
                                </div>

                                <button
                                    onClick={() => handleOpenSchedule(schedule)}
                                    className="w-full bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Edit3 size={16} /> Editar Planejamento
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal Novo Cronograma */}
                {isNewModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        {/* 1. Overlay Premium */}
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-md z-0 animate-in fade-in duration-300"
                            onClick={() => setIsNewModalOpen(false)}
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
                                <h2 className="text-xl font-bold text-[#EEEEEE] mb-1">Novo cronograma</h2>
                                <p className="text-xs text-[#6e6e6e] font-light">Crie um novo planejamento mensal de conteúdo.</p>
                            </div>

                            <div className="p-8 pt-2 space-y-5 relative z-20">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide ml-1">Cliente</label>
                                    <div className="relative group">
                                        <select
                                            className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none appearance-none cursor-pointer transition-all duration-300 text-sm font-light"
                                            value={newClientId}
                                            onChange={e => setNewClientId(e.target.value)}
                                        >
                                            <option value="" className="bg-[#0a0a1a]">Selecione...</option>
                                            {clients.map(client => (
                                                <option key={client.id} value={client.id} className="bg-[#0a0a1a]">{client.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide ml-1">Mês</label>
                                        <div className="relative group">
                                            <select
                                                className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none appearance-none cursor-pointer transition-all duration-300 text-sm font-light"
                                                value={newMonth}
                                                onChange={e => setNewMonth(Number(e.target.value))}
                                            >
                                                {MONTHS.map((m, i) => (
                                                    <option key={i} value={i + 1} className="bg-[#0a0a1a]">{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide ml-1">Ano</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light placeholder-[#6e6e6e]"
                                            value={newYear}
                                            onChange={e => setNewYear(Number(e.target.value))}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-4">
                                    <button
                                        onClick={() => setIsNewModalOpen(false)}
                                        className="px-5 py-2.5 text-sm text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-xl font-light"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleCreateSchedule}
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
            </div>
        );
    }

    // --- View: Edit ---

    return (
        <div className="flex flex-col h-full bg-[#0a0a1a]">
            {/* Header */}
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0f0f1a]">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView('list')} className="text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-lg">
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-white font-bold text-lg">{currentSchedule?.client?.name}</h2>
                        <p className="text-xs text-gray-400">{MONTHS[(currentSchedule?.month || 1) - 1]} / {currentSchedule?.year}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-white/5 rounded-lg p-1 mr-4 border border-white/10">
                        <button
                            onClick={() => setActiveTab('strategy')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'strategy' ? 'bg-primary text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            Estratégia
                        </button>
                        <button
                            onClick={() => setActiveTab('content')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'content' ? 'bg-primary text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            Conteúdo
                        </button>
                        <button
                            onClick={() => setActiveTab('visualize')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'visualize' ? 'bg-primary text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            Visualizar
                        </button>
                    </div>

                    <button
                        onClick={handleSaveAll}
                        disabled={saving}
                        className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all mr-4 shadow-lg
                        ${saveSuccess ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-primary hover:bg-secondary text-white shadow-primary/20'}
                        ${saving ? 'opacity-50 cursor-wait' : ''}
                    `}
                    >
                        {saveSuccess ? (
                            <><CheckCircle2 size={16} /> Salvo!</>
                        ) : (
                            <><Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}</>
                        )}
                    </button>

                    <button onClick={handleDownloadPDF} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg" title="Baixar PDF">
                        <Download size={20} />
                    </button>
                    <div className="h-6 w-px bg-white/10 mx-1"></div>
                    <button onClick={handleSendWhatsapp} className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg" title="Enviar WhatsApp">
                        <Share2 size={20} />
                    </button>
                    <button onClick={handleSendEmail} className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg" title="Enviar Email">
                        <Mail size={20} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

                {/* TAB: STRATEGY */}
                {activeTab === 'strategy' && currentSchedule && (
                    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-[#0f0f1a] border border-white/10 rounded-2xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <LayoutGrid size={20} className="text-primary" /> Estratégia do Mês
                                </h3>
                                {/* Botão Salvar Removido Daqui */}
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">Foco de Marketing</label>
                                    <textarea
                                        className="w-full h-24 bg-[#0a0a1a] border border-white/10 rounded-xl p-4 text-white focus:border-primary focus:outline-none resize-none"
                                        placeholder="Qual o objetivo principal deste mês? (Ex: Aumentar vendas do produto X, Branding, etc)"
                                        value={currentSchedule.strategy_focus || ''}
                                        onChange={e => setCurrentSchedule({ ...currentSchedule, strategy_focus: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-300 mb-2">Datas Importantes</label>
                                        <textarea
                                            className="w-full h-24 bg-[#0a0a1a] border border-white/10 rounded-xl p-4 text-white focus:border-primary focus:outline-none resize-none"
                                            placeholder="Feriados, eventos, lançamentos..."
                                            value={currentSchedule.strategy_dates || ''}
                                            onChange={e => setCurrentSchedule({ ...currentSchedule, strategy_dates: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-300 mb-2">Oferta Principal</label>
                                        <textarea
                                            className="w-full h-24 bg-[#0a0a1a] border border-white/10 rounded-xl p-4 text-white focus:border-primary focus:outline-none resize-none"
                                            placeholder="O que será vendido ou promovido com destaque?"
                                            value={currentSchedule.strategy_offer || ''}
                                            onChange={e => setCurrentSchedule({ ...currentSchedule, strategy_offer: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">Direção Criativa</label>
                                    <textarea
                                        className="w-full h-24 bg-[#0a0a1a] border border-white/10 rounded-xl p-4 text-white focus:border-primary focus:outline-none resize-none"
                                        placeholder="Estilo visual, tom de voz, referências..."
                                        value={currentSchedule.strategy_creative || ''}
                                        onChange={e => setCurrentSchedule({ ...currentSchedule, strategy_creative: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: CONTENT */}
                {activeTab === 'content' && (
                    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {[1, 2, 3, 4].map(week => (
                            <div key={week} className="bg-[#0f0f1a] border border-white/10 rounded-2xl overflow-hidden">
                                <div className="bg-white/5 p-4 border-b border-white/10 flex justify-between items-center">
                                    <h3 className="font-bold text-white">Semana {week}</h3>
                                    <button
                                        onClick={() => handleAddPost(week)}
                                        className="text-xs bg-primary/20 text-primary hover:bg-primary/30 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Adicionar Post
                                    </button>
                                </div>

                                <div className="p-4 space-y-4">
                                    {posts.filter(p => p.week_number === week).length === 0 ? (
                                        <div className="text-center py-8 text-gray-500 text-sm border-2 border-dashed border-white/5 rounded-xl">
                                            Nenhum post planejado para esta semana.
                                        </div>
                                    ) : (
                                        posts.filter(p => p.week_number === week).map(post => (
                                            <div key={post.id} className="bg-[#0a0a1a] border border-white/5 rounded-xl p-4 flex gap-4 hover:border-white/20 transition-all group">
                                                {/* Format Selector */}
                                                <div className="w-32 shrink-0">
                                                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Formato</label>
                                                    <select
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white focus:border-primary focus:outline-none"
                                                        value={post.format}
                                                        onChange={e => handleUpdatePost(post.id, 'format', e.target.value)}
                                                    >
                                                        {FORMATS.map(f => (
                                                            <option key={f.id} value={f.id}>{f.label}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Main Content */}
                                                <div className="flex-1 grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Tema / Objetivo</label>
                                                        <input
                                                            className="w-full bg-transparent border-b border-white/10 py-1 text-sm text-white focus:border-primary focus:outline-none placeholder:text-gray-700"
                                                            placeholder="Sobre o que é o post?"
                                                            value={post.theme || ''}
                                                            onChange={e => handleUpdatePost(post.id, 'theme', e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Hook (Gancho)</label>
                                                        <input
                                                            className="w-full bg-transparent border-b border-white/10 py-1 text-sm text-white focus:border-primary focus:outline-none placeholder:text-gray-700"
                                                            placeholder="Frase inicial para prender atenção"
                                                            value={post.hook || ''}
                                                            onChange={e => handleUpdatePost(post.id, 'hook', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Dor / Desejo (Gatilho)</label>
                                                        <input
                                                            className="w-full bg-transparent border-b border-white/10 py-1 text-sm text-white focus:border-primary focus:outline-none placeholder:text-gray-700"
                                                            placeholder="Qual emoção estamos explorando?"
                                                            value={post.pain_desire || ''}
                                                            onChange={e => handleUpdatePost(post.id, 'pain_desire', e.target.value)}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center">
                                                    <button
                                                        onClick={() => handleDeletePost(post.id)}
                                                        className="p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB: VISUALIZE (PPT VIEW) */}
                {activeTab === 'visualize' && currentSchedule && (
                    <div className="flex flex-col items-center pb-20 gap-8">

                        {/* PAGE 1: COVER & STRATEGY */}
                        <div
                            ref={el => { if (el) pagesRef.current[0] = el }}
                            className="w-[1123px] h-[794px] bg-[#0f0f1a] text-white p-12 shadow-2xl relative overflow-hidden flex flex-col shrink-0"
                        >
                            {/* Background Decoration */}
                            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                            {/* Cover / Header */}
                            <div className="text-center mb-12 border-b border-white/10 pb-8">
                                <h1 className="text-5xl font-bold mb-4">{currentSchedule.client?.name}</h1>
                                <p className="text-2xl text-gray-400 tracking-widest font-light">Planejamento Estratégico • {MONTHS[(currentSchedule?.month || 1) - 1]} {currentSchedule.year}</p>
                            </div>

                            {/* Strategy Content */}
                            <div className="flex-1 grid grid-cols-2 gap-12 content-start">
                                <div className="space-y-10">
                                    <div>
                                        <h3 className="text-primary font-bold uppercase tracking-wider mb-3 text-sm border-l-4 border-primary pl-4">Foco do Mês</h3>
                                        <p className="text-3xl font-light leading-relaxed">{currentSchedule.strategy_focus || 'Não definido'}</p>
                                    </div>
                                    <div>
                                        <h3 className="text-primary font-bold uppercase tracking-wider mb-3 text-sm border-l-4 border-primary pl-4">Oferta Principal</h3>
                                        <p className="text-xl text-gray-300">{currentSchedule.strategy_offer || 'Não definido'}</p>
                                    </div>
                                </div>
                                <div className="space-y-10">
                                    <div className="bg-white/5 p-8 rounded-2xl border border-white/10 h-full">
                                        <h3 className="text-white font-bold mb-6 flex items-center gap-3 text-xl">
                                            <Calendar size={24} className="text-primary" /> Datas Importantes
                                        </h3>
                                        <p className="text-gray-300 whitespace-pre-wrap text-lg leading-relaxed">{currentSchedule.strategy_dates || 'Nenhuma data marcada'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-auto pt-6 border-t border-white/10 text-center text-gray-500 text-sm flex justify-between items-center">
                                <span>Gerado por Nexum</span>
                                <span>{new Date().toLocaleDateString()}</span>
                            </div>
                        </div>

                        {/* PAGES 2+: WEEKS */}
                        {[1, 2, 3, 4].map((week, index) => {
                            const weekPosts = posts.filter(p => p.week_number === week);
                            if (weekPosts.length === 0) return null;

                            return (
                                <div
                                    key={week}
                                    ref={el => { if (el) pagesRef.current[index + 1] = el }}
                                    className="w-[1123px] h-[794px] bg-[#0f0f1a] text-white p-12 shadow-2xl relative overflow-hidden flex flex-col shrink-0"
                                >
                                    {/* Header da Semana */}
                                    <div className="text-center mb-8 pb-4 border-b border-white/10 relative z-10">
                                        <h2 className="text-3xl font-bold text-white tracking-widest">Semana {week}</h2>
                                    </div>

                                    {/* Posts Grid */}
                                    <div className="flex-1 grid grid-cols-2 gap-8 content-start">
                                        {weekPosts.map(post => (
                                            <div key={post.id} className="bg-[#0a0a1a] p-6 rounded-2xl border border-white/10 relative h-full flex flex-col">
                                                <div className="absolute top-0 right-0 left-0 flex justify-center -translate-y-1/2">
                                                    <span className={`px-6 py-1.5 rounded-full font-medium text-xs tracking-wider shadow-lg bg-[#0f0f1a] border ${post.format === 'reels' ? 'border-pink-500 text-pink-400' :
                                                        post.format === 'static' ? 'border-blue-500 text-blue-400' :
                                                            post.format === 'carousel' ? 'border-purple-500 text-purple-400' :
                                                                'border-yellow-500 text-yellow-400'
                                                        }`}>
                                                        {FORMATS.find(f => f.id === post.format)?.label}
                                                    </span>
                                                </div>

                                                <div className="mt-6 flex-1 flex flex-col">
                                                    <h4 className="font-bold text-xl mb-3 text-white break-words leading-tight text-center">{post.theme || 'Sem tema'}</h4>
                                                    <p className="text-base text-gray-400 mb-6 italic text-center flex-1">"{post.hook}"</p>

                                                    <div className="bg-white/5 p-4 rounded-xl text-sm text-gray-300 mt-auto">
                                                        <strong className="text-[#6e6e6e] block mb-1 text-[11px] font-medium tracking-tight">Gatilho (Dor/Desejo)</strong>
                                                        {post.pain_desire || '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer */}
                                    <div className="mt-auto pt-6 border-t border-white/10 text-center text-gray-500 text-sm flex justify-between items-center">
                                        <span>Gerado por Nexum</span>
                                        <span>{new Date().toLocaleDateString()}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrganizadorCronograma;
