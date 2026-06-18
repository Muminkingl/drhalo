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

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const sql = `
      ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT '';
      ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS age TEXT DEFAULT '';
      ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS converted BOOLEAN DEFAULT FALSE;
      ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS converted_patient_id UUID;
      
      -- Reload schema cache
      NOTIFY pgrst, 'reload schema';
    `;
    console.log('Executing migration on Supabase...');
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error('Error executing SQL:', error);
      process.exit(1);
    } else {
      console.log('Migration successful: columns added to public.appointments table.');
      process.exit(0);
    }
  } catch (err) {
    console.error('Failed to run migration:', err);
    process.exit(1);
  }
}

run();
