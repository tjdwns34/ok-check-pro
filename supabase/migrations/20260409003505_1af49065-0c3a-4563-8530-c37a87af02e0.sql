
-- Add user_id column
ALTER TABLE public.checklist_items ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Remove old data without user_id
DELETE FROM public.checklist_items WHERE user_id IS NULL;

-- Make user_id NOT NULL
ALTER TABLE public.checklist_items ALTER COLUMN user_id SET NOT NULL;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Anyone can view checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Anyone can update checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Anyone can insert checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Anyone can delete checklist items" ON public.checklist_items;

-- Create user-scoped policies
CREATE POLICY "Users can view their own items"
  ON public.checklist_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own items"
  ON public.checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own items"
  ON public.checklist_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own items"
  ON public.checklist_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to seed default items for new users
CREATE OR REPLACE FUNCTION public.seed_checklist_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.checklist_items (user_id, title, category) VALUES
    (NEW.id, '고객정보 접근권한 확인', '월간 점검'),
    (NEW.id, '비밀번호 변경 여부', '월간 점검'),
    (NEW.id, '문서 보관 상태', '월간 점검'),
    (NEW.id, '시스템 로그 점검', '분기 점검'),
    (NEW.id, '외부감사 자료 준비', '분기 점검'),
    (NEW.id, '규정 변경사항 반영', '분기 점검');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on new user signup
CREATE TRIGGER on_auth_user_created_seed_checklist
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_checklist_for_new_user();
