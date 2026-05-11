import { supabase } from '../supabaseClient';

export const VALIDATION_STATUS = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED'
};

/**
 * Validates the connection and schema integrity of the Supabase backend.
 */
export async function validateEnvironment() {
  const results = {
    connection: false,
    schema: false,
    error: null,
    details: []
  };

  try {
    // 1. Test basic connection by fetching a single row from a known table
    // We use a small limit to minimize data transfer
    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .limit(1);

    if (error) {
      if (error.message.includes('failed to fetch')) {
        throw new Error('Network error: Cannot reach Supabase. Check your internet connection.');
      }
      if (error.code === 'PGRST301' || error.message.includes('JWT')) {
        throw new Error('Authentication error: Invalid Supabase URL or Anon Key. Please run configure_showroom.bat again.');
      }
      throw error;
    }

    results.connection = true;
    results.details.push('Connection to Supabase established.');

    // 2. Verify existence of all required tables
    const requiredTables = ['clients', 'cars', 'services', 'appointments'];
    for (const table of requiredTables) {
      const { error: tableError } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (tableError) {
        throw new Error(`Schema error: Table "${table}" is missing or inaccessible in Supabase.`);
      }
      results.details.push(`Table "${table}" verified.`);
    }

    results.schema = true;
    return { status: VALIDATION_STATUS.SUCCESS, ...results };

  } catch (err) {
    console.error('Environment Validation Failed:', err);
    return { 
      status: VALIDATION_STATUS.FAILED, 
      ...results, 
      error: err.message 
    };
  }
}
