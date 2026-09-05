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

export async function getAppDataByKey(key) {
  const { data, error } = await supabase
    .from("app_data")
    .select("value")
    .eq("key", key)
    .single();
  if (error) throw error;
  return data.value;
}

export async function marcarMiniassuntoEstudado(subtopicoId, miniassuntoNome) {
  const subtopicos = await getAppDataByKey("subtopicos");

  const atualizado = subtopicos.map((s) => {
    if (s.id !== subtopicoId) return s;

    let miniassuntos = s.miniassuntos || [];
    if (miniassuntoNome && miniassuntos.length > 0) {
      miniassuntos = miniassuntos.map((m) =>
        m.nome === miniassuntoNome || m === miniassuntoNome
          ? { ...m, estudado: true }
          : m
      );
    }

    const completo =
      miniassuntos.length > 0 && miniassuntos.every((m) => m.estudado);

    return {
      ...s,
      miniassuntos,
      status: completo ? "completo" : "iniciado",
    };
  });

  const { error } = await supabase
    .from("app_data")
    .update({ value: atualizado })
    .eq("key", "subtopicos");

  if (error) throw error;
}