const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
try {
  const envFile = fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2].trim();
    }
  });
} catch (e) {
  console.log('No .env.local found or error reading it');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addPrescriptionField() {
  console.log('Adding prescription column to visits table...');
  
  try {
    const sql = `
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visits' AND column_name='prescription') THEN
          ALTER TABLE public.visits ADD COLUMN prescription TEXT DEFAULT '';
        END IF;
      END $$;
      
      NOTIFY pgrst, 'reload schema';
    `;

    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('Error adding column via RPC:', error.message);
      console.log('\nAlternative: If the above failed, please run this in the Supabase SQL Editor:');
      console.log("ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS prescription TEXT DEFAULT '';");
    } else {
      console.log('Success! The prescription field has been added to the visits table.');
    }
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

addPrescriptionField();
