
-- Departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  hierarchy TEXT NOT NULL DEFAULT 'user' CHECK (hierarchy IN ('owner', 'gestor', 'user')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User permissions table (granular)
CREATE TABLE public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Helper function to get user hierarchy
CREATE OR REPLACE FUNCTION public.get_user_hierarchy(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hierarchy FROM public.profiles WHERE id = p_user_id;
$$;

-- Helper function to check permission
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT granted FROM public.user_permissions WHERE user_id = p_user_id AND permission = p_permission),
    -- Defaults: owners/gestors get all, users get basic
    (SELECT CASE
      WHEN hierarchy IN ('owner', 'gestor') THEN true
      ELSE p_permission IN ('documents:read', 'contacts:read', 'templates:read')
    END FROM public.profiles WHERE id = p_user_id)
  );
$$;

-- RLS Policies for departments
CREATE POLICY "Owners and gestors can manage departments"
ON public.departments FOR ALL
USING (public.get_user_hierarchy(auth.uid()) IN ('owner', 'gestor'))
WITH CHECK (public.get_user_hierarchy(auth.uid()) IN ('owner', 'gestor'));

CREATE POLICY "All users can view departments"
ON public.departments FOR SELECT
USING (true);

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles in their org"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Owners and gestors can update any profile"
ON public.profiles FOR UPDATE
USING (public.get_user_hierarchy(auth.uid()) IN ('owner', 'gestor'));

CREATE POLICY "Owners and gestors can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (public.get_user_hierarchy(auth.uid()) IN ('owner', 'gestor') OR id = auth.uid());

-- RLS Policies for user_permissions
CREATE POLICY "Users can view their own permissions"
ON public.user_permissions FOR SELECT
USING (user_id = auth.uid() OR public.get_user_hierarchy(auth.uid()) IN ('owner', 'gestor'));

CREATE POLICY "Owners and gestors can manage permissions"
ON public.user_permissions FOR ALL
USING (public.get_user_hierarchy(auth.uid()) IN ('owner', 'gestor'))
WITH CHECK (public.get_user_hierarchy(auth.uid()) IN ('owner', 'gestor'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, hierarchy)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE WHEN NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1) THEN 'owner' ELSE 'user' END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
