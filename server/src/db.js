import { supabase } from './supabase.js';

export function usersConfigured() {
  return !!supabase;
}

export async function findUserByEmail(email) {
  const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findUserByUsername(username) {
  const { data, error } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findUserById(id) {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertUser({ email, username, passwordHash }) {
  const { data, error } = await supabase
    .from('users')
    .insert({ email, username, password_hash: passwordHash })
    .select()
    .single();
  if (error) throw error;
  return data;
}
