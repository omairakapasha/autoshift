import { createClient } from '@supabase/supabase-js';

// Helper to ensure env is loaded in Electron renderer
const getEnv = (key, fallback) => {
  if (typeof window !== 'undefined' && window.process && window.process.env && window.process.env[key]) {
    return window.process.env[key];
  }
  return process.env[key] || fallback;
};

const supabaseUrl = getEnv('REACT_APP_SUPABASE_URL', 'https://oskbtjmtijsfsknuszxp.supabase.co');
const supabaseKey = getEnv('REACT_APP_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_2xVMdj4XabcNyLhnYLWv1w_2pt0v60m');

export const supabase = createClient(supabaseUrl, supabaseKey);