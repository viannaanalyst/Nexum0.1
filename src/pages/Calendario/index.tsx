import React, { useState, useEffect } from 'react';
import { Briefcase, User, Tag as TagIcon, X as CloseIcon } from 'lucide-react';
import { Select } from '../../components/ui/Select';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useCompany } from '../../context/CompanyContext';
import { supabase } from '../../lib/supabase';
import KanbanCardModal from '../Organizador/KanbanCardModal';
import { NewEventModal } from '../../components/Calendar/NewEventModal';
import './calendario.css';

const Calendario = () => {
  const { selectedCompany } = useCompany();
  const calendarRef = React.useRef<FullCalendar>(null);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'task' | 'event'>('task');
  const [showEventModal, setShowEventModal] = useState(false);
  const [initialEventDate, setInitialEventDate] = useState<string | undefined>();

  // Filter Options States
  const [clients, setClients] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  // Selected Filters States
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [firstColumnId, setFirstColumnId] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalNewTask = () => {
      if (firstColumnId) {
        setModalMode('task');
        setSelectedCardId('new');
      }
    };

    const handleGlobalNewEvent = () => {
      setInitialEventDate(new Date().toISOString().slice(0, 16));
      setShowEventModal(true);
    };

    window.addEventListener('open-new-task', handleGlobalNewTask);
    window.addEventListener('open-new-event', handleGlobalNewEvent);
    return () => {
      window.removeEventListener('open-new-task', handleGlobalNewTask);
      window.removeEventListener('open-new-event', handleGlobalNewEvent);
    };
  }, [firstColumnId]);

  useEffect(() => {
    if (selectedCompany) {
      fetchFiltersData();
      fetchEvents();
    }
  }, [selectedCompany]);

  // Apply filters whenever selections or source data changes
  useEffect(() => {
    filterEvents();
  }, [selectedClient, selectedMember, selectedTag, allEvents]);

  const fetchFiltersData = async () => {
    if (!selectedCompany) return;

    // 1. Fetch Clients
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, name')
      .eq('company_id', selectedCompany.id)
      .eq('status', 'active')
      .order('name');
    if (clientsData) setClients(clientsData);

    // 2. Fetch Members (Profiles)
    const { data: membersData } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('company_id', selectedCompany.id)
      .eq('status', 'active');

    if (membersData && membersData.length > 0) {
      const userIds = membersData.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      if (profiles) setMembers(profiles);
    }

    // 3. Fetch Tags
    const { data: tagsData } = await supabase
      .from('kanban_tags')
      .select('id, name, color')
      .eq('company_id', selectedCompany.id)
      .order('name');
    if (tagsData) setTags(tagsData);

    // 4. Fetch First Column (for new tasks)
    const { data: cols } = await supabase
      .from('kanban_columns')
      .select('id')
      .eq('company_id', selectedCompany.id)
      .order('position', { ascending: true })
      .limit(1);
    if (cols && cols.length > 0) setFirstColumnId(cols[0].id);
  };

  const fetchEvents = async () => {
    try {
      // Fetch cards with tags relationship
      const { data: cards, error } = await supabase
        .from('kanban_cards')
        .select(`
            *,
            kanban_card_tags (
                tag_id
            )
        `)
        .eq('company_id', selectedCompany?.id)
        .eq('show_on_calendar', true)
        .not('due_date', 'is', null);

      if (error) throw error;

      if (cards) {
        // Fetch Profiles (Assignees)
        const userIds = Array.from(new Set(cards.map(c => c.assigned_to).filter(Boolean)));
        let profilesMap: Record<string, any> = {};

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);

          if (profiles) {
            profiles.forEach(p => { profilesMap[p.id] = p; });
          }
        }

        // Fetch Clients
        const clientIds = Array.from(new Set(cards.map(c => c.client_id).filter(Boolean)));
        let clientsMap: Record<string, any> = {};

        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from('clients')
            .select('id, name')
            .in('id', clientIds);

          if (clients) {
            clients.forEach(c => { clientsMap[c.id] = c; });
          }
        }

        const formattedEvents = cards.map(card => {
          const profile = card.assigned_to ? profilesMap[card.assigned_to] : null;
          const client = card.client_id ? clientsMap[card.client_id] : null;
          const cardTagIds = card.kanban_card_tags?.map((t: any) => t.tag_id) || [];

          // If it's an event, we use the timestamp. If it's a task, just the date.
          // But always as a single point in time/day to avoid taking over the calendar.
          const isEvent = card.category === 'Evento';

          return {
            id: card.id,
            title: card.title,
            start: card.due_date, // Use due_date as the single point
            allDay: !isEvent, // Tasks are allDay (on the deadline), Events have time
            backgroundColor: getPriorityColor(card.priority),
            borderColor: getPriorityColor(card.priority),
            extendedProps: {
              priority: card.priority,
              description: card.description,
              responsible: profile ? (profile.full_name || profile.email) : null,
              responsibleId: card.assigned_to,
              client: client ? client.name : null,
              clientId: card.client_id,
              tagIds: cardTagIds,
              category: card.category,
              rawDueDate: card.due_date
            }
          };
        }).filter(Boolean);
        setAllEvents(formattedEvents);
        setEvents(formattedEvents); // Initial set without filters
      }
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    }
  };

  const filterEvents = () => {
    let filtered = [...allEvents];

    if (selectedClient) {
      filtered = filtered.filter(e => e.extendedProps.clientId === selectedClient);
    }

    if (selectedMember) {
      filtered = filtered.filter(e => e.extendedProps.responsibleId === selectedMember);
    }

    if (selectedTag) {
      filtered = filtered.filter(e => e.extendedProps.tagIds && e.extendedProps.tagIds.includes(selectedTag));
    }

    setEvents(filtered);
  };

  const getPriorityColor = (priority: string) => {
    const p = priority?.toLowerCase() || '';
    switch (p) {
      case 'urgent': return '#ef4444'; // Red
      case 'high': return '#f97316';   // Orange
      case 'medium': return '#8b5cf6'; // Violet
      case 'low': return '#10b981';    // Green
      default: return '#3b82f6';       // Default Blue
    }
  };

  const getPriorityLabel = (priority: string) => {
    const p = priority?.toLowerCase() || '';
    switch (p) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return '';
    }
  };

  const renderEventContent = (eventInfo: any) => {
    const { responsible, client, priority, category, rawDueDate } = eventInfo.event.extendedProps;
    const priorityLabel = getPriorityLabel(priority);
    const isEvent = category === 'Evento';
    const time = isEvent && rawDueDate ? rawDueDate.split('T')[1]?.slice(0, 5) : '';

    return (
      <div className="flex flex-col w-full overflow-hidden px-1.5 py-1">
        <div className="font-bold truncate text-[11px] leading-tight mb-0.5">{eventInfo.event.title}</div>

        <div className="flex flex-col gap-0.5 opacity-90">
          {isEvent && time && (
            <div className="text-[9px] uppercase tracking-wide font-bold text-blue-400 flex items-center gap-1">
              <span>🕒</span> {time}
            </div>
          )}
          {priorityLabel && !isEvent && (
            <div className="text-[9px] uppercase tracking-wide font-semibold opacity-80">
              {priorityLabel}
            </div>
          )}
          {client && (
            <div className="text-[9px] truncate flex items-center gap-1">
              <span className="opacity-70">Cli:</span> {client}
            </div>
          )}
          {responsible && (
            <div className="text-[9px] truncate flex items-center gap-1">
              <span className="opacity-70">Resp:</span> {responsible.split(' ')[0]}
            </div>
          )}
        </div>
      </div>
    );
  };

  const [currentDateTitle, setCurrentDateTitle] = useState('');
  const [currentView, setCurrentView] = useState('dayGridMonth');

  useEffect(() => {
    // Initial title update
    if (calendarRef.current) {
      updateTitle();
    }
  }, [events]); // Update when events load (often triggers rerender)

  const updateTitle = () => {
    const api = calendarRef.current?.getApi();
    if (api) {
      setCurrentDateTitle(api.view.title);
      setCurrentView(api.view.type);
    }
  };

  const handlePrev = () => {
    calendarRef.current?.getApi().prev();
    updateTitle();
  };

  const handleNext = () => {
    calendarRef.current?.getApi().next();
    updateTitle();
  };

  const handleToday = () => {
    calendarRef.current?.getApi().today();
    updateTitle();
  };

  const handleViewChange = (view: string) => {
    calendarRef.current?.getApi().changeView(view);
    updateTitle();
  };

  return (
    <div className="h-full flex flex-col space-y-4">

      {/* Custom Header Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">

        {/* Left: Navigation & Title */}
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="flex bg-[#0f0f1a] rounded-lg border border-white/10 overflow-hidden">
            <button onClick={handlePrev} className="p-2 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button onClick={handleNext} className="p-2 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border-l border-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
          <button onClick={handleToday} className="px-4 py-2 bg-[#0f0f1a] border border-white/10 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:border-primary/50 transition-all">
            Hoje
          </button>
          <h2 className="text-xl font-bold text-white capitalize min-w-[200px]">{currentDateTitle}</h2>
        </div>

        {/* Right: Filters & Views */}
        <div className="flex flex-col md:flex-row gap-4 items-center w-full lg:w-auto">

          {/* Filters Group */}
          <div className="flex flex-wrap gap-2 items-center justify-end w-full md:w-auto">
            <Select
              className="w-full md:w-auto"
              value={selectedClient}
              onChange={setSelectedClient}
              icon={<Briefcase size={14} />}
              options={[
                { value: '', label: 'Cliente' },
                ...clients.map(c => ({ value: c.id, label: c.name }))
              ]}
            />

            <Select
              className="w-full md:w-auto"
              value={selectedMember}
              onChange={setSelectedMember}
              icon={<User size={14} />}
              options={[
                { value: '', label: 'Responsável' },
                ...members.map(m => ({ value: m.id, label: m.full_name || m.email }))
              ]}
            />

            <Select
              className="w-full md:w-auto"
              value={selectedTag}
              onChange={setSelectedTag}
              icon={<TagIcon size={14} />}
              options={[
                { value: '', label: 'Tag' },
                ...tags.map(t => ({ value: t.id, label: t.name }))
              ]}
            />

            {(selectedClient || selectedMember || selectedTag) && (
              <button
                onClick={() => {
                  setSelectedClient('');
                  setSelectedMember('');
                  setSelectedTag('');
                }}
                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Limpar Filtros"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
              </button>
            )}
          </div>

          {/* View Buttons */}
          <div className="flex bg-[#0f0f1a] rounded-lg border border-white/10 p-1">
            <button
              onClick={() => handleViewChange('dayGridMonth')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${currentView === 'dayGridMonth' ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
            >
              Mês
            </button>
            <button
              onClick={() => handleViewChange('timeGridWeek')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${currentView === 'timeGridWeek' ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
            >
              Semana
            </button>
            <button
              onClick={() => handleViewChange('timeGridDay')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${currentView === 'timeGridDay' ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
            >
              Dia
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card p-0 rounded-2xl border border-white/10 flex-1 overflow-hidden relative">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={false} // Hide default toolbar
          locale="pt-br"
          height="100%"
          events={events}
          eventContent={renderEventContent}
          dayHeaderClassNames="text-gray-400 uppercase text-xs font-semibold tracking-wider py-4"
          dayCellClassNames="hover:bg-white/5 transition-colors cursor-pointer"
          slotLabelClassNames="text-gray-400 text-xs"
          eventClassNames="rounded-md border-0 shadow-sm opacity-90 hover:opacity-100 transition-opacity"
          datesSet={updateTitle} // Keep title in sync
          eventClick={(info) => {
            setModalMode('task');
            setSelectedCardId(info.event.id);
          }}
          dateClick={(info) => {
            setInitialEventDate(info.dateStr + 'T12:00');
            setShowEventModal(true);
          }}
          selectable={true}
        />
      </div>

      {selectedCardId && (
        <KanbanCardModal
          cardId={selectedCardId}
          columnId={selectedCardId === 'new' ? firstColumnId || undefined : undefined}
          mode={modalMode}
          onClose={() => {
            setSelectedCardId(null);
            fetchEvents(); // Refresh events after closing modal
          }}
        />
      )}

      <NewEventModal
        isOpen={showEventModal}
        initialDate={initialEventDate}
        onClose={() => setShowEventModal(false)}
        onSuccess={() => {
          fetchEvents();
          setShowEventModal(false);
        }}
      />
    </div>
  );
};

export default Calendario;
