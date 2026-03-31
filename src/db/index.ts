import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ccdifvdkjstrybszgqqw.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_TZeJKZa4tZhjGdRakhBTkA_CdZvXS-U';

export const supabase = createClient(supabaseUrl, supabaseKey);

export function initDb() {
  // Supabase tables should be created in the Supabase dashboard.
  console.log('Supabase initialized');
}

export default supabase;

