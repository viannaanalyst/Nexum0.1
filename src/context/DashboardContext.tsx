import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useCompany } from './CompanyContext';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { isSameDay, parseISO, format } from 'date-fns';

// --- Types (Moved from Atividades/index.tsx) ---
interface DashboardMetrics {
  totalAssigned: number;
  totalCompleted: number;
  efficiency: number;
  completedToday: number;
}

interface PriorityTask {
  id: string;
  title: string;
  column_id: string;
  priority: string;
  due_date: string | null;
  updated_at: string;
  column?: { title: string };
}

interface ProductivityData {
  date: string;
  count: number;
}

interface DashboardContextType {
  metrics: DashboardMetrics;
  priorityTasks: PriorityTask[];
  productivityData: ProductivityData[];
  upcomingDeadlines: PriorityTask[];
  completedTasksToday: string[];
  loading: boolean;
  refreshDashboard: () => Promise<void>;
  lastUpdated: Date | null;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalAssigned: 0,
    totalCompleted: 0,
    efficiency: 0,
    completedToday: 0
  });
  const [priorityTasks, setPriorityTasks] = useState<PriorityTask[]>([]);
  const [productivityData, setProductivityData] = useState<ProductivityData[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<PriorityTask[]>([]);
  const [completedTasksToday, setCompletedTasksToday] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false); // Initial load
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const lastCompanyIdRef = React.useRef<string | null>(null);

  const fetchDashboardData = async (force = false) => {
    if (!selectedCompany || !user) return;
    
    // Cache strategy: If data exists and is less than 5 minutes old, don't fetch unless forced
    if (!force && lastUpdated && (new Date().getTime() - lastUpdated.getTime() < 5 * 60 * 1000)) {
        return; 
    }

    setLoading(true);

    try {
      // 1. Efficiency Metrics
      const { data: allCards, error: cardsError } = await supabase
        .from('kanban_cards')
        .select(`
            id, 
            title, 
            column_id, 
            priority, 
            due_date, 
            updated_at,
            column:kanban_columns!inner(title, is_done_column)
        `)
        .eq('company_id', selectedCompany.id)
        .eq('assigned_to', user.id);

      if (cardsError) throw cardsError;

      const totalAssigned = allCards?.length || 0;
      
      const doneCards = allCards?.filter((c: any) => 
          c.column?.is_done_column === true || 
          c.column?.title?.toLowerCase().includes('conclu') || 
          c.column?.title?.toLowerCase().includes('done')
      ) || [];
      
      const totalCompleted = doneCards.length;
      const efficiency = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

      // Completed Today
      const today = new Date();
      const completedTodayList = doneCards.filter((c: any) => isSameDay(parseISO(c.updated_at), today));
      
      setMetrics({
        totalAssigned,
        totalCompleted,
        efficiency,
        completedToday: completedTodayList.length
      });
      setCompletedTasksToday(completedTodayList.map((c: any) => c.title));

      // 2. Priority Tasks (Pending)
      const pendingPriority = allCards?.filter((c: any) => 
        (c.priority === 'high' || c.priority === 'urgent') && 
        !doneCards.includes(c)
      ) || [];
      setPriorityTasks(pendingPriority.slice(0, 5) as any);

      // 3. Productivity Chart (Audit Logs)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('created_at')
        .eq('company_id', selectedCompany.id)
        .eq('user_id', user.id)
        .gte('created_at', sevenDaysAgo.toISOString());

      const chartDataMap: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateKey = format(d, 'yyyy-MM-dd');
          chartDataMap[dateKey] = 0;
      }

      logs?.forEach((log: any) => {
          const dateKey = format(parseISO(log.created_at), 'yyyy-MM-dd');
          if (chartDataMap[dateKey] !== undefined) {
              chartDataMap[dateKey]++;
          }
      });

      const chartData = Object.keys(chartDataMap).sort().map(date => ({
          date: format(parseISO(date), 'dd/MM'),
          count: chartDataMap[date]
      }));
      setProductivityData(chartData);

      // 4. Upcoming Deadlines
      const deadlines = allCards?.filter((c: any) => c.due_date && !doneCards.includes(c))
        .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 5) || [];
      setUpcomingDeadlines(deadlines as any);

      setLastUpdated(new Date());

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when context mounts or company changes
  useEffect(() => {
      if (selectedCompany && user) {
          const isNewCompany = selectedCompany.id !== lastCompanyIdRef.current;
          
          if (isNewCompany) {
              lastCompanyIdRef.current = selectedCompany.id;
              fetchDashboardData(true); // Force fetch on company change
          } else {
              fetchDashboardData(false); // Use cache if available
          }
      }
  }, [selectedCompany, user]);

  return (
    <DashboardContext.Provider value={{
      metrics,
      priorityTasks,
      productivityData,
      upcomingDeadlines,
      completedTasksToday,
      loading,
      refreshDashboard: () => fetchDashboardData(true),
      lastUpdated
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};
