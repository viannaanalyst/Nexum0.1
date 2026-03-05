import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
    value: string | number;
    label: string;
}

interface SelectProps {
    value: string | number | string[] | number[];
    onChange: (value: any) => void;
    options: SelectOption[];
    icon?: React.ReactNode;
    className?: string;
    dropdownWidth?: string;
    multiple?: boolean;
}

export const Select: React.FC<SelectProps> = ({
    value,
    onChange,
    options,
    icon,
    className = '',
    dropdownWidth = 'w-full',
    multiple = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Determines displayed text
    let selectedLabel = '';
    const isArray = Array.isArray(value);

    if (multiple && isArray) {
        if (value.length === 0) {
            selectedLabel = 'Nenhum selecionado';
        } else if (value.includes('all' as never)) {
            selectedLabel = options.find(o => o.value === 'all')?.label ?? 'Todos';
        } else if (value.length === 1) {
            selectedLabel = options.find(o => o.value === value[0])?.label ?? '';
        } else {
            selectedLabel = `${value.length} selecionados`;
        }
    } else {
        selectedLabel = options.find(o => o.value === value)?.label ?? '';
    }

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    return (
        <div ref={containerRef} className={`relative select-none ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className={`
          flex items-center gap-2 px-3 py-2 rounded-xl
          bg-white/[0.04] hover:bg-white/[0.07]
          border border-white/[0.08] hover:border-white/[0.15]
          text-white/90 text-sm font-light
          transition-all duration-200
          outline-none focus:border-primary/40
          ${isOpen ? 'border-primary/40 bg-white/[0.07]' : ''}
        `}
            >
                {icon && <span className="text-primary/80 flex-shrink-0">{icon}</span>}
                <span className="truncate max-w-[120px]">{selectedLabel}</span>
                <ChevronDown
                    size={14}
                    className={`flex-shrink-0 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary/70' : ''}`}
                />
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div
                    className="
            absolute z-[200] mt-2 left-0
            bg-[#0d0d20]/95 backdrop-blur-xl
            border border-white/[0.08]
            rounded-2xl shadow-2xl shadow-black/60
            overflow-hidden
            animate-in fade-in zoom-in-95 duration-150
          "
                    style={{ minWidth: '100%' }}
                >
                    {/* Top glow line */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                    <div className="py-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                        {options.map((option) => {
                            const isSelected = multiple && isArray
                                ? value.includes(option.value as never)
                                : option.value === value;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        if (multiple && isArray) {
                                            let newValue = [...value];

                                            if (option.value === 'all') {
                                                // Se clicar em "Todos", seleciona apenas "Todos"
                                                newValue = ['all'];
                                            } else {
                                                // Se clicar em outra coisa, remove "Todos" e faz o toggle
                                                newValue = newValue.filter(v => v !== 'all');
                                                if (isSelected) {
                                                    newValue = newValue.filter(v => v !== option.value);
                                                } else {
                                                    newValue.push(option.value as never);
                                                }

                                                // Se desmarcou tudo, podemos querer setar back to "all" se preferir, 
                                                // mas o usuário decide. Se a lista ficou vazia e não é "all":
                                                if (newValue.length === 0) {
                                                    newValue = ['all'];
                                                }
                                            }

                                            onChange(newValue as any);
                                            // Don't close dropdown on multiple selection
                                        } else {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }
                                    }}
                                    className={`
                    w-full flex items-center justify-between
                    px-4 py-2.5 text-sm text-left cursor-pointer
                    transition-all duration-150
                    ${isSelected
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'text-gray-400 hover:bg-white/[0.05] hover:text-white'
                                        }
                  `}
                                >
                                    <div className="flex items-center gap-3">
                                        {multiple && (
                                            <div className={`
                                                w-4 h-4 rounded border flex items-center justify-center
                                                ${isSelected ? 'bg-primary border-primary' : 'border-gray-500'}
                                            `}>
                                                {isSelected && <Check size={12} className="text-white" />}
                                            </div>
                                        )}
                                        <span>{option.label}</span>
                                    </div>
                                    {!multiple && isSelected && (
                                        <Check size={13} className="text-primary flex-shrink-0 ml-2" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
