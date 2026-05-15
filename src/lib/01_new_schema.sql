-- New Schema for Patient Management System

-- Drop old tables if necessary (assuming development mode, careful in production)
-- DROP TABLE IF EXISTS public.visits CASCADE;
-- DROP TABLE IF EXISTS public.patients CASCADE;

-- 1. Patients Table (Static Info)
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  dob TEXT DEFAULT '',
  hospital_file_number TEXT DEFAULT '',
  mobile_number TEXT DEFAULT '',
  sex TEXT DEFAULT '',
  clinic_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

-- 2. Visits Table (Visit-Based Info)
CREATE TABLE IF NOT EXISTS public.visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  diagnosis TEXT DEFAULT '',
  treatment TEXT DEFAULT '',
  current_treatment TEXT DEFAULT '',
  history TEXT DEFAULT '',
  past_medical_history TEXT DEFAULT '',
  drug_history TEXT DEFAULT '',
  past_surgical_history TEXT DEFAULT '',
  examination TEXT DEFAULT '',
  follow_up_date TEXT DEFAULT '',
  note TEXT DEFAULT '',
  prescription TEXT DEFAULT '',
  table_data TEXT DEFAULT '',
  visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- Note: In a real migration, we would copy data from patients to visits here.
-- Assuming we are okay with a fresh start or we can write a migration block.

DO $$ 
BEGIN
    -- Optional: If you want to migrate existing patient medical data to their first visit:
    -- INSERT INTO public.visits (patient_id, diagnosis, treatment, current_treatment, history, past_medical_history, drug_history, past_surgical_history, follow_up_date, note, table_data, visited_at, user_id)
    -- SELECT id, diagnosis, treatment, current_treatment, history, past_medical_history, drug_history, past_surgical_history, follow_up_date, note, table_data, created_at, user_id
    -- FROM public.patients
    -- WHERE id NOT IN (SELECT patient_id FROM public.visits);

    -- Then we can drop the old columns from patients, but let's keep them for backward compatibility during transition or drop them carefully later.
END $$;

NOTIFY pgrst, 'reload schema';
