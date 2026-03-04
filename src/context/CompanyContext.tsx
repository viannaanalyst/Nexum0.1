import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  whatsapp: string;
  email: string;
  status: 'active' | 'inactive';
  plan: 'basic' | 'pro' | 'enterprise';
}

interface CompanyContextType {
  companies: Company[];
  selectedCompany: Company | null;
  addCompany: (company: Omit<Company, 'id' | 'status'>) => Promise<void>;
  selectCompany: (companyId: string) => void;
  updateCompany: (id: string, data: Partial<Company>) => Promise<void>;
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // Try to recover selected company from localStorage
      const savedCompanyId = localStorage.getItem('selectedCompanyId');
      
      // If we already have companies loaded and one selected, don't refetch to avoid flicker
      if (companies.length > 0 && selectedCompany) {
          setLoading(false);
          return;
      }

      fetchCompanies(savedCompanyId);
    } else {
      setCompanies([]);
      setSelectedCompany(null);
      localStorage.removeItem('selectedCompanyId');
      setLoading(false);
    }
  }, [user]);

  const fetchCompanies = async (savedCompanyId?: string | null) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setCompanies(data as Company[]);
        
        let companyToSelect: Company | undefined;

        // 1. Try to select from localStorage
        if (savedCompanyId) {
            companyToSelect = (data as Company[]).find(c => c.id === savedCompanyId);
        }

        // 2. If no saved company (or invalid), and not super admin, select first available
        if (!companyToSelect && !user?.is_super_admin && data.length > 0) {
            companyToSelect = data[0] as Company;
        }

        // 3. If super admin and no saved company, we don't select any by default (they stay in dashboard)
        // But if they HAD a saved company, we restore it.
        
        if (companyToSelect) {
           setSelectedCompany(companyToSelect);
           localStorage.setItem('selectedCompanyId', companyToSelect.id);
        }
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCompany = async (companyData: Omit<Company, 'id' | 'status'>) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert([
          {
            ...companyData,
            status: 'active',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setCompanies((prev) => [data as Company, ...prev]);
      }
    } catch (error) {
      console.error('Error adding company:', error);
      throw error;
    }
  };

  const selectCompany = (companyId: string) => {
    if (!companyId) {
      setSelectedCompany(null);
      localStorage.removeItem('selectedCompanyId');
      return;
    }
    const company = companies.find((c) => c.id === companyId);
    if (company) {
      setSelectedCompany(company);
      localStorage.setItem('selectedCompanyId', company.id);
    }
  };

  const updateCompany = async (id: string, data: Partial<Company>) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      setCompanies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data } : c))
      );
      if (selectedCompany?.id === id) {
        setSelectedCompany((prev) => (prev ? { ...prev, ...data } : null));
      }
    } catch (error) {
      console.error('Error updating company:', error);
      throw error;
    }
  };

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompany,
        addCompany,
        selectCompany,
        updateCompany,
        loading,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
