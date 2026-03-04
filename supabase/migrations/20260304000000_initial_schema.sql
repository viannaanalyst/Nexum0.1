/*
  # Initial Schema for Nexum Multi-tenant System

  1. New Tables
    - `companies`
      - `id` (uuid, primary key)
      - `name` (text)
      - `cnpj` (text)
      - `email` (text)
      - `whatsapp` (text)
      - `plan` (text: 'basic', 'pro', 'enterprise')
      - `status` (text: 'active', 'inactive')
      - `created_at` (timestamp)
      
    - `profiles` (extends auth.users)
      - `id` (uuid, references auth.users)
      - `full_name` (text)
      - `email` (text)
      - `is_super_admin` (boolean)
      - `created_at` (timestamp)

    - `organization_members`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `user_id` (uuid, references auth.users)
      - `role` (text: 'admin', 'editor', 'visualizador')
      - `is_approver` (boolean)
      - `created_at` (timestamp)

  2. Security (RLS)
    - Enable RLS on all tables
    - Policies for SUPER ADMIN to access everything
    - Policies for Organization Members to access their own company data
*/

-- Create companies table
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text NOT NULL,
  email text,
  whatsapp text,
  plan text NOT NULL DEFAULT 'basic',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Create profiles table (extends auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  is_super_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create organization_members table
CREATE TABLE organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'editor', 'visualizador')),
  is_approver boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_super_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is member of company
CREATE OR REPLACE FUNCTION is_company_member(company_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
    AND company_id = company_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policies for companies
CREATE POLICY "Super Admin can do everything on companies" ON companies
  FOR ALL USING (is_super_admin());

CREATE POLICY "Members can view their own company" ON companies
  FOR SELECT USING (
    is_company_member(id)
  );

-- Policies for organization_members
CREATE POLICY "Super Admin can do everything on members" ON organization_members
  FOR ALL USING (is_super_admin());

CREATE POLICY "Members can view members of their company" ON organization_members
  FOR SELECT USING (
    exists (
      select 1 from organization_members m
      where m.user_id = auth.uid()
      and m.company_id = organization_members.company_id
    )
  );

CREATE POLICY "Company Admins can manage members" ON organization_members
  FOR ALL USING (
    exists (
      select 1 from organization_members m
      where m.user_id = auth.uid()
      and m.company_id = organization_members.company_id
      and m.role = 'admin'
    )
  );
