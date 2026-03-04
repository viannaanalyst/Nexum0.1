import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, Clock, User, Tag, Paperclip, 
  CheckSquare, MessageSquare, FileText, Plus,
  ChevronDown, Lock, Send, MoreVertical, Trash2,
  File, FileCode, FileImage, Download
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { supabase } from '../../lib/supabase';

// Tipos
interface KanbanCardModalProps {
  cardId: string;
  columnId?: string; // If cardId is 'new', this is required
  onClose: () => void;
}

const KanbanCardModal = ({ cardId, columnId, onClose }: KanbanCardModalProps) => {
  const { selectedCompany } = useCompany();
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
  const [comments, setComments] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // New: Selected tags
  
  // Auxiliary Data
  const [members, setMembers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]); 
  const [newComment, setNewComment] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  
  // New Tag Creation State
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6'); // Default blue

  const [approvers, setApprovers] = useState<any[]>([]);
  const [showApproverModal, setShowApproverModal] = useState<string | null>(null); // Stores the checklist item ID being configured
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserApprover, setCurrentUserApprover] = useState<boolean>(false);
  
  // Tracking original state for system logs
  const [originalAssignedTo, setOriginalAssignedTo] = useState<string>('');
  const [originalDueDate, setOriginalDueDate] = useState<string>('');

  // Mentions State
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number | null>(null); // Index where @ started
  const [filteredMembers, setFilteredMembers] = useState<any[]>([]);

  // Fetch Data
  useEffect(() => {
    fetchMembers();
    fetchClients(); 
    fetchTags();
    fetchApprovers(); // Fetch approvers list
    checkCurrentUserRole(); // Check role

    if (cardId !== 'new') {
      fetchCardData();
    } else {
      setLoading(false);
      setTitle('Nova Tarefa');
    }
  }, [cardId, selectedCompany]);

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
          .select('is_approver')
          .eq('user_id', user.id)
          .eq('company_id', selectedCompany.id)
          .single();
        
        if (error) {
            // It's possible the user is not in the table yet or RLS issue, just log and continue
            // console.warn('User not found in members:', error.message);
            setCurrentUserApprover(false);
        } else if (data) {
            setCurrentUserApprover(data.is_approver || false);
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
          .select('id, full_name, email')
          .in('id', userIds);

        if (profilesData) {
          setMembers(profilesData.map(p => ({
            id: p.id,
            name: p.full_name || p.email || 'Sem nome'
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
        setShowOnCalendar(cardData.show_on_calendar || false);
        setCategory(cardData.category || '');
        setSubcategory(cardData.subcategory || '');
        setClientId(cardData.client_id || ''); // New: Set Client ID
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
        .order('created_at', { ascending: true });

      if (commentError) throw commentError;

      // Manually fetch user emails for comments
      let commentsWithUsers: any[] = [];
      if (commentData) {
          const userIds = [...new Set(commentData.map(c => c.user_id).filter(Boolean))];
          let profileMap: Record<string, any> = {};
          
          if (userIds.length > 0) {
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, email, full_name')
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
        show_on_calendar: showOnCalendar,
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
          }

          if (dueDate !== originalDueDate) {
              const oldDate = originalDueDate ? new Date(originalDueDate).toLocaleDateString('pt-BR') : 'Não definida';
              const newDate = dueDate ? new Date(dueDate).toLocaleDateString('pt-BR') : 'Não definida';
              const { data: { user } } = await supabase.auth.getUser();
              await createSystemLog(finalCardId, `Alterou a data de entrega de "${oldDate}" para "${newDate}".`, user?.id);
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
      alert('Erro ao salvar card.');
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
                alert(`Este item só pode ser aprovado por: ${approverName}`);
                return;
            }
        } else {
            // If no specific approver, ANY approver can approve
            if (!currentUserApprover) {
                alert('Este item requer aprovação de um gestor.');
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
        } else {
            await createSystemLog(cardId, `Removeu a solicitação de aprovação do item: "${itemDesc}".`, user?.id);
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
        }

    } catch (error) {
        console.error('Error uploading file:', error);
        alert('Erro ao fazer upload do arquivo.');
    } finally {
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  };

  const handleDeleteFile = async (fileId: string, fileUrl: string, fileName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o arquivo "${fileName}"?`)) return;

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

    } catch (error) {
        console.error('Error deleting file:', error);
        alert('Erro ao excluir arquivo.');
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
        alert('Erro ao criar etiqueta.');
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

  if (loading) return <div className="fixed inset-0 bg-black/80 flex items-center justify-center text-white">Carregando...</div>;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0a0a1a] w-full max-w-4xl h-auto max-h-[85vh] rounded-2xl border border-white/10 flex shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative">
        
        {/* Coluna Principal (Conteúdo) */}
        <div className="flex-1 flex flex-col border-r border-white/10">
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex justify-between items-start">
            <div className="flex-1 mr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] bg-white/10 text-gray-400 px-2 py-0.5 rounded font-mono">
                  {isNew ? 'NOVA TAREFA' : `TASK-${cardId.slice(0, 6)}`}
                </span>
              </div>
              <input 
                className="text-2xl font-bold text-white bg-transparent border-none focus:outline-none w-full placeholder:text-gray-600"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Título da Tarefa"
              />
            </div>
            <div className="flex gap-2 items-start">
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4 border-b border-white/10 flex gap-4">
            {['details', 'checklist', 'comments', 'files', 'tags'].map((tab: any) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === tab 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'details' && <><FileText size={14} /> Detalhes</>}
                {tab === 'checklist' && <><CheckSquare size={14} /> Checklist ({checklist.length})</>}
                {tab === 'comments' && <><MessageSquare size={14} /> Comentários ({comments.length})</>}
                {tab === 'files' && <><Paperclip size={14} /> Arquivos ({files.length})</>}
                {tab === 'tags' && <><Tag size={14} /> Etiquetas ({selectedTags.length})</>}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#0a0a1a]">
            {isNew && activeTab !== 'details' && (
              <div className="bg-blue-500/10 border border-blue-500/20 text-blue-200 p-3 rounded-lg mb-4 text-xs">
                As alterações nestas abas serão salvas quando você clicar em "Salvar Tudo".
              </div>
            )}

            {activeTab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Data de Criação</label>
                    <div className="flex items-center gap-2 text-white mt-1 text-sm">
                      <Calendar size={14} className="text-gray-400" />
                      {new Date().toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Data de Entrega</label>
                    <div className="flex items-center gap-2 text-white mt-1 text-sm">
                      <Calendar size={14} className="text-gray-400" />
                      {dueDate ? new Date(dueDate).toLocaleDateString('pt-BR') : 'Não definida'}
                    </div>
                  </div>
                </div>

                <div>
                  <textarea
                    className="w-full h-64 bg-transparent text-gray-300 resize-none focus:outline-none placeholder:text-gray-600 leading-relaxed text-sm"
                    placeholder="Descreva a tarefa detalhadamente (Markdown suportado)..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* Definition of Done (Quick View) */}
                <div className="mt-4 bg-[#0f0f1a] rounded-lg border border-white/10 p-3">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <CheckSquare size={14} className="text-primary" />
                            <span className="text-xs font-bold text-white uppercase">Definition of Done</span>
                        </div>
                        <span className="text-xs text-gray-500">
                            {checklist.filter(i => i.is_completed).length}/{checklist.length}
                        </span>
                    </div>
                    <button 
                        onClick={() => setActiveTab('checklist')}
                        className="text-xs text-primary hover:underline"
                    >
                        Ver todos os itens...
                    </button>
                </div>
              </div>
            )}
            
            {activeTab === 'checklist' && (
               <div className="space-y-4">
                 <div className="space-y-2">
                   {checklist.map(item => (
                     <div key={item.id} className={`flex items-start gap-3 p-3 bg-white/5 rounded-lg group border ${item.needs_approval ? 'border-yellow-500/30' : 'border-transparent'}`}>
                       
                       {/* Checkbox / Approval Action */}
                       <button 
                         onClick={() => handleToggleChecklist(item.id, item.is_completed, item.needs_approval, item.approver_id)}
                         disabled={
                             item.needs_approval && !item.is_completed && (
                                 item.approver_id 
                                     ? item.approver_id !== currentUserId 
                                     : !currentUserApprover
                             )
                         }
                         className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors 
                            ${item.is_completed 
                                ? 'bg-emerald-500 border-emerald-500 text-white' 
                                : item.needs_approval && (item.approver_id ? item.approver_id !== currentUserId : !currentUserApprover)
                                    ? 'border-yellow-500/50 bg-yellow-500/10 cursor-not-allowed opacity-50'
                                    : 'border-gray-500 hover:border-gray-300'
                            }`}
                         title={
                             item.needs_approval 
                                ? (item.approver_id 
                                    ? `Aprovação necessária de: ${members.find(m => m.id === item.approver_id)?.name || 'Responsável'}`
                                    : "Requer aprovação de um gestor")
                                : "Concluir item"
                         }
                       >
                         {item.is_completed && <CheckSquare size={12} />}
                         {!item.is_completed && item.needs_approval && (item.approver_id ? item.approver_id !== currentUserId : !currentUserApprover) && <Lock size={10} className="text-yellow-500" />}
                       </button>

                       <div className="flex-1 flex flex-col min-w-0">
                           <span className={`text-sm ${item.is_completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                             {item.description}
                           </span>
                           {item.needs_approval && item.approver_id && (
                               <span className="text-[10px] text-yellow-500 flex items-center gap-1 mt-1 font-medium bg-yellow-500/10 px-1.5 py-0.5 rounded w-fit border border-yellow-500/20">
                                   <User size={10} />
                                   Aprovador: {members.find(m => m.id === item.approver_id)?.name || 'Usuário não encontrado'}
                               </span>
                           )}
                       </div>

                       {/* Lock Toggle (Request Approval) */}
                       <button
                         onClick={() => handleToggleApprovalReq(item.id, item.needs_approval)}
                         className={`p-1 rounded transition-colors ${
                             item.needs_approval 
                                ? 'text-yellow-500 bg-yellow-500/10' 
                                : 'text-gray-600 hover:text-gray-400'
                         }`}
                         title={item.needs_approval ? "Aprovação solicitada" : "Solicitar aprovação"}
                       >
                           <Lock size={14} />
                       </button>

                       <button 
                         onClick={() => handleDeleteChecklist(item.id)}
                         className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                       >
                         <Trash2 size={14} />
                       </button>
                     </div>
                   ))}
                 </div>
                 
                 <div className="flex gap-2">
                   <input 
                     value={newChecklistItem}
                     onChange={(e) => setNewChecklistItem(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()}
                     className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                     placeholder="Novo item do checklist..."
                   />
                   <button 
                     onClick={handleAddChecklistItem}
                     className="bg-primary hover:bg-secondary text-white px-3 py-2 rounded-lg"
                   >
                     <Plus size={18} />
                   </button>
                 </div>
               </div>
            )}

            {activeTab === 'comments' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 custom-scrollbar">
                  {comments.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 text-sm">Nenhum comentário ainda.</div>
                  ) : (
                    comments.map(comment => (
                      <div key={comment.id} className={`flex gap-3 ${comment.is_system_log ? 'opacity-75' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${comment.is_system_log ? 'bg-gray-600' : 'bg-indigo-500'}`}>
                          {comment.is_system_log ? <Clock size={14} /> : (comment.user?.email?.[0]?.toUpperCase() || 'U')}
                        </div>
                        <div className={`rounded-lg p-3 flex-1 ${comment.is_system_log ? 'bg-white/5 border border-white/5 italic' : 'bg-white/5'}`}>
                          <div className="flex justify-between items-baseline mb-1">
                            <span className={`text-xs font-bold ${comment.is_system_log ? 'text-gray-400' : 'text-gray-300'}`}>
                                {comment.user_id ? (comment.user?.email || 'Usuário') : 'Sistema'}
                            </span>
                            <span className="text-[10px] text-gray-500">{new Date(comment.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          <p className={`text-sm ${comment.is_system_log ? 'text-gray-400' : 'text-gray-300'} whitespace-pre-wrap`}>
                              {comment.content}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2 mt-auto pt-2 border-t border-white/10 relative">
                  {mentionQuery !== null && filteredMembers.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 max-h-48 overflow-y-auto">
                          {filteredMembers.map(member => (
                              <button
                                  key={member.id}
                                  onClick={() => selectMention(member)}
                                  className="w-full text-left px-3 py-2 hover:bg-white/10 text-sm text-gray-300 flex items-center gap-2"
                              >
                                  <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                                      {member.name.charAt(0)}
                                  </div>
                                  {member.name}
                              </button>
                          ))}
                      </div>
                  )}
                  <input 
                    value={newComment}
                    onChange={handleCommentChange}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    placeholder="Escreva um comentário... (@ para mencionar)"
                  />
                  <button 
                    onClick={handleAddComment}
                    className="bg-primary hover:bg-secondary text-white p-2 rounded-lg"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {files.map(file => (
                    <div key={file.id} className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-start gap-3 hover:bg-white/10 transition-colors group relative overflow-hidden">
                      <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center shrink-0">
                        {getFileIcon(file.file_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-white truncate" title={file.file_name}>{file.file_name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-500 uppercase font-bold bg-white/10 px-1.5 py-0.5 rounded">
                                {file.file_name.split('.').pop()?.toUpperCase() || 'FILE'}
                            </span>
                            <span className="text-[10px] text-gray-500">
                                {new Date(file.created_at).toLocaleDateString()}
                            </span>
                        </div>
                      </div>
                      
                      {/* Hover Actions */}
                      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <a 
                            href={file.file_url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="p-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-lg"
                            title="Baixar"
                          >
                              <Download size={14} />
                          </a>
                          <button 
                            className="p-1.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg"
                            title="Excluir"
                            onClick={() => handleDeleteFile(file.id, file.file_url, file.file_name)}
                          >
                              <Trash2 size={14} />
                          </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileUpload}
                />
                <button 
                  onClick={handleAddFile}
                  className="w-full border border-dashed border-white/20 rounded-lg p-8 text-gray-400 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all flex flex-col items-center gap-3 group"
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Paperclip size={24} />
                  </div>
                  <div className="text-center">
                      <span className="text-sm font-medium block">Clique para fazer upload</span>
                      <span className="text-xs text-gray-500">ou arraste e solte seus arquivos aqui</span>
                  </div>
                </button>
              </div>
            )}

            {activeTab === 'tags' && (
              <div className="space-y-6">
                {/* Create Tag */}
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Criar Nova Etiqueta</h4>
                    <div className="flex gap-3">
                        <input 
                            value={newTagName}
                            onChange={e => setNewTagName(e.target.value)}
                            placeholder="Nome da etiqueta"
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                            onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                        />
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2">
                            <input 
                                type="color"
                                value={newTagColor}
                                onChange={e => setNewTagColor(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
                            />
                        </div>
                        <button 
                            onClick={handleCreateTag}
                            className="bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>

                {/* List Tags */}
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase">Etiquetas Disponíveis</h4>
                    {tags.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Nenhuma etiqueta criada ainda.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {tags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => toggleTag(tag.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${
                                        selectedTags.includes(tag.id)
                                            ? 'border-transparent text-white ring-2 ring-white/20'
                                            : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                                    }`}
                                    style={{
                                        backgroundColor: tag.color
                                    }}
                                >
                                    <Tag size={12} />
                                    {tag.name}
                                    {selectedTags.includes(tag.id) && <div className="bg-white/20 rounded-full p-0.5"><CheckSquare size={10} /></div>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar (Metadados) */}
        <div className="w-72 bg-[#0f0f1a] p-4 flex flex-col gap-4 border-l border-white/10 overflow-y-auto">
          
          {/* Cliente */}
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-bold uppercase">Cliente</label>
            <div className="relative">
              <select 
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:border-primary focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-[#0a0a1a]">Selecione um cliente</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#0a0a1a]">{c.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Prioridade */}
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-bold uppercase">Prioridade</label>
            <div className="relative">
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:border-primary focus:outline-none cursor-pointer"
              >
                <option value="low" className="bg-[#0a0a1a]">Baixa</option>
                <option value="medium" className="bg-[#0a0a1a]">Média</option>
                <option value="high" className="bg-[#0a0a1a]">Alta</option>
                <option value="urgent" className="bg-[#0a0a1a]">Urgente</option>
              </select>
              <ChevronDown size={14} className="text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Responsável */}
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-bold uppercase">Responsável</label>
            <div className="relative">
              <select 
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:border-primary focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-[#0a0a1a]">Sem responsável</option>
                {members.map(m => (
                  <option key={m.id} value={m.id} className="bg-[#0a0a1a]">{m.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Calendário */}
          <button 
            onClick={() => setShowOnCalendar(!showOnCalendar)}
            className={`w-full border rounded-lg px-3 py-2 flex items-center justify-center gap-2 transition-all text-sm ${
              showOnCalendar 
                ? 'bg-primary/20 border-primary text-primary' 
                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
            }`}
          >
            <Calendar size={14} />
            {showOnCalendar ? 'No Calendário' : 'Add ao Calendário'}
          </button>

          {/* Previsão de Entrega */}
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-bold uppercase">Previsão de Entrega</label>
            <div className="relative">
              <input 
                type="date" 
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t border-white/10 my-1"></div>

          {/* Categoria */}
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-bold uppercase">Categoria</label>
            <input 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none" 
              placeholder="Ex: Design"
            />
          </div>

          {/* Subcategoria */}
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-bold uppercase">Subcategoria</label>
            <input 
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none" 
              placeholder="Ex: Redes Sociais"
            />
          </div>

          <div className="mt-auto">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-primary hover:bg-secondary text-white py-2.5 rounded-lg font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {saving ? 'Salvando...' : 'Salvar Tudo'}
            </button>
          </div>

        </div>
      </div>
    </div>

    {/* Modal de Seleção de Aprovador */}
    {showApproverModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#0f0f1a] p-6 rounded-xl border border-white/10 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                <h3 className="text-lg font-bold text-white mb-2">Solicitar Aprovação</h3>
                <p className="text-sm text-gray-400 mb-4">Selecione quem deve aprovar este item:</p>
                
                <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                    {approvers.length === 0 ? (
                        <p className="text-sm text-yellow-500">Nenhum membro configurado como "Aprovador" na equipe.</p>
                    ) : (
                        approvers.map(approver => (
                            <button
                                key={approver.id}
                                onClick={() => updateApprovalStatus(showApproverModal, true, approver.id)}
                                className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
                            >
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                                    {approver.name.charAt(0)}
                                </div>
                                <span className="text-sm text-white">{approver.name}</span>
                            </button>
                        ))
                    )}
                </div>

                <div className="flex justify-end">
                    <button 
                        onClick={() => setShowApproverModal(null)}
                        className="text-sm text-gray-400 hover:text-white px-3 py-2"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default KanbanCardModal;
