
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
    eventId?: string | null;
}

export const NewEventModal: React.FC<NewEventModalProps> = ({ isOpen, onClose, onSuccess, initialDate, eventId }) => {
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
            if (eventId) {
                fetchEventDetails();
            } else if (initialDate) {
                // ... logic for new event ...
                setEventDate(initialDate.split('T')[0]);
                if (initialDate.includes('T')) {
                    setEventTime(initialDate.split('T')[1].slice(0, 5));
                }
                // Clear other fields for new event
                setTitle('');
                setDescription('');
                setLocation('');
                setAssignedTo('');
            }
        }
    }, [isOpen, selectedCompany, initialDate, eventId]);

    const fetchEventDetails = async () => {
        if (!eventId) return;
        try {
            const { data, error } = await supabase
                .from('kanban_cards')
                .select('*')
                .eq('id', eventId)
                .single();

            if (data) {
                setTitle(data.title);
                // Extract description from the saved format (📍 Local: ...\n\n...)
                const descParts = data.description.split('\n\n');
                if (descParts.length > 1 && descParts[0].includes('📍 Local:')) {
                    setLocation(descParts[0].replace('📍 Local: ', ''));
                    setDescription(descParts.slice(1).join('\n\n'));
                } else {
                    setDescription(data.description);
                    setLocation('');
                }
                if (data.due_date) {
                    setEventDate(data.due_date.split('T')[0]);
                    if (data.due_date.includes('T')) {
                        setEventTime(data.due_date.split('T')[1].slice(0, 5));
                    }
                }
                setAssignedTo(data.assigned_to || '');
            }
        } catch (error) {
            console.error('Error fetching event details:', error);
        }
    };

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
            // Find first column for the company to place the card in (needed only for insert)
            let columnId = null;
            if (!eventId) {
                const { data: cols } = await supabase
                    .from('kanban_columns')
                    .select('id')
                    .eq('company_id', selectedCompany.id)
                    .order('position')
                    .limit(1);
                columnId = cols?.[0]?.id;
                if (!columnId) throw new Error('Nenhuma coluna encontrada');
            }

            // Combine date and time for due_date
            const fullDate = `${eventDate}T${eventTime}:00`;

            const cardData: any = {
                company_id: selectedCompany.id,
                title: title,
                description: `${location ? `📍 Local: ${location}\n\n` : ''}${description}`,
                start_date: null,
                due_date: fullDate,
                assigned_to: assignedTo || null,
                category: 'Evento',
                show_on_calendar: true,
                priority: 'medium'
            };

            if (columnId) {
                cardData.column_id = columnId;
            }

            const { error } = eventId
                ? await supabase.from('kanban_cards').update(cardData).eq('id', eventId)
                : await supabase.from('kanban_cards').insert({ ...cardData, position: 0 });

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

    const handleDelete = async () => {
        if (!eventId) return;
        if (!window.confirm('Deseja realmente excluir este evento?')) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('kanban_cards')
                .delete()
                .eq('id', eventId);

            if (error) throw error;

            toast.success('Evento excluído!', 'Sucesso');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error deleting event:', error);
            toast.error(error.message || 'Erro ao excluir evento', 'Erro');
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

                {/* Glow Primary no Topo */}
                <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[120%] h-[150px] bg-primary/30 blur-[80px] pointer-events-none rounded-[100%]"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_2px_rgba(99,102,241,0.6)]"></div>

                {/* Header Minimalista */}
                <div className="relative p-8 pb-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-medium text-[#EEEEEE]">{eventId ? 'Editar Evento' : 'Novo Evento'}</h3>
                            <p className="text-[#6e6e6e] text-xs mt-1 font-light">{eventId ? 'Altere os detalhes do compromisso.' : 'Agende reuniões ou compromissos na agenda.'}</p>
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
                                className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light"
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
                                    className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light [color-scheme:dark]"
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
                                    className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light [color-scheme:dark]"
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
                                    className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                />
                            </div>
                            {/* Responsável */}
                            <div className="relative group">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-[#6e6e6e] ml-1 mb-1 block">Responsável</label>
                                <select
                                    className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none appearance-none cursor-pointer transition-all duration-300 text-sm font-light"
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
                                className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light resize-none"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                        {eventId ? (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="px-4 py-2 text-red-500/60 hover:text-red-500 text-xs font-medium transition-colors"
                            >
                                Excluir
                            </button>
                        ) : <div />}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 bg-transparent text-gray-500 hover:text-red-500 transition-all duration-300 font-medium text-sm flex items-center justify-center"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl shadow-lg shadow-primary/20 transition-all duration-300 font-medium text-sm flex items-center justify-center"
                            >
                                {loading ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
