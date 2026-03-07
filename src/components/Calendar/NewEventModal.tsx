
import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Users, Info, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../context/CompanyContext';
import { useUI } from '../../context/UIContext';

interface NewEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialDate?: string;
}

export const NewEventModal: React.FC<NewEventModalProps> = ({ isOpen, onClose, onSuccess, initialDate }) => {
    const { selectedCompany } = useCompany();
    const { toast } = useUI();
    const [loading, setLoading] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eventDate, setEventDate] = useState(initialDate ? initialDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [eventTime, setEventTime] = useState(initialDate && initialDate.includes('T') ? initialDate.split('T')[1].slice(0, 5) : '12:00');
    const [location, setLocation] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const [members, setMembers] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && selectedCompany) {
            fetchMembers();
            if (initialDate) {
                setEventDate(initialDate.split('T')[0]);
                if (initialDate.includes('T')) {
                    setEventTime(initialDate.split('T')[1].slice(0, 5));
                }
            }
        }
    }, [isOpen, selectedCompany, initialDate]);

    const fetchMembers = async () => {
        try {
            const { data: membersData } = await supabase
                .from('organization_members')
                .select('user_id, profiles(id, full_name, email)')
                .eq('company_id', selectedCompany?.id)
                .eq('status', 'active');

            if (membersData) {
                setMembers(membersData.map((m: any) => m.profiles));
            }
        } catch (error) {
            console.error('Error fetching members:', error);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !selectedCompany) return;

        setLoading(true);
        try {
            // Find first column for the company to place the card in
            const { data: cols } = await supabase
                .from('kanban_columns')
                .select('id')
                .eq('company_id', selectedCompany.id)
                .order('position')
                .limit(1);

            const columnId = cols?.[0]?.id;
            if (!columnId) throw new Error('Nenhuma coluna encontrada');

            // Combine date and time for due_date
            const fullDate = `${eventDate}T${eventTime}:00`;

            const { error } = await supabase.from('kanban_cards').insert({
                company_id: selectedCompany.id,
                column_id: columnId,
                title: title,
                description: `${location ? `📍 Local: ${location}\n\n` : ''}${description}`,
                start_date: null, // Clear start_date to prevent range bars
                due_date: fullDate,
                assigned_to: assignedTo || null,
                category: 'Evento',
                show_on_calendar: true,
                position: 0,
                priority: 'medium'
            });

            if (error) throw error;

            toast.success('Evento criado com sucesso!', 'Sucesso');
            onSuccess();
            onClose();
            // Reset form
            setTitle('');
            setDescription('');
            setLocation('');
            setAssignedTo('');
        } catch (error: any) {
            console.error('Error creating event:', error);
            toast.error(error.message || 'Erro ao criar evento', 'Erro');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* 1. Overlay (Fundo Escuro com Blur e Noise) */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md z-0 animate-in fade-in duration-300"
                onClick={onClose}
            >
                <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
            </div>

            {/* 2. Container do Modal (Glass Card Premium) */}
            <div className="relative z-10 w-full max-w-lg rounded-[22px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300 border border-white/10 bg-[#0a0a1a]/10 backdrop-blur-xl ring-1 ring-white/10 ring-inset">

                {/* Grain Texture Overlay */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0"></div>

                {/* Borda interna sutil (Inner Border) */}
                <div className="absolute inset-0 rounded-[22px] border border-white/5 pointer-events-none"></div>

                {/* Glow Azul no Topo */}
                <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[120%] h-[150px] bg-blue-500/30 blur-[80px] pointer-events-none rounded-[100%]"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_20px_2px_rgba(59,130,246,0.6)]"></div>

                {/* Header Minimalista */}
                <div className="relative p-8 pb-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-medium text-[#EEEEEE]">Novo Evento</h3>
                            <p className="text-[#6e6e6e] text-xs mt-1 font-light">Agende reuniões ou compromissos na agenda.</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors z-20"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSave} className="p-8 pt-4 space-y-5 relative z-10">
                    <div className="space-y-4">
                        {/* Título do Evento */}
                        <div className="relative group">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-[#6e6e6e] ml-1 mb-1 block">Título do Evento</label>
                            <input
                                required
                                autoFocus
                                type="text"
                                placeholder="Ex: Reunião de Planejamento"
                                className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-blue-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Início */}
                            <div className="relative group">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-[#6e6e6e] ml-1 mb-1 block">Data do Evento</label>
                                <input
                                    required
                                    type="date"
                                    className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-blue-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light [color-scheme:dark]"
                                    value={eventDate}
                                    onChange={(e) => setEventDate(e.target.value)}
                                />
                            </div>
                            {/* Término */}
                            <div className="relative group">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-[#6e6e6e] ml-1 mb-1 block">Horário</label>
                                <input
                                    required
                                    type="time"
                                    className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-blue-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light [color-scheme:dark]"
                                    value={eventTime}
                                    onChange={(e) => setEventTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Local */}
                            <div className="relative group">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-[#6e6e6e] ml-1 mb-1 block">Local / Link</label>
                                <input
                                    type="text"
                                    placeholder="Google Meet, Sala..."
                                    className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-blue-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                />
                            </div>
                            {/* Responsável */}
                            <div className="relative group">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-[#6e6e6e] ml-1 mb-1 block">Responsável</label>
                                <select
                                    className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-blue-500/30 focus:ring-0 outline-none appearance-none cursor-pointer transition-all duration-300 text-sm font-light"
                                    value={assignedTo}
                                    onChange={(e) => setAssignedTo(e.target.value)}
                                >
                                    <option value="" className="bg-[#0a0a1a]">Selecione um membro</option>
                                    {members.map(m => (
                                        <option key={m.id} value={m.id} className="bg-[#0a0a1a]">
                                            {m.full_name || m.email}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Descrição */}
                        <div className="relative group">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-[#6e6e6e] ml-1 mb-1 block">Descrição</label>
                            <textarea
                                placeholder="Pauta da reunião..."
                                rows={2}
                                className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-blue-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light resize-none"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-white/5 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3.5 bg-white/[0.02] hover:bg-white/[0.05] text-gray-500 hover:text-white rounded-xl border border-white/5 transition-all duration-300 font-medium text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] py-3.5 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-xl border border-white/5 hover:border-white/20 transition-all duration-300 font-medium text-sm flex items-center justify-center gap-2 group shadow-lg shadow-blue-500/10"
                        >
                            {loading ? 'Salvando...' : (
                                <>
                                    <span>Salvar Evento</span>
                                    <span className="text-primary group-hover:translate-x-1 transition-transform">→</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
