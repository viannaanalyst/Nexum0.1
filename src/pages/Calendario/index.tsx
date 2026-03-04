import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useCompany } from '../../context/CompanyContext';
import './calendario.css';

const Calendario = () => {
  const { selectedCompany } = useCompany();

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            Calendário
          </h1>
          <p className="text-gray-400 mt-2">
            Visualizando: {selectedCompany?.name || 'Selecione uma empresa'}
          </p>
        </div>
      </div>

      <div className="glass-card p-6 rounded-2xl border border-white/10 flex-1 overflow-hidden relative">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          locale="pt-br"
          buttonText={{
            today: 'Hoje',
            month: 'Mês',
            week: 'Semana',
            day: 'Dia'
          }}
          height="100%"
          events={[]}
          dayHeaderClassNames="text-gray-400 uppercase text-xs font-semibold tracking-wider py-4"
          dayCellClassNames="hover:bg-white/5 transition-colors cursor-pointer"
          slotLabelClassNames="text-gray-400 text-xs"
          eventClassNames="rounded-md border-0 shadow-sm opacity-90 hover:opacity-100 transition-opacity"
          titleFormat={{ year: 'numeric', month: 'long' }}
        />
      </div>
    </div>
  );
};

export default Calendario;
