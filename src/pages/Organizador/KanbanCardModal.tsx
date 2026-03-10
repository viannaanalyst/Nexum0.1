import React, { useState, useEffect, useRef } from 'react';

import { createPortal } from 'react-dom';
import {
    X, Paperclip,
    CheckSquare, MessageSquare, FileText, Plus,
    ChevronDown, ChevronUp, Lock, Send, MoreVertical, Trash2, Pencil,
    File, FileCode, FileImage, FileArchive, Download, GitBranch, Info, Video,
    // Mantendo icones Lucide que ainda podem ser usados em outros lugares ou como fallback
    Calendar as LucideCalendar, Clock as LucideClock, User as LucideUser, Tag as LucideTag, Share2
} from 'lucide-react';
import {
    IconCalendar,
    IconFlag,
    IconTag,
    IconClock,
    IconUser,
    IconBriefcase,
    IconPlayerPlay,
    IconCircleDotted,
    IconTarget,
    IconArrowsMaximize,
    IconGripVertical,
    IconArrowsDiagonal
} from '@tabler/icons-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCompany } from '../../context/CompanyContext';
import { supabase } from '../../lib/supabase';
import { useUI } from '../../context/UIContext';
import { createTaskNotification } from '../../lib/notificationService';

// Tipos
interface TimeEntry {
    id: string;
    card_id: string;
    user_id: string;
    start_time: string;
    end_time?: string;
    duration_minutes?: number;
    date: string;
    notes?: string;
    is_billable: boolean;
    is_running: boolean;
    created_at: string;
    // Helper para UI
    profiles?: {
        full_name: string;
        avatar_url?: string;
    }
}

interface KanbanCardModalProps {
    cardId: string;
    columnId?: string; // If cardId is 'new', this is required
    defaultClientId?: string; // Pre-fill client from board filter
    onClose: () => void;
    onRefresh?: () => void;
    onOpenCard?: (cardId: string) => void;
    mode?: 'task' | 'event';
}

// Sub-componentes do Checklist movidos para fora para evitar perda de foco ao digitar
interface SortableChecklistItemProps {
    item: any;
    isFullScreen?: boolean;
    userRole: string | null;
    handleToggleChecklist: (itemId: string, currentStatus: boolean, needsApproval: boolean, approverId: string | null) => void;
    handleDeleteChecklist: (itemId: string) => void;
}

const SortableChecklistItem = ({
    item,
    isFullScreen = false,
    userRole,
    handleToggleChecklist,
    handleDeleteChecklist
}: SortableChecklistItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 'auto',
        position: 'relative' as const,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-start gap-3 rounded-lg transition-all relative ${isDragging ? 'bg-white/5 shadow-lg' : ''} ${isFullScreen ? 'p-4 py-3 hover:bg-white/[0.03] text-base' : 'p-3 py-2 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent text-sm'}`}
        >
            <div {...attributes} {...listeners} className="mt-1 cursor-grab active:cursor-grabbing text-gray-700 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shrink-0 w-4">
                <IconGripVertical size={isFullScreen ? 16 : 14} />
            </div>

            <div className="flex-1 flex flex-col gap-1 min-w-0">
                <div className="flex items-start gap-3 min-w-0">
                    <button
                        onClick={() => handleToggleChecklist(item.id, item.is_completed, item.needs_approval, item.approver_id)}
                        className={`rounded border flex items-center justify-center transition-all shrink-0 ${isFullScreen ? 'mt-1 w-5 h-5' : 'mt-0.5 w-4 h-4'} ${item.is_completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-600 hover:border-gray-400'}`}
                    >
                        {item.is_completed && <CheckSquare size={isFullScreen ? 12 : 10} strokeWidth={3} />}
                    </button>

                    <span
                        className={`flex-1 transition-colors font-medium leading-relaxed break-words ${item.is_completed ? 'text-gray-500 line-through' : 'text-gray-200'} cursor-pointer ${isFullScreen ? 'text-base' : 'text-sm'}`}
                        onClick={() => handleToggleChecklist(item.id, item.is_completed, item.needs_approval, item.approver_id)}
                    >
                        {item.description}
                    </span>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                            onClick={() => handleDeleteChecklist(item.id)}
                            className="p-1.5 rounded hover:bg-white/10 text-gray-600 hover:text-red-400 transition-colors"
                            title="Excluir"
                        >
                            <Trash2 size={isFullScreen ? 16 : 14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface SortableChecklistGroupProps {
    group: any;
    checklist: any[];
    onAddItem: (groupId: string) => void;
    isFullScreen?: boolean;
    userRole: string | null;
    handleUpdateChecklistGroup: (groupId: string, title: string) => void;
    handleDeleteChecklistGroup: (groupId: string) => void;
    newChecklistItems: Record<string, string>;
    setNewChecklistItems: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    handleAddChecklistItem: (groupId: string) => void;
    handleToggleChecklist: (itemId: string, currentStatus: boolean, needsApproval: boolean, approverId: string | null) => void;
    handleDeleteChecklist: (itemId: string) => void;
}

const SortableChecklistGroup = ({
    group,
    checklist,
    onAddItem,
    isFullScreen = false,
    userRole,
    handleUpdateChecklistGroup,
    handleDeleteChecklistGroup,
    newChecklistItems,
    setNewChecklistItems,
    handleAddChecklistItem,
    handleToggleChecklist,
    handleDeleteChecklist
}: SortableChecklistGroupProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: group.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
    };

    const groupItems = checklist.filter(i => i.group_id === group.id || (group.id === 'default' && !i.group_id));
    const completedCount = groupItems.filter(i => i.is_completed).length;
    const totalCount = groupItems.length;

    return (
        <div ref={setNodeRef} style={style} className={`space-y-3 border border-white/10 rounded-xl group/group ${isFullScreen ? 'p-6 bg-white/[0.02] shadow-xl' : 'p-4 shadow-sm'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 opacity-0 group-hover/group:opacity-100 transition-opacity">
                        <IconGripVertical size={isFullScreen ? 18 : 16} />
                    </div>
                    <input
                        className={`font-bold text-white bg-transparent border-none focus:outline-none w-full placeholder:text-gray-500 hover:text-gray-200 transition-colors ${isFullScreen ? 'text-lg' : 'text-sm'}`}
                        value={group.title}
                        onChange={(e) => handleUpdateChecklistGroup(group.id, e.target.value)}
                        placeholder="Nome do Checklist"
                        disabled={userRole === 'visualizador'}
                    />
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-500 font-medium px-2 py-0.5 rounded-full bg-white/5">
                            {completedCount} de {totalCount}
                        </span>
                        {group.id !== 'default' && (
                            <button onClick={() => handleDeleteChecklistGroup(group.id)} className="opacity-0 group-hover/group:opacity-100 p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all">
                                <Trash2 size={isFullScreen ? 18 : 16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <SortableContext items={groupItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                    {groupItems.filter(i => !i.is_completed).map(item => (
                        <SortableChecklistItem
                            key={item.id}
                            item={item}
                            isFullScreen={isFullScreen}
                            userRole={userRole}
                            handleToggleChecklist={handleToggleChecklist}
                            handleDeleteChecklist={handleDeleteChecklist}
                        />
                    ))}
                </div>
            </SortableContext>

            {/* Input de Adicionar Item (Estilo Botao Texto) */}
            {userRole !== 'visualizador' && (
                <div className="px-3 py-2 mt-1">
                    <div className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer group" onClick={() => onAddItem(group.id)}>
                        <Plus size={isFullScreen ? 18 : 14} className="group-hover:text-primary transition-colors" />
                        <input
                            id={`new-checklist-input-${isFullScreen ? 'full-' : ''}${group.id}`}
                            value={newChecklistItems[group.id] || ''}
                            onChange={(e) => setNewChecklistItems({ ...newChecklistItems, [group.id]: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem(group.id)}
                            className={`bg-transparent focus:outline-none w-full placeholder:text-gray-500 text-gray-300 font-medium ${isFullScreen ? 'text-base h-10' : 'text-sm h-6'}`}
                            placeholder="Adicionar item"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}

            {/* Secao de Concluidos */}
            {groupItems.filter(i => i.is_completed).length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5">
                    <details className="group/details">
                        <summary className="px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors list-none text-xs font-medium text-gray-500 select-none">
                            <ChevronDown size={isFullScreen ? 14 : 12} className="transition-transform group-open/details:rotate-180" />
                            <span>Mostrar {groupItems.filter(i => i.is_completed).length} item(ns) concluido(s)</span>
                        </summary>

                        <div className="px-2 pb-2 pt-2 animate-in slide-in-from-top-2 duration-200 space-y-1">
                            <SortableContext items={groupItems.filter(i => i.is_completed).map(i => i.id)} strategy={verticalListSortingStrategy}>
                                {groupItems.filter(i => i.is_completed).map(item => (
                                    <SortableChecklistItem
                                        key={item.id}
                                        item={item}
                                        isFullScreen={isFullScreen}
                                        userRole={userRole}
                                        handleToggleChecklist={handleToggleChecklist}
                                        handleDeleteChecklist={handleDeleteChecklist}
                                    />
                                ))}
                            </SortableContext>
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
};

const KanbanCardModal = ({ cardId, columnId, defaultClientId, onClose, onRefresh, onOpenCard, mode = 'task' }: KanbanCardModalProps) => {
    const { selectedCompany } = useCompany();
    const { toast, confirm } = useUI();
    const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'comments' | 'files' | 'tags'>('details');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Estados dos campos
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
    const [assignedTo, setAssignedTo] = useState<string>('');
    const [dueDate, setDueDate] = useState('');
    const [showOnCalendar, setShowOnCalendar] = useState(false);
    const [category, setCategory] = useState('');
    const [subcategory, setSubcategory] = useState('');
    const [clientId, setClientId] = useState(defaultClientId || '');
    const [parentId, setParentId] = useState<string | null>(null);

    // Approval flow state (for when this card IS a subtask)
    const [approvalNeeded, setApprovalNeeded] = useState(false);
    const [approvalApproverId, setApprovalApproverId] = useState<string | null>(null);
    const [approvalIsApproved, setApprovalIsApproved] = useState(false);
    const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | 'awaiting_adjustment'>('pending');
    const [approvalHistory, setApprovalHistory] = useState<any[]>([]);
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const [checklist, setChecklist] = useState<any[]>([]);
    const [checklistGroups, setChecklistGroups] = useState<any[]>([{ id: 'default', title: 'Checklist Principal' }]);
    const [newChecklistItems, setNewChecklistItems] = useState<Record<string, string>>({});
    const [comments, setComments] = useState<any[]>([]);
    const [files, setFiles] = useState<any[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [subtasks, setSubtasks] = useState<any[]>([]); // New: Subtasks
    const [columnsMap, setColumnsMap] = useState<Record<string, string>>({}); // Helper for subtask status
    const [columns, setColumns] = useState<any[]>([]); // New: Columns list for dropdown
    const [currentColumnId, setCurrentColumnId] = useState<string>(columnId || ''); // For status badge

    // Auxiliary Data
    const [members, setMembers] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [tags, setTags] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');

    // New Tag Creation State
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#3b82f6'); // Default blue
    const [showMemberSelect, setShowMemberSelect] = useState(false);
    const [showPrioritySelect, setShowPrioritySelect] = useState(false);
    const [showStatusSelect, setShowStatusSelect] = useState(false); // New: Status
    const [showClientSelect, setShowClientSelect] = useState(false); // New: Client

    const [showTagInput, setShowTagInput] = useState(false); // Toggle tag creation input
    const [approvers, setApprovers] = useState<any[]>([]);
    const [showApproverModal, setShowApproverModal] = useState<string | null>(null); // Stores the checklist item ID being configured
    const [popoverPos, setPopoverPos] = useState<{ top: number, left: number } | null>(null); // New: Popover position
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [currentUserApprover, setCurrentUserApprover] = useState<boolean>(false);
    const [userRole, setUserRole] = useState<string | null>(null);

    // Tracking original state for system logs
    const [originalAssignedTo, setOriginalAssignedTo] = useState<string>('');
    const [originalDueDate, setOriginalDueDate] = useState<string>('');
    const [startDate, setStartDate] = useState(''); // New: Start Date
    const [deliveryDate, setDeliveryDate] = useState(''); // New: Delivery Date
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [isExpandedDescription, setIsExpandedDescription] = useState(true);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const startDatePickerRef = useRef<HTMLInputElement>(null);
    const dueDatePickerRef = useRef<HTMLInputElement>(null);
    const deliveryDatePickerRef = useRef<HTMLInputElement>(null);

    // Subtask Interaction State
    const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);
    const [showSubtaskMemberSelect, setShowSubtaskMemberSelect] = useState<string | null>(null);
    const [showSubtaskPrioritySelect, setShowSubtaskPrioritySelect] = useState<string | null>(null);
    const [showSubtaskDateSelect, setShowSubtaskDateSelect] = useState<string | null>(null);
    const [showSubtaskStatusSelect, setShowSubtaskStatusSelect] = useState<string | null>(null);
    const [isSubtasksCollapsed, setIsSubtasksCollapsed] = useState(false);
    const [isChecklistCollapsed, setIsChecklistCollapsed] = useState(false);
    const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
    const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
    const [showSubtaskTagSelectId, setShowSubtaskTagSelectId] = useState<string | null>(null);
    const [showSubtasksOnly, setShowSubtasksOnly] = useState(false);
    const [showChecklistOnly, setShowChecklistOnly] = useState(false);
    const [showDescriptionOnly, setShowDescriptionOnly] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewName, setPreviewName] = useState<string | null>(null);

    // Mentions State
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState<number | null>(null); // Index where @ started
    const [filteredMembers, setFilteredMembers] = useState<any[]>([]);

    // Time Tracking State
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
    const [showTimePopover, setShowTimePopover] = useState(false);
    const [totalMinutes, setTotalMinutes] = useState(0);

    // Timer Tick Effect
    const [timerDisplay, setTimerDisplay] = useState('0h 0m 0s');

    const getFileIcon = (filename: string, size: number = 18) => {
        const ext = filename.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif':
            case 'webp':
            case 'svg':
                return <FileImage size={size} />;
            case 'pdf':
                return <FileText size={size} className="text-red-400" />;
            case 'doc':
            case 'docx':
                return <FileText size={size} className="text-blue-400" />;
            case 'xls':
            case 'xlsx':
                return <FileText size={size} className="text-emerald-400" />;
            case 'js':
            case 'ts':
            case 'jsx':
            case 'tsx':
            case 'py':
            case 'java':
            case 'cpp':
            case 'html':
            case 'css':
                return <FileCode size={size} className="text-amber-400" />;
            case 'zip':
            case 'rar':
            case '7z':
                return <FileArchive size={size} className="text-purple-400" />;
            case 'mp4':
            case 'webm':
            case 'ogg':
            case 'mov':
                return <Video size={size} className="text-pink-400" />;
            default:
                return <File size={size} />;
        }
    };

    const handleDownload = async (url: string, filename: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Error downloading file:', error);
            // Fallback to simple link click if fetch fails
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };


    useEffect(() => {
        if (descriptionRef.current) {
            descriptionRef.current.style.height = 'auto'; // Reset height
            descriptionRef.current.style.height = `${descriptionRef.current.scrollHeight}px`; // Set height based on content
        }
    }, [description, isEditingDescription, isExpandedDescription]);

    useEffect(() => {
        let interval: any;
        if (isRunning && activeTimer) {
            interval = setInterval(() => {
                const now = new Date();
                const start = new Date(activeTimer.start_time);
                const diffMs = now.getTime() - start.getTime();

                const hours = Math.floor(diffMs / 3600000);
                const minutes = Math.floor((diffMs % 3600000) / 60000);
                const seconds = Math.floor((diffMs % 60000) / 1000);

                setTimerDisplay(`${hours}h ${minutes}m ${seconds}s`);
            }, 1000);
        } else {
            setTimerDisplay('0h 0m 0s');
        }
        return () => clearInterval(interval);
    }, [isRunning, activeTimer]);

    // Fetch Data
    useEffect(() => {
        fetchMembers();
        fetchClients();
        fetchTags();
        fetchApprovers(); // Fetch approvers list
        checkCurrentUserRole(); // Check role
        fetchTimeEntries(); // Fetch time entries

        if (cardId !== 'new') {
            fetchCardDetails();
            fetchChecklist();
            fetchComments();
            fetchFiles();
            fetchSubtasks();
            fetchApprovalHistory();
        } else {
            setLoading(false);
            setTitle(mode === 'event' ? 'Novo Evento' : 'Nova tarefa');
            if (columnId) setCurrentColumnId(columnId);
            if (defaultClientId) setClientId(defaultClientId);

            // If mode is event, we could pre-set a category or tag if they exist
            if (mode === 'event') {
                setCategory('Evento'); // Assuming there's a category/type field used for this
            }
        }
    }, [cardId, selectedCompany]);

    useEffect(() => {
        if (selectedCompany) {
            fetchColumns();
        }
    }, [clientId, selectedCompany, loading]);

    const fetchColumns = async () => {
        if (!selectedCompany) return;
        try {
            const { data, error } = await supabase
                .from('kanban_columns')
                .select('id, title, color, client_id, is_done_column, position')
                .eq('company_id', selectedCompany.id);

            if (error) throw error;

            if (data) {
                const filtered = data.filter(col =>
                    col.client_id === null || (clientId && col.client_id === clientId)
                );

                const sortedCols = [...filtered].sort((a, b) => {
                    if (a.is_done_column && !b.is_done_column) return 1;
                    if (!a.is_done_column && b.is_done_column) return -1;
                    if (a.client_id === null && b.client_id !== null) return 1;
                    if (a.client_id !== null && b.client_id === null) return -1;
                    return (a.position || 0) - (b.position || 0);
                });

                const map = sortedCols.reduce((acc, col) => ({ ...acc, [col.id]: col.title }), {});
                setColumnsMap(map);
                setColumns(sortedCols);

                if (sortedCols.length > 0) {
                    const isPropValid = columnId && sortedCols.some(c => c.id === columnId);
                    const isCurrentValid = currentColumnId && sortedCols.some(c => c.id === currentColumnId);

                    if (cardId === 'new' && isPropValid) {
                        if (!currentColumnId || currentColumnId === columnId || !isCurrentValid) {
                            setCurrentColumnId(columnId as string);
                        }
                    } else if (!loading && !isCurrentValid) {
                        // For existing cards, only fallback if we finished loading details and the status is still invalid
                        if (isPropValid) {
                            setCurrentColumnId(columnId as string);
                        } else {
                            setCurrentColumnId(sortedCols[0].id);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching columns", error);
        }
    };

    const fetchApprovers = async () => {
        if (!selectedCompany) return;
        try {
            const { data, error } = await supabase
                .from('organization_members')
                .select('user_id')
                .eq('company_id', selectedCompany.id)
                .eq('is_approver', true);

            if (error) throw error;

            if (data && data.length > 0) {
                const userIds = data.map(m => m.user_id);
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, full_name, email')
                    .in('id', userIds);

                if (profilesData) {
                    setApprovers(profilesData.map(p => ({
                        id: p.id,
                        name: p.full_name || p.email
                    })));
                }
            } else {
                setApprovers([]);
            }
        } catch (error) {
            console.error('Error fetching approvers:', error);
        }
    };

    const checkCurrentUserRole = async () => {
        if (!selectedCompany) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);

                // Fix: Use data safely and check for errors explicitly
                const { data, error } = await supabase
                    .from('organization_members')
                    .select('is_approver, role')
                    .eq('user_id', user.id)
                    .eq('company_id', selectedCompany.id)
                    .single();

                if (error) {
                    // It's possible the user is not in the table yet or RLS issue, just log and continue
                    // console.warn('User not found in members:', error.message);
                    setCurrentUserApprover(false);
                } else if (data) {
                    setCurrentUserApprover(data.is_approver || false);
                    setUserRole(data.role);
                }
            }
        } catch (error) {
            console.error('Error checking user role:', error);
        }
    };

    const fetchClients = async () => {
        if (!selectedCompany) return;
        try {
            const { data } = await supabase.from('clients').select('id, name').eq('company_id', selectedCompany.id).eq('status', 'active');
            if (data) setClients(data);
        } catch (error) {
            console.error('Error fetching clients:', error);
        }
    };

    const fetchTags = async () => {
        if (!selectedCompany) return;
        try {
            const { data, error } = await supabase
                .from('kanban_tags')
                .select('*')
                .eq('company_id', selectedCompany.id)
                .order('created_at');

            if (data) setTags(data);
        } catch (error) {
            console.error("Error fetching tags", error);
        }
    };

    const fetchMembers = async () => {
        if (!selectedCompany) return;
        try {
            // 1. Get members from organization_members
            const { data: membersData, error } = await supabase
                .from('organization_members')
                .select('user_id')
                .eq('company_id', selectedCompany.id);

            if (error) {
                console.error('Error fetching members:', error);
                return;
            }

            if (membersData && membersData.length > 0) {
                const userIds = membersData.map(m => m.user_id);

                // 2. Get profile details
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, avatar_url')
                    .in('id', userIds);

                if (profilesData) {
                    setMembers(profilesData.map(p => ({
                        id: p.id,
                        name: p.full_name || p.email || 'Sem nome',
                        email: p.email,
                        avatar_url: p.avatar_url
                    })));
                }
            } else {
                setMembers([]);
            }
        } catch (error) {
            console.error('Error in fetchMembers:', error);
        }
    };

    const fetchCardDetails = async () => {
        setLoading(true);
        try {
            const { data: cardData } = await supabase
                .from('kanban_cards')
                .select('*, kanban_card_tags(tag_id)')
                .eq('id', cardId)
                .single();

            if (cardData) {
                setTitle(cardData.title);
                setDescription(cardData.description || '');
                setPriority(cardData.priority || 'medium');
                setAssignedTo(cardData.assigned_to || '');
                setOriginalAssignedTo(cardData.assigned_to || '');
                setDueDate(cardData.due_date ? cardData.due_date.split('T')[0] : '');
                setOriginalDueDate(cardData.due_date ? cardData.due_date.split('T')[0] : '');
                setStartDate(cardData.start_date ? cardData.start_date.split('T')[0] : '');
                setDeliveryDate(cardData.delivery_date ? cardData.delivery_date.split('T')[0] : '');
                setShowOnCalendar(cardData.show_on_calendar || false);
                setCategory(cardData.category || '');
                setSubcategory(cardData.subcategory || '');
                setClientId(cardData.client_id || '');
                setCurrentColumnId(cardData.column_id || '');
                setParentId(cardData.parent_id || null);
                setApprovalNeeded((cardData as any).needs_approval ?? false);
                setApprovalApproverId((cardData as any).approver_id ?? null);
                setApprovalIsApproved((cardData as any).is_approved ?? false);
                setApprovalStatus((cardData as any).approval_status ?? 'pending');

                const cardTags = (cardData as any).kanban_card_tags?.map((t: any) => t.tag_id) || [];
                setSelectedTags(cardTags);
            }
        } catch (error) {
            console.error('Error fetching card details:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchApprovalHistory = async () => {
        if (cardId === 'new') return;
        try {
            const { data, error } = await supabase
                .from('kanban_approval_history')
                .select('id, card_id, actor_id, action, note, created_at')
                .eq('card_id', cardId)
                .order('created_at', { ascending: true });
            if (error) {
                console.error('Error fetching approval history:', error);
                return;
            }
            setApprovalHistory(data || []);
        } catch (error) {
            console.error('Error fetching approval history:', error);
        }
    };

    const fetchChecklist = async () => {
        try {
            const { data: checkData } = await supabase
                .from('kanban_checklists')
                .select('*')
                .eq('card_id', cardId)
                .order('position');
            setChecklist(checkData || []);

            try {
                const { data: groupsData, error: groupsError } = await supabase
                    .from('kanban_checklist_groups')
                    .select('*')
                    .eq('card_id', cardId)
                    .order('position', { ascending: true });

                if (!groupsError && groupsData && groupsData.length > 0) {
                    setChecklistGroups(groupsData);
                }
            } catch (e) {
                console.warn('Error fetching checklist groups - migration may be needed', e);
            }
        } catch (error) {
            console.error('Error fetching checklist:', error);
        }
    };

    const fetchComments = async () => {
        try {
            const { data: commentData, error: commentError } = await supabase
                .from('kanban_comments')
                .select('*')
                .eq('card_id', cardId)
                .order('created_at', { ascending: false });

            if (commentError) throw commentError;

            let commentsWithUsers: any[] = [];
            if (commentData) {
                const userIds = [...new Set(commentData.map(c => c.user_id).filter(Boolean))];
                let profileMap: Record<string, any> = {};

                if (userIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, email, full_name, avatar_url')
                        .in('id', userIds);

                    if (profiles) {
                        profileMap = profiles.reduce((acc, p) => ({
                            ...acc,
                            [p.id]: { ...p, email: p.full_name || p.email }
                        }), {} as Record<string, any>);
                    }
                }

                commentsWithUsers = commentData.map(c => ({
                    ...c,
                    user: c.user_id ? (profileMap[c.user_id] || { email: 'Usuario desconhecido' }) : { email: 'Sistema' }
                }));
            }
            setComments(commentsWithUsers);
        } catch (error) {
            console.error('Error fetching comments:', error);
        }
    };

    const fetchFiles = async () => {
        try {
            const { data: fileData } = await supabase
                .from('kanban_attachments')
                .select('*')
                .eq('card_id', cardId)
                .order('created_at', { ascending: false });
            setFiles(fileData || []);
        } catch (error) {
            console.error('Error fetching files:', error);
        }
    };

    const fetchSubtasks = async () => {
        try {
            const { data: subData } = await supabase
                .from('kanban_cards')
                .select('*, kanban_card_tags(tag_id)')
                .eq('parent_id', cardId)
                .order('position');

            if (subData) {
                const formattedSubtasks = subData.map(task => ({
                    ...task,
                    tags: (task as any).kanban_card_tags?.map((t: any) => t.tag_id) || []
                }));
                setSubtasks(formattedSubtasks);
            } else {
                setSubtasks([]);
            }
        } catch (error) {
            console.error('Error fetching subtasks:', error);
        }
    };

    const fetchTimeEntries = async () => {
        if (cardId === 'new') return;
        try {
            const { data, error } = await supabase
                .from('time_entries')
                .select('*, profiles:user_id(full_name, avatar_url)')
                .eq('card_id', cardId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTimeEntries(data || []);

            // Calcular total e checar se ha algum rodando
            const total = (data || []).reduce((acc, entry) => acc + (entry.duration_minutes || 0), 0);
            setTotalMinutes(total);

            const running = (data || []).find(entry => entry.is_running);
            if (running) {
                setIsRunning(true);
                setActiveTimer(running);
            } else {
                setIsRunning(false);
                setActiveTimer(null);
            }
        } catch (error) {
            console.error('Error fetching time entries:', error);
        }
    };

    const formatDuration = (totalMinutes: number) => {
        if (totalMinutes === 0) return '0h';
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
    };

    const createSystemLog = async (cardId: string, content: string, userId: string | null = null) => {
        try {
            // Find user name for local display
            let userDisplay = { email: 'Sistema' };
            if (userId) {
                const foundMember = members.find(m => m.id === userId);
                // Check current user if not in members list (e.g. self)
                if (foundMember) {
                    userDisplay = { email: foundMember.name };
                } else if (userId === currentUserId) {
                    // Fallback if currentUserId is available but not in members list yet?
                    // But members list should be populated.
                    // Just in case, 'VocÃª' or fetch from auth.
                    userDisplay = { email: 'VocÃª' };
                }
            }

            // If cardId is 'new', we can't save to DB yet. 
            // We'll just add to local comments state with a special flag.
            if (cardId === 'new') {
                const tempLog = {
                    id: `temp-log-${Date.now()}`,
                    content: content,
                    is_system_log: true,
                    user_id: userId,
                    user: userDisplay,
                    created_at: new Date().toISOString()
                };
                setComments(prev => [...prev, tempLog]);
                return;
            }

            const { data, error } = await supabase
                .from('kanban_comments')
                .insert({
                    card_id: cardId,
                    content: content,
                    is_system_log: true,
                    user_id: userId // System logs can have a user now
                })
                .select()
                .single();

            if (error) throw error;

            const logWithUser = { ...data, user: userDisplay };
            setComments(prev => [...prev, logWithUser]);
        } catch (error) {
            console.error('Error creating system log:', error);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleSubtaskDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = subtasks.findIndex((t) => t.id === active.id);
        const newIndex = subtasks.findIndex((t) => t.id === over.id);

        const newSubtasks = arrayMove(subtasks, oldIndex, newIndex);
        setSubtasks(newSubtasks);

        try {
            // Update positions in batch
            const updates = newSubtasks.map((task, index) => ({
                id: task.id,
                position: index * 10
            }));

            for (const update of updates) {
                await supabase
                    .from('kanban_cards')
                    .update({ position: update.position })
                    .eq('id', update.id);
            }
        } catch (error) {
            console.error('Error updating subtask positions:', error);
            toast.error('Erro ao reordenar subtarefas.', 'Erro');
            fetchSubtasks(); // Revert
        }
    };

    const handleChecklistDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        // Determine if we are dragging a group or an item
        const activeItem = checklist.find(i => i.id === active.id);
        const overItem = checklist.find(i => i.id === over.id);
        const activeGroup = checklistGroups.find(g => g.id === active.id);
        const overGroup = checklistGroups.find(g => g.id === over.id);

        if (activeGroup && overGroup) {
            // Reorder groups
            const oldIndex = checklistGroups.findIndex(g => g.id === active.id);
            const newIndex = checklistGroups.findIndex(g => g.id === over.id);
            const newGroups = arrayMove(checklistGroups, oldIndex, newIndex);
            setChecklistGroups(newGroups);

            try {
                const updates = newGroups.map((group, index) => ({
                    id: group.id,
                    position: index * 10
                }));
                for (const update of updates) {
                    if (update.id === 'default') continue;
                    await supabase.from('kanban_checklist_groups').update({ position: update.position }).eq('id', update.id);
                }
            } catch (error) {
                console.error('Error updating checklist group positions:', error);
                toast.error('Erro ao reordenar grupos.', 'Erro');
                fetchChecklist();
            }
        } else if (activeItem && (overItem || overGroup)) {
            // Reorder items or move to group
            const oldIndex = checklist.findIndex(i => i.id === active.id);
            const newItems = [...checklist];
            const [movedItem] = newItems.splice(oldIndex, 1);

            const targetGroupId = overGroup ? overGroup.id : (overItem ? overItem.group_id : (movedItem.group_id || 'default'));
            movedItem.group_id = targetGroupId;

            if (overItem) {
                const newIndex = newItems.findIndex(i => i.id === over.id);
                newItems.splice(newIndex, 0, movedItem);
            } else {
                newItems.push(movedItem);
            }

            setChecklist(newItems);

            try {
                const updates = newItems.map((item, index) => ({
                    id: item.id,
                    position: index * 10,
                    group_id: item.group_id
                }));
                for (const update of updates) {
                    if (update.id.startsWith('temp-')) continue;
                    await supabase.from('kanban_checklists').update({
                        position: update.position,
                        group_id: update.group_id
                    }).eq('id', update.id);
                }
            } catch (error) {
                console.error('Error updating checklist item positions:', error);
                toast.error('Erro ao reordenar itens.', 'Erro');
                fetchChecklist();
            }
        }
    };

    const SortableSubtaskItem = ({ task, isFullScreen }: { task: any, isFullScreen: boolean }) => {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging
        } = useSortable({ id: task.id });

        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
            zIndex: isDragging ? 100 : 'auto',
            position: 'relative' as const,
        };

        if (isFullScreen) {
            return (
                <div
                    ref={setNodeRef}
                    style={style}
                    className={`group grid grid-cols-[30px_1fr_140px_140px_180px_60px] gap-6 items-center px-6 py-4 hover:bg-white/[0.04] transition-all relative text-sm ${(showSubtaskStatusSelect === task.id || showSubtaskMemberSelect === task.id || showSubtaskPrioritySelect === task.id || showSubtaskTagSelectId === task.id) ? 'z-[999]' : 'z-auto'}`}
                >
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shrink-0">
                        <IconGripVertical size={16} />
                    </div>

                    {/* Nome e Status */}
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="relative shrink-0">
                            <button
                                onClick={() => {
                                    if (userRole === 'visualizador') return;
                                    setActiveSubtaskId(task.id);
                                    setShowSubtaskStatusSelect(showSubtaskStatusSelect === task.id ? null : task.id);
                                    setShowSubtaskMemberSelect(null);
                                    setShowSubtaskPrioritySelect(null);
                                    setShowSubtaskDateSelect(null);
                                }}
                                className="w-5 h-5 rounded-full border border-gray-600 hover:border-gray-400 flex items-center justify-center transition-colors shadow-sm"
                                style={{ borderColor: task.column_id ? columns.find(c => c.id === task.column_id)?.color : '#4b5563' }}
                            >
                                <div
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: task.column_id ? (columns.find(c => c.id === task.column_id)?.color) : 'transparent' }}
                                />
                            </button>

                            {showSubtaskStatusSelect === task.id && (
                                <div className="absolute top-full left-0 mt-2 w-56 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-2">
                                    {columns.map(col => (
                                        <button
                                            key={col.id}
                                            onClick={() => {
                                                handleUpdateSubtask(task.id, { column_id: col.id });
                                                setShowSubtaskStatusSelect(null);
                                            }}
                                            className="w-full text-left px-4 py-2 text-xs hover:bg-white/5 flex items-center gap-3 group/item transition-colors"
                                        >
                                            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: col.color }} />
                                            <span className="text-gray-300 group-hover/item:text-white transition-colors">{col.title}</span>
                                            {task.column_id === col.id && <CheckSquare size={12} className="ml-auto text-primary" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {editingSubtaskId === task.id ? (
                            <input
                                autoFocus
                                className="bg-white/10 border border-primary/50 rounded-lg px-2 py-1 text-sm text-white focus:outline-none w-full"
                                value={editingSubtaskTitle}
                                onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                                onBlur={() => {
                                    if (editingSubtaskTitle.trim() && editingSubtaskTitle !== task.title) {
                                        handleUpdateSubtask(task.id, { title: editingSubtaskTitle });
                                    }
                                    setEditingSubtaskId(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (editingSubtaskTitle.trim() && editingSubtaskTitle !== task.title) {
                                            handleUpdateSubtask(task.id, { title: editingSubtaskTitle });
                                        }
                                        setEditingSubtaskId(null);
                                    }
                                    if (e.key === 'Escape') setEditingSubtaskId(null);
                                }}
                            />
                        ) : (
                            <div className="flex items-center group/title flex-1 min-w-0 pr-12">
                                <span
                                    className="text-gray-200 group-hover:text-white truncate transition-colors cursor-pointer font-medium flex-1"
                                    onClick={() => {
                                        if (onOpenCard) onOpenCard(task.id);
                                    }}
                                >
                                    {task.title}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover/title:opacity-100 transition-opacity whitespace-nowrap ml-auto">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (userRole === 'visualizador') return;
                                            setEditingSubtaskId(task.id);
                                            setEditingSubtaskTitle(task.title);
                                        }}
                                        className="text-gray-600 hover:text-blue-400 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                        title="Renomear"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (userRole === 'visualizador') return;
                                                setShowSubtaskTagSelectId(showSubtaskTagSelectId === task.id ? null : task.id);
                                            }}
                                            className="text-gray-600 hover:text-emerald-400 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                            title="Tags"
                                        >
                                            <IconTag size={14} />
                                        </button>
                                        {showSubtaskTagSelectId === task.id && (
                                            <div className="absolute top-full right-0 mt-1 w-48 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl z-[100] p-1">
                                                <div className="max-h-40 overflow-y-auto custom-scrollbar">
                                                    {tags.map(tag => (
                                                        <button
                                                            key={tag.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleSubtaskTag(task.id, tag.id);
                                                            }}
                                                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10px] text-gray-300 hover:bg-white/5 transition-colors text-left ${task.tags?.includes(tag.id) ? 'bg-primary/10 text-primary' : ''}`}
                                                        >
                                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                                            <span className="truncate">{tag.name}</span>
                                                        </button>
                                                    ))}
                                                    {tags.length === 0 && <p className="text-[10px] text-gray-500 p-2 text-center font-medium">Nenhuma etiqueta</p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {task.tags && task.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 ml-3 shrink-0">
                                        {tags.filter(t => task.tags.includes(t.id)).slice(0, 3).map(tag => (
                                            <div
                                                key={tag.id}
                                                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border border-white/5 whitespace-nowrap"
                                                style={{ backgroundColor: `${tag.color}15`, color: tag.color }}
                                            >
                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                                <span>{tag.name}</span>
                                            </div>
                                        ))}
                                        {task.tags.length > 3 && (
                                            <span className="text-[10px] text-gray-500 font-bold self-center">+{task.tags.length - 3}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Responsavel */}
                    <div className="flex justify-start relative pl-2">
                        <button
                            onClick={() => {
                                if (userRole === 'visualizador') return;
                                setActiveSubtaskId(task.id);
                                setShowSubtaskMemberSelect(showSubtaskMemberSelect === task.id ? null : task.id);
                                setShowSubtaskPrioritySelect(null);
                                setShowSubtaskDateSelect(null);
                            }}
                            className="group/member flex items-center"
                        >
                            {task.assigned_to ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0 border border-primary/30 ring-2 ring-[#0a0a1a] overflow-hidden shadow-lg">
                                        {members.find(m => m.id === task.assigned_to)?.avatar_url ? (
                                            <img src={members.find(m => m.id === task.assigned_to).avatar_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            members.find(m => m.id === task.assigned_to)?.name?.charAt(0) || 'U'
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">{members.find(m => m.id === task.assigned_to)?.name?.split(' ')[0]}</span>
                                </div>
                            ) : (
                                <div className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all">
                                    <IconUser size={14} />
                                </div>
                            )}
                        </button>

                        {showSubtaskMemberSelect === task.id && (
                            <div className="absolute top-full left-0 mt-2 w-56 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                                <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                                    {members.map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => {
                                                handleUpdateSubtask(task.id, { assigned_to: m.id });
                                                setShowSubtaskMemberSelect(null);
                                            }}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left ${task.assigned_to === m.id ? 'bg-primary/10 text-primary' : ''}`}
                                        >
                                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold overflow-hidden shadow-sm">
                                                {m.avatar_url ? (
                                                    <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    m.name.charAt(0)
                                                )}
                                            </div>
                                            <span className="truncate">{m.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Prioridade */}
                    <div className="flex justify-start relative pl-2">
                        <button
                            onClick={() => {
                                if (userRole === 'visualizador') return;
                                setActiveSubtaskId(task.id);
                                setShowSubtaskPrioritySelect(showSubtaskPrioritySelect === task.id ? null : task.id);
                                setShowSubtaskMemberSelect(null);
                                setShowSubtaskDateSelect(null);
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <IconFlag
                                size={18}
                                className={`${task.priority === 'urgent' ? 'text-red-500' : task.priority === 'high' ? 'text-orange-500' : task.priority === 'medium' ? 'text-blue-500' : 'text-gray-600'} transition-colors`}
                                fill={task.priority && task.priority !== 'low' ? "currentColor" : "none"}
                                stroke={1.5}
                            />
                            <span className={`text-xs capitalize ${task.priority === 'urgent' ? 'text-red-500/80' : task.priority === 'high' ? 'text-orange-500/80' : task.priority === 'medium' ? 'text-blue-500/80' : 'text-gray-600'}`}>
                                {task.priority || 'Baixa'}
                            </span>
                        </button>

                        {showSubtaskPrioritySelect === task.id && (
                            <div className="absolute top-full left-0 mt-2 w-40 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden p-1">
                                {[
                                    { value: 'urgent', label: 'Urgente', text: 'text-red-500' },
                                    { value: 'high', label: 'Alta', text: 'text-orange-500' },
                                    { value: 'medium', label: 'Media', text: 'text-blue-500' },
                                    { value: 'low', label: 'Baixa', text: 'text-gray-500' }
                                ].map(p => (
                                    <button
                                        key={p.value}
                                        onClick={() => {
                                            handleUpdateSubtask(task.id, { priority: p.value });
                                            setShowSubtaskPrioritySelect(null);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs hover:bg-white/5 transition-colors text-left ${task.priority === p.value ? 'bg-white/10' : ''}`}
                                    >
                                        <IconFlag size={14} className={p.text} fill="currentColor" />
                                        <span className="text-gray-300">{p.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Data */}
                    <div className="text-left text-xs relative flex justify-start pl-2">
                        <div className="relative min-w-[80px] h-8 flex items-center group/date px-2 rounded-lg hover:bg-white/5 transition-colors">
                            {task.due_date ? (
                                <span className="cursor-pointer hover:text-white transition-colors text-gray-300 font-medium">
                                    {new Date(task.due_date.substring(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </span>
                            ) : (
                                <IconCalendar size={18} className="text-gray-600 hover:text-gray-400" />
                            )}
                            <input
                                type="date"
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                value={task.due_date ? task.due_date.substring(0, 10) : ''}
                                onChange={(e) => handleUpdateSubtask(task.id, { due_date: e.target.value })}
                                disabled={userRole === 'visualizador'}
                                onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
                            />
                        </div>
                    </div>

                    {/* Ações */}
                    <div className="flex justify-end items-center gap-1 pr-2">
                        {/* Badge de aprovação — sempre visível */}
                        {task.needs_approval && (
                            task.approval_status === 'approved' ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 whitespace-nowrap">
                                    <CheckSquare size={10} />APROVADO
                                </span>
                            ) : task.approval_status === 'awaiting_adjustment' ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/20 whitespace-nowrap">
                                    <Lock size={10} />REPROVADO
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20 whitespace-nowrap">
                                    <Lock size={10} />AGUARDANDO
                                </span>
                            )
                        )}
                        {/* Botão de config e excluir — só no hover */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {(currentUserApprover || userRole === 'admin' || userRole === 'proprietario') && (
                                <button
                                    onClick={(e) => handleToggleSubtaskApprovalReq(e, task.id, task.needs_approval)}
                                    className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${task.needs_approval ? 'text-primary' : 'text-gray-600 hover:text-gray-400'}`}
                                    title="Configurar Aprovação"
                                >
                                    <Lock size={16} />
                                </button>
                            )}
                            <button onClick={(e) => {
                                e.stopPropagation();
                                if (userRole === 'visualizador') return;
                                handleUnlinkSubtask(task.id);
                            }} className="text-gray-600 hover:text-red-400 transition-colors p-2 hover:bg-white/10 rounded-lg">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div
                ref={setNodeRef}
                style={style}
                className={`group grid grid-cols-[1fr_100px_100px_140px_40px] gap-4 items-center px-4 py-2 hover:bg-white/[0.02] transition-all relative text-sm ${(showSubtaskStatusSelect === task.id || showSubtaskMemberSelect === task.id || showSubtaskPrioritySelect === task.id || showSubtaskTagSelectId === task.id) ? 'z-[999]' : 'z-auto'}`}
            >
                {/* Nome e Status */}
                <div className="flex items-center gap-3 min-w-0">
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-700 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shrink-0 w-4">
                        <IconGripVertical size={14} />
                    </div>
                    <div className="relative shrink-0">
                        <button
                            onClick={() => {
                                if (userRole === 'visualizador') return;
                                setActiveSubtaskId(task.id);
                                setShowSubtaskStatusSelect(showSubtaskStatusSelect === task.id ? null : task.id);
                                setShowSubtaskMemberSelect(null);
                                setShowSubtaskPrioritySelect(null);
                                setShowSubtaskDateSelect(null);
                            }}
                            className="w-4 h-4 rounded-full border border-gray-600 hover:border-gray-400 flex items-center justify-center transition-colors shadow-sm"
                            style={{ borderColor: task.column_id ? columns.find(c => c.id === task.column_id)?.color : '#4b5563' }}
                        >
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: task.column_id ? (columns.find(c => c.id === task.column_id)?.color) : 'transparent' }}
                            />
                        </button>

                        {showSubtaskStatusSelect === task.id && (
                            <div className="absolute top-full left-0 mt-2 w-56 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-2">
                                {columns.map(col => (
                                    <button
                                        key={col.id}
                                        onClick={() => {
                                            handleUpdateSubtask(task.id, { column_id: col.id });
                                            setShowSubtaskStatusSelect(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs hover:bg-white/5 flex items-center gap-3 group/item transition-colors"
                                    >
                                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: col.color }} />
                                        <span className="text-gray-300 group-hover/item:text-white transition-colors">{col.title}</span>
                                        {task.column_id === col.id && <CheckSquare size={12} className="ml-auto text-primary" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {editingSubtaskId === task.id ? (
                        <input
                            autoFocus
                            className="bg-white/10 border border-primary/50 rounded px-2 py-0.5 text-xs text-white focus:outline-none flex-1 min-w-0"
                            value={editingSubtaskTitle}
                            onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                            onBlur={() => {
                                if (editingSubtaskTitle.trim() && editingSubtaskTitle !== task.title) {
                                    handleUpdateSubtask(task.id, { title: editingSubtaskTitle });
                                }
                                setEditingSubtaskId(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (editingSubtaskTitle.trim() && editingSubtaskTitle !== task.title) {
                                        handleUpdateSubtask(task.id, { title: editingSubtaskTitle });
                                    }
                                    setEditingSubtaskId(null);
                                }
                                if (e.key === 'Escape') setEditingSubtaskId(null);
                            }}
                        />
                    ) : (
                        <div className="flex items-center group/title flex-1 min-w-0 pr-8">
                            <span
                                className="text-gray-300 group-hover:text-white truncate text-sm font-medium cursor-pointer flex-1"
                                onClick={() => {
                                    if (onOpenCard) onOpenCard(task.id);
                                }}
                            >
                                {task.title}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover/title:opacity-100 transition-opacity whitespace-nowrap ml-auto">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (userRole === 'visualizador') return;
                                        setEditingSubtaskId(task.id);
                                        setEditingSubtaskTitle(task.title);
                                    }}
                                    className="text-gray-600 hover:text-blue-400 p-1 hover:bg-white/5 rounded transition-colors"
                                    title="Renomear"
                                >
                                    <Pencil size={12} />
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (userRole === 'visualizador') return;
                                            setShowSubtaskMemberSelect(null);
                                            setShowSubtaskPrioritySelect(null);
                                            setShowSubtaskStatusSelect(null);
                                            setShowSubtaskTagSelectId(showSubtaskTagSelectId === task.id ? null : task.id);
                                        }}
                                        className="text-gray-600 hover:text-emerald-400 p-1 hover:bg-white/5 rounded transition-colors"
                                        title="Tags"
                                    >
                                        <IconTag size={12} />
                                    </button>
                                    {showSubtaskTagSelectId === task.id && (
                                        <div className="absolute top-full right-0 mt-1 w-48 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl z-[100] p-1">
                                            <div className="max-h-40 overflow-y-auto custom-scrollbar">
                                                {tags.map(tag => (
                                                    <button
                                                        key={tag.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleSubtaskTag(task.id, tag.id);
                                                        }}
                                                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10px] text-gray-300 hover:bg-white/5 transition-colors text-left ${task.tags?.includes(tag.id) ? 'bg-primary/10 text-primary' : ''}`}
                                                    >
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                                        <span className="truncate">{tag.name}</span>
                                                    </button>
                                                ))}
                                                {tags.length === 0 && <p className="text-[10px] text-gray-500 p-2 text-center">Nenhuma etiqueta</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {task.tags && task.tags.length > 0 && (
                                <div className="flex gap-1 ml-2 shrink-0">
                                    {tags.filter(t => task.tags.includes(t.id)).slice(0, 3).map(tag => (
                                        <div
                                            key={tag.id}
                                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border border-white/5 whitespace-nowrap"
                                            style={{ backgroundColor: `${tag.color}15`, color: tag.color }}
                                        >
                                            <div className="w-1 h-1 rounded-full" style={{ backgroundColor: tag.color }} />
                                            <span>{tag.name}</span>
                                        </div>
                                    ))}
                                    {task.tags.length > 3 && (
                                        <span className="text-[9px] text-gray-500 font-bold self-center">+{task.tags.length - 3}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Responsavel */}
                <div className="flex justify-start relative">
                    <button
                        onClick={() => {
                            if (userRole === 'visualizador') return;
                            setActiveSubtaskId(task.id);
                            setShowSubtaskMemberSelect(showSubtaskMemberSelect === task.id ? null : task.id);
                            setShowSubtaskPrioritySelect(null);
                            setShowSubtaskDateSelect(null);
                        }}
                        className="group/member flex items-center"
                    >
                        {task.assigned_to ? (
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 border border-primary/30 ring-1 ring-[#0a0a1a] overflow-hidden shadow-lg">
                                {members.find(m => m.id === task.assigned_to)?.avatar_url ? (
                                    <img src={members.find(m => m.id === task.assigned_to).avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    members.find(m => m.id === task.assigned_to)?.name?.charAt(0) || 'U'
                                )}
                            </div>
                        ) : (
                            <div className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all">
                                <IconUser size={12} />
                            </div>
                        )}
                    </button>

                    {showSubtaskMemberSelect === task.id && (
                        <div className="absolute top-full left-0 mt-2 w-56 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                            <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                                {members.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => {
                                            handleUpdateSubtask(task.id, { assigned_to: m.id });
                                            setShowSubtaskMemberSelect(null);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left ${task.assigned_to === m.id ? 'bg-primary/10 text-primary' : ''}`}
                                    >
                                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold overflow-hidden shadow-sm">
                                            {m.avatar_url ? (
                                                <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                m.name.charAt(0)
                                            )}
                                        </div>
                                        <span className="truncate">{m.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Prioridade */}
                <div className="flex justify-start relative">
                    <button
                        onClick={() => {
                            if (userRole === 'visualizador') return;
                            setActiveSubtaskId(task.id);
                            setShowSubtaskPrioritySelect(showSubtaskPrioritySelect === task.id ? null : task.id);
                            setShowSubtaskMemberSelect(null);
                            setShowSubtaskDateSelect(null);
                        }}
                        className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white/5 transition-colors"
                    >
                        <IconFlag
                            size={16}
                            className={`${task.priority === 'urgent' ? 'text-red-500' : task.priority === 'high' ? 'text-orange-500' : task.priority === 'medium' ? 'text-blue-500' : 'text-gray-600'} transition-colors`}
                            fill={task.priority && task.priority !== 'low' ? "currentColor" : "none"}
                            stroke={1.5}
                        />
                        <span className={`text-[10px] capitalize ${task.priority === 'urgent' ? 'text-red-500/80' : task.priority === 'high' ? 'text-orange-500/80' : task.priority === 'medium' ? 'text-blue-500/80' : 'text-gray-600'}`}>
                            {(task.priority === 'urgent' ? 'Urgente' : task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa')}
                        </span>
                    </button>

                    {showSubtaskPrioritySelect === task.id && (
                        <div className="absolute top-full left-0 mt-2 w-40 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden p-1">
                            {[
                                { value: 'urgent', label: 'Urgente', text: 'text-red-500' },
                                { value: 'high', label: 'Alta', text: 'text-orange-500' },
                                { value: 'medium', label: 'Média', text: 'text-blue-500' },
                                { value: 'low', label: 'Baixa', text: 'text-gray-500' }
                            ].map(p => (
                                <button
                                    key={p.value}
                                    onClick={() => {
                                        handleUpdateSubtask(task.id, { priority: p.value });
                                        setShowSubtaskPrioritySelect(null);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs hover:bg-white/5 transition-colors text-left ${task.priority === p.value ? 'bg-white/10' : ''}`}
                                >
                                    <IconFlag size={14} className={p.text} fill="currentColor" />
                                    <span className="text-gray-300">{p.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Data */}
                <div className="text-left text-xs relative flex justify-start">
                    <div className="relative min-w-[60px] h-7 flex items-center group/date px-1.5 rounded hover:bg-white/5 transition-colors">
                        {task.due_date ? (
                            <span className="cursor-pointer hover:text-white transition-colors text-[11px] text-gray-300 font-medium">
                                {new Date(task.due_date.substring(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR').slice(0, 5)}
                            </span>
                        ) : (
                            <IconCalendar size={16} className="text-gray-600 hover:text-gray-400" />
                        )}
                        <input
                            type="date"
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            value={task.due_date ? task.due_date.substring(0, 10) : ''}
                            onChange={(e) => handleUpdateSubtask(task.id, { due_date: e.target.value })}
                            disabled={userRole === 'visualizador'}
                            onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
                        />
                    </div>
                </div>

                {/* Ações */}
                <div className="flex justify-end items-center gap-0.5 pr-2">
                    {/* Badge de aprovação — sempre visível */}
                    {task.needs_approval && (
                        task.approval_status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20 whitespace-nowrap">
                                <CheckSquare size={9} />APROVADO
                            </span>
                        ) : task.approval_status === 'awaiting_adjustment' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px] font-bold border border-red-500/20 whitespace-nowrap">
                                <Lock size={9} />REPROVADO
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-bold border border-amber-500/20 whitespace-nowrap">
                                <Lock size={9} />AGUARDANDO
                            </span>
                        )
                    )}
                    {/* Botão de config e excluir — só no hover */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                        {(currentUserApprover || userRole === 'admin' || userRole === 'proprietario') && (
                            <button
                                onClick={(e) => handleToggleSubtaskApprovalReq(e, task.id, task.needs_approval)}
                                className={`p-1 rounded hover:bg-white/10 transition-colors ${task.needs_approval ? 'text-primary' : 'text-gray-600 hover:text-gray-400'}`}
                                title="Configurar Aprovação"
                            >
                                <Lock size={13} />
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (userRole === 'visualizador') return;
                                handleUnlinkSubtask(task.id);
                            }}
                            className="text-gray-600 hover:text-red-400 transition-all p-1 hover:bg-white/5 rounded"
                            title="Excluir"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };



    // Helper for Audit Logs
    const createAuditLog = async (action: string, entityType: string, entityId: string, details: any) => {
        if (!selectedCompany) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            await supabase.from('audit_logs').insert({
                company_id: selectedCompany.id,
                user_id: user.id,
                action_type: action,
                entity_type: entityType,
                entity_id: entityId,
                details: {
                    ...details,
                    card_title: title // Use current title state
                }
            });
        } catch (e) {
            console.error('Error creating audit log:', e);
        }
    };

    const handleCreateSubtask = async (subtaskTitle: string) => {
        if (!subtaskTitle.trim() || !selectedCompany) return;

        if (cardId === 'new') {
            toast.warning('Salve a tarefa principal antes de criar subtarefas.', 'Atenção');
            return;
        }

        try {
            const targetColId = currentColumnId || columnId;
            if (!targetColId) {
                toast.error('Nenhuma coluna encontrada para criar subtarefa.', 'Erro');
                return;
            }

            const { data, error } = await supabase.from('kanban_cards').insert({
                company_id: selectedCompany.id,
                client_id: clientId || null,
                column_id: targetColId,
                title: subtaskTitle,
                parent_id: cardId,
                position: 9999,
                priority: 'medium'
            }).select().single();

            if (error) throw error;
            setSubtasks([...subtasks, { ...data, tags: [] }]);
        } catch (error) {
            console.error('Error creating subtask:', error);
            toast.error('Erro ao criar subtarefa.', 'Erro');
        }
    };

    const handleToggleSubtaskTag = async (subtaskId: string, tagId: string) => {
        const subtask = subtasks.find(t => t.id === subtaskId);
        if (!subtask) return;

        const currentTags = subtask.tags || [];
        const isAdding = !currentTags.includes(tagId);

        try {
            if (isAdding) {
                const { error: insertError } = await supabase.from('kanban_card_tags').insert({ card_id: subtaskId, tag_id: tagId });
                if (insertError) throw insertError;
            } else {
                const { error: deleteError } = await supabase.from('kanban_card_tags').delete().match({ card_id: subtaskId, tag_id: tagId });
                if (deleteError) throw deleteError;
            }

            const newTags = isAdding
                ? [...currentTags, tagId]
                : currentTags.filter((id: string) => id !== tagId);

            setSubtasks(subtasks.map(t => t.id === subtaskId ? { ...t, tags: newTags } : t));
        } catch (error) {
            console.error('Error toggling subtask tag:', error);
            toast.error('Erro ao atualizar tags da subtarefa.', 'Erro');
        }
    };

    const handleUnlinkSubtask = async (subtaskId: string) => {
        try {
            const { error } = await supabase.from('kanban_cards').update({ parent_id: null }).eq('id', subtaskId);
            if (error) throw error;
            setSubtasks(subtasks.filter(t => t.id !== subtaskId));
        } catch (error) {
            console.error('Error unlinking subtask:', error);
            toast.error('Erro ao desvincular subtarefa.', 'Erro');
        }
    };

    const handleConvertChecklistToSubtask = async (itemId: string, description: string) => {
        if (!selectedCompany) return;
        if (cardId === 'new') {
            toast.warning('Salve a tarefa principal antes de converter itens em subtarefas.', 'Atenção');
            return;
        }

        try {
            // 1. Create subtask
            const targetColId = currentColumnId || columnId;

            if (!targetColId) {
                toast.error('Nenhuma coluna encontrada.', 'Erro');
                return;
            }

            const { data: newCard, error: createError } = await supabase.from('kanban_cards').insert({
                company_id: selectedCompany.id,
                client_id: clientId || null,
                column_id: targetColId,
                title: description,
                parent_id: cardId,
                position: 9999,
                priority: 'medium'
            }).select().single();

            if (createError) throw createError;

            // 2. Delete checklist item
            await handleDeleteChecklist(itemId);

            // 3. Update state
            setSubtasks([...subtasks, newCard]);
        } catch (error) {
            console.error('Error converting checklist:', error);
            toast.error('Erro ao converter item.', 'Erro');
        }
    };

    const handleUpdateSubtask = async (subtaskId: string, updates: any) => {
        try {
            const { error } = await supabase
                .from('kanban_cards')
                .update(updates)
                .eq('id', subtaskId);

            if (error) throw error;

            setSubtasks(subtasks.map(task =>
                task.id === subtaskId ? { ...task, ...updates } : task
            ));
        } catch (error) {
            console.error('Error updating subtask:', error);
            toast.error('Erro ao atualizar subtarefa.', 'Erro');
        }
    };

    const handleSave = async () => {
        if (!selectedCompany) return;
        setSaving(true);
        try {
            const cardData = {
                title,
                description,
                priority,
                assigned_to: assignedTo || null,
                due_date: dueDate || null,
                start_date: startDate || null,
                delivery_date: deliveryDate || null, // New: Save Delivery Date
                show_on_calendar: dueDate ? true : false,
                category,
                subcategory,
                client_id: clientId || null, // New: Save Client ID
                company_id: selectedCompany.id,
                column_id: currentColumnId || columnId || columns[0]?.id, // Always include the current/selected column
                ...(cardId === 'new' ? { position: 9999 } : {})
            };

            let finalCardId = cardId;

            if (cardId === 'new') {
                const { data, error } = await supabase.from('kanban_cards').insert(cardData).select('id').single();
                if (error) throw error;
                finalCardId = data.id;

                // Audit Log: Create
                await createAuditLog('create', 'card', finalCardId, { column_id: columnId });
            } else {
                const { error } = await supabase
                    .from('kanban_cards')
                    .update(cardData)
                    .eq('id', cardId);
                if (error) throw error;
            }

            // Process Assignment Notifications (for both new and existing cards)
            if (assignedTo && assignedTo !== originalAssignedTo) {
                await createTaskNotification(
                    assignedTo,
                    'Nova Tarefa Atribuida',
                    `Você foi atribuído à tarefa: ${title}`,
                    finalCardId,
                    'assignment'
                );
            }

            // Check for other changes and create system logs (only for existing cards)
            if (cardId !== 'new') {
                if (assignedTo !== originalAssignedTo) {
                    const oldUser = members.find(m => m.id === originalAssignedTo)?.name || 'Ninguem';
                    const newUser = members.find(m => m.id === assignedTo)?.name || 'Ninguem';
                    const { data: { user } } = await supabase.auth.getUser();
                    await createSystemLog(finalCardId, `Alterou o responsavel de "${oldUser}" para "${newUser}".`, user?.id);

                    // Audit Log
                    await createAuditLog('update', 'card', finalCardId, {
                        field: 'assigned_to',
                        from: oldUser,
                        to: newUser
                    });
                }

                if (dueDate !== originalDueDate) {
                    const oldDate = originalDueDate ? new Date(originalDueDate).toLocaleDateString('pt-BR') : 'Nao definida';
                    const newDate = dueDate ? new Date(dueDate).toLocaleDateString('pt-BR') : 'Nao definida';
                    const { data: { user } } = await supabase.auth.getUser();
                    await createSystemLog(finalCardId, `Alterou a data de entrega de "${oldDate}" para "${newDate}".`, user?.id);

                    // Audit Log
                    await createAuditLog('update', 'card', finalCardId, {
                        field: 'due_date',
                        from: oldDate,
                        to: newDate
                    });
                }
            }

            // Process pending checklist items
            if (checklist.length > 0) {
                // Filter items that need to be inserted (those without ID or with temp ID)
                // For simplicity, we can upsert or check if they have a real UUID. 
                // But since we kept them in state, for new items we might have issues if we don't track them properly.
                // Let's assume for 'new' card all items are new.
                if (cardId === 'new') {
                    const checklistToInsert = checklist.map((item, index) => ({
                        card_id: finalCardId,
                        description: item.description,
                        position: index,
                        is_completed: item.is_completed || false,
                        company_id: selectedCompany.id // Added this line just in case, though schema didn't require it explicitly in migration provided but policy uses join. 
                        // Wait, checklist table doesn't have company_id in schema I read earlier, it relies on card.
                    }));

                    if (checklistToInsert.length > 0) {
                        const { error: checkError } = await supabase.from('kanban_checklists').insert(checklistToInsert);
                        if (checkError) console.error('Error saving checklist:', checkError);
                    }
                }
            }

            // Process pending comments (only for new cards)
            if (cardId === 'new' && comments.length > 0) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const commentsToInsert = comments.map(c => ({
                        card_id: finalCardId,
                        content: c.content,
                        user_id: user.id
                    }));
                    const { error: commError } = await supabase.from('kanban_comments').insert(commentsToInsert);
                    if (commError) console.error('Error saving comments:', commError);
                }
            }

            // Process pending files (only for new cards)
            if (cardId === 'new' && files.length > 0) {
                const { data: { user } } = await supabase.auth.getUser();
                const filesToInsert = files.map(f => ({
                    card_id: finalCardId,
                    file_name: f.file_name,
                    file_url: f.file_url,
                    file_type: f.file_type || 'link',
                    uploader_id: user?.id
                }));
                const { error: fileError } = await supabase.from('kanban_attachments').insert(filesToInsert);
                if (fileError) console.error('Error saving files:', fileError);
            }

            // Process Tags
            // Delete existing if not new
            if (cardId !== 'new') {
                await supabase.from('kanban_card_tags').delete().eq('card_id', cardId);
            }

            if (selectedTags.length > 0) {
                const tagsToInsert = selectedTags.map(tagId => ({
                    card_id: finalCardId,
                    tag_id: tagId
                }));
                const { error: tagError } = await supabase.from('kanban_card_tags').insert(tagsToInsert);
                if (tagError) console.error('Error saving tags:', tagError);
            }


            if (onRefresh) onRefresh();
            onClose(); // Close modal on success (and trigger refresh in parent)
        } catch (error) {
            console.error('Error saving:', error);
            toast.error('Erro ao salvar card.', 'Erro');
        } finally {
            setSaving(false);
        }
    };

    const handleAddChecklistGroup = async () => {
        if (!selectedCompany || cardId === 'new') {
            const newGroup = { id: `temp-group-${Date.now()}`, title: 'Novo Checklist' };
            setChecklistGroups([...checklistGroups, newGroup]);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('kanban_checklist_groups')
                .insert({ card_id: cardId, title: 'Novo Checklist' })
                .select()
                .single();

            if (data) {
                setChecklistGroups([...checklistGroups, data]);
            }
        } catch (err) {
            console.error('Error adding checklist group', err);
            const newGroup = { id: `temp-group-${Date.now()}`, title: 'Novo Checklist' };
            setChecklistGroups([...checklistGroups, newGroup]);
        }
    };

    const handleUpdateChecklistGroup = async (groupId: string, title: string) => {
        setChecklistGroups(checklistGroups.map(g => g.id === groupId ? { ...g, title } : g));
        if (!groupId.startsWith('temp-') && cardId !== 'new') {
            try {
                await supabase.from('kanban_checklist_groups').update({ title }).eq('id', groupId);
            } catch (err) {
                console.error('Update checklist group error', err);
            }
        }
    };

    const handleDeleteChecklistGroup = async (groupId: string) => {
        setChecklistGroups(checklistGroups.filter(g => g.id !== groupId));
        setChecklist(checklist.filter(item => item.group_id !== groupId));
        if (!groupId.startsWith('temp-') && cardId !== 'new') {
            try {
                await supabase.from('kanban_checklist_groups').delete().eq('id', groupId);
            } catch (err) {
                console.error('Delete checklist group error', err);
            }
        }
    };

    const handleAddChecklistItem = async (groupId: string = 'default') => {
        const itemText = newChecklistItems[groupId];
        if (!itemText?.trim()) return;

        // If it's a new card
        if (cardId === 'new' || groupId.startsWith('temp-') || groupId === 'default') {
            const newItem = {
                id: `temp-${Date.now()}`,
                description: itemText,
                is_completed: false,
                needs_approval: false,
                group_id: groupId,
                position: checklist.length
            };
            setChecklist([...checklist, newItem]);
            setNewChecklistItems({ ...newChecklistItems, [groupId]: '' });
            return;
        }

        if (!selectedCompany) return;

        try {
            const { data, error } = await supabase
                .from('kanban_checklists')
                .insert({
                    card_id: cardId,
                    group_id: groupId,
                    description: itemText,
                    position: checklist.length,
                    is_completed: false,
                    needs_approval: false
                })
                .select()
                .single();

            if (error) throw error;
            setChecklist([...checklist, data]);
            setNewChecklistItems({ ...newChecklistItems, [groupId]: '' });
        } catch (error: any) {
            console.error('Error adding checklist item:', error);
            // Fallback for no group mapped yet
            if (error?.code === '42703') { // column "group_id" does not exist
                const { data: fData } = await supabase.from('kanban_checklists').insert({ card_id: cardId, description: itemText, position: checklist.length }).select().single();
                if (fData) setChecklist([...checklist, fData]);
                setNewChecklistItems({ ...newChecklistItems, [groupId]: '' });
            }
        }
    };

    const handleToggleChecklist = async (itemId: string, currentStatus: boolean, needsApproval: boolean, approverId: string | null) => {
        // Check approval rules
        if (needsApproval) {
            if (approverId) {
                // If a specific approver is assigned, ONLY they can approve
                if (currentUserId !== approverId) {
                    const approverName = members.find(m => m.id === approverId)?.name || 'o responsavel';
                    toast.warning(`Este item so pode ser aprovado por: ${approverName}`, 'Permissao negada');
                    return;
                }
            } else {
                // If no specific approver, ANY approver can approve
                if (!currentUserApprover) {
                    toast.warning('Este item requer aprovacao de um gestor.', 'Permissao negada');
                    return;
                }
            }
        }

        // Local update for temp items
        if (itemId.startsWith('temp-')) {
            setChecklist(checklist.map(item =>
                item.id === itemId ? { ...item, is_completed: !currentStatus } : item
            ));
            return;
        }

        try {
            const { error } = await supabase
                .from('kanban_checklists')
                .update({
                    is_completed: !currentStatus,
                    // Se for aprovador marcando, podemos salvar quem aprovou (futuro)
                    // approver_id: currentUserApprover ? currentUserId : null 
                })
                .eq('id', itemId);

            if (error) throw error;
            setChecklist(checklist.map(item =>
                item.id === itemId ? { ...item, is_completed: !currentStatus } : item
            ));

            // Audit Log for Approval
            if (needsApproval && !currentStatus) {
                const itemDesc = checklist.find(i => i.id === itemId)?.description || 'item';
                await createAuditLog('approve', 'card', cardId, { status: 'approved', checklist_item: itemDesc });
            }
        } catch (error) {
            console.error('Error toggling checklist:', error);
        }
    };

    const handleToggleApprovalReq = (e: React.MouseEvent, itemId: string, currentStatus: boolean) => {
        e.stopPropagation();
        // Instead of toggling immediately, if turning ON, show modal to select approver
        if (!currentStatus) {
            const rect = e.currentTarget.getBoundingClientRect();
            let left = rect.left;
            const popoverWidth = 256;
            if (left + popoverWidth > window.innerWidth - 20) {
                left = window.innerWidth - popoverWidth - 20;
            }
            setPopoverPos({ top: rect.bottom + 8, left });
            setShowApproverModal(itemId);
        } else {
            // If turning OFF, just update
            updateApprovalStatus(itemId, false, null);
        }
    };

    const updateApprovalStatus = async (itemId: string, status: boolean, approverId: string | null) => {
        // Local update for temp items
        if (itemId.startsWith('temp-')) {
            setChecklist(checklist.map(item =>
                item.id === itemId ? { ...item, needs_approval: status, approver_id: approverId } : item
            ));
            setShowApproverModal(null);
            return;
        }

        try {
            const { error } = await supabase
                .from('kanban_checklists')
                .update({
                    needs_approval: status,
                    approver_id: approverId,
                    approval_status: status ? 'pending' : 'pending' // Reset status if re-enabling
                })
                .eq('id', itemId);

            if (error) throw error;
            setChecklist(checklist.map(item =>
                item.id === itemId ? { ...item, needs_approval: status, approver_id: approverId } : item
            ));
            setShowApproverModal(null);

            // System Log
            const itemDesc = checklist.find(i => i.id === itemId)?.description || 'item';
            const { data: { user } } = await supabase.auth.getUser();
            if (status) {
                const approverName = members.find(m => m.id === approverId)?.name || 'um gestor';
                await createSystemLog(cardId, `Solicitou aprovacao de "${approverName}" para o item: "${itemDesc}".`, user?.id);
                await createAuditLog('approve', 'card', cardId, { status: 'requested', checklist_item: itemDesc, approver: approverName });
            } else {
                await createSystemLog(cardId, `Removeu a solicitacao de aprovacao do item: "${itemDesc}".`, user?.id);
                await createAuditLog('approve', 'card', cardId, { status: 'removed', checklist_item: itemDesc });
            }

        } catch (error) {
            console.error('Error updating approval status:', error);
        }
    };

    const handleToggleSubtaskApprovalReq = (e: React.MouseEvent, subtaskId: string, currentStatus: boolean) => {
        e.stopPropagation();
        if (!currentStatus) {
            const rect = e.currentTarget.getBoundingClientRect();
            let left = rect.left;
            const popoverWidth = 256;
            if (left + popoverWidth > window.innerWidth - 20) {
                left = window.innerWidth - popoverWidth - 20;
            }
            setPopoverPos({ top: rect.bottom + 8, left });
            setShowApproverModal(`subtask:${subtaskId}`);
        } else {
            updateSubtaskApprovalStatus(subtaskId, false, null);
        }
    };

    const updateSubtaskApprovalStatus = async (subtaskId: string, status: boolean, approverId: string | null) => {
        try {
            const { error } = await supabase
                .from('kanban_cards')
                .update({
                    needs_approval: status,
                    approver_id: approverId,
                    is_approved: false,
                    approval_status: status ? 'pending' : null,
                })
                .eq('id', subtaskId);

            if (error) throw error;
            setSubtasks(subtasks.map(t =>
                t.id === subtaskId ? { ...t, needs_approval: status, approver_id: approverId, is_approved: false, approval_status: status ? 'pending' : null } : t
            ));

            // If this IS the current open card (subtask), update inline states too
            if (subtaskId === cardId) {
                setApprovalNeeded(status);
                setApprovalApproverId(approverId);
                setApprovalIsApproved(false);
                setApprovalStatus(status ? 'pending' : 'pending');
            }

            if (status) {
                await supabase.from('kanban_approval_history').insert({
                    card_id: subtaskId,
                    actor_id: currentUserId,
                    action: 'requested',
                    note: null,
                });
            }

            setShowApproverModal(null);

            const subtaskTitle = subtasks.find(t => t.id === subtaskId)?.title || 'subtarefa';
            const { data: { user } } = await supabase.auth.getUser();
            if (status) {
                const approverName = members.find(m => m.id === approverId)?.name || 'um gestor';
                await createSystemLog(cardId, `Solicitou aprovação de "${approverName}" para a subtarefa: "${subtaskTitle}".`, user?.id);
                toast.success(`Aprovação solicitada para ${approverName}.`, 'Aprovação');
            } else {
                await createSystemLog(cardId, `Removeu a solicitação de aprovação da subtarefa: "${subtaskTitle}".`, user?.id);
            }
            if (subtaskId === cardId) await fetchApprovalHistory();
        } catch (error) {
            console.error('Error updating subtask approval status:', error);
            toast.error('Erro ao configurar aprovação.', 'Erro');
        }
    };

    const handleApproveSubtask = async () => {
        try {
            const { error } = await supabase
                .from('kanban_cards')
                .update({ is_approved: true, approval_status: 'approved' })
                .eq('id', cardId);
            if (error) throw error;

            await supabase.from('kanban_approval_history').insert({
                card_id: cardId,
                actor_id: currentUserId,
                action: 'approved',
                note: null,
            });

            setApprovalIsApproved(true);
            setApprovalStatus('approved');
            setShowRejectForm(false);
            await fetchApprovalHistory();
            toast.success('Subtarefa aprovada com sucesso!', 'Aprovação');
        } catch (error) {
            console.error('Error approving subtask:', error);
            toast.error('Erro ao aprovar subtarefa.', 'Erro');
        }
    };

    const handleRejectSubtask = async () => {
        if (!rejectReason.trim()) {
            toast.warning('Informe a justificativa antes de devolver para ajuste.', 'Atenção');
            return;
        }
        try {
            const { error } = await supabase
                .from('kanban_cards')
                .update({ is_approved: false, approval_status: 'awaiting_adjustment' })
                .eq('id', cardId);
            if (error) throw error;

            await supabase.from('kanban_approval_history').insert({
                card_id: cardId,
                actor_id: currentUserId,
                action: 'rejected',
                note: rejectReason.trim(),
            });

            setApprovalIsApproved(false);
            setApprovalStatus('awaiting_adjustment');
            setShowRejectForm(false);
            setRejectReason('');
            await fetchApprovalHistory();
            toast.warning('Subtarefa devolvida para ajuste.', 'Reprovado');
        } catch (error) {
            console.error('Error rejecting subtask:', error);
            toast.error('Erro ao reprovar subtarefa.', 'Erro');
        }
    };

    const handleResubmitSubtask = async () => {
        try {
            const { error } = await supabase
                .from('kanban_cards')
                .update({ is_approved: false, approval_status: 'pending' })
                .eq('id', cardId);
            if (error) throw error;

            await supabase.from('kanban_approval_history').insert({
                card_id: cardId,
                actor_id: currentUserId,
                action: 'resubmitted',
                note: null,
            });

            setApprovalIsApproved(false);
            setApprovalStatus('pending');
            await fetchApprovalHistory();
            toast.success('Subtarefa reenviada para aprovação!', 'Reenvio');
        } catch (error) {
            console.error('Error resubmitting subtask:', error);
            toast.error('Erro ao reenviar subtarefa.', 'Erro');
        }
    };

    const handleDeleteChecklist = async (itemId: string) => {
        // Local delete for temp items
        if (itemId.startsWith('temp-')) {
            setChecklist(checklist.filter(item => item.id !== itemId));
            return;
        }

        try {
            const { error } = await supabase
                .from('kanban_checklists')
                .delete()
                .eq('id', itemId);

            if (error) throw error;
            setChecklist(checklist.filter(item => item.id !== itemId));
        } catch (error) {
            console.error('Error deleting checklist item:', error);
        }
    };

    const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const cursorPosition = e.target.selectionStart || 0;
        setNewComment(value);

        // Detect @
        const lastAt = value.lastIndexOf('@', cursorPosition);
        if (lastAt !== -1) {
            // Check if there's a space before @ (or it's the start)
            const charBefore = lastAt > 0 ? value[lastAt - 1] : ' ';
            if (charBefore === ' ' || charBefore === '\n') {
                const query = value.slice(lastAt + 1, cursorPosition);
                // If query contains space, user might have finished typing the name or moved on
                if (!query.includes(' ')) {
                    setMentionQuery(query);
                    setMentionIndex(lastAt);

                    // Filter members
                    const filtered = members.filter(m =>
                        m.name.toLowerCase().includes(query.toLowerCase()) ||
                        m.email?.toLowerCase().includes(query.toLowerCase())
                    );
                    setFilteredMembers(filtered);
                    return;
                }
            }
        }

        setMentionQuery(null);
        setMentionIndex(null);
    };

    const selectMention = (member: any) => {
        if (mentionIndex === null) return;

        const before = newComment.slice(0, mentionIndex);
        const after = newComment.slice(newComment.length); // Actually we should slice from cursor but let's assume end for now or simple replacement
        // Better: replace the query part
        const queryLength = mentionQuery?.length || 0;
        const afterAt = newComment.slice(mentionIndex + 1 + queryLength);

        const newValue = `${before}@${member.name} ${afterAt}`;
        setNewComment(newValue);
        setMentionQuery(null);
        setMentionIndex(null);

        // Focus back to input (ref would be better but simple state update works for now)
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check for mentions and trigger notifications
        const mentions = members.filter(m => newComment.includes(`@${m.name}`));
        if (mentions.length > 0) {
            for (const mention of mentions) {
                await createTaskNotification(
                    mention.id,
                    'VocÃª foi mencionado',
                    `${user.email?.split('@')[0]} mencionou vocÃª em: ${title}`,
                    cardId,
                    'mention'
                );
            }
        }

        // If new card, add to local state
        if (cardId === 'new') {
            const tempComment = {
                id: `temp-${Date.now()}`,
                content: newComment,
                user_id: user.id,
                user: { email: user.email },
                created_at: new Date().toISOString()
            };
            setComments([...comments, tempComment]);
            setNewComment('');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('kanban_comments')
                .insert({
                    card_id: cardId,
                    content: newComment,
                    user_id: user.id
                })
                .select()
                .single();

            if (error) throw error;

            const commentWithUser = { ...data, user: { email: user.email } };

            setComments([...comments, commentWithUser]);
            setNewComment('');

            // Audit Log
            await createAuditLog('comment', 'card', cardId, { content: newComment });
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    };

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleAddFile = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const { data: { user } = {} } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario nao autenticado');

            // 1. Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('kanban-attachments')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('kanban-attachments')
                .getPublicUrl(filePath);

            // 3. Logic for New vs Existing Card
            if (cardId === 'new') {
                const tempFile = {
                    id: `temp-${Date.now()}`,
                    file_name: file.name,
                    file_url: publicUrl,
                    file_type: fileExt || 'unknown',
                    file_size: file.size,
                    uploader_id: user.id,
                    created_at: new Date().toISOString()
                };
                setFiles([tempFile, ...files]);
                createSystemLog('new', `Anexou o arquivo: ${file.name}`, user.id);
            } else {
                const { data, error: dbError } = await supabase
                    .from('kanban_attachments')
                    .insert({
                        card_id: cardId,
                        file_name: file.name,
                        file_url: publicUrl,
                        file_type: fileExt || 'unknown',
                        file_size: file.size,
                        uploader_id: user.id
                    })
                    .select()
                    .single();

                if (dbError) throw dbError;
                setFiles([data, ...files]);
                await createSystemLog(cardId, `Anexou o arquivo: ${file.name}`, user.id);
                await createAuditLog('update', 'card', cardId, { action: 'file_upload', file_name: file.name });
            }

        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Erro ao fazer upload do arquivo.', 'Erro');
        } finally {
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDeleteFile = async (fileId: string, fileUrl: string, fileName: string) => {
        if (!await confirm(`Excluir Arquivo`, `Tem certeza que deseja excluir o arquivo "${fileName}"?`, { type: 'danger' })) return;

        // 1. If it's a temp file (new card), just remove from state
        if (fileId.startsWith('temp-')) {
            setFiles(files.filter(f => f.id !== fileId));
            return;
        }

        try {
            // 2. Extract path from URL to delete from Storage
            // URL format: .../storage/v1/object/public/kanban-attachments/user_id/filename
            const bucketName = 'kanban-attachments';
            const urlParts = fileUrl.split(`${bucketName}/`);
            if (urlParts.length > 1) {
                const filePath = urlParts[1];
                const { error: storageError } = await supabase.storage
                    .from(bucketName)
                    .remove([filePath]);

                if (storageError) {
                    console.error('Error deleting from storage:', storageError);
                    // Continue to delete from DB even if storage fails (orphan cleanup later)
                }
            }

            // 3. Delete from Database
            const { error: dbError } = await supabase
                .from('kanban_attachments')
                .delete()
                .eq('id', fileId);

            if (dbError) throw dbError;

            // 4. Update State
            setFiles(files.filter(f => f.id !== fileId));

            // 5. System Log
            const { data: { user } } = await supabase.auth.getUser();
            await createSystemLog(cardId, `Excluiu o arquivo: ${fileName}`, user?.id);
            await createAuditLog('delete', 'file', cardId, { file_name: fileName }); // Using cardId as entity_id or fileId? Using cardId but marking file details.

        } catch (error) {
            console.error('Error deleting file:', error);
            toast.error('Erro ao excluir arquivo.', 'Erro');
        }
    };

    const handleCreateTag = async () => {
        if (!newTagName.trim() || !selectedCompany) return;
        try {
            const { data, error } = await supabase.from('kanban_tags').insert({
                company_id: selectedCompany.id,
                name: newTagName,
                color: newTagColor
            }).select().single();

            if (error) throw error;

            setTags([...tags, data]);
            setNewTagName('');
            // Automatically select the created tag
            setSelectedTags([...selectedTags, data.id]);
        } catch (error) {
            console.error('Error creating tag:', error);
            toast.error('Erro ao criar etiqueta.', 'Erro');
        }
    };

    const toggleTag = (tagId: string) => {
        if (selectedTags.includes(tagId)) {
            setSelectedTags(selectedTags.filter(id => id !== tagId));
        } else {
            setSelectedTags([...selectedTags, tagId]);
        }
    };

    const isNew = cardId === 'new';

    if (loading) return createPortal(<div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center text-white">Carregando...</div>, document.body);

    return createPortal(
        <>
            {/* Time Tracking Popover (Rendered inside the portal but absolute to the field) */}
            {showTimePopover && (
                <TimeTrackingPopover
                    cardId={cardId}
                    isRunning={isRunning}
                    activeTimer={activeTimer}
                    totalMinutes={totalMinutes}
                    timerDisplay={timerDisplay}
                    timeEntries={timeEntries}
                    onClose={() => setShowTimePopover(false)}
                    onRefresh={fetchTimeEntries}
                    members={members}
                    formatDuration={formatDuration}
                />
            )}
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                {/* 1. Overlay Premium */}
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-md z-0 animate-in fade-in duration-300"
                    onClick={onClose}
                >
                    <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
                </div>

                {/* 2. Container Glass Premium */}
                <div className="relative z-10 w-full max-w-[1600px] h-[90vh] flex rounded-[22px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300 border border-white/10 bg-[#0a0a1a]/10 backdrop-blur-xl ring-1 ring-white/10 ring-inset">

                    {/* Grain Texture Overlay */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0"></div>

                    {/* Glow Effects */}
                    <div className="absolute inset-0 rounded-[22px] border border-white/5 pointer-events-none"></div>

                    {/* Glow Roxo no Topo (Estilo Equipe) */}
                    <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[80%] h-[100px] bg-primary/30 blur-[80px] pointer-events-none rounded-[100%] z-0"></div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_20px_2px_rgba(99,102,241,0.4)] z-0"></div>

                    {/* ================= ESQUERDA: CONTEÚDO PRINCIPAL (70%) ================= */}
                    <div className="flex-1 flex flex-col border-r border-white/5 overflow-hidden relative z-20 bg-transparent">

                        {/* Ações de Topo (Flutuantes) */}
                        <div className="absolute top-6 right-6 z-[60] flex gap-2">
                            {showSubtasksOnly || showChecklistOnly ? (
                                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            ) : (
                                <>
                                    {userRole !== 'visualizador' && (
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-primary/20"
                                        >
                                            {saving ? 'Salvando...' : 'Salvar Altera\u00E7\u00F5es'}
                                        </button>
                                    )}
                                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors">
                                        <X size={20} />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Corpo Unificado Scrollavel */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                            {showSubtasksOnly ? (
                                <div className="max-w-[1200px] mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex flex-col gap-6">
                                        <button
                                            onClick={() => setShowSubtasksOnly(false)}
                                            className="w-fit flex items-center gap-2 text-gray-500 hover:text-primary transition-colors text-sm font-medium group"
                                        >
                                            <div className="p-1 rounded bg-white/5 group-hover:bg-primary/10 transition-colors">
                                                <ChevronUp size={14} className="-rotate-90" />
                                            </div>
                                            Voltar \u00E0 tarefa
                                        </button>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <h2 className="text-3xl font-bold text-white tracking-tight">Subtarefas</h2>
                                                <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                                    <div className="h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                                            style={{ width: `${subtasks.length > 0 ? (subtasks.filter(t => t.column_id && columnsMap[t.column_id]?.toLowerCase() === 'concluído').length / subtasks.length) * 100 : 0}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs text-blue-500 font-bold">
                                                        {subtasks.filter(t => t.column_id && columnsMap[t.column_id]?.toLowerCase() === 'concluído').length}/{subtasks.length}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden shadow-2xl">
                                        {/* Tabela Header - ClickUp Style Minimal */}
                                        <div className="grid grid-cols-[1fr_140px_140px_180px_60px] gap-6 px-6 py-4 text-xs font-bold text-gray-500 bg-white/[0.03] border-b border-white/10 uppercase tracking-wider">
                                            <div className="pl-10">Nome</div>
                                            <div className="text-left">Responsavel</div>
                                            <div className="text-left">Prioridade</div>
                                            <div className="text-left">Data de vencimento</div>
                                            <div></div>
                                        </div>

                                        {/* Lista - ClickUp Style */}
                                        <div className="divide-y divide-white/5 bg-transparent">
                                            <DndContext
                                                sensors={sensors}
                                                collisionDetection={closestCenter}
                                                onDragEnd={handleSubtaskDragEnd}
                                            >
                                                <SortableContext
                                                    items={subtasks.map(t => t.id)}
                                                    strategy={verticalListSortingStrategy}
                                                >
                                                    {subtasks.map(task => (
                                                        <SortableSubtaskItem key={task.id} task={task} isFullScreen={true} />
                                                    ))}
                                                </SortableContext>
                                            </DndContext>
                                        </div>

                                        {/* New Task Input Inline */}
                                        {userRole !== 'visualizador' && (
                                            <div className="flex items-center gap-4 px-6 py-4 text-gray-500 hover:text-gray-300 transition-colors cursor-text group hover:bg-white/[0.03]" onClick={() => document.getElementById('new-subtask-input-full')?.focus()}>
                                                <div className="w-6 flex justify-center opacity-0"><div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div></div>
                                                <input
                                                    id="new-subtask-input-full"
                                                    className="bg-transparent text-sm focus:outline-none w-full placeholder:text-gray-600 text-gray-300 h-8 font-medium"
                                                    placeholder="Adicionar nova subtarefa..."
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleCreateSubtask(e.currentTarget.value);
                                                            e.currentTarget.value = '';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : showChecklistOnly ? (
                                <div className="max-w-[1200px] mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex flex-col gap-6">
                                        <button
                                            onClick={() => setShowChecklistOnly(false)}
                                            className="w-fit flex items-center gap-2 text-gray-500 hover:text-primary transition-colors text-sm font-medium group"
                                        >
                                            <div className="p-1 rounded bg-white/5 group-hover:bg-primary/10 transition-colors">
                                                <ChevronUp size={14} className="-rotate-90" />
                                            </div>
                                            Voltar Ã  tarefa
                                        </button>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <h2 className="text-3xl font-bold text-white tracking-tight">Checklists</h2>
                                                <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                                    <div className="h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                                            style={{ width: `${checklist.length > 0 ? (checklist.filter(i => i.is_completed).length / checklist.length) * 100 : 0}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs text-emerald-500 font-bold">
                                                        {checklist.filter(i => i.is_completed).length}/{checklist.length}
                                                    </span>
                                                </div>
                                            </div>
                                            <button onClick={handleAddChecklistGroup} className="bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-primary/20">
                                                <Plus size={16} />
                                                Novo Checklist
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6">
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={handleChecklistDragEnd}
                                        >
                                            <SortableContext
                                                items={checklistGroups.map(g => g.id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                {checklistGroups.map(group => (
                                                    <SortableChecklistGroup
                                                        key={group.id}
                                                        group={group}
                                                        checklist={checklist}
                                                        onAddItem={(groupId) => document.getElementById(`new-checklist-input-full-${groupId}`)?.focus()}
                                                        isFullScreen={true}
                                                        userRole={userRole}
                                                        handleUpdateChecklistGroup={handleUpdateChecklistGroup}
                                                        handleDeleteChecklistGroup={handleDeleteChecklistGroup}
                                                        newChecklistItems={newChecklistItems}
                                                        setNewChecklistItems={setNewChecklistItems}
                                                        handleAddChecklistItem={handleAddChecklistItem}
                                                        handleToggleChecklist={handleToggleChecklist}
                                                        handleDeleteChecklist={handleDeleteChecklist}
                                                    />
                                                ))}
                                            </SortableContext>
                                        </DndContext>
                                    </div>
                                </div>
                            ) : showDescriptionOnly ? (
                                <div className="max-w-[1200px] mx-auto w-full h-fit space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex flex-col gap-6 shrink-0">
                                        <button
                                            onClick={() => setShowDescriptionOnly(false)}
                                            className="w-fit flex items-center gap-2 text-gray-500 hover:text-primary transition-colors text-sm font-medium group"
                                        >
                                            <div className="p-1 rounded bg-white/5 group-hover:bg-primary/10 transition-colors">
                                                <ChevronUp size={14} className="-rotate-90" />
                                            </div>
                                            Voltar \u00E0 tarefa
                                        </button>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <h2 className="text-3xl font-bold text-white tracking-tight">Descri\u00E7\u00E3o</h2>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full border border-white/10 rounded-xl p-8">
                                        <textarea
                                            ref={descriptionRef}
                                            className="w-full bg-transparent text-gray-200 resize-none focus:outline-none placeholder:text-gray-600/50 leading-relaxed text-lg font-light p-0 transition-all"
                                            placeholder="Escreva algo brilhante aqui..."
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            autoFocus
                                            style={{ height: 'auto', minHeight: '200px' }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Cabe\u00E7alho (Agora parte do fluxo) */}
                                    <div className="pr-32"> {/* Padding right para nao sobrepor bot\u00F5es */}
                                        {/* Breadcrumbs / ID */}
                                        <div className="flex items-center gap-3 mb-3">
                                            {parentId && onOpenCard && (
                                                <button
                                                    onClick={() => onOpenCard(parentId)}
                                                    className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-[10px] font-bold tracking-wider"
                                                    title="Voltar para a Task Pai"
                                                >
                                                    <ChevronUp size={12} className="-rotate-90" strokeWidth={3} />
                                                    Task Pai
                                                </button>
                                            )}
                                            <span className="text-[10px] bg-white/[0.05] border border-white/5 text-gray-400 px-2 py-0.5 rounded-full font-mono tracking-wider">
                                                {isNew ? 'NOVA TAREFA' : `TASK-${cardId.slice(0, 6)}`}
                                            </span>
                                            {/* Status/Coluna Badge */}
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${currentColumnId || columnId ? 'bg-blue-500' : 'bg-gray-500'}`} />
                                                <span className="text-[13px] text-[#6e6e6e] tracking-wide font-medium">
                                                    {columnsMap[currentColumnId || columnId || ''] || 'Sem Status'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Titulo Grande */}
                                        <input
                                            className="text-4xl font-bold text-white bg-transparent border-none focus:outline-none w-full placeholder:text-gray-600/50 leading-tight tracking-tight"
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder="Título da Tarefa"
                                            disabled={userRole === 'visualizador'}
                                        />
                                    </div>

                                    {/* 1. Propriedades (Lista Estilo ClickUp) */}
                                    <div className="grid grid-cols-2 gap-x-12 gap-y-1">

                                        {/* === COLUNA ESQUERDA === */}
                                        <div className="space-y-4">

                                            {/* 1. Status */}
                                            <div className="flex items-center justify-between group h-8">
                                                <div
                                                    className="flex items-center gap-2 text-[#EEEEEE] min-w-[140px] cursor-pointer"
                                                    onClick={() => userRole !== 'visualizador' && setShowStatusSelect(!showStatusSelect)}
                                                >
                                                    <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                        <IconTarget size={16} stroke={2} color="#6e6e6e" />
                                                    </div>
                                                    <span className="text-sm font-medium text-[#EEEEEE] group-hover:text-white transition-colors">Status</span>
                                                </div>

                                                <div className="relative flex-1 flex justify-start">
                                                    <button
                                                        onClick={() => userRole !== 'visualizador' && setShowStatusSelect(!showStatusSelect)}
                                                        className="flex items-center"
                                                    >
                                                        <div
                                                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium tracking-wide text-white transition-all hover:opacity-90 shadow-sm"
                                                            style={{ backgroundColor: columns.find(c => c.id === currentColumnId)?.color || '#3b82f6' }}
                                                        >
                                                            <span className="truncate max-w-[100px]">{columnsMap[currentColumnId] || 'PENDENTE'}</span>
                                                            <ChevronDown size={10} strokeWidth={3} />
                                                        </div>
                                                        <div className="w-6 h-6 flex items-center justify-center ml-1 rounded hover:bg-white/10 text-gray-500 hover:text-green-500 transition-colors cursor-pointer">
                                                            <CheckSquare size={14} />
                                                        </div>
                                                    </button>

                                                    {/* Popover Status */}
                                                    {showStatusSelect && (
                                                        <div className="absolute top-full left-0 mt-1 w-48 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 py-1">
                                                            {columns.map(col => (
                                                                <button
                                                                    key={col.id}
                                                                    onClick={() => {
                                                                        setCurrentColumnId(col.id);
                                                                        setShowStatusSelect(false);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-left"
                                                                >
                                                                    <div className={`w-2 h-2 rounded-full ${col.color || 'bg-gray-500'}`} />
                                                                    <span className="text-gray-300">{col.title}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 2. Datas */}
                                            <div className="flex items-center justify-between group h-8">
                                                <div
                                                    className="flex items-center gap-2 text-[#EEEEEE] min-w-[140px] cursor-pointer"
                                                    onClick={() => userRole !== 'visualizador' && dueDatePickerRef.current?.showPicker()}
                                                >
                                                    <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                        <IconCalendar size={16} stroke={1.5} color="#6e6e6e" />
                                                    </div>
                                                    <span className="text-sm font-medium text-[#EEEEEE] group-hover:text-white transition-colors">Datas</span>
                                                </div>

                                                <div className="relative flex-1 flex items-center gap-2 justify-start">
                                                    {/* Data Inicio */}
                                                    <div className="relative flex items-center gap-1 hover:bg-white/5 px-1.5 py-1 rounded cursor-pointer transition-colors group/start">
                                                        <span className={`text-sm ${startDate ? 'text-gray-300' : 'text-[#6e6e6e]'}`}>
                                                            {startDate ? new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR').slice(0, 5) : 'Início'}
                                                        </span>
                                                        <input
                                                            ref={startDatePickerRef}
                                                            type="date"
                                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                                            value={startDate}
                                                            onChange={(e) => setStartDate(e.target.value)}
                                                            disabled={userRole === 'visualizador'}
                                                            onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
                                                        />
                                                    </div>

                                                    <span className="text-gray-700">{'\u2192'}</span>

                                                    {/* Data Prevista */}
                                                    <div className="relative flex items-center gap-1 hover:bg-white/5 px-1.5 py-1 rounded cursor-pointer transition-colors group/due">
                                                        <span className={`text-sm ${dueDate ? 'text-gray-300' : 'text-[#6e6e6e]'}`}>
                                                            {dueDate ? new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR').slice(0, 5) : 'Prevista'}
                                                        </span>
                                                        <input
                                                            ref={dueDatePickerRef}
                                                            type="date"
                                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                                            value={dueDate}
                                                            onChange={(e) => {
                                                                setDueDate(e.target.value);
                                                                if (e.target.value) setShowOnCalendar(true);
                                                            }}
                                                            disabled={userRole === 'visualizador'}
                                                            onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
                                                        />
                                                    </div>

                                                    {/* Botao limpar (so aparece se tiver datas) */}
                                                    {(startDate || dueDate) && (
                                                        <button
                                                            className="ml-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDueDate('');
                                                                setStartDate('');
                                                                setShowOnCalendar(false);
                                                            }}
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 3. Data da entrega */}
                                            <div className="flex items-center justify-between group h-8">
                                                <div
                                                    className="flex items-center gap-2 text-[#EEEEEE] min-w-[140px] cursor-pointer"
                                                    onClick={() => userRole !== 'visualizador' && deliveryDatePickerRef.current?.showPicker()}
                                                >
                                                    <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                        <IconCalendar size={16} stroke={1.5} color="#6e6e6e" />
                                                    </div>
                                                    <span className="text-sm font-medium text-[#EEEEEE] group-hover:text-white transition-colors">Data da entrega</span>
                                                </div>

                                                <div className="relative flex-1 flex justify-start">
                                                    <div className="relative flex items-center gap-1 hover:bg-white/5 px-1.5 py-1 rounded cursor-pointer transition-colors group/delivery">
                                                        <span className={`text-sm ${deliveryDate ? 'text-gray-300' : 'text-[#6e6e6e]'}`}>
                                                            {deliveryDate ? new Date(deliveryDate + 'T12:00:00').toLocaleDateString('pt-BR').slice(0, 5) : 'Vazio'}
                                                        </span>
                                                        <input
                                                            ref={deliveryDatePickerRef}
                                                            type="date"
                                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                                            value={deliveryDate}
                                                            onChange={(e) => setDeliveryDate(e.target.value)}
                                                            disabled={userRole === 'visualizador'}
                                                            onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
                                                        />
                                                        {deliveryDate && (
                                                            <button
                                                                className="ml-1 text-gray-600 hover:text-red-400 opacity-0 group-hover/delivery:opacity-100 transition-opacity z-20"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDeliveryDate('');
                                                                }}
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 4. Etiquetas */}
                                            <div className="flex items-center justify-between group h-8">
                                                <div
                                                    className="flex items-center gap-2 text-[#EEEEEE] min-w-[140px] cursor-pointer"
                                                    onClick={() => userRole !== 'visualizador' && setShowTagInput(!showTagInput)}
                                                >
                                                    <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                        <IconTag size={16} stroke={1.5} color="#6e6e6e" />
                                                    </div>
                                                    <span className="text-sm font-medium text-[#EEEEEE] group-hover:text-white transition-colors">Etiquetas</span>
                                                </div>

                                                <div className="relative flex-1 flex justify-start">
                                                    {tags.length > 0 && selectedTags.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1 items-center">
                                                            {tags.filter(t => selectedTags.includes(t.id)).map(tag => (
                                                                <button
                                                                    key={tag.id}
                                                                    onClick={() => toggleTag(tag.id)}
                                                                    className="px-2 py-0.5 rounded text-[10px] font-bold text-white hover:opacity-80 transition-opacity"
                                                                    style={{ backgroundColor: tag.color }}
                                                                >
                                                                    {tag.name}
                                                                </button>
                                                            ))}
                                                            <button
                                                                onClick={() => setShowTagInput(!showTagInput)}
                                                                className="w-5 h-5 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors ml-1"
                                                            >
                                                                <Plus size={10} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setShowTagInput(!showTagInput)}
                                                            className="text-sm text-[#6e6e6e] hover:text-gray-400 cursor-pointer transition-colors"
                                                        >
                                                            Vazio
                                                        </button>
                                                    )}

                                                    {/* Popover Tags */}
                                                    {showTagInput && (
                                                        <div className="absolute top-full left-0 mt-2 bg-[#1a1a2e] border border-white/10 rounded-xl p-3 shadow-xl z-50 w-64 animate-in fade-in zoom-in-95 duration-200">
                                                            <div className="flex flex-col gap-3">
                                                                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                                                    {tags.map(tag => (
                                                                        <button
                                                                            key={tag.id}
                                                                            onClick={() => toggleTag(tag.id)}
                                                                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors group ${selectedTags.includes(tag.id) ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                                                        >
                                                                            <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: tag.color }} />
                                                                            <span className={`flex-1 text-left truncate ${selectedTags.includes(tag.id) ? 'text-white' : 'text-gray-400'}`}>{tag.name}</span>
                                                                            {selectedTags.includes(tag.id) && <CheckSquare size={12} className="text-primary shrink-0" />}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                <div className="h-px bg-white/10 w-full" />
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        value={newTagName}
                                                                        onChange={e => setNewTagName(e.target.value)}
                                                                        placeholder="Nova etiqueta..."
                                                                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-primary/50 outline-none w-full"
                                                                        onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                                                                    />
                                                                    <div className="relative w-6 h-6 rounded overflow-hidden border border-white/10 shrink-0">
                                                                        <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} className="absolute -top-2 -left-2 w-[150%] h-[150%] p-0 cursor-pointer border-none" />
                                                                    </div>
                                                                    <button onClick={handleCreateTag} className="bg-primary text-white p-1.5 rounded-lg"><Plus size={12} /></button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                        </div>

                                        {/* === COLUNA DIREITA === */}
                                        <div className="space-y-4">

                                            {/* 1. Responsaveis */}
                                            <div className="flex items-center justify-between group h-8">
                                                <div
                                                    className="flex items-center gap-2 text-[#EEEEEE] min-w-[140px] cursor-pointer"
                                                    onClick={() => userRole !== 'visualizador' && setShowMemberSelect(!showMemberSelect)}
                                                >
                                                    <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                        <IconUser size={16} stroke={1.5} color="#6e6e6e" />
                                                    </div>
                                                    <span className="text-sm font-medium text-[#EEEEEE] group-hover:text-white transition-colors">Responsáveis</span>
                                                </div>

                                                <div className="relative flex-1 flex justify-start">
                                                    <button
                                                        onClick={() => userRole !== 'visualizador' && setShowMemberSelect(!showMemberSelect)}
                                                        className="flex items-center"
                                                    >
                                                        {assignedTo ? (
                                                            <div className="flex items-center gap-2 group/assigned">
                                                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 border border-primary/30 overflow-hidden">
                                                                    {members.find(m => m.id === assignedTo)?.avatar_url ? (
                                                                        <img src={members.find(m => m.id === assignedTo).avatar_url} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        members.find(m => m.id === assignedTo)?.name.charAt(0) || 'U'
                                                                    )}
                                                                </div>
                                                                <span className="text-sm text-gray-300 group-hover/assigned:text-white transition-colors truncate max-w-[120px]">
                                                                    {members.find(m => m.id === assignedTo)?.name}
                                                                </span>
                                                                <X
                                                                    size={12}
                                                                    className="text-gray-500 hover:text-red-400 opacity-0 group-hover/assigned:opacity-100 transition-opacity ml-1"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAssignedTo('');
                                                                    }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm text-[#6e6e6e] hover:text-gray-400 transition-colors">Vazio</span>
                                                        )}
                                                    </button>

                                                    {/* Popover Membros */}
                                                    {showMemberSelect && (
                                                        <div className="absolute top-full left-0 mt-2 w-64 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                            <div className="p-2 border-b border-white/5">
                                                                <input
                                                                    autoFocus
                                                                    placeholder="Buscar membro..."
                                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-primary/50 outline-none"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                            <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                                                                {members.map(m => (
                                                                    <button
                                                                        key={m.id}
                                                                        onClick={() => {
                                                                            setAssignedTo(m.id);
                                                                            setShowMemberSelect(false);
                                                                        }}
                                                                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left ${assignedTo === m.id ? 'bg-primary/10 text-primary' : ''}`}
                                                                    >
                                                                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                                                                            {m.avatar_url ? (
                                                                                <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                m.name.charAt(0)
                                                                            )}
                                                                        </div>
                                                                        <span className="truncate">{m.name}</span>
                                                                        {assignedTo === m.id && <CheckSquare size={12} className="ml-auto text-primary" />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 2. Prioridade */}
                                            <div className="flex items-center justify-between group h-8">
                                                <div
                                                    className="flex items-center gap-2 text-[#EEEEEE] min-w-[140px] cursor-pointer"
                                                    onClick={() => userRole !== 'visualizador' && setShowPrioritySelect(!showPrioritySelect)}
                                                >
                                                    <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                        <IconFlag size={16} stroke={1.5} color="#6e6e6e" />
                                                    </div>
                                                    <span className="text-sm font-medium text-[#EEEEEE] group-hover:text-white transition-colors">Prioridade</span>
                                                </div>

                                                <div className="relative flex-1 flex justify-start">
                                                    <button
                                                        onClick={() => userRole !== 'visualizador' && setShowPrioritySelect(!showPrioritySelect)}
                                                        className="flex items-center"
                                                    >
                                                        {priority ? (
                                                            <div className="flex items-center gap-2">
                                                                <IconFlag
                                                                    size={14}
                                                                    fill="currentColor"
                                                                    className={`${priority === 'urgent' ? 'text-red-500' : priority === 'high' ? 'text-orange-500' : priority === 'medium' ? 'text-blue-500' : 'text-gray-500'}`}
                                                                />
                                                                <span className="text-sm text-gray-300 capitalize">
                                                                    {priority === 'urgent' ? 'Urgente' : priority === 'high' ? 'Alta' : priority === 'medium' ? 'Media' : 'Baixa'}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm text-[#6e6e6e] hover:text-gray-400 transition-colors">Vazio</span>
                                                        )}
                                                    </button>

                                                    {/* Popover Prioridade */}
                                                    {showPrioritySelect && (
                                                        <div className="absolute top-full left-0 mt-2 w-40 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-1">
                                                            {[
                                                                { value: 'urgent', label: 'Urgente', text: 'text-red-500' },
                                                                { value: 'high', label: 'Alta', text: 'text-orange-500' },
                                                                { value: 'medium', label: 'Media', text: 'text-blue-500' },
                                                                { value: 'low', label: 'Baixa', text: 'text-gray-500' }
                                                            ].map(p => (
                                                                <button
                                                                    key={p.value}
                                                                    onClick={() => {
                                                                        setPriority(p.value as any);
                                                                        setShowPrioritySelect(false);
                                                                    }}
                                                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors text-left ${priority === p.value ? 'bg-white/5' : ''}`}
                                                                >
                                                                    <IconFlag size={14} className={p.text} fill="currentColor" />
                                                                    <span className="text-gray-300">{p.label}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 3. Tempo Rastreado (Visual) */}
                                            <div className="flex items-center justify-between group h-8">
                                                <div
                                                    className="flex items-center gap-2 text-[#EEEEEE] min-w-[140px] cursor-pointer"
                                                    onClick={() => setShowTimePopover(!showTimePopover)}
                                                >
                                                    <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                        <IconPlayerPlay size={16} stroke={1.5} color="#6e6e6e" />
                                                    </div>
                                                    <span className="text-sm font-medium text-[#EEEEEE] group-hover:text-white transition-colors">Tempo rastreado</span>
                                                </div>
                                                <div className="flex-1 flex justify-start">
                                                    <button
                                                        onClick={() => setShowTimePopover(!showTimePopover)}
                                                        className={`flex items-center gap-2 transition-colors px-2 py-0.5 rounded-full ${isRunning ? 'bg-primary/20 text-primary border border-primary/30 animate-pulse' : 'text-gray-500 hover:text-white bg-white/5 hover:bg-white/10'}`}
                                                    >
                                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${isRunning ? 'bg-primary text-white' : 'bg-white/10'}`}>
                                                            {isRunning ? (
                                                                <div className="w-1.5 h-1.5 bg-white rounded-sm" />
                                                            ) : (
                                                                <div className="w-0 h-0 border-t-[3px] border-t-transparent border-l-[5px] border-l-white border-b-[3px] border-b-transparent ml-0.5"></div>
                                                            )}
                                                        </div>
                                                        <span className="text-xs font-bold">
                                                            {isRunning ? timerDisplay : totalMinutes > 0 ? formatDuration(totalMinutes) : <span className="text-[#6e6e6e]">Adicionar hora</span>}
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* 4. Cliente (Relacionamentos) */}
                                            <div className="flex items-center justify-between group h-8">
                                                <div
                                                    className="flex items-center gap-2 text-[#EEEEEE] min-w-[140px] cursor-pointer"
                                                    onClick={() => userRole !== 'visualizador' && setShowClientSelect(!showClientSelect)}
                                                >
                                                    <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                        <IconBriefcase size={16} stroke={1.5} color="#6e6e6e" />
                                                    </div>
                                                    <span className="text-sm font-medium text-[#EEEEEE] group-hover:text-white transition-colors">Cliente</span>
                                                </div>

                                                <div className="relative flex-1 flex justify-start">
                                                    <button
                                                        onClick={() => userRole !== 'visualizador' && setShowClientSelect(!showClientSelect)}
                                                        className="flex items-center"
                                                    >
                                                        {clientId ? (
                                                            <div className="flex items-center gap-2 group/client">
                                                                <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400 shrink-0">
                                                                    {clients.find(c => c.id === clientId)?.name.charAt(0) || 'C'}
                                                                </div>
                                                                <span className="text-sm text-gray-300 group-hover/client:text-white transition-colors truncate max-w-[120px]">
                                                                    {clients.find(c => c.id === clientId)?.name}
                                                                </span>
                                                                <X
                                                                    size={12}
                                                                    className="text-gray-500 hover:text-red-400 opacity-0 group-hover/client:opacity-100 transition-opacity ml-1"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setClientId('');
                                                                    }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm text-[#6e6e6e] hover:text-gray-400 transition-colors">Vazio</span>
                                                        )}
                                                    </button>

                                                    {/* Popover Clientes */}
                                                    {showClientSelect && (
                                                        <div className="absolute top-full left-0 mt-2 w-64 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                            <div className="p-2 border-b border-white/5">
                                                                <input
                                                                    autoFocus
                                                                    placeholder="Buscar cliente..."
                                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-primary/50 outline-none"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                            <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                                                                {clients.map(c => (
                                                                    <button
                                                                        key={c.id}
                                                                        onClick={() => {
                                                                            setClientId(c.id);
                                                                            setShowClientSelect(false);
                                                                        }}
                                                                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left ${clientId === c.id ? 'bg-primary/10 text-primary' : ''}`}
                                                                    >
                                                                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
                                                                            {c.name.charAt(0)}
                                                                        </div>
                                                                        <span className="truncate">{c.name}</span>
                                                                        {clientId === c.id && <CheckSquare size={12} className="ml-auto text-primary" />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                        </div>

                                    </div>

                                    <div className="h-px bg-white/5 w-full" />

                                    {/* Bloco de Aprovação (apenas em subtarefas com aprovação ativa) */}
                                    {parentId && approvalNeeded && (
                                        <div className="space-y-3">
                                            {/* Header */}
                                            <div className="flex items-center gap-2">
                                                <Lock size={15} className={approvalStatus === 'approved' ? 'text-emerald-400' : approvalStatus === 'awaiting_adjustment' ? 'text-red-400' : 'text-amber-400'} />
                                                <h3 className="text-base font-semibold tracking-tight text-[#EEEEEE]">Aprovação</h3>
                                                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                    approvalStatus === 'approved'
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        : approvalStatus === 'awaiting_adjustment'
                                                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                }`}>
                                                    {approvalStatus === 'approved' ? 'APROVADO' : approvalStatus === 'awaiting_adjustment' ? 'AGUARDANDO AJUSTE' : 'AGUARDANDO APROVAÇÃO'}
                                                </span>
                                            </div>

                                            {/* Aprovador */}
                                            {approvalApproverId && (
                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                    <span>Aprovador:</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary overflow-hidden">
                                                            {members.find(m => m.id === approvalApproverId)?.avatar_url
                                                                ? <img src={members.find(m => m.id === approvalApproverId)!.avatar_url} className="w-full h-full object-cover" />
                                                                : (members.find(m => m.id === approvalApproverId)?.name?.charAt(0) || '?')}
                                                        </div>
                                                        <span className="text-gray-300 font-medium">{members.find(m => m.id === approvalApproverId)?.name || 'Desconhecido'}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Histórico — visível para todos */}
                                            {approvalHistory.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Histórico</p>
                                                    <div className="space-y-3 border-l-2 border-white/5 pl-3">
                                                        {approvalHistory.map((entry, idx) => {
                                                            const actor = members.find(m => m.id === entry.actor_id);
                                                            const actorName = actor?.name || 'Usuário';
                                                            const actorAvatar = actor?.avatar_url;
                                                            return (
                                                            <div key={entry.id || idx} className="relative">
                                                                <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-[#050510] border-2" style={{
                                                                    borderColor: entry.action === 'approved' ? '#34d399' : entry.action === 'rejected' ? '#f87171' : entry.action === 'resubmitted' ? '#60a5fa' : '#a78bfa'
                                                                }} />
                                                                <div className="flex items-start gap-2">
                                                                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary overflow-hidden shrink-0">
                                                                        {actorAvatar
                                                                            ? <img src={actorAvatar} alt={actorName} className="w-full h-full object-cover" />
                                                                            : actorName.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0 space-y-1">
                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            <span className="text-xs text-gray-200 font-semibold">{actorName}</span>
                                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                                                                entry.action === 'approved' ? 'bg-emerald-500/15 text-emerald-400'
                                                                                : entry.action === 'rejected' ? 'bg-red-500/15 text-red-400'
                                                                                : entry.action === 'resubmitted' ? 'bg-blue-500/15 text-blue-400'
                                                                                : 'bg-purple-500/15 text-purple-400'
                                                                            }`}>
                                                                                {entry.action === 'approved' ? 'APROVOU' : entry.action === 'rejected' ? 'REPROVADO' : entry.action === 'resubmitted' ? 'REENVIADO PARA APROVAÇÃO' : 'SOLICITOU APROVAÇÃO'}
                                                                            </span>
                                                                            <span className="text-[9px] text-gray-600 ml-auto whitespace-nowrap">{new Date(entry.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                                                        </div>
                                                                        {entry.note && (
                                                                            <div className="flex items-start gap-1.5 bg-red-500/5 border border-red-500/10 rounded-lg px-2.5 py-2">
                                                                                <Lock size={10} className="text-red-400 mt-0.5 shrink-0" />
                                                                                <p className="text-[11px] text-red-200/80 leading-relaxed">{entry.note}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Ações do aprovador: visível só para o aprovador quando status é pending */}
                                            {currentUserId === approvalApproverId && approvalStatus === 'pending' && (
                                                <div className="space-y-2">
                                                    {!showRejectForm ? (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={handleApproveSubtask}
                                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl transition-colors"
                                                            >
                                                                <CheckSquare size={14} />Aprovar
                                                            </button>
                                                            <button
                                                                onClick={() => setShowRejectForm(true)}
                                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-colors"
                                                            >
                                                                <Lock size={14} />Reprovar
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2 p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                                                            <p className="text-xs text-red-400 font-semibold">Justificativa / Solicitação de ajuste *</p>
                                                            <textarea
                                                                value={rejectReason}
                                                                onChange={(e) => setRejectReason(e.target.value)}
                                                                placeholder="Descreva o que precisa ser ajustado..."
                                                                rows={3}
                                                                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-red-500/30 outline-none resize-none"
                                                            />
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={handleRejectSubtask}
                                                                    className="flex-1 px-3 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-colors"
                                                                >
                                                                    Devolver para Ajuste
                                                                </button>
                                                                <button
                                                                    onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                                                                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 text-xs rounded-xl transition-colors"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Botão de reenvio: visível para todos quando aguardando ajuste (exceto se já estiver como aprovador mostrando os botões de aprovar/reprovar) */}
                                            {approvalStatus === 'awaiting_adjustment' && (
                                                <button
                                                    onClick={handleResubmitSubtask}
                                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-xs font-bold rounded-xl transition-colors"
                                                >
                                                    <Send size={13} />Reenviar para Aprovação
                                                </button>
                                            )}

                                            <div className="h-px bg-white/5 w-full" />
                                        </div>
                                    )}

                                    {/* 2. Descricao */}
                                    <div className="space-y-3 group">
                                        {(!description && !isEditingDescription) ? (
                                            <button
                                                onClick={() => setIsEditingDescription(true)}
                                                className="flex items-center gap-2 px-3 py-2 -ml-3 rounded-xl hover:bg-white/5 transition-all group/btn"
                                            >
                                                <span className="text-base font-semibold tracking-tight text-[#EEEEEE] group-hover:text-white transition-colors">Adicionar descrição</span>
                                            </button>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-between text-white pr-2">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-base font-semibold tracking-tight text-[#EEEEEE]">Descrição</h3>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {description && (
                                                            <button
                                                                onClick={() => setShowDescriptionOnly(true)}
                                                                className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                                                title="Ver em tela cheia"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrows-diagonal-minimize-2"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M18 10h-4v-4" /><path d="M20 4l-6 6" /><path d="M6 14h4v4" /><path d="M10 14l-6 6" /></svg>
                                                            </button>
                                                        )}
                                                        {description && (
                                                            <button
                                                                onClick={() => setIsExpandedDescription(!isExpandedDescription)}
                                                                className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center justify-center"
                                                                title={isExpandedDescription ? "Recolher" : "Expandir"}
                                                            >
                                                                {isExpandedDescription ? (
                                                                    <ChevronUp size={14} />
                                                                ) : (
                                                                    <ChevronDown size={14} />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className={`relative transition-all duration-300 overflow-hidden ${!isExpandedDescription ? 'max-h-[100px] mb-2' : 'max-h-none'} border border-white/10 rounded-xl p-4`}>
                                                    <textarea
                                                        ref={descriptionRef}
                                                        className="w-full bg-transparent text-gray-300 resize-none overflow-hidden focus:outline-none placeholder:text-gray-600/50 leading-relaxed text-sm font-light border-none p-0 transition-all"
                                                        placeholder="Escreva, pressione a barra de espaco para usar a IA ou '/' para usar comandos"
                                                        value={description}
                                                        onChange={(e) => setDescription(e.target.value)}
                                                        onBlur={() => !description && setIsEditingDescription(false)}
                                                        autoFocus={isEditingDescription && !description}
                                                    />
                                                    {!isExpandedDescription && description.length > 50 && (
                                                        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#0a0a1a] to-transparent pointer-events-none" />
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* 3. Subtarefas (Estilo ClickUp) */}
                                    {!parentId && (
                                        <div className="space-y-2">
                                            {/* Cabecalho e Filtros */}
                                            <div className="flex items-center justify-between pb-2 mb-2">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2 text-white">
                                                        <h3 className="text-base font-semibold tracking-tight text-[#EEEEEE]">Subtarefas</h3>
                                                    </div>

                                                    {/* Barra de Progresso Subtarefas (Igual Checklist) */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                                                style={{ width: `${subtasks.length > 0 ? (subtasks.filter(t => t.column_id && columnsMap[t.column_id]?.toLowerCase() === 'concluido').length / subtasks.length) * 100 : 0}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-xs text-blue-500 font-medium">
                                                            {subtasks.filter(t => t.column_id && columnsMap[t.column_id]?.toLowerCase() === 'concluido').length}/{subtasks.length}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setShowSubtasksOnly(true)}
                                                        className="text-xs font-medium text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5"
                                                        title="Ver em tela cheia"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrows-diagonal-minimize-2"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M18 10h-4v-4" /><path d="M20 4l-6 6" /><path d="M6 14h4v4" /><path d="M10 14l-6 6" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={() => setIsSubtasksCollapsed(!isSubtasksCollapsed)}
                                                        className="text-xs font-medium text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5"
                                                    >
                                                        {isSubtasksCollapsed ? (
                                                            <ChevronDown size={14} />
                                                        ) : (
                                                            <ChevronUp size={14} />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="rounded-xl border border-white/5">
                                                {/* Tabela Header - ClickUp Style Minimal */}
                                                <div className="grid grid-cols-[1fr_100px_100px_140px_40px] gap-4 px-4 py-2 text-[11px] font-medium text-gray-500 bg-[#0a0a1a]/40 border-b border-white/5 rounded-t-xl">
                                                    <div className="pl-8">Nome</div> {/* pl-8 para alinhar com o texto da task, pulando o icone de status */}
                                                    <div className="text-left">Responsavel</div>
                                                    <div className="text-left">Prioridade</div>
                                                    <div className="text-left">Data de vencimento</div>
                                                    <div></div>
                                                </div>

                                                {/* Lista - ClickUp Style */}
                                                <div className={`divide-y divide-white/5 ${isSubtasksCollapsed ? 'max-h-0 overflow-hidden text-transparent opacity-0 duration-300 transition-all' : 'overflow-visible'}`}>
                                                    <DndContext
                                                        sensors={sensors}
                                                        collisionDetection={closestCenter}
                                                        onDragEnd={handleSubtaskDragEnd}
                                                    >
                                                        <SortableContext
                                                            items={subtasks.map(t => t.id)}
                                                            strategy={verticalListSortingStrategy}
                                                        >
                                                            {subtasks.map(task => (
                                                                <SortableSubtaskItem key={task.id} task={task} isFullScreen={false} />
                                                            ))}
                                                        </SortableContext>
                                                    </DndContext>

                                                    {/* New Task Input Inline - ClickUp Style */}
                                                    {userRole !== 'visualizador' && (
                                                        <div className="flex items-center gap-3 px-4 py-2 text-gray-500 hover:text-gray-300 transition-colors cursor-text group hover:bg-white/[0.02] rounded-b-xl" onClick={() => document.getElementById('new-subtask-input')?.focus()}>
                                                            <div className="w-4 flex justify-center opacity-0"><div className="w-1 h-1 rounded-full bg-gray-600"></div></div> {/* Spacer */}
                                                            <Plus size={14} className="text-gray-600 group-hover:text-primary transition-colors shrink-0" />
                                                            <input
                                                                id="new-subtask-input"
                                                                className="bg-transparent text-sm focus:outline-none w-full placeholder:text-gray-600 text-gray-300 h-6"
                                                                placeholder="Adicionar nova subtarefa..."
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        handleCreateSubtask(e.currentTarget.value);
                                                                        e.currentTarget.value = '';
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 4. Checklists (ClickUp Style) */}
                                    <div className="space-y-4">
                                        {/* Header Geral da Secao */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <h3 className="text-base font-semibold tracking-tight text-[#EEEEEE]">Checklists</h3>
                                                {/* Barra de Progresso Global (Pill Style) */}
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                                            style={{ width: `${checklist.length > 0 ? (checklist.filter(i => i.is_completed).length / checklist.length) * 100 : 0}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs text-emerald-500 font-medium">
                                                        {checklist.filter(i => i.is_completed).length}/{checklist.length}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setShowChecklistOnly(true)}
                                                    className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                                    title="Ver em tela cheia"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrows-diagonal-minimize-2"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M18 10h-4v-4" /><path d="M20 4l-6 6" /><path d="M6 14h4v4" /><path d="M10 14l-6 6" /></svg>
                                                </button>
                                                <button
                                                    onClick={() => setIsChecklistCollapsed(!isChecklistCollapsed)}
                                                    className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center justify-center"
                                                    title={isChecklistCollapsed ? "Expandir" : "Recolher"}
                                                >
                                                    {isChecklistCollapsed ? (
                                                        <ChevronDown size={14} />
                                                    ) : (
                                                        <ChevronUp size={14} />
                                                    )}
                                                </button>
                                                <button onClick={handleAddChecklistGroup} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Adicionar grupo">
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className={`space-y-4 transition-all duration-300 ${isChecklistCollapsed ? 'max-h-0 overflow-hidden opacity-0 text-transparent' : 'max-h-[2000px] opacity-100 overflow-visible'}`}>
                                            <DndContext
                                                sensors={sensors}
                                                collisionDetection={closestCenter}
                                                onDragEnd={handleChecklistDragEnd}
                                            >
                                                <SortableContext
                                                    items={checklistGroups.map(g => g.id)}
                                                    strategy={verticalListSortingStrategy}
                                                >
                                                    {checklistGroups.map(group => (
                                                        <SortableChecklistGroup
                                                            key={group.id}
                                                            group={group}
                                                            checklist={checklist}
                                                            onAddItem={(groupId) => document.getElementById(`new-checklist-input-${groupId}`)?.focus()}
                                                            isFullScreen={false}
                                                            userRole={userRole}
                                                            handleUpdateChecklistGroup={handleUpdateChecklistGroup}
                                                            handleDeleteChecklistGroup={handleDeleteChecklistGroup}
                                                            newChecklistItems={newChecklistItems}
                                                            setNewChecklistItems={setNewChecklistItems}
                                                            handleAddChecklistItem={handleAddChecklistItem}
                                                            handleToggleChecklist={handleToggleChecklist}
                                                            handleDeleteChecklist={handleDeleteChecklist}
                                                        />
                                                    ))}
                                                </SortableContext>
                                            </DndContext>
                                        </div>
                                    </div>

                                    {/* 5. Anexos */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-semibold tracking-tight text-[#EEEEEE]">Anexos ({files.length})</h3>
                                            </div>
                                            <button onClick={handleAddFile} className="text-xs text-primary hover:text-white transition-colors">
                                                + Adicionar
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap gap-4">
                                            {files.map(file => {
                                                const fileExt = file.file_name.split('.').pop()?.toLowerCase() || '';
                                                const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(fileExt);
                                                const uploader = members.find(m => m.id === file.uploader_id);
                                                const uploaderName = uploader?.name || 'Sistema';

                                                let uploaderInitials = 'US';
                                                if (uploader) {
                                                    const parts = uploader.name.trim().split(' ');
                                                    uploaderInitials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
                                                }

                                                const formatAttachmentDate = (dateString: string) => {
                                                    const d = new Date(dateString);
                                                    const today = new Date();
                                                    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();

                                                    const yesterday = new Date(today);
                                                    yesterday.setDate(yesterday.getDate() - 1);
                                                    const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();

                                                    let timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();

                                                    if (isToday) return `Hoje Ã s ${timeStr}`;
                                                    if (isYesterday) return `Ontem Ã s ${timeStr}`;
                                                    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} Ã s ${timeStr}`;
                                                };

                                                return (
                                                    <div key={file.id} className="w-[206px] h-[180px] shrink-0 bg-[#0a0a1a] border border-white/5 rounded-xl flex flex-col hover:border-white/20 transition-colors group relative overflow-hidden">

                                                        {/* Botao flutuante de Excluir */}
                                                        <button onClick={() => handleDeleteFile(file.id, file.file_url, file.file_name)} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-gray-400 hover:text-white hover:bg-red-500/80 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0 z-20 shadow-md">
                                                            <Trash2 size={14} />
                                                        </button>

                                                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="flex-1 flex flex-col min-h-0 relative">
                                                            {/* Top Area - Preview */}
                                                            <div className="flex-1 flex items-center justify-center bg-[#050510] relative overflow-hidden min-h-0">
                                                                {isImage ? (
                                                                    <img src={file.file_url} alt={file.file_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                                ) : (
                                                                    <div className="text-primary/70 transform group-hover:scale-110 transition-transform duration-300 scale-[2]">
                                                                        {getFileIcon(file.file_name)}
                                                                    </div>
                                                                )}

                                                                {/* Fullscreen Overlay Button - Now for all files */}
                                                                <div
                                                                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setPreviewUrl(file.file_url);
                                                                        setPreviewName(file.file_name);
                                                                    }}
                                                                >
                                                                    <div className="p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white transform scale-90 group-hover:scale-100 transition-transform duration-300">
                                                                        <IconArrowsDiagonal size={20} stroke={2} />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Bottom Strip */}
                                                            <div className="h-16 shrink-0 bg-white/[0.02] border-t border-white/5 p-3 flex flex-row items-center justify-between relative z-10 w-full gap-2 text-left">
                                                                <div className="flex flex-col min-w-0 pr-1 flex-1">
                                                                    <p className="text-xs font-semibold text-white truncate" title={file.file_name}>{file.file_name}</p>
                                                                    <p className="text-[10px] text-gray-500 mt-1 truncate">{formatAttachmentDate(file.created_at)}</p>
                                                                </div>

                                                                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-gray-300 shrink-0 border border-white/5 overflow-hidden ring-2 ring-[#0a0a1a]" title={uploaderName}>
                                                                    {uploader?.avatar_url ? (
                                                                        <img src={uploader.avatar_url} alt={uploaderName} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        uploaderInitials
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </a>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ================= DIREITA: ATIVIDADE E CHAT (30%) ================= */}
                    <div className="w-[400px] flex flex-col bg-[#050510]/80 backdrop-blur-xl border-l border-white/5 z-20">
                        {/* Header Lateral */}
                        <div className="p-4 border-b border-white/5 flex items-center gap-2">
                            <MessageSquare size={16} className="text-primary" />
                            <h3 className="text-base font-semibold text-[#EEEEEE] tracking-tight">Comentários</h3>
                        </div>

                        {/* Feed Scrollavel */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#050510]/50 flex flex-col-reverse">
                            {comments.filter(c => !c.is_system_log).length === 0 ? (
                                <div className="text-center py-10 opacity-30">
                                    <MessageSquare size={32} className="mx-auto mb-2" />
                                    <p className="text-xs">Nenhum comentário registrado.</p>
                                </div>
                            ) : (
                                comments.filter(c => !c.is_system_log).map(comment => {
                                    const hasUser = !!comment.user_id;
                                    const userAvatar = comment.user?.avatar_url;
                                    const userInitial = (comment.user?.email?.[0] || comment.user?.full_name?.[0] || 'S').toUpperCase();
                                    const userName = comment.user_id ? (comment.user?.email || 'Usuario') : 'Sistema';

                                    return (
                                        <div key={comment.id} className="flex gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden border border-white/10 ${hasUser ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-400'}`}>
                                                {userAvatar ? (
                                                    <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                                                ) : (
                                                    hasUser ? userInitial : <Info size={14} />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-0.5">
                                                    <span className="text-xs font-bold text-gray-200">
                                                        {userName}
                                                    </span>
                                                    <span className="text-[9px] text-gray-600">{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className="text-xs text-gray-300 break-words leading-relaxed">
                                                    {comment.content}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Input Fixo no Rodape */}
                        <div className="p-4 border-t border-white/5 bg-[#0a0a1a]">
                            {/* Mentions Popup */}
                            {mentionQuery !== null && filteredMembers.length > 0 && (
                                <div className="absolute bottom-20 left-4 right-4 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-40 overflow-y-auto custom-scrollbar">
                                    {filteredMembers.map(member => (
                                        <button
                                            key={member.id}
                                            onClick={() => selectMention(member)}
                                            className="w-full text-left px-3 py-2.5 hover:bg-white/5 text-xs text-gray-300 flex items-center gap-3 transition-colors"
                                        >
                                            <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold overflow-hidden">
                                                {member.avatar_url ? (
                                                    <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    member.name.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <span className="truncate">{member.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {userRole !== 'visualizador' && (
                                <div className="relative group">
                                    <input
                                        value={newComment}
                                        onChange={handleCommentChange}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                        className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl pl-4 pr-10 py-3 text-sm text-white focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all placeholder-gray-600"
                                        placeholder="Escreva um comentario..."
                                    />
                                    <button
                                        onClick={handleAddComment}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-primary transition-colors"
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Selecao de Aprovador (Popover Style) */}
            {showApproverModal && popoverPos && (
                <div
                    className="fixed inset-0 z-[100]"
                    onClick={() => setShowApproverModal(null)}
                >
                    <div
                        className="absolute z-[101] w-64 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                        style={{
                            top: popoverPos.top,
                            left: popoverPos.left
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-3 border-b border-white/5 bg-[#0a0a1a]/50">
                            <h4 className="text-xs font-semibold text-white/90">Selecionar Aprovador</h4>
                        </div>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                            {approvers.map(approver => (
                                <button
                                    key={approver.id}
                                    onClick={() => {
                                        const isSubtask = showApproverModal!.startsWith('subtask:');
                                        const id = isSubtask ? showApproverModal!.replace('subtask:', '') : showApproverModal!;
                                        if (isSubtask) {
                                            updateSubtaskApprovalStatus(id, true, approver.id);
                                        } else {
                                            updateApprovalStatus(id, true, approver.id);
                                        }
                                    }}
                                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left transition-colors group/opt"
                                >
                                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 group-hover/opt:bg-primary group-hover/opt:text-white transition-colors">
                                        {approver.name.charAt(0)}
                                    </div>
                                    <span className="text-xs text-gray-300 group-hover/opt:text-white truncate">{approver.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ================= MODAL DE PREVIEW DE ANEXO ================= */}
            {previewUrl && (
                <div
                    className="fixed inset-0 z-[100] flex flex-col bg-[#050510]/95 backdrop-blur-xl animate-in fade-in duration-300"
                    onClick={() => setPreviewUrl(null)}
                >
                    {/* Header do Preview */}
                    <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-black/20 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                {previewName ? getFileIcon(previewName) : <Paperclip size={18} />}
                            </div>
                            <span className="text-sm font-semibold text-white tracking-tight">{previewName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (previewUrl && previewName) {
                                        handleDownload(previewUrl, previewName);
                                    }
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors text-xs font-medium"
                            >
                                <Download size={14} />
                                Baixar
                            </button>
                            <button
                                onClick={() => setPreviewUrl(null)}
                                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Área de Conteúdo (Imagem, PDF ou Placeholder) */}
                    {(() => {
                        const previewExt = previewName?.split('.').pop()?.toLowerCase() || '';
                        const isPreviewImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(previewExt);
                        const isPreviewPdf = previewExt === 'pdf';
                        const isPreviewText = ['txt', 'csv', 'js', 'ts', 'jsx', 'tsx', 'py'].includes(previewExt);
                        const isPreviewOffice = ['xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt'].includes(previewExt);
                        const isPreviewVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(previewExt);
                        const isIframePreview = isPreviewPdf || isPreviewText || isPreviewOffice;

                        if (isPreviewImage) {
                            return (
                                <div className="flex-1 flex items-center justify-center p-8 w-full h-full">
                                    <img
                                        src={previewUrl}
                                        alt={previewName || 'Preview'}
                                        className="max-w-full max-h-full object-contain shadow-2xl rounded-sm animate-in zoom-in-95 duration-500"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            );
                        }

                        if (isPreviewVideo) {
                            return (
                                <div className="flex-1 flex items-center justify-center p-8 w-full h-full">
                                    <video
                                        src={previewUrl}
                                        controls
                                        autoPlay
                                        className="max-w-full max-h-full rounded-xl shadow-2xl bg-black"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            );
                        }

                        if (isIframePreview) {
                            const finalPreviewUrl = isPreviewOffice
                                ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`
                                : previewUrl;

                            return (
                                <div className="w-full h-full bg-white animate-in fade-in duration-500" onClick={(e) => e.stopPropagation()}>
                                    <iframe
                                        src={finalPreviewUrl}
                                        className="w-full h-full border-none"
                                        title={previewName || 'Preview'}
                                    />
                                </div>
                            );
                        }

                        return (
                            <div className="flex-1 flex items-center justify-center p-8 w-full h-full">
                                <div className="flex flex-col items-center gap-6 p-12 bg-white/5 rounded-[32px] border border-white/10 backdrop-blur-md shadow-2xl animate-in zoom-in-95 duration-500 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                                    <div className="p-8 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                                        {previewName ? (
                                            getFileIcon(previewName, 48)
                                        ) : (
                                            <Paperclip size={48} />
                                        )}
                                    </div>
                                    <div className="text-center space-y-2">
                                        <h3 className="text-lg font-bold text-white tracking-tight px-4 truncate w-full max-w-[300px]" title={previewName || ''}>{previewName}</h3>
                                        <p className="text-xs text-gray-400">Pré-visualização não disponível</p>
                                    </div>
                                    <button
                                        onClick={() => previewUrl && previewName && handleDownload(previewUrl, previewName)}
                                        className="mt-2 w-full px-6 py-3.5 rounded-xl bg-primary hover:bg-primary/80 text-white font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                                    >
                                        <Download size={18} />
                                        Baixar Arquivo
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </>,
        document.body
    );
};

// --- Sub-componente Tempo Rastreado ---
interface TimeTrackingPopoverProps {
    cardId: string;
    isRunning: boolean;
    activeTimer: TimeEntry | null;
    totalMinutes: number;
    timerDisplay: string;
    timeEntries: TimeEntry[];
    onClose: () => void;
    onRefresh: () => void;
    members: any[];
    formatDuration: (minutes: number) => string;
}

const TimeTrackingPopover = ({
    cardId,
    isRunning,
    activeTimer,
    totalMinutes,
    timerDisplay,
    timeEntries,
    onClose,
    onRefresh,
    members,
    formatDuration
}: TimeTrackingPopoverProps) => {
    const { toast, confirm } = useUI();
    const [manualTime, setManualTime] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const parseTimeInput = (input: string): number => {
        // Converte formatos como "1h 30m", "1h30", "90m" ou "1.5"
        let total = 0;
        const hMatch = input.match(/(\d+)\s*h/i);
        const mMatch = input.match(/(\d+)\s*m/i);

        if (hMatch) total += parseInt(hMatch[1]) * 60;
        if (mMatch) total += parseInt(mMatch[1]);

        // Se for so número (ex: "90") assume minutos
        if (!hMatch && !mMatch && /^\d+$/.test(input.trim())) {
            total = parseInt(input);
        }

        return total;
    };

    const handleDeleteTimeEntry = async (id: string) => {
        const ok = await confirm('Excluir Registro', 'Deseja realmente excluir este registro de tempo?');
        if (!ok) return;
        try {
            const { error } = await supabase
                .from('time_entries')
                .delete()
                .eq('id', id);

            if (error) throw error;
            onRefresh();
        } catch (error) {
            console.error('Error deleting time entry:', error);
            toast.error('Erro ao excluir registro.', 'Erro');
        }
    };

    const handleStartTime = async () => {
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('time_entries')
                .insert({
                    card_id: cardId,
                    user_id: user.id,
                    is_running: true,
                    start_time: new Date().toISOString()
                });

            if (error) throw error;
            onRefresh();
        } catch (error) {
            console.error('Error starting timer:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleStopTimer = async () => {
        if (!activeTimer) return;
        setIsSaving(true);
        try {
            const now = new Date();
            const start = new Date(activeTimer.start_time);
            const diffMs = now.getTime() - start.getTime();
            const minutes = Math.floor(diffMs / 60000);

            const { error } = await supabase
                .from('time_entries')
                .update({
                    is_running: false,
                    end_time: now.toISOString(),
                    duration_minutes: Math.max(1, minutes) // Minimo 1 minuto
                })
                .eq('id', activeTimer.id);

            if (error) throw error;
            onRefresh();
        } catch (error) {
            console.error('Error stopping timer:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveManual = async () => {
        const minutes = parseTimeInput(manualTime);
        if (minutes <= 0) return;

        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('time_entries')
                .insert({
                    card_id: cardId,
                    user_id: user.id,
                    duration_minutes: minutes,
                    date: new Date().toISOString().split('T')[0]
                });

            if (error) throw error;
            setManualTime('');
            onRefresh();
        } catch (error) {
            console.error('Error saving manual time:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Obter nome do usuario do timer ativo
    const activeUserName = members.find(m => m.id === activeTimer?.user_id)?.name || 'Você';

    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[340px] bg-[#0d0d1a]/98 backdrop-blur-3xl border border-white/10 rounded-[24px] shadow-2xl z-[100] animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
            {/* Header com Botao de Fechar discreto */}
            <div className="flex justify-between items-center px-6 pt-6 mb-2">
                <span className="text-[11px] text-[#6e6e6e] font-medium tracking-wide">Tempo rastreado</span>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-full">
                    <X size={16} />
                </button>
            </div>

            <div className={`p-6 pt-2 pb-6 relative ${isRunning ? 'bg-primary/5' : ''}`}>
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-white text-lg font-bold">Total</h3>
                    <div className="bg-white/5 px-3 py-1 rounded-full border border-white/5">
                        <span className="text-xl font-black text-white tracking-tight">{formatDuration(totalMinutes)}</span>
                    </div>
                </div>

                {/* Área do Cronômetro Ativo */}
                <div className="relative bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4 group ring-1 ring-white/5 shadow-inner">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-primary font-black uppercase tracking-[0.1em]">{isRunning ? `Rodando: ${activeUserName}` : 'Entrar tempo ou iniciar'}</span>
                            {isRunning && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    <span className="text-[10px] font-bold text-primary tracking-tighter">{timerDisplay}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                value={manualTime}
                                onChange={e => setManualTime(e.target.value)}
                                disabled={isRunning || isSaving}
                                placeholder="ex: 1h 30m ou use o cronômetro"
                                className="flex-1 bg-transparent border-none text-sm text-white focus:ring-0 outline-none placeholder-gray-600 font-light"
                            />
                            <button
                                onClick={isRunning ? handleStopTimer : manualTime ? handleSaveManual : handleStartTime}
                                disabled={isSaving}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isRunning ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20' : 'bg-primary hover:bg-primary/80 shadow-lg shadow-primary/20'}`}
                            >
                                {isSaving ? (
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : isRunning ? (
                                    <div className="w-3 h-3 bg-white rounded-sm" />
                                ) : (
                                    <IconPlayerPlay size={20} fill="currentColor" className="ml-0.5" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista Historica */}
            <div className="flex-1 bg-black/40 border-t border-white/5 flex flex-col min-h-0 max-h-[300px]">
                <div className="p-4 py-3 bg-white/[0.01] flex justify-between items-center">
                    <span className="text-[10px] text-[#6e6e6e] font-semibold tracking-wider">Histórico</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4">
                    {timeEntries.length > 0 ? (
                        timeEntries.map(entry => (
                            <div key={entry.id} className="group flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/5">
                                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-[10px] font-bold text-gray-400 group-hover:bg-primary/20 group-hover:text-primary transition-all shrink-0">
                                    {(entry as any).profiles?.avatar_url ? (
                                        <img src={(entry as any).profiles.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
                                    ) : (
                                        (entry as any).profiles?.full_name?.charAt(0) || 'U'
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-white font-semibold truncate group-hover:text-primary transition-colors">{(entry as any).profiles?.full_name || 'Usuário'}</span>
                                        <span className="text-sm text-white font-black tracking-tight shrink-0">{formatDuration(entry.duration_minutes || 0)}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <span className="text-[9px] text-gray-600 font-bold">{new Date(entry.created_at).toLocaleDateString('pt-BR')}</span>
                                        <button
                                            onClick={() => handleDeleteTimeEntry(entry.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-500 transition-all hover:bg-red-500/10 rounded-md"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-12 text-center">
                            <IconCircleDotted className="mx-auto text-gray-800 mb-2 opacity-20" size={32} />
                            <p className="text-[9px] text-gray-700 uppercase font-black tracking-widest">Sem registros ainda</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default KanbanCardModal;

