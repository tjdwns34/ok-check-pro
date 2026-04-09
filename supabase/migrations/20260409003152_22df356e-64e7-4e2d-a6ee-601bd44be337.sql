
CREATE POLICY "Anyone can delete checklist items"
  ON public.checklist_items FOR DELETE
  USING (true);
