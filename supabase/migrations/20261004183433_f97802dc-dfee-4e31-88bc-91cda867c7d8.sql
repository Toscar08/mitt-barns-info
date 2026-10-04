ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS clothing_size text,
  ADD COLUMN IF NOT EXISTS shoe_size text,
  ADD COLUMN IF NOT EXISTS passport_number text,
  ADD COLUMN IF NOT EXISTS passport_expiry date,
  ADD COLUMN IF NOT EXISTS school text,
  ADD COLUMN IF NOT EXISTS school_class text;