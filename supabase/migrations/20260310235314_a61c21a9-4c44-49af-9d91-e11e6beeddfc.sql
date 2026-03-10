
INSERT INTO public.profiles (id, email, full_name, hierarchy, active, must_change_password)
VALUES 
  ('621104e0-0158-4529-a43b-69d9a30b0098', 'devbluetech07@gmail.com', 'Dev Bluetech', 'owner', true, false),
  ('b79136c5-66c4-46a8-9de7-a7629532e008', 'demo@empresa.com', 'Demo User', 'user', true, false)
ON CONFLICT (id) DO UPDATE SET 
  full_name = EXCLUDED.full_name,
  hierarchy = EXCLUDED.hierarchy,
  active = EXCLUDED.active;
