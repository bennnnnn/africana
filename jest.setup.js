/* eslint-disable no-undef */
global.__DEV__ = false;

process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY || 'sb_publishable_test_key_for_jest';
