const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
try {
  const envFile = fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  });
} catch (e) {
  console.log('No .env.local found or error reading it');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const sql = `
      -- 1. Ensure visits table exists with all columns
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
        table_data TEXT DEFAULT '',
        visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_id UUID DEFAULT auth.uid()
      );

      -- 2. Backfill visits: Create a visit record for any patient who doesn't have one
      INSERT INTO public.visits (
        patient_id, diagnosis, treatment, current_treatment, history, 
        past_medical_history, drug_history, past_surgical_history, 
        examination, follow_up_date, note, table_data, visited_at, user_id
      )
      SELECT 
        id, diagnosis, treatment, current_treatment, history, 
        past_medical_history, drug_history, past_surgical_history, 
        examination, follow_up_date, note, table_data, created_at, user_id
      FROM public.patients
      WHERE id NOT IN (SELECT DISTINCT patient_id FROM public.visits);

      -- 3. Reload schema cache
      NOTIFY pgrst, 'reload schema';
    `;
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error('Error executing SQL:', error);
    } else {
      console.log('Migration successful: All patients now have at least one visit record.');
    }
  } catch (err) {
    console.error('Failed to run migration:', err);
  }
}

run();
