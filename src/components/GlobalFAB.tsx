
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Plus,
    UserPlus,
    DollarSign,
    MessageSquare,
    Zap,
    X,
    Calendar as CalendarIcon,
    CheckSquare
} from 'lucide-react';

const GlobalFAB = () => {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState({
        icon: <Plus />,
        label: 'Novo',
        action: () => console.log('Action'),
        color: 'from-primary to-accent',
        isMenu: false
    });

    // Update FAB based on route
    useEffect(() => {
        const path = location.pathname;
        if (path.includes('configuracao/kanban')) {
            setConfig({
                icon: <Plus />,
                label: 'Novo',
                action: () => setIsOpen(!isOpen),
                color: 'from-blue-600 to-indigo-600',
                isMenu: true
            });
        } else if (path.includes('kanban')) {
            setConfig({
                icon: <Plus />,
                label: 'Nova Coluna',
                action: () => window.dispatchEvent(new CustomEvent('open-new-column')),
                color: 'from-blue-600 to-indigo-600',
                isMenu: false
            });
        } else if (path.includes('calendario')) {
            setConfig({
                icon: <Plus />,
                label: 'Novo',
                action: () => setIsOpen(!isOpen),
                color: 'from-primary to-secondary',
                isMenu: true
            });
        } else if (path.includes('cronograma')) {
            setConfig({
                icon: <Plus />,
                label: 'Novo Cronograma',
                action: () => window.dispatchEvent(new CustomEvent('open-new-schedule')),
                color: 'from-purple-600 to-pink-600',
                isMenu: false
            });
        } else if (path.includes('equipe')) {
            setConfig({
                icon: <UserPlus />,
                label: 'Novo Membro',
                action: () => window.dispatchEvent(new CustomEvent('open-new-member')),
                color: 'from-orange-500 to-red-500',
                isMenu: false
            });
        } else if (path.includes('clientes')) {
            setConfig({
                icon: <UserPlus />,
                label: 'Novo Cliente',
                action: () => window.dispatchEvent(new CustomEvent('open-new-client')),
                color: 'from-accent to-primary',
                isMenu: false
            });
        } else if (path.includes('suporte')) {
            setConfig({
                icon: <Plus />,
                label: 'Novo Chamado',
                action: () => window.dispatchEvent(new CustomEvent('open-support-ticket')),
                color: 'from-primary to-accent',
                isMenu: false
            });
        } else if (path.includes('lancamentos')) {
            setConfig({
                icon: <DollarSign />,
                label: 'Novo Lançamento',
                action: () => window.dispatchEvent(new CustomEvent('open-new-transaction')),
                color: 'from-emerald-500 to-teal-500',
                isMenu: false
            });
        } else {
            setConfig({
                icon: <Zap />,
                label: 'Ação Rápida',
                action: () => setIsOpen(!isOpen),
                color: 'from-primary to-accent',
                isMenu: true
            });
        }
    }, [location.pathname, isOpen]);

    const handleAction = (eventName: string) => {
        window.dispatchEvent(new CustomEvent(eventName));
        setIsOpen(false);
    };

    return (
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-4">
            {/* Quick Menu Options (Radial or Vertical) */}
            {isOpen && (
                <div className="flex flex-col items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300">
                    {location.pathname.includes('calendario') ? (
                        <>
                            <QuickAction
                                icon={<CheckSquare size={20} />}
                                label="Tarefa"
                                color="bg-indigo-500"
                                onClick={() => handleAction('open-new-task')}
                            />
                            <QuickAction
                                icon={<CalendarIcon size={20} />}
                                label="Evento"
                                color="bg-blue-500"
                                onClick={() => handleAction('open-new-event')}
                            />
                        </>
                    ) : location.pathname.includes('configuracao/kanban') ? (
                        <>
                            <QuickAction
                                icon={<Plus size={20} />}
                                label="Coluna"
                                color="bg-blue-500"
                                onClick={() => handleAction('open-new-column-config')}
                            />
                            <QuickAction
                                icon={<Plus size={20} />}
                                label="Template"
                                color="bg-indigo-500"
                                onClick={() => handleAction('open-new-template-config')}
                            />
                        </>
                    ) : (
                         <>
                            <QuickAction icon={<MessageSquare size={20} />} label="Suporte" color="bg-white/10" onClick={() => handleAction('open-support-ticket')} />
                            <QuickAction icon={<Zap size={20} />} label="Automação" color="bg-white/10" />
                        </>
                    )}
                </div>
            )
            }

            {/* Main FAB */}
            <button
                onClick={config.action}
                className={`
                    group relative flex items-center justify-center
                    w-14 h-14 rounded-full 
                    bg-gradient-to-br ${config.color}
                    text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]
                    hover:shadow-[0_0_30px_rgba(99,102,241,0.6)]
                    hover:scale-110 active:scale-95
                    transition-all duration-500 ease-out
                `}
            >
                {/* Pulsing light effect */}
                <span className="absolute inset-0 rounded-full bg-inherit animate-ping opacity-20 group-hover:opacity-40"></span>

                {/* Glass Overlay */}
                <span className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-[2px] border border-white/20"></span>

                {/* Icon */}
                <div className="relative z-10 transition-transform duration-500 group-hover:rotate-90">
                    {isOpen ? <X size={24} /> : config.icon}
                </div>

                {/* Expandable Label on Hover */}
                <div className="absolute right-full mr-4 px-4 py-2 bg-[#0a0a1a]/90 backdrop-blur-xl border border-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 pointer-events-none whitespace-nowrap">
                    <span className="text-sm font-bold text-white tracking-wide">{config.label}</span>
                </div>
            </button>
        </div >
    );
};

const QuickAction = ({ icon, label, color, onClick }: any) => (
    <div className="group relative flex items-center justify-center w-14 h-14 cursor-pointer" onClick={onClick}>
        {/* Sub-button Label (Absolute to the left) */}
        <div className="absolute right-full mr-4 px-3 py-1.5 bg-[#0a0a1a]/80 backdrop-blur-md border border-white/10 rounded-xl text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 shadow-xl whitespace-nowrap pointer-events-none">
            {label}
        </div>

        {/* Sub-button Icon */}
        <div className={`w-12 h-12 rounded-full ${color} border border-white/20 flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all duration-300 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.3)] hover:shadow-primary/40`}>
            {icon}
        </div>
    </div>
);

export default GlobalFAB;
