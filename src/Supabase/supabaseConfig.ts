import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://kfeapfxdeyxdlxsuzyii.supabase.co";
const supabaseKey = "sb_publishable_c81X2ZO9JIhO_pGtIlJORg_ia2zj17n";

export const supabase = createClient(supabaseUrl, supabaseKey);
