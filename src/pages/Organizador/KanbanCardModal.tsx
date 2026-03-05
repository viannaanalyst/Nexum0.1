import React, { useState, useEffect } from 'react';
import {
    X, Paperclip,
    CheckSquare, MessageSquare, FileText, Plus,
    ChevronDown, Lock, Send, MoreVertical, Trash2,
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

// Tipos
interface KanbanCardModalProps {
    cardId: string;
    columnId?: string; // If cardId is 'new', this is required
    onClose: () => void;
}

const KanbanCardModal = ({ cardId, columnId, onClose }: KanbanCardModalProps) => {
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
    const [checklistTitle, setChecklistTitle] = useState('Checklist Principal'); // New State for Checklist Title
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
    const [newChecklistItem, setNewChecklistItem] = useState('');

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

    // Subtask Interaction State
    const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);
    const [showSubtaskMemberSelect, setShowSubtaskMemberSelect] = useState<string | null>(null);
    const [showSubtaskPrioritySelect, setShowSubtaskPrioritySelect] = useState<string | null>(null);
    const [showSubtaskDateSelect, setShowSubtaskDateSelect] = useState<string | null>(null);
    const [showSubtaskStatusSelect, setShowSubtaskStatusSelect] = useState<string | null>(null);

    // Mentions State
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState<number | null>(null); // Index where @ started
    const [filteredMembers, setFilteredMembers] = useState<any[]>([]);

    // Fetch Data
    useEffect(() => {
        fetchMembers();
        fetchClients();
        fetchTags();
        fetchColumns(); // Fetch columns for subtasks status
        fetchApprovers(); // Fetch approvers list
        checkCurrentUserRole(); // Check role

        if (cardId !== 'new') {
            fetchCardData();
        } else {
            setLoading(false);
            setTitle('Nova tarefa');
            if (columnId) setCurrentColumnId(columnId);
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

    const fetchCardData = async () => {
        setLoading(true);
        try {
            // Fetch Card Details
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
                setClientId(cardData.client_id || ''); // New: Set Client ID
                setCurrentColumnId(cardData.column_id || '');
            }

            // Fetch Checklist
            const { data: checkData } = await supabase
                .from('kanban_checklists')
                .select('*')
                .eq('card_id', cardId)
                .order('position');
            setChecklist(checkData || []);

            // Fetch Comments
            const { data: commentData, error: commentError } = await supabase
                .from('kanban_comments')
                .select('*')
                .eq('card_id', cardId)
                .order('created_at', { ascending: false });

            if (commentError) throw commentError;

            // Manually fetch user emails for comments
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
                            [p.id]: { ...p, email: p.full_name || p.email } // Use name if available, fallback to email. Kept property 'email' for compatibility with existing code
                        }), {} as Record<string, any>);
                    }
                }

                commentsWithUsers = commentData.map(c => ({
                    ...c,
                    user: c.user_id ? (profileMap[c.user_id] || { email: 'Usuário desconhecido' }) : { email: 'Sistema' }
                }));
            }
            setComments(commentsWithUsers);

            // Fetch Files
            const { data: fileData } = await supabase
                .from('kanban_attachments')
                .select('*')
                .eq('card_id', cardId)
                .order('created_at', { ascending: false });
            setFiles(fileData || []);

            // Fetch Selected Tags
            const { data: tagData } = await supabase
                .from('kanban_card_tags')
                .select('tag_id')
                .eq('card_id', cardId);
            if (tagData) {
                setSelectedTags(tagData.map(t => t.tag_id));
            }

            // Fetch Subtasks
            const { data: subData } = await supabase
                .from('kanban_cards')
                .select('*')
                .eq('parent_id', cardId)
                .order('position');
            setSubtasks(subData || []);

        } catch (error) {
            console.error('Error fetching card details:', error);
        } finally {
            setLoading(false);
        }
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
                // Only include column_id if creating new
                ...(cardId === 'new' ? { column_id: columnId, position: 9999 } : {})
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

            // Check for changes and create system logs (only for existing cards or newly created ones)
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

    const handleAddChecklistItem = async () => {
        if (!newChecklistItem.trim()) return;

        // If it's a new card, just add to local state
        if (cardId === 'new') {
            const newItem = {
                id: `temp-${Date.now()}`,
                description: newChecklistItem,
                is_completed: false,
                needs_approval: false,
                position: checklist.length
            };
            setChecklist([...checklist, newItem]);
            setNewChecklistItem('');
            return;
        }

        if (!selectedCompany) return;

        try {
            const { data, error } = await supabase
                .from('kanban_checklists')
                .insert({
                    card_id: cardId,
                    description: newChecklistItem,
                    position: checklist.length,
                    is_completed: false,
                    needs_approval: false // Default false
                })
                .select()
                .single();

            if (error) throw error;
            setChecklist([...checklist, data]);
            setNewChecklistItem('');
        } catch (error) {
            console.error('Error adding checklist item:', error);
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

        // Check for mentions and trigger notifications (Logic only)
        const mentions = members.filter(m => newComment.includes(`@${m.name}`));
        if (mentions.length > 0) {
            console.log('Notifying users:', mentions.map(m => m.name));
            // Here we would call a backend function or insert into a notifications table
            // await supabase.rpc('notify_users', { user_ids: mentions.map(m => m.id), card_id: cardId });
            mentions.forEach(m => {
                // Simulated notification
                // alert(`[SIMULAÇÃO] Notificação enviada para: ${m.name}`);
            });
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

    if (loading) return <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center text-white">Carregando...</div>;

    return (
        <>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
                                                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 border border-primary/30">
                                                            {members.find(m => m.id === assignedTo)?.name.charAt(0) || 'U'}
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
                                                                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
                                                                    {m.name.charAt(0)}
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
                                            <button className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-full">
                                                <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
                                                    <div className="w-0 h-0 border-t-[3px] border-t-transparent border-l-[5px] border-l-white border-b-[3px] border-b-transparent ml-0.5"></div>
                                                </div>
                                                <span className="text-xs">Adicionar hora</span>
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
                                <div className="flex items-center gap-2 text-gray-400">
                                    <FileText size={16} />
                                    <h3 className="text-sm font-bold uppercase tracking-wide">Descrição</h3>
                                </div>
                                <textarea
                                    className="w-full min-h-[60px] bg-white/[0.02] hover:bg-white/[0.04] text-gray-300 resize-y focus:outline-none placeholder:text-gray-600 leading-relaxed text-sm font-light border border-white/5 focus:border-primary/20 rounded-xl p-4 transition-all focus:bg-white/[0.05] focus:shadow-[0_0_15px_-3px_rgba(99,102,241,0.1)]"
                                    placeholder="Clique para adicionar uma descrição detalhada..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    disabled={userRole === 'visualizador'}
                                />
                            </div>

                            {/* 3. Subtarefas (Estilo ClickUp) */}
                            <div className="space-y-2">
                                {/* Cabeçalho e Filtros */}
                                <div className="flex items-center justify-between pb-2 mb-2">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 text-white">
                                            <GitBranch size={16} />
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
                                        <button className="text-xs font-medium text-gray-500 hover:text-white transition-colors flex items-center gap-1">
                                            Classificar <ChevronDown size={10} />
                                        </button>
                                        <button className="text-xs font-medium text-gray-500 hover:text-white transition-colors flex items-center gap-1">
                                            Expandir tudo <IconPlayerPlay size={10} className="rotate-90" />
                                        </button>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-white/5 overflow-hidden">
                                    {/* Tabela Header - ClickUp Style Minimal */}
                                    <div className="grid grid-cols-[1fr_100px_100px_140px_40px] gap-4 px-4 py-2 text-[11px] font-medium text-gray-500 bg-[#0a0a1a]/40 border-b border-white/5">
                                        <div className="pl-8">Nome</div> {/* pl-8 para alinhar com o texto da task, pulando o ícone de status */}
                                        <div className="text-left">Responsável</div>
                                        <div className="text-left">Prioridade</div>
                                        <div className="text-left">Data de vencimento</div>
                                        <div></div>
                                    </div>

                                    {/* Lista - ClickUp Style */}
                                    <div className="divide-y divide-white/5">
                                        {subtasks.map(task => (
                                            <div key={task.id} className="group grid grid-cols-[1fr_100px_100px_140px_40px] gap-4 items-center px-4 py-2 hover:bg-white/[0.02] transition-colors relative text-sm">
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

                                                    <span className="text-gray-300 group-hover:text-white truncate transition-colors cursor-pointer font-normal">
                                                        {task.title}
                                                    </span>
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
                                                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 border border-primary/30 ring-2 ring-[#0a0a1a]">
                                                                {members.find(m => m.id === task.assigned_to)?.name?.charAt(0) || 'U'}
                                                            </div>
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full border border-dashed border-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors">
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
                                                                        <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold">
                                                                            {m.name.charAt(0)}
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
                                                    <div className="relative min-w-[60px] h-6 flex items-center">
                                                        <span
                                                            className={`cursor-pointer hover:text-white transition-colors ${!task.due_date ? 'text-gray-600 hover:text-gray-400' : 'text-gray-300'}`}
                                                        >
                                                            {task.due_date ? new Date(task.due_date + 'T12:00:00').toLocaleDateString('pt-BR').slice(0, 5) : '-'}
                                                        </span>
                                                        <input
                                                            type="date"
                                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                                            value={task.due_date || ''}
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
                                            <div className="flex items-center gap-3 px-4 py-2 text-gray-500 hover:text-gray-300 transition-colors cursor-text group hover:bg-white/[0.02]" onClick={() => document.getElementById('new-subtask-input')?.focus()}>
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
                                        <button className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Card do Checklist "Principal" (Simulando um bloco) */}
                                <div className="border border-white/10 rounded-xl overflow-hidden shadow-sm">

                                    {/* Header do Bloco */}
                                    <div className="px-4 py-3 flex items-center justify-between group cursor-pointer hover:bg-white/[0.02] transition-colors">
                                        <div className="flex items-center gap-3 flex-1">
                                            <input
                                                className="text-sm font-bold text-white bg-transparent border-none focus:outline-none w-full placeholder:text-gray-500 hover:text-gray-200 transition-colors"
                                                value={checklistTitle}
                                                onChange={(e) => setChecklistTitle(e.target.value)}
                                                placeholder="Nome do Checklist"
                                                disabled={userRole === 'visualizador'}
                                            />
                                            <span className="text-xs text-gray-500 font-medium shrink-0">
                                                {checklist.filter(i => i.is_completed).length} de {checklist.length}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Lista de Itens Pendentes */}
                                    <div className="px-2 pb-2">
                                        {checklist.filter(i => !i.is_completed).map(item => (
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
                                                <div className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer group" onClick={() => document.getElementById('new-checklist-input')?.focus()}>
                                                    <Plus size={14} className="group-hover:text-primary transition-colors" />
                                                    <input
                                                        id="new-checklist-input"
                                                        value={newChecklistItem}
                                                        onChange={(e) => setNewChecklistItem(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()}
                                                        className="bg-transparent text-sm focus:outline-none w-full placeholder:text-gray-500 text-gray-300 h-6 font-medium"
                                                        placeholder="Adicionar item"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Seção de Concluídos (Accordion) */}
                                    {checklist.filter(i => i.is_completed).length > 0 && (
                                        <div className="border-t border-white/5">
                                            <details className="group/details">
                                                <summary className="px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-white/[0.02] transition-colors list-none text-xs font-medium text-gray-500 select-none">
                                                    <ChevronDown size={12} className="transition-transform group-open/details:rotate-180" />
                                                    <span>Mostrar {checklist.filter(i => i.is_completed).length} concluído(s)</span>
                                                </summary>

                                                <div className="px-2 pb-2 pt-1 animate-in slide-in-from-top-2 duration-200">
                                                    {checklist.filter(i => i.is_completed).map(item => (
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
                            </div>

                            {/* 5. Anexos */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <Paperclip size={16} />
                                        <h3 className="text-sm font-bold uppercase tracking-wide">Anexos ({files.length})</h3>
                                    </div>
                                    <button onClick={handleAddFile} className="text-xs text-primary hover:text-white transition-colors">
                                        + Adicionar
                                    </button>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    {files.map(file => (
                                        <div key={file.id} className="bg-white/[0.02] border border-white/5 rounded-lg p-3 flex items-center gap-3 hover:bg-white/[0.05] transition-colors group relative">
                                            <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-gray-400">
                                                {getFileIcon(file.file_name)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs text-gray-300 truncate" title={file.file_name}>{file.file_name}</p>
                                                <p className="text-[10px] text-gray-600">{new Date(file.created_at).toLocaleDateString()}</p>
                                            </div>
                                            <button onClick={() => handleDeleteFile(file.id, file.file_url, file.file_name)} className="absolute top-1 right-1 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
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
        </>
    );
};

export default KanbanCardModal;
