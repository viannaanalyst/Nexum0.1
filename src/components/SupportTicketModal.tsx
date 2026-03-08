import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Bug,
  Lightbulb,
  Upload,
  Loader2,
  Trash2,
  Type,
  ImageIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { useUI } from '../context/UIContext';

interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SupportTicketModal: React.FC<SupportTicketModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { toast } = useUI();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'bug' | 'melhoria'>('bug');
  const [description, setDescription] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setPageUrl(''); // Empty by default as requested
      setScreenshot(null);
      setScreenshotPreview(null);
    }
  }, [isOpen]);

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
          user_name: user?.name || user?.email,
          company_name: selectedCompany?.name,
          status: 'open'
        }]);

      if (error) throw error;

      toast.success('Chamado enviado com sucesso!');
      onClose();
    } catch (error: any) {
      console.error('Error submitting ticket:', error);
      toast.error(error.message || 'Erro ao enviar chamado.');
    } finally {
      setLoading(false);
    }
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
      <div className="relative z-10 w-full max-w-lg rounded-[22px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300 border border-white/10 bg-[#0a0a1a]/10 backdrop-blur-xl ring-1 ring-white/10 ring-inset flex flex-col max-h-[92vh]">

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
              <h2 className="text-xl font-medium text-[#EEEEEE] relative z-10">Novo chamado</h2>
              <p className="text-[#6e6e6e] text-xs mt-1 font-light">Descreva detalhadamente como podemos te ajudar.</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors z-20"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-8 pt-2 flex-1 overflow-y-auto custom-scrollbar space-y-5 relative z-20">
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
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Descreva aqui o erro ou a melhoria desejada..."
                  className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light placeholder-[#6e6e6e] resize-none leading-relaxed"
                />
                <div className="absolute top-2 right-2 flex p-1.5 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer text-gray-500 hover:text-white transition-all"><Type size={14} /></div>
                  <div className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer text-gray-500 hover:text-white transition-all"><ImageIcon size={14} /></div>
                </div>
              </div>
              <p className="text-[10px] text-gray-600 mt-1 ml-1">Dica: Você pode colar prints diretamente com Ctrl+V</p>
            </div>

            {/* Category and Priority Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative group">
                <label className="text-[11px] tracking-wide font-medium text-[#6e6e6e] ml-1 mb-1 block capitalize">Categoria</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none appearance-none cursor-pointer transition-all duration-300 text-sm font-light"
                >
                  <option value="bug" className="bg-[#0a0a1a]">Bug</option>
                  <option value="melhoria" className="bg-[#0a0a1a]">Melhoria</option>
                </select>
              </div>

              <div className="relative group">
                <label className="text-[11px] tracking-wide font-medium text-[#6e6e6e] ml-1 mb-1 block capitalize">Prioridade</label>
                <select
                  className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none appearance-none cursor-pointer transition-all duration-300 text-sm font-light"
                >
                  <option value="baixa" className="bg-[#0a0a1a]">Baixa</option>
                  <option value="media" className="bg-[#0a0a1a]">Média</option>
                  <option value="alta" className="bg-[#0a0a1a]">Alta</option>
                </select>
              </div>
            </div>

            {/* Screenshot Area */}
            <div className="relative group">
              <label className="text-[11px] tracking-wide font-bold text-[#6e6e6e] ml-1 mb-1 block uppercase tracking-widest">Anexo de print</label>
              {!screenshotPreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/10 rounded-xl hover:bg-white/5 hover:border-primary/30 transition-all cursor-pointer group bg-white/[0.01]"
                >
                  <Upload className="text-gray-500 mb-2 group-hover:text-primary transition-colors" size={20} />
                  <span className="text-[10px] text-gray-500 font-medium group-hover:text-gray-300 uppercase tracking-widest">Clique para anexar print</span>
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
                    <span className="text-[10px] text-white font-medium uppercase tracking-widest">Remover Imagem</span>
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
                'Enviar Chamado'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupportTicketModal;
