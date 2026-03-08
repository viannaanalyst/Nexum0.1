import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Bug,
  Lightbulb,
  Upload,
  Loader2,
  Trash2,
  ImageIcon,
  Send,
  Paperclip,
  MessageSquare,
  Sparkles,
  Smile
} from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { useUI } from '../context/UIContext';
import { Select } from './ui/Select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket?: any;
}

const SupportTicketModal: React.FC<SupportTicketModalProps> = ({ isOpen, onClose, ticket }) => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { toast } = useUI();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'bug' | 'melhoria'>('bug');
  const [description, setDescription] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [priority, setPriority] = useState<'baixa' | 'media' | 'alta'>('baixa');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(ticket?.title || '');
      setType(ticket?.type || 'bug');
      setDescription(ticket?.description || '');
      setPageUrl(ticket?.page_url || '');
      setScreenshot(null);
      setScreenshotPreview(ticket?.screenshot_url || null);
      setPriority(ticket?.priority || 'baixa');
      
      // Set initial content for contentEditable
      if (descriptionRef.current) {
        descriptionRef.current.innerHTML = ticket?.description || '';
      }

      if (ticket?.id) {
        setMessages([]); // Clear previous messages
        fetchMessages();
        const subscription = supabase
          .channel(`ticket-messages-${ticket.id}`)
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'support_ticket_messages',
            filter: `ticket_id=eq.${ticket.id}`
          }, async (payload) => {
            // Fetch profile for the new message sender
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, avatar_url, email')
              .eq('id', payload.new.user_id)
              .single();
            
            setMessages(prev => {
              // Remove the optimistic version of this message if it exists
              const filtered = prev.filter(m => 
                !(m.isOptimistic && m.message === payload.new.message && m.user_id === payload.new.user_id)
              );
              
              // Avoid duplicates if the message is already there (e.g. from a quick re-fetch)
              if (filtered.some(m => m.id === payload.new.id)) return filtered;
              
              const newMessages = [...filtered, { ...payload.new, user: profile }];
              // Sort to ensure correct order
              return newMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
          })
          .subscribe();

        return () => {
          subscription.unsubscribe();
        };
      }
    }
  }, [isOpen, ticket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const fetchMessages = async () => {
    if (!ticket?.id) return;
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });
      
      if (messagesError) throw messagesError;

      if (messagesData && messagesData.length > 0) {
        const userIds = [...new Set(messagesData.map(m => m.user_id))];
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .in('id', userIds);
        
        if (profilesError) console.error('Error fetching profiles:', profilesError);

        const messagesWithProfiles = messagesData.map(msg => ({
          ...msg,
          user: profilesData?.find(p => p.id === msg.user_id)
        }));

        setMessages(messagesWithProfiles);
      } else {
        setMessages([]);
      }
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast.error('Erro ao buscar mensagens: ' + error.message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            setScreenshot(file);
            const reader = new FileReader();
            reader.onloadend = () => {
              setScreenshotPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
            toast.success('Imagem colada com sucesso!');
          }
        }
      }
    }
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Por favor, informe um título para o chamado.');
      return;
    }
    if (!description.trim()) {
      toast.error('Por favor, descreva o problema ou sugestão.');
      return;
    }

    setLoading(true);
    try {
      let screenshot_url = '';

      if (screenshot) {
        const fileExt = screenshot.name ? screenshot.name.split('.').pop() : 'png';
        const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
        const filePath = `tickets/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('support-tickets')
          .upload(filePath, screenshot);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('support-tickets')
          .getPublicUrl(filePath);

        screenshot_url = publicUrl;
      }

      if (ticket?.id) {
        const { error } = await supabase
          .from('support_tickets')
          .update({
            title,
            type,
            description,
            page_url: pageUrl,
            screenshot_url,
            priority,
          })
          .eq('id', ticket.id);

        if (error) throw error;
        toast.success('Chamado atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('support_tickets')
          .insert([{
            user_id: user?.id,
            company_id: selectedCompany?.id,
            title,
            type,
            description,
            page_url: pageUrl,
            screenshot_url,
            priority,
            user_name: user?.name || user?.email,
            company_name: selectedCompany?.name,
            status: 'open'
          }]);

        if (error) throw error;
        toast.success('Chamado enviado com sucesso!');
      }
      onClose();
    } catch (error: any) {
      console.error('Error submitting ticket:', error);
      toast.error(error.message || 'Erro ao enviar chamado.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !ticket?.id || !user) return;

    setSendingMessage(true);
    try {
      const { error: messageError } = await supabase
        .from('support_ticket_messages')
        .insert([{
          ticket_id: ticket.id,
          user_id: user.id,
          message: newMessage.trim()
        }]);

      if (messageError) throw messageError;

      // Manually update local state for immediate feedback
      const localMsg = {
        id: `temp-${Math.random().toString(36).substr(2, 9)}`,
        ticket_id: ticket.id,
        user_id: user.id,
        message: newMessage.trim(),
        created_at: new Date().toISOString(),
        isOptimistic: true,
        user: {
          full_name: user.name,
          avatar_url: user.avatar_url,
          email: user.email
        }
      };
      setMessages(prev => [...prev, localMsg]);

      // Notify the other party
      const isSuperAdmin = user.is_super_admin;
      
      if (!isSuperAdmin) {
        // User sent message -> notify Super Admins
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .eq('is_super_admin', true);

        if (admins && admins.length > 0) {
          const notifications = admins.map(admin => ({
            user_id: admin.id,
            title: `Nova mensagem no chamado #${ticket.id.slice(0, 8)}`,
            description: `${user.name || user.email}: ${newMessage.trim().substring(0, 60)}...`,
            type: 'support'
          }));
          await supabase.from('notifications').insert(notifications);
        }
      } else {
        // Admin sent message -> notify ticket owner
        await supabase.from('notifications').insert([{
          user_id: ticket.user_id,
          title: `Suporte respondeu seu chamado`,
          description: `Nova mensagem no chamado #${ticket.id.slice(0, 8)}`,
          type: 'support'
        }]);
      }

      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSendingMessage(false);
    }
  };

  const onEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md z-0 animate-in fade-in duration-300"
        onClick={onClose}
      >
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      </div>

      {/* Modal Content */}
      <div className={`relative z-10 w-full ${ticket ? 'max-w-6xl' : 'max-w-4xl'} rounded-[22px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300 border border-white/10 bg-[#0a0a1a]/10 backdrop-blur-xl ring-1 ring-white/10 ring-inset flex flex-col max-h-[92vh]`}>

        {/* Grain Texture Overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0 rounded-[22px]"></div>

        {/* Glow Effects */}
        <div className="absolute inset-0 rounded-[22px] border border-white/5 pointer-events-none"></div>
        <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[120%] h-[150px] bg-primary/30 blur-[80px] pointer-events-none rounded-[100%]"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_2px_rgba(99,102,241,0.6)]"></div>

        {/* Header */}
        <div className="relative p-8 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-medium text-[#EEEEEE] relative z-10 flex items-center gap-3">
                {ticket ? 'Detalhes do chamado' : 'Novo chamado'}
                {ticket && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-[#6e6e6e] border border-white/5 font-mono">
                    #{ticket.id.slice(0, 8)}
                  </span>
                )}
              </h2>
              <p className="text-[#6e6e6e] text-xs mt-1 font-light">
                {ticket ? 'Visualize e troque mensagens sobre seu chamado.' : 'Descreva detalhadamente como podemos te ajudar.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors z-20"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto custom-scrollbar flex ${ticket ? 'flex-row' : 'flex-col'}`}>
          {/* Form Content / Left Column */}
          <form onSubmit={handleSubmit} className={`${ticket ? 'flex-1 border-r border-white/5' : ''} p-8 pt-2 space-y-5 relative z-20`}>
          <div className="space-y-4">
            {/* Title Field */}
            <div className="relative group">
              <label className="text-[11px] tracking-wide font-medium text-[#6e6e6e] ml-1 mb-1 block capitalize">Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título do chamado"
                className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 focus:shadow-[0_0_15px_-3px_rgba(99,102,241,0.15)] outline-none transition-all duration-300 text-sm font-light"
                required
              />
            </div>

            {/* URL Field */}
            <div className="relative group">
              <label className="text-[11px] tracking-wide font-medium text-[#6e6e6e] ml-1 mb-1 block capitalize">URL da página</label>
              <input
                type="text"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 focus:shadow-[0_0_15px_-3px_rgba(99,102,241,0.15)] outline-none transition-all duration-300 text-sm font-light"
              />
            </div>

            {/* Description Area */}
            <div className="relative group">
              <label className="text-[11px] tracking-wide font-medium text-[#6e6e6e] ml-1 mb-1 block capitalize">Descrição</label>
              <div className="relative">
                <div
                  ref={descriptionRef}
                  contentEditable
                  onInput={(e) => setDescription(e.currentTarget.innerHTML)}
                  className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light min-h-[150px] leading-relaxed overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:text-[#6e6e6e]"
                  data-placeholder="Descreva aqui o erro ou a melhoria desejada..."
                />
              </div>
              <p className="text-[10px] text-gray-600 mt-1 ml-1">Dica: Você pode colar textos e prints diretamente no campo de descrição.</p>
            </div>

            {/* Category and Priority Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="relative group">
                <label className="text-[11px] tracking-wide font-medium text-[#6e6e6e] ml-1 mb-1 block capitalize">Categoria</label>
                <Select
                  value={type}
                  onChange={setType}
                  options={[
                    { value: 'bug', label: 'Bug' },
                    { value: 'melhoria', label: 'Melhoria' }
                  ]}
                  className="w-full"
                />
              </div>

              <div className="relative group">
                <label className="text-[11px] tracking-wide font-medium text-[#6e6e6e] ml-1 mb-1 block capitalize">Prioridade</label>
                <Select
                  value={priority}
                  onChange={setPriority}
                  options={[
                    { value: 'baixa', label: 'Baixa' },
                    { value: 'media', label: 'Média' },
                    { value: 'alta', label: 'Alta' }
                  ]}
                  className="w-full"
                />
              </div>
            </div>

            {/* Screenshot Area */}
            <div className="relative group">
              <label className="text-[11px] tracking-wide font-bold text-[#6e6e6e] ml-1 mb-1 block">Anexo de print</label>
              {!screenshotPreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/10 rounded-xl hover:bg-white/5 hover:border-primary/30 transition-all cursor-pointer group bg-white/[0.01]"
                >
                  <Upload className="text-gray-500 mb-2 group-hover:text-primary transition-colors" size={20} />
                  <span className="text-[10px] text-gray-500 font-medium group-hover:text-gray-300">Clique para anexar print</span>
                </div>
              ) : (
                <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group">
                  <img src={screenshotPreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleRemoveScreenshot}
                      className="p-2 bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500/30 transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                    <span className="text-[10px] text-white font-medium">Remover imagem</span>
                  </div>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          {/* Actions - Bottom Right Alignment */}
          <div className="pt-4 border-t border-white/5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-transparent text-gray-500 hover:text-red-500 transition-all duration-300 font-medium text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl shadow-lg shadow-primary/20 transition-all duration-300 font-medium text-sm flex items-center justify-center min-w-[120px]"
            >
              {loading ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                ticket ? 'Salvar alterações' : 'Enviar'
              )}
            </button>
          </div>
          </form>

          {/* Right Column: Chat History - Only visible when editing */}
          {ticket && (
            <div className="flex-[0.8] flex flex-col h-[600px] lg:h-auto min-h-[500px] relative z-20 bg-black/20 backdrop-blur-sm">
              <div className="p-4 px-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-primary" />
                  <h3 className="text-xs font-semibold text-white/70 tracking-tight">Histórico de mensagens</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-gray-500 font-medium tracking-widest">Suporte online</span>
                </div>
              </div>

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative">
                <div className="flex-1" /> {/* Spacer to push messages to bottom */}
                <div className="p-6 space-y-6">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center p-8 mt-auto">
                    <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4 border border-primary/20 rotate-12 transition-transform hover:rotate-0 duration-500">
                      <Sparkles className="w-8 h-8 text-primary/60" />
                    </div>
                    <h4 className="text-sm font-medium text-white/80 mb-2">Inicie o atendimento</h4>
                    <p className="text-xs font-light text-[#6e6e6e] max-w-[180px] leading-relaxed">
                      Nenhuma mensagem enviada ainda. Mande um "Olá" para começar.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.user_id === user?.id;
                    const senderName = msg.user?.full_name || msg.user?.email || 'Usuário';
                    const avatarUrl = msg.user?.avatar_url;

                    return (
                      <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        {/* Avatar */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full border border-white/10 flex items-center justify-center overflow-hidden bg-white/5 shadow-inner`}>
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={senderName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-white/40">{getInitials(senderName)}</span>
                          )}
                        </div>

                        {/* Content */}
                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                          <div className={`rounded-2xl p-4 text-sm font-light leading-relaxed prose prose-invert ${
                            isMe 
                            ? 'bg-primary/20 text-white rounded-tr-none border border-primary/20' 
                            : 'bg-white/[0.05] text-white/80 rounded-tl-none border border-white/5'
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.message}</p>
                          </div>
                          <span className="text-[10px] text-[#6e6e6e] font-light mt-1.5 px-1 bg-white/[0.02] py-0.5 rounded-full border border-white/5">
                            {format(new Date(msg.created_at), "HH:mm '·' d 'de' MMM", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Chat Input Dock */}
              <div className="p-4 bg-black/40 border-t border-white/5 backdrop-blur-md relative">
                {showEmojiPicker && (
                  <div ref={emojiPickerRef} className="absolute bottom-full right-4 mb-4 z-[100] animate-in slide-in-from-bottom-2 duration-200">
                    <EmojiPicker
                      onEmojiClick={onEmojiClick}
                      theme={Theme.DARK}
                      lazyLoadEmojis={true}
                      skinTonesDisabled={true}
                      searchDisabled={false}
                      width={320}
                      height={400}
                    />
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="relative group/input">
                  <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-xl opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-500" />
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escreva sua mensagem aqui..."
                    rows={2}
                    className="relative w-full bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-2xl pl-4 pr-24 py-4 text-white/90 focus:bg-white/[0.07] focus:border-primary/40 focus:ring-0 outline-none transition-all duration-300 text-sm font-light placeholder-gray-600 resize-none shadow-2xl"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                  />
                  <div className="absolute bottom-3.5 right-3.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                        showEmojiPicker 
                        ? 'bg-primary/20 text-primary border border-primary/20' 
                        : 'text-gray-500 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Smile size={18} />
                    </button>
                    <button
                      type="submit"
                      disabled={sendingMessage || !newMessage.trim()}
                      className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-xl hover:bg-secondary hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-primary/30 z-10"
                    >
                      {sendingMessage ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportTicketModal;
