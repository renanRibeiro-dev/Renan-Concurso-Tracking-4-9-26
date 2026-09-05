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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("questoes_v2")
    .insert([{ subtopico_id, caderno, numero, resultado, user_id: user.id }]);
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
  return typeof data.value === "string" ? JSON.parse(data.value) : data.value;
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

// ---------------- reteste ----------------

/**
 * Busca as questões pendentes de reteste: resultado 'errado' ou 'pulou'
 * que ainda não atingiram retest_ok = true.
 * @returns {Promise<Array>}
 */
export async function getQuestoesParaReteste() {
  const { data, error } = await supabase
    .from("questoes_v2")
    .select("*")
    .in("resultado", ["errado", "pulou"])
    .or("retest_ok.is.null,retest_ok.eq.false")
    .order("data", { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Registra uma tentativa de reteste na MESMA linha da questão original.
 * 'certo' incrementa r_seq_acertos (2 seguidos = retest_ok true).
 * 'errado' zera r_seq_acertos e incrementa r_erros_total.
 * 'pulou' não deve chamar esta função (tratar só na UI, sem gravar).
 *
 * @param {string|number} questaoId
 * @param {'certo'|'errado'} resultadoTentativa
 * @param {{ r_seq_acertos?: number, r_erros_total?: number }} atual valores atuais da linha
 * @returns {Promise<{ r_seq_acertos: number, r_erros_total: number, retest_ok: boolean }>}
 */
export async function registrarTentativaReteste(questaoId, resultadoTentativa, atual = {}) {
  let r_seq_acertos = atual.r_seq_acertos || 0;
  let r_erros_total = atual.r_erros_total || 0;
  let retest_ok = false;

  if (resultadoTentativa === "certo") {
    r_seq_acertos += 1;
    retest_ok = r_seq_acertos >= 2;
  } else if (resultadoTentativa === "errado") {
    r_seq_acertos = 0;
    r_erros_total += 1;
  }

  const { error } = await supabase
    .from("questoes_v2")
    .update({ r_seq_acertos, r_erros_total, retest_ok })
    .eq("id", questaoId);

  if (error) throw error;
  return { r_seq_acertos, r_erros_total, retest_ok };
}
