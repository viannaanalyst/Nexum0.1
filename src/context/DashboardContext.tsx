import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useCompany } from './CompanyContext';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { isSameDay, parseISO, format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

// --- Types (Moved from Atividades/index.tsx) ---
interface DashboardMetrics {
  totalAssigned: number;
  totalCompleted: number;
  efficiency: number;
  completedToday: number;
  completedParentToday: number;
  completedSubtasksToday: number;
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
  completedParentTasksToday: string[];
  completedSubtasksToday: string[];
  loading: boolean;
  filterRange: number;
  setFilterRange: (days: number) => void;
  userProfile: { full_name: string | null } | null;
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
    completedToday: 0,
    completedParentToday: 0,
    completedSubtasksToday: 0
  });
  const [priorityTasks, setPriorityTasks] = useState<PriorityTask[]>([]);
  const [productivityData, setProductivityData] = useState<ProductivityData[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<PriorityTask[]>([]);
  const [completedTasksToday, setCompletedTasksToday] = useState<string[]>([]);
  const [completedParentTasksToday, setCompletedParentTasksToday] = useState<string[]>([]);
  const [completedSubtasksToday, setCompletedSubtasksToday] = useState<string[]>([]);

  const [loading, setLoading] = useState(false); // Initial load
  const [userProfile, setUserProfile] = useState<{ full_name: string | null } | null>(null);
  const [filterRange, setFilterRange] = useState(7);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const lastCompanyIdRef = React.useRef<string | null>(null);
  const lastRangeRef = React.useRef<number>(7);

  const fetchDashboardData = async (force = false) => {
    if (!selectedCompany || !user) return;

    // Cache strategy: If data exists and is less than 5 minutes old, don't fetch unless forced or range changed
    const rangeChanged = filterRange !== lastRangeRef.current;
    if (!force && !rangeChanged && lastUpdated && (new Date().getTime() - lastUpdated.getTime() < 5 * 60 * 1000)) {
      return;
    }

    lastRangeRef.current = filterRange;

    setLoading(true);

    try {
      // 0. Fetch User Profile for name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      setUserProfile(profile);

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
            parent_id,
            column:kanban_columns!inner(title, is_done_column)
        `)
        .eq('company_id', selectedCompany.id)
        .eq('assigned_to', user.id);

      if (cardsError) throw cardsError;

      const totalAssigned = allCards?.length || 0;

      const doneCards = allCards?.filter((c: any) =>
        c.column?.is_done_column === true
      ) || [];

      const totalCompleted = doneCards.length;
      const efficiency = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

      const today = new Date();
      const completedTodayList = doneCards.filter((c: any) => isSameDay(parseISO(c.updated_at), today));

      const completedParentToday = completedTodayList.filter((c: any) => !c.parent_id);
      const completedSubtasksTodayList = completedTodayList.filter((c: any) => c.parent_id);

      setMetrics({
        totalAssigned,
        totalCompleted,
        efficiency,
        completedToday: completedTodayList.length,
        completedParentToday: completedParentToday.length,
        completedSubtasksToday: completedSubtasksTodayList.length
      });
      setCompletedTasksToday(completedTodayList.map((c: any) => c.title));
      setCompletedParentTasksToday(completedParentToday.map((c: any) => c.title));
      setCompletedSubtasksToday(completedSubtasksTodayList.map((c: any) => c.title));

      // 2. Priority Tasks (Pending)
      const pendingPriority = allCards?.filter((c: any) =>
        (c.priority === 'high' || c.priority === 'urgent') &&
        !doneCards.includes(c)
      ) || [];
      setPriorityTasks(pendingPriority.slice(0, 5) as any);

      // 3. Productivity Chart (Audit Logs)
      const rangeDate = new Date();
      rangeDate.setDate(rangeDate.getDate() - (filterRange - 1));

      const { data: logs } = await supabase
        .from('audit_logs')
        .select('created_at')
        .eq('company_id', selectedCompany.id)
        .eq('user_id', user.id)
        .gte('created_at', rangeDate.toISOString());

      const chartDataMap: Record<string, number> = {};
      
      if (filterRange === 30) {
        const monthStart = startOfMonth(new Date());
        const monthEnd = endOfMonth(new Date());
        const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        
        monthDays.forEach(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          chartDataMap[dateKey] = 0;
        });
        
        const { data: logs } = await supabase
          .from('audit_logs')
          .select('created_at')
          .eq('company_id', selectedCompany.id)
          .eq('user_id', user.id)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString());

        logs?.forEach((log: any) => {
          const dateKey = format(parseISO(log.created_at), 'yyyy-MM-dd');
          if (chartDataMap[dateKey] !== undefined) {
            chartDataMap[dateKey]++;
          }
        });
      } else {
        const rangeDate = new Date();
        rangeDate.setDate(rangeDate.getDate() - (filterRange - 1));

        for (let i = 0; i < filterRange; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateKey = format(d, 'yyyy-MM-dd');
          chartDataMap[dateKey] = 0;
        }

        const { data: logs } = await supabase
          .from('audit_logs')
          .select('created_at')
          .eq('company_id', selectedCompany.id)
          .eq('user_id', user.id)
          .gte('created_at', rangeDate.toISOString());

        logs?.forEach((log: any) => {
          const dateKey = format(parseISO(log.created_at), 'yyyy-MM-dd');
          if (chartDataMap[dateKey] !== undefined) {
            chartDataMap[dateKey]++;
          }
        });
      }

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

  // Fetch when context mounts, company changes, or filter range changes
  useEffect(() => {
    if (selectedCompany && user) {
      const isNewCompany = selectedCompany.id !== lastCompanyIdRef.current;
      const isNewRange = filterRange !== lastRangeRef.current;

      if (isNewCompany || isNewRange) {
        if (isNewCompany) lastCompanyIdRef.current = selectedCompany.id;
        fetchDashboardData(true); // Force fetch on major changes
      } else {
        fetchDashboardData(false); // Use cache if available
      }
    }
  }, [selectedCompany, user, filterRange]);

  return (
    <DashboardContext.Provider value={{
      metrics,
      priorityTasks,
      productivityData,
      upcomingDeadlines,
      completedTasksToday,
      completedParentTasksToday,
      completedSubtasksToday,
      loading,
      filterRange,
      setFilterRange,
      userProfile,
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
