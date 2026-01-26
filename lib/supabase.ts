
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zfkwzbupyvrrthuowchc.supabase.co';
const supabaseAnonKey = 'sb_publishable_wtSso_NL3o6j69XDmfeyvg_Hqs1w2i5';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
