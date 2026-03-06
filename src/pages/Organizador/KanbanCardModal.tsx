import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Paperclip,
    CheckSquare, MessageSquare, FileText, Plus,
    ChevronDown, ChevronUp, Lock, Send, MoreVertical, Trash2,
    File, FileCode, FileImage, Download, GitBranch, Info,
    // Mantendo ícones Lucide que ainda podem ser usados em outros lugares ou como fallback
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
    IconCircleDotted
} from '@tabler/icons-react';
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
}

const KanbanCardModal = ({ cardId, columnId, defaultClientId, onClose }: KanbanCardModalProps) => {
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
    const [clientId, setClientId] = useState('');

    const [checklist, setChecklist] = useState<any[]>([]);
    const [checklistGroups, setChecklistGroups] = useState<any[]>([{ id: 'default', title: 'Checklist Principal' }]);
    const [newChecklistItems, setNewChecklistItems] = useState<Record<string, string>>({});
    const [comments, setComments] = useState<any[]>([]);
    const [files, setFiles] = useState<any[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [subtasks, setSubtasks] = useState<any[]>([]); // New: Subtasks
    const [columnsMap, setColumnsMap] = useState<Record<string, string>>({}); // Helper for subtask status
    const [columns, setColumns] = useState<any[]>([]); // New: Columns list for dropdown
    const [currentColumnId, setCurrentColumnId] = useState<string>(''); // For status badge

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

    // Subtask Interaction State
    const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);
    const [showSubtaskMemberSelect, setShowSubtaskMemberSelect] = useState<string | null>(null);
    const [showSubtaskPrioritySelect, setShowSubtaskPrioritySelect] = useState<string | null>(null);
    const [showSubtaskDateSelect, setShowSubtaskDateSelect] = useState<string | null>(null);
    const [showSubtaskStatusSelect, setShowSubtaskStatusSelect] = useState<string | null>(null);
    const [isSubtasksCollapsed, setIsSubtasksCollapsed] = useState(false);
    const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
    const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
    const [showSubtaskTagSelectId, setShowSubtaskTagSelectId] = useState<string | null>(null);

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
        fetchColumns(); // Fetch columns for subtasks status
        fetchApprovers(); // Fetch approvers list
        checkCurrentUserRole(); // Check role
        fetchTimeEntries(); // Fetch time entries

        if (cardId !== 'new') {
            fetchCardDetails();
            fetchChecklist();
            fetchComments();
            fetchFiles();
            fetchSubtasks();
        } else {
            setLoading(false);
            setTitle('Nova tarefa');
            if (columnId) setCurrentColumnId(columnId);
            if (defaultClientId) setClientId(defaultClientId);
        }
    }, [cardId, selectedCompany]);

    const fetchColumns = async () => {
        if (!selectedCompany) return;
        try {
            const { data } = await supabase
                .from('kanban_columns')
                .select('id, title, color')
                .eq('company_id', selectedCompany.id)
                .order('position');

            if (data) {
                const map = data.reduce((acc, col) => ({ ...acc, [col.id]: col.title }), {});
                setColumnsMap(map);
                setColumns(data);
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
                .select('*')
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
            }
        } catch (error) {
            console.error('Error fetching card details:', error);
        } finally {
            setLoading(false);
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
                    .order('created_at', { ascending: true });

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
                    user: c.user_id ? (profileMap[c.user_id] || { email: 'Usuário desconhecido' }) : { email: 'Sistema' }
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
                .select('*')
                .eq('parent_id', cardId)
                .order('position');
            setSubtasks(subData || []);
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

            // Calcular total e checar se há algum rodando
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
                    // Just in case, 'Você' or fetch from auth.
                    userDisplay = { email: 'Você' };
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
            // Find first column
            const { data: cols } = await supabase
                .from('kanban_columns')
                .select('id')
                .eq('company_id', selectedCompany.id)
                .order('position')
                .limit(1);

            const firstColId = cols?.[0]?.id;
            if (!firstColId) {
                toast.error('Nenhuma coluna encontrada para criar subtarefa.', 'Erro');
                return;
            }

            const { data, error } = await supabase.from('kanban_cards').insert({
                company_id: selectedCompany.id,
                client_id: clientId || null,
                column_id: firstColId,
                title: subtaskTitle,
                parent_id: cardId,
                position: 9999,
                priority: 'medium'
            }).select().single();

            if (error) throw error;
            setSubtasks([...subtasks, data]);
        } catch (error) {
            console.error('Error creating subtask:', error);
            toast.error('Erro ao criar subtarefa.', 'Erro');
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
            const { data: cols } = await supabase.from('kanban_columns').select('id').eq('company_id', selectedCompany.id).order('position').limit(1);
            const firstColId = cols?.[0]?.id;

            if (!firstColId) {
                toast.error('Nenhuma coluna encontrada.', 'Erro');
                return;
            }

            const { data: newCard, error: createError } = await supabase.from('kanban_cards').insert({
                company_id: selectedCompany.id,
                client_id: clientId || null,
                column_id: firstColId,
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
                column_id: currentColumnId || columnId, // Always include the current/selected column
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
                    'Nova Tarefa Atribuída',
                    `Você foi atribuído à tarefa: ${title}`,
                    finalCardId,
                    'assignment'
                );
            }

            // Check for other changes and create system logs (only for existing cards)
            if (cardId !== 'new') {
                if (assignedTo !== originalAssignedTo) {
                    const oldUser = members.find(m => m.id === originalAssignedTo)?.name || 'Ninguém';
                    const newUser = members.find(m => m.id === assignedTo)?.name || 'Ninguém';
                    const { data: { user } } = await supabase.auth.getUser();
                    await createSystemLog(finalCardId, `Alterou o responsável de "${oldUser}" para "${newUser}".`, user?.id);

                    // Audit Log
                    await createAuditLog('update', 'card', finalCardId, {
                        field: 'assigned_to',
                        from: oldUser,
                        to: newUser
                    });
                }

                if (dueDate !== originalDueDate) {
                    const oldDate = originalDueDate ? new Date(originalDueDate).toLocaleDateString('pt-BR') : 'Não definida';
                    const newDate = dueDate ? new Date(dueDate).toLocaleDateString('pt-BR') : 'Não definida';
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
                    const approverName = members.find(m => m.id === approverId)?.name || 'o responsável';
                    toast.warning(`Este item só pode ser aprovado por: ${approverName}`, 'Permissão negada');
                    return;
                }
            } else {
                // If no specific approver, ANY approver can approve
                if (!currentUserApprover) {
                    toast.warning('Este item requer aprovação de um gestor.', 'Permissão negada');
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

    const handleToggleApprovalReq = (itemId: string, currentStatus: boolean) => {
        // Instead of toggling immediately, if turning ON, show modal to select approver
        if (!currentStatus) {
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
                await createSystemLog(cardId, `Solicitou aprovação de "${approverName}" para o item: "${itemDesc}".`, user?.id);
                await createAuditLog('approve', 'card', cardId, { status: 'requested', checklist_item: itemDesc, approver: approverName });
            } else {
                await createSystemLog(cardId, `Removeu a solicitação de aprovação do item: "${itemDesc}".`, user?.id);
                await createAuditLog('approve', 'card', cardId, { status: 'removed', checklist_item: itemDesc });
            }

        } catch (error) {
            console.error('Error updating approval status:', error);
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
                    'Você foi mencionado',
                    `${user.email?.split('@')[0]} mencionou você em: ${title}`,
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

    const getFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <FileImage size={24} className="text-yellow-500" />;
        if (['pdf'].includes(ext || '')) return <FileText size={24} className="text-red-500" />;
        if (['doc', 'docx'].includes(ext || '')) return <FileText size={24} className="text-blue-500" />;
        if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <FileText size={24} className="text-green-500" />;
        if (['zip', 'rar'].includes(ext || '')) return <FileCode size={24} className="text-purple-500" />;
        return <File size={24} className="text-gray-400" />;
    };

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleAddFile = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

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
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
                {/* 1. Overlay Premium */}
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-md z-0 animate-in fade-in duration-300"
                    onClick={onClose}
                >
                    <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
                </div>

                {/* 2. Container Glass Premium */}
                <div className="relative z-10 w-full max-w-[1600px] h-[90vh] flex rounded-[22px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-white/10 bg-[#0a0a1a]/90 backdrop-blur-xl">

                    {/* Glow Effects */}
                    <div className="absolute inset-0 rounded-[22px] border border-white/5 pointer-events-none"></div>

                    {/* Glow Roxo no Topo (Estilo Equipe) */}
                    <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[80%] h-[100px] bg-primary/30 blur-[80px] pointer-events-none rounded-[100%] z-0"></div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_20px_2px_rgba(99,102,241,0.4)] z-0"></div>

                    {/* ================= ESQUERDA: CONTEÚDO PRINCIPAL (70%) ================= */}
                    <div className="flex-1 flex flex-col border-r border-white/5 overflow-hidden relative z-20 bg-transparent">

                        {/* Ações de Topo (Flutuantes) */}
                        <div className="absolute top-6 right-6 z-50 flex gap-2">
                            {userRole !== 'visualizador' && (
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-primary/20"
                                >
                                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            )}
                            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Corpo Unificado Scrollável */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">

                            {/* Cabeçalho (Agora parte do fluxo) */}
                            <div className="pr-32"> {/* Padding right para não sobrepor botões */}
                                {/* Breadcrumbs / ID */}
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-[10px] bg-white/[0.05] border border-white/5 text-gray-400 px-2 py-0.5 rounded-full font-mono tracking-wider">
                                        {isNew ? 'NOVA TAREFA' : `TASK-${cardId.slice(0, 6)}`}
                                    </span>
                                    {/* Status/Coluna Badge */}
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${currentColumnId || columnId ? 'bg-blue-500' : 'bg-gray-500'}`} />
                                        <span className="text-xs text-gray-400 uppercase tracking-wide font-bold">
                                            {columnsMap[currentColumnId || columnId || ''] || 'Sem Status'}
                                        </span>
                                    </div>
                                </div>

                                {/* Título Grande */}
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
                                        <div className="flex items-center gap-2 text-gray-400 min-w-[140px]">
                                            <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                <IconFlag size={16} stroke={1.5} style={{ color: columns.find(c => c.id === currentColumnId)?.color || '#3b82f6' }} fill="currentColor" />
                                            </div>
                                            <span className="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">Status</span>
                                        </div>

                                        <div className="relative flex-1 flex justify-start">
                                            <button
                                                onClick={() => userRole !== 'visualizador' && setShowStatusSelect(!showStatusSelect)}
                                                className="flex items-center"
                                            >
                                                <div
                                                    className="flex items-center gap-2 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide text-white transition-all hover:opacity-90"
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
                                        <div className="flex items-center gap-2 text-gray-400 min-w-[140px]">
                                            <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                <IconCalendar size={16} stroke={1.5} />
                                            </div>
                                            <span className="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">Datas</span>
                                        </div>

                                        <div className="relative flex-1 flex items-center gap-2 justify-start">
                                            {/* Data Início */}
                                            <div className="relative flex items-center gap-1 hover:bg-white/5 px-1.5 py-1 rounded cursor-pointer transition-colors group/start">
                                                <span className={`text-sm ${startDate ? 'text-gray-300' : 'text-gray-500'}`}>
                                                    {startDate ? new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR').slice(0, 5) : 'Início'}
                                                </span>
                                                <input
                                                    type="date"
                                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    disabled={userRole === 'visualizador'}
                                                    onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
                                                />
                                            </div>

                                            <span className="text-gray-700">→</span>

                                            {/* Data Prevista */}
                                            <div className="relative flex items-center gap-1 hover:bg-white/5 px-1.5 py-1 rounded cursor-pointer transition-colors group/due">
                                                <span className={`text-sm ${dueDate ? 'text-gray-300' : 'text-gray-500'}`}>
                                                    {dueDate ? new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR').slice(0, 5) : 'Prevista'}
                                                </span>
                                                <input
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

                                            {/* Botão limpar (só aparece se tiver datas) */}
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
                                        <div className="flex items-center gap-2 text-gray-400 min-w-[140px]">
                                            <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                <IconCalendar size={16} stroke={1.5} />
                                            </div>
                                            <span className="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">Data da entrega</span>
                                        </div>

                                        <div className="relative flex-1 flex justify-start">
                                            <div className="relative flex items-center gap-1 hover:bg-white/5 px-1.5 py-1 rounded cursor-pointer transition-colors group/delivery">
                                                <span className={`text-sm ${deliveryDate ? 'text-gray-300' : 'text-gray-600'}`}>
                                                    {deliveryDate ? new Date(deliveryDate + 'T12:00:00').toLocaleDateString('pt-BR').slice(0, 5) : 'Vazio'}
                                                </span>
                                                <input
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
                                        <div className="flex items-center gap-2 text-gray-400 min-w-[140px]">
                                            <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                <IconTag size={16} stroke={1.5} />
                                            </div>
                                            <span className="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">Etiquetas</span>
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
                                                    className="text-sm text-gray-600 hover:text-gray-400 cursor-pointer transition-colors"
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

                                    {/* 1. Responsáveis */}
                                    <div className="flex items-center justify-between group h-8">
                                        <div className="flex items-center gap-2 text-gray-400 min-w-[140px]">
                                            <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                <IconUser size={16} stroke={1.5} />
                                            </div>
                                            <span className="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">Responsáveis</span>
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
                                                    <span className="text-sm text-gray-600 hover:text-gray-400 transition-colors">Vazio</span>
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
                                        <div className="flex items-center gap-2 text-gray-400 min-w-[140px]">
                                            <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                <IconFlag size={16} stroke={1.5} />
                                            </div>
                                            <span className="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">Prioridade</span>
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
                                                            {priority === 'urgent' ? 'Urgente' : priority === 'high' ? 'Alta' : priority === 'medium' ? 'Média' : 'Baixa'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-600 hover:text-gray-400 transition-colors">Vazio</span>
                                                )}
                                            </button>

                                            {/* Popover Prioridade */}
                                            {showPrioritySelect && (
                                                <div className="absolute top-full left-0 mt-2 w-40 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-1">
                                                    {[
                                                        { value: 'urgent', label: 'Urgente', text: 'text-red-500' },
                                                        { value: 'high', label: 'Alta', text: 'text-orange-500' },
                                                        { value: 'medium', label: 'Média', text: 'text-blue-500' },
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
                                        <div className="flex items-center gap-2 text-gray-400 min-w-[140px]">
                                            <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                <IconPlayerPlay size={16} stroke={1.5} />
                                            </div>
                                            <span className="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">Tempo rastreado</span>
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
                                                    {isRunning ? timerDisplay : totalMinutes > 0 ? formatDuration(totalMinutes) : 'Adicionar hora'}
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* 4. Cliente (Relacionamentos) */}
                                    <div className="flex items-center justify-between group h-8">
                                        <div className="flex items-center gap-2 text-gray-400 min-w-[140px]">
                                            <div className="p-1 rounded hover:bg-white/5 transition-colors">
                                                <IconBriefcase size={16} stroke={1.5} />
                                            </div>
                                            <span className="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">Cliente</span>
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
                                                    <span className="text-sm text-gray-600 hover:text-gray-400 transition-colors">Vazio</span>
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

                            {/* 2. Descrição */}
                            <div className="space-y-3 group">
                                {(!description && !isEditingDescription) ? (
                                    <button
                                        onClick={() => setIsEditingDescription(true)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-white hover:bg-white/5 transition-all group/btn"
                                    >
                                        <span className="text-base font-medium">Adicionar descrição</span>
                                    </button>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between text-white pr-2">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold uppercase tracking-wide">Descrição</h3>
                                            </div>
                                            {description && (
                                                <button
                                                    onClick={() => setIsExpandedDescription(!isExpandedDescription)}
                                                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] uppercase font-bold text-gray-400 hover:text-white transition-all border border-white/5 shadow-sm"
                                                >
                                                    {isExpandedDescription ? (
                                                        <>Recolher <ChevronUp size={12} className="text-primary" strokeWidth={3} /></>
                                                    ) : (
                                                        <>Expandir <ChevronDown size={12} className="text-primary" strokeWidth={3} /></>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                        <div className={`relative transition-all duration-300 overflow-hidden ${!isExpandedDescription ? 'max-h-[100px] mb-2' : 'max-h-none'}`}>
                                            <textarea
                                                ref={descriptionRef}
                                                className="w-full bg-white/[0.02] hover:bg-white/[0.04] text-gray-300 resize-none overflow-hidden focus:outline-none placeholder:text-gray-600/50 leading-relaxed text-sm font-light border border-white/5 focus:border-primary/20 rounded-xl p-4 transition-all focus:bg-white/[0.05] focus:shadow-[0_0_15px_-3px_rgba(99,102,241,0.1)]"
                                                placeholder="Escreva, pressione a barra de espaço para usar a IA ou '/' para usar comandos"
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
                            <div className="space-y-2">
                                {/* Cabeçalho e Filtros */}
                                <div className="flex items-center justify-between pb-2 mb-2">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 text-white">
                                            <h3 className="text-sm font-bold uppercase tracking-wide">Subtarefas</h3>
                                        </div>

                                        {/* Barra de Progresso Subtarefas (Igual Checklist) */}
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${subtasks.length > 0 ? (subtasks.filter(t => t.column_id && columnsMap[t.column_id]?.toLowerCase() === 'concluído').length / subtasks.length) * 100 : 0}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs text-blue-500 font-medium">
                                                {subtasks.filter(t => t.column_id && columnsMap[t.column_id]?.toLowerCase() === 'concluído').length}/{subtasks.length}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setIsSubtasksCollapsed(!isSubtasksCollapsed)}
                                            className="text-xs font-medium text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5"
                                        >
                                            {isSubtasksCollapsed ? (
                                                <>Expandir tudo <ChevronDown size={12} /></>
                                            ) : (
                                                <>Recolher tudo <ChevronUp size={12} /></>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-white/5">
                                    {/* Tabela Header - ClickUp Style Minimal */}
                                    <div className="grid grid-cols-[1fr_100px_100px_140px_40px] gap-4 px-4 py-2 text-[11px] font-medium text-gray-500 bg-[#0a0a1a]/40 border-b border-white/5 rounded-t-xl">
                                        <div className="pl-8">Nome</div> {/* pl-8 para alinhar com o texto da task, pulando o ícone de status */}
                                        <div className="text-left">Responsável</div>
                                        <div className="text-left">Prioridade</div>
                                        <div className="text-left">Data de vencimento</div>
                                        <div></div>
                                    </div>

                                    {/* Lista - ClickUp Style */}
                                    <div className={`divide-y divide-white/5 ${isSubtasksCollapsed ? 'max-h-0 overflow-hidden text-transparent opacity-0 duration-300 transition-all' : 'overflow-visible'}`}>
                                        {subtasks.map(task => (
                                            <div
                                                key={task.id}
                                                className={`group grid grid-cols-[1fr_100px_100px_140px_40px] gap-4 items-center px-4 py-2 hover:bg-white/[0.02] transition-colors relative text-sm ${(showSubtaskStatusSelect === task.id || showSubtaskMemberSelect === task.id || showSubtaskPrioritySelect === task.id || showSubtaskTagSelectId === task.id) ? 'z-[999]' : 'z-auto'}`}
                                            >
                                                {/* Nome e Status */}
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {/* Expand/Collapse Placeholder (futuro) */}
                                                    <div className="w-4 flex justify-center text-gray-600">
                                                        <div className="w-1 h-1 rounded-full bg-gray-600"></div>
                                                    </div>

                                                    {/* Status Circle Button */}
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
                                                            className="w-4 h-4 rounded-full border border-gray-600 hover:border-gray-400 flex items-center justify-center transition-colors"
                                                            style={{ borderColor: task.column_id ? columns.find(c => c.id === task.column_id)?.color : '#4b5563' }}
                                                        >
                                                            <div
                                                                className="w-2 h-2 rounded-full"
                                                                style={{ backgroundColor: task.column_id ? (columns.find(c => c.id === task.column_id)?.color) : 'transparent' }}
                                                            />
                                                        </button>

                                                        {/* Popover Status Subtarefa */}
                                                        {showSubtaskStatusSelect === task.id && (
                                                            <div className="absolute top-full left-0 mt-2 w-48 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 py-1">
                                                                {columns.map(col => (
                                                                    <button
                                                                        key={col.id}
                                                                        onClick={() => {
                                                                            handleUpdateSubtask(task.id, { column_id: col.id });
                                                                            setShowSubtaskStatusSelect(null);
                                                                        }}
                                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2 group/item"
                                                                    >
                                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                                                                        <span className="text-gray-300 group-hover/item:text-white transition-colors">{col.title}</span>
                                                                        {task.column_id === col.id && <CheckSquare size={10} className="ml-auto text-primary" />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {editingSubtaskId === task.id ? (
                                                        <input
                                                            autoFocus
                                                            className="bg-white/5 border border-primary/30 rounded px-1 py-0.5 text-sm text-white focus:outline-none w-full"
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
                                                        <span className="text-gray-300 group-hover:text-white truncate transition-colors cursor-pointer font-normal flex-1">
                                                            {task.title}
                                                        </span>
                                                    )}

                                                    {/* Hover Actions: Pencil & Tag */}
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingSubtaskId(task.id);
                                                                setEditingSubtaskTitle(task.title);
                                                            }}
                                                            className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                                                            title="Editar título"
                                                        >
                                                            <LucideCalendar size={12} className="hidden" /> {/* just to have reference if needed */}
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setShowSubtaskTagSelectId(showSubtaskTagSelectId === task.id ? null : task.id);
                                                            }}
                                                            className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors relative"
                                                            title="Vincular etiqueta"
                                                        >
                                                            <LucideTag size={12} />
                                                            {showSubtaskTagSelectId === task.id && (
                                                                <div className="absolute top-full right-0 mt-2 w-48 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl z-[60] p-2" onClick={(e) => e.stopPropagation()}>
                                                                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 px-1">Etiquetas</p>
                                                                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                                                                        {tags.map(tag => (
                                                                            <button
                                                                                key={tag.id}
                                                                                className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 text-xs text-gray-300 transition-colors"
                                                                            >
                                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                                                                <span className="truncate">{tag.name}</span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Responsável - ClickUp Style (Icon + Plus) */}
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
                                                        title={task.assigned_to ? members.find(m => m.id === task.assigned_to)?.name : 'Atribuir responsável'}
                                                    >
                                                        {task.assigned_to ? (
                                                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 border border-primary/30 ring-2 ring-[#0a0a1a] overflow-hidden">
                                                                {members.find(m => m.id === task.assigned_to)?.avatar_url ? (
                                                                    <img src={members.find(m => m.id === task.assigned_to).avatar_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    members.find(m => m.id === task.assigned_to)?.name?.charAt(0) || 'U'
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors">
                                                                <IconUser size={12} />
                                                            </div>
                                                        )}
                                                    </button>

                                                    {/* Popover Responsável Subtarefa */}
                                                    {showSubtaskMemberSelect === task.id && (
                                                        <div className="absolute top-full left-0 mt-2 w-48 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                            <div className="max-h-40 overflow-y-auto custom-scrollbar p-1">
                                                                {members.map(m => (
                                                                    <button
                                                                        key={m.id}
                                                                        onClick={() => {
                                                                            handleUpdateSubtask(task.id, { assigned_to: m.id });
                                                                            setShowSubtaskMemberSelect(null);
                                                                        }}
                                                                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left ${task.assigned_to === m.id ? 'bg-primary/10 text-primary' : ''}`}
                                                                    >
                                                                        <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold overflow-hidden">
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

                                                {/* Prioridade - ClickUp Style (Flag Icon Only) */}
                                                <div className="flex justify-start relative pl-2">
                                                    <button
                                                        onClick={() => {
                                                            if (userRole === 'visualizador') return;
                                                            setActiveSubtaskId(task.id);
                                                            setShowSubtaskPrioritySelect(showSubtaskPrioritySelect === task.id ? null : task.id);
                                                            setShowSubtaskMemberSelect(null);
                                                            setShowSubtaskDateSelect(null);
                                                        }}
                                                        className="hover:bg-white/5 p-1.5 rounded transition-colors"
                                                    >
                                                        <IconFlag
                                                            size={16}
                                                            className={`${task.priority === 'urgent' ? 'text-red-500' : task.priority === 'high' ? 'text-orange-500' : task.priority === 'medium' ? 'text-blue-500' : 'text-gray-600'} transition-colors`}
                                                            fill={task.priority && task.priority !== 'low' ? "currentColor" : "none"}
                                                            stroke={1.5}
                                                        />
                                                    </button>

                                                    {/* Popover Prioridade Subtarefa */}
                                                    {showSubtaskPrioritySelect === task.id && (
                                                        <div className="absolute top-full left-0 mt-2 w-32 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-1">
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
                                                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-white/5 transition-colors text-left ${task.priority === p.value ? 'bg-white/5' : ''}`}
                                                                >
                                                                    <IconFlag size={12} className={p.text} fill="currentColor" />
                                                                    <span className="text-gray-300">{p.label}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Data - ClickUp Style (Text only) */}
                                                <div className="text-left text-xs relative flex justify-start pl-2">
                                                    <div className="relative min-w-[60px] h-6 flex items-center group/date">
                                                        {task.due_date ? (
                                                            <span className="cursor-pointer hover:text-white transition-colors text-gray-300">
                                                                {new Date(task.due_date.substring(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR').slice(0, 5)}
                                                            </span>
                                                        ) : (
                                                            <IconCalendar size={16} className="text-gray-600 hover:text-gray-400 cursor-pointer" />
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

                                                {/* Ações (More Icon) */}
                                                <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleUnlinkSubtask(task.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1.5 hover:bg-white/5 rounded">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

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

                            {/* 4. Checklists (ClickUp Style) */}
                            <div className="space-y-4">
                                {/* Header Geral da Seção */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-sm font-bold uppercase tracking-wide text-white">Checklists</h3>
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
                                        <button className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                                            <IconPlayerPlay size={14} className="rotate-90" /> {/* Expand All Icon Placeholder */}
                                        </button>
                                        <button onClick={handleAddChecklistGroup} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>

                                {checklistGroups.map(group => {
                                    const groupItems = checklist.filter(i => i.group_id === group.id || (group.id === 'default' && !i.group_id));
                                    const completedItems = groupItems.filter(i => i.is_completed);

                                    return (
                                        <div key={group.id} className="border border-white/10 rounded-xl overflow-hidden shadow-sm">
                                            {/* Header do Bloco */}
                                            <div className="px-4 py-3 flex items-center justify-between group cursor-pointer hover:bg-white/[0.02] transition-colors relative">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <input
                                                        className="text-sm font-bold text-white bg-transparent border-none focus:outline-none w-full placeholder:text-gray-500 hover:text-gray-200 transition-colors"
                                                        value={group.title}
                                                        onChange={(e) => handleUpdateChecklistGroup(group.id, e.target.value)}
                                                        placeholder="Nome do Checklist"
                                                        disabled={userRole === 'visualizador'}
                                                    />
                                                    <span className="text-xs text-gray-500 font-medium shrink-0">
                                                        {completedItems.length} de {groupItems.length}
                                                    </span>
                                                </div>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-4">
                                                    <button onClick={() => handleDeleteChecklistGroup(group.id)} className="p-1.5 rounded hover:bg-white/10 text-gray-600 hover:text-red-400" title="Excluir Checklist">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Lista de Itens Pendentes */}
                                            <div className="px-2 pb-2">
                                                {groupItems.filter(i => !i.is_completed).map(item => (
                                                    <div key={item.id} className="group flex items-start gap-3 px-3 py-2 hover:bg-white/[0.04] rounded-lg transition-colors relative text-sm group/item">
                                                        <button
                                                            onClick={() => handleToggleChecklist(item.id, item.is_completed, item.needs_approval, item.approver_id)}
                                                            disabled={item.needs_approval && (item.approver_id ? item.approver_id !== currentUserId : !currentUserApprover)}
                                                            className="mt-0.5 w-4 h-4 rounded border border-gray-600 hover:border-gray-400 bg-transparent flex items-center justify-center transition-all shrink-0"
                                                        >
                                                        </button>

                                                        <span className="flex-1 text-gray-300 group-hover/item:text-white transition-colors font-normal leading-relaxed break-words">
                                                            {item.description}
                                                        </span>

                                                        {/* Ações do Item */}
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => handleToggleApprovalReq(item.id, item.needs_approval)} className={`p-1.5 rounded hover:bg-white/10 ${item.needs_approval ? 'text-yellow-500' : 'text-gray-600 hover:text-yellow-400'}`} title="Aprovação">
                                                                <Lock size={14} />
                                                            </button>
                                                            <button onClick={() => handleDeleteChecklist(item.id)} className="p-1.5 rounded hover:bg-white/10 text-gray-600 hover:text-red-400" title="Excluir">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Input de Adicionar Item (Estilo Botão Texto) */}
                                                {userRole !== 'visualizador' && (
                                                    <div className="px-3 py-2 mt-1">
                                                        <div className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer group" onClick={() => document.getElementById(`new-checklist-input-${group.id}`)?.focus()}>
                                                            <Plus size={14} className="group-hover:text-primary transition-colors" />
                                                            <input
                                                                id={`new-checklist-input-${group.id}`}
                                                                value={newChecklistItems[group.id] || ''}
                                                                onChange={(e) => setNewChecklistItems({ ...newChecklistItems, [group.id]: e.target.value })}
                                                                onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem(group.id)}
                                                                className="bg-transparent text-sm focus:outline-none w-full placeholder:text-gray-500 text-gray-300 h-6 font-medium"
                                                                placeholder="Adicionar item"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Seção de Concluídos (Accordion) */}
                                            {completedItems.length > 0 && (
                                                <div className="border-t border-white/5">
                                                    <details className="group/details">
                                                        <summary className="px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-white/[0.02] transition-colors list-none text-xs font-medium text-gray-500 select-none">
                                                            <ChevronDown size={12} className="transition-transform group-open/details:rotate-180" />
                                                            <span>Mostrar {completedItems.length} concluído(s)</span>
                                                        </summary>

                                                        <div className="px-2 pb-2 pt-1 animate-in slide-in-from-top-2 duration-200">
                                                            {completedItems.map(item => (
                                                                <div key={item.id} className="group flex items-start gap-3 px-3 py-2 hover:bg-white/[0.04] rounded-lg transition-colors relative text-sm opacity-60 hover:opacity-100">
                                                                    <button
                                                                        onClick={() => handleToggleChecklist(item.id, item.is_completed, item.needs_approval, item.approver_id)}
                                                                        className="mt-0.5 w-4 h-4 rounded border border-emerald-500 bg-emerald-500 text-white flex items-center justify-center transition-all shrink-0"
                                                                    >
                                                                        <CheckSquare size={10} strokeWidth={3} />
                                                                    </button>

                                                                    <span className="flex-1 text-gray-500 line-through transition-colors font-normal leading-relaxed break-words">
                                                                        {item.description}
                                                                    </span>

                                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button onClick={() => handleDeleteChecklist(item.id)} className="p-1.5 rounded hover:bg-white/10 text-gray-600 hover:text-red-400" title="Excluir">
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </details>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 5. Anexos */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold uppercase tracking-wide text-white">Anexos ({files.length})</h3>
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

                                            if (isToday) return `Hoje às ${timeStr}`;
                                            if (isYesterday) return `Ontem às ${timeStr}`;
                                            return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} às ${timeStr}`;
                                        };

                                        return (
                                            <div key={file.id} className="w-[206px] h-[180px] shrink-0 bg-[#0a0a1a] border border-white/5 rounded-xl flex flex-col hover:border-white/20 transition-colors group relative overflow-hidden">

                                                {/* Botão flutuante de Excluir */}
                                                <button onClick={() => handleDeleteFile(file.id, file.file_url, file.file_name)} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-gray-400 hover:text-white hover:bg-red-500/80 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0 z-20 shadow-md">
                                                    <Trash2 size={14} />
                                                </button>

                                                <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="flex-1 flex flex-col min-h-0 relative">
                                                    {/* Top Area - Preview */}
                                                    <div className="flex-1 flex items-center justify-center bg-[#050510] relative overflow-hidden min-h-0">
                                                        {isImage ? (
                                                            <img src={file.file_url} alt={file.file_name} className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity p-2" />
                                                        ) : (
                                                            <div className="text-primary/70 transform group-hover:scale-110 transition-transform duration-300 scale-[2]">
                                                                {getFileIcon(file.file_name)}
                                                            </div>
                                                        )}
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

                        </div>
                    </div>

                    {/* ================= DIREITA: ATIVIDADE E CHAT (30%) ================= */}
                    <div className="w-[400px] flex flex-col bg-[#050510]/80 backdrop-blur-xl border-l border-white/5 z-20">
                        {/* Header Lateral */}
                        <div className="p-4 border-b border-white/5 flex items-center gap-2">
                            <MessageSquare size={16} className="text-primary" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Atividade</h3>
                        </div>

                        {/* Feed Scrollável */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#050510]/50 flex flex-col-reverse">
                            {comments.length === 0 ? (
                                <div className="text-center py-10 opacity-30">
                                    <MessageSquare size={32} className="mx-auto mb-2" />
                                    <p className="text-xs">Nenhuma atividade registrada.</p>
                                </div>
                            ) : (
                                comments.map(comment => {
                                    const hasUser = !!comment.user_id;
                                    const userAvatar = comment.user?.avatar_url;
                                    const userInitial = (comment.user?.email?.[0] || comment.user?.full_name?.[0] || 'S').toUpperCase();
                                    const userName = comment.user_id ? (comment.user?.email || 'Usuário') : 'Sistema';

                                    return (
                                        <div key={comment.id} className={`flex gap-3 ${comment.is_system_log ? 'opacity-70' : ''}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden border border-white/10 ${hasUser ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-400'}`}>
                                                {userAvatar ? (
                                                    <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                                                ) : (
                                                    hasUser ? userInitial : <Info size={14} />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-0.5">
                                                    <span className={`text-xs font-bold ${comment.is_system_log ? 'text-gray-400' : 'text-gray-200'}`}>
                                                        {userName}
                                                    </span>
                                                    <span className="text-[9px] text-gray-600">{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className={`text-xs ${comment.is_system_log ? 'text-gray-500' : 'text-gray-300'} break-words leading-relaxed`}>
                                                    {comment.content}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Input Fixo no Rodapé */}
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
                                        placeholder="Escreva um comentário..."
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

            {/* Modal de Seleção de Aprovador (Mantido Igual) */}
            {showApproverModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-md z-0 animate-in fade-in duration-300"
                        onClick={() => setShowApproverModal(null)}
                    >
                        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
                    </div>

                    <div className="relative z-10 bg-[#0a0a1a]/80 backdrop-blur-xl p-6 rounded-[22px] border border-white/10 w-full max-w-sm shadow-2xl animate-in zoom-in-95 overflow-hidden">
                        <div className="absolute inset-0 rounded-[22px] border border-white/5 pointer-events-none"></div>
                        <div className="relative z-20">
                            <h3 className="text-lg font-medium text-white/90 mb-2">Solicitar Aprovação</h3>
                            <p className="text-sm text-gray-400 font-light mb-6">Selecione quem deve aprovar este item:</p>

                            <div className="space-y-2 max-h-60 overflow-y-auto mb-6 custom-scrollbar pr-1">
                                {approvers.map(approver => (
                                    <button
                                        key={approver.id}
                                        onClick={() => updateApprovalStatus(showApproverModal, true, approver.id)}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 transition-all text-left group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-xs font-bold group-hover:bg-primary group-hover:text-white transition-colors">
                                            {approver.name.charAt(0)}
                                        </div>
                                        <span className="text-sm text-gray-300 group-hover:text-white font-light">{approver.name}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={() => setShowApproverModal(null)}
                                    className="text-sm text-gray-500 hover:text-white px-4 py-2 transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
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

        // Se for só número (ex: "90") assume minutos
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
                    duration_minutes: Math.max(1, minutes) // Mínimo 1 minuto
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

    // Obter nome do usuário do timer ativo
    const activeUserName = members.find(m => m.id === activeTimer?.user_id)?.name || 'Você';

    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[340px] bg-[#0d0d1a]/98 backdrop-blur-3xl border border-white/10 rounded-[24px] shadow-2xl z-[100] animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
            {/* Header com Botão de Fechar discreto */}
            <div className="flex justify-between items-center px-6 pt-6 mb-2">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">tempo rastreado</span>
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

            {/* Lista Histórica */}
            <div className="flex-1 bg-black/40 border-t border-white/5 flex flex-col min-h-0 max-h-[300px]">
                <div className="p-4 py-3 bg-white/[0.01] flex justify-between items-center">
                    <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">HISTÓRICO</span>
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

