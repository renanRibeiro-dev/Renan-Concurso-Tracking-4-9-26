import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Faz login com e-mail e senha.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

/**
 * Encerra a sessão do usuário atual.
 * @returns {Promise<{ error: any }>}
 */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  return { error };
}
//iiiiiii
/**
 * Retorna a sessão atual (ou null se não houver usuário logado).
 * @returns {Promise<{ session: any, error: any }>}
 */
export async function getSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  return { session, error };
}

export async function salvarQuestao({ subtopico_id, caderno, numero, resultado }) {
  const { data, error } = await supabase
    .from("questoes_v2")
    .insert([{ subtopico_id, caderno, numero, resultado }]);
  if (error) throw error;
  return data;
}

export async function getAppData(tabela) {
  const { data, error } = await supabase.from(tabela).select("*");
  if (error) throw error;
  return data;
}