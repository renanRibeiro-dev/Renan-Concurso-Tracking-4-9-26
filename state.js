// state.js
// O "motor" do app: estado em memória + regras de negócio. Não desenha nada
// (isso é do app.js) e não fala com o Supabase diretamente (isso é do storage.js).

const EstudoState = (() => {
  let subtopicos = [];   // clone de EDITAL_MECANICA + progresso do usuário
  let questoes = [];     // { id, subtopicoId, miniassuntoId|null, caderno, numero, resultado, data }

  // -------- carregar / salvar --------

  async function init() {
    const persistidos = await Storage.get('subtopicos');
    if (persistidos && persistidos.length) {
      subtopicos = mesclarComEdital(persistidos);
    } else {
      subtopicos = EDITAL_MECANICA.map(s => ({ ...s, registros: [] })); // registros = ids de miniassunto já registrados
    }
    questoes = (await Storage.get('questoes')) || [];
  }

  // Atualiza classificação (quente/pct/categoria/miniassuntos) a partir do data.js sem
  // perder o progresso do usuário (registros), e adiciona subtópicos novos do edital.
  function mesclarComEdital(persistidos) {
    const porId = new Map(persistidos.map(s => [s.id, s]));
    return EDITAL_MECANICA.map(s => {
      const existente = porId.get(s.id);
      if (!existente) return { ...s, registros: [] };
      return {
        ...s,
        registros: existente.registros || [],
        critico: existente.critico || false
      };
    });
  }

  async function salvarSubtopicos() {
    await Storage.set('subtopicos', subtopicos);
  }
  async function salvarQuestoes() {
    await Storage.set('questoes', questoes);
  }

  // -------- consultas de navegação --------

  function subtopicosPorDisciplina(disciplina) {
    const categoria = disciplina === 'PT' ? 'portugues' : disciplina === 'EN' ? 'ingles' : 'especifica';
    return subtopicos.filter(s => s.categoria === categoria);
  }

  // Lista de tópicos (matérias) de uma disciplina que ainda têm algo pendente —
  // um tópico some da navegação quando todos os seus subtópicos estão estudados.
  function topicosPendentes(disciplina) {
    const subs = subtopicosPorDisciplina(disciplina);
    const materias = [...new Set(subs.map(s => s.materia))];
    return materias
      .map(materia => {
        const subsDaMateria = subs.filter(s => s.materia === materia);
        const pendentes = subsDaMateria.filter(s => !subtopicoEstudado(s));
        return {
          materia,
          quente: MATERIA_QUENTE.has(materia.trim()) || subsDaMateria.every(s => s.categoria !== 'especifica'),
          totalSubtopicos: subsDaMateria.length,
          pendentes: pendentes.length
        };
      })
      .filter(t => t.pendentes > 0);
  }

  function subtopicosPendentesDoTopico(materia) {
    return subtopicos.filter(s => s.materia === materia);
  }

  // -------- regra de progresso --------

  // Um subtópico "esmaece" (estudado) quando todos os seus miniassuntos foram registrados.
  // Enquanto a lista de miniassuntos não existir (placeholder vazio), cai no fallback:
  // basta ter pelo menos 1 questão registrada nele.
  function subtopicoEstudado(s) {
    if (s.miniassuntos && s.miniassuntos.length > 0) {
      return s.miniassuntos.every(m => (s.registros || []).includes(m.id));
    }
    return questoes.some(q => q.subtopicoId === s.id);
  }

  function miniassuntoRegistrado(s, miniassuntoId) {
    return (s.registros || []).includes(miniassuntoId);
  }

  // -------- registrar questão --------

  async function registrarQuestao({ subtopicoId, miniassuntoId, caderno, numero, resultado }) {
    const s = subtopicos.find(x => x.id === subtopicoId);
    if (!s) throw new Error('subtópico não encontrado');

    const duplicada = questoes.some(q => q.caderno === caderno && q.numero === numero && q.subtopicoId === subtopicoId);
    if (duplicada) throw new Error('duplicada');

    questoes.push({
      id: crypto.randomUUID(),
      subtopicoId,
      miniassuntoId: miniassuntoId || null,
      caderno: caderno || '',
      numero,
      resultado, // 'certo' | 'errado' | 'pulou'
      data: new Date().toISOString()
    });

    if (miniassuntoId) {
      s.registros = s.registros || [];
      if (!s.registros.includes(miniassuntoId)) s.registros.push(miniassuntoId);
    }

    // 3 erros no mesmo subtópico acende como crítico (mesma regra do app antigo)
    const errosNoSub = questoes.filter(q => q.subtopicoId === subtopicoId && q.resultado === 'errado').length;
    if (errosNoSub >= 3) s.critico = true;

    await salvarSubtopicos();
    await salvarQuestoes();
  }

  // -------- estatísticas --------

  function questoesDoSubtopico(subtopicoId) {
    return questoes.filter(q => q.subtopicoId === subtopicoId);
  }

  function pctAcerto(subtopicoId) {
    const qs = questoesDoSubtopico(subtopicoId).filter(q => q.resultado !== 'pulou');
    if (qs.length === 0) return null;
    const certos = qs.filter(q => q.resultado === 'certo').length;
    return Math.round((certos / qs.length) * 100);
  }

  function tendencia(subtopicoId) {
    const qs = questoesDoSubtopico(subtopicoId)
      .filter(q => q.resultado !== 'pulou')
      .sort((a, b) => new Date(b.data) - new Date(a.data))
      .slice(0, 3);
    if (qs.length < 2) return null;
    const certos = qs.filter(q => q.resultado === 'certo').length;
    if (certos === qs.length) return 'subindo';
    if (certos === 0) return 'descendo';
    return 'estavel';
  }

  function ultimasQuestoes(subtopicoId, n) {
    return questoesDoSubtopico(subtopicoId)
      .sort((a, b) => new Date(b.data) - new Date(a.data))
      .slice(0, n || 10);
  }

  return {
    init,
    get subtopicos() { return subtopicos; },
    get questoes() { return questoes; },
    subtopicosPorDisciplina,
    topicosPendentes,
    subtopicosPendentesDoTopico,
    subtopicoEstudado,
    miniassuntoRegistrado,
    registrarQuestao,
    questoesDoSubtopico,
    pctAcerto,
    tendencia,
    ultimasQuestoes
  };
})();
// state.js
// O "motor" do app: estado em memória + regras de negócio. Não desenha nada
// (isso é do app.js) e não fala com o Supabase diretamente (isso é do storage.js).

const EstudoState = (() => {
  let subtopicos = [];   // clone de EDITAL_MECANICA + progresso do usuário
  let questoes = [];     // { id, subtopicoId, miniassuntoId|null, caderno, numero, resultado, data }

  // -------- carregar / salvar --------

  async function init() {
    const persistidos = await Storage.get('subtopicos');
    if (persistidos && persistidos.length) {
      subtopicos = mesclarComEdital(persistidos);
    } else {
      subtopicos = EDITAL_MECANICA.map(s => ({ ...s, registros: [] })); // registros = ids de miniassunto já registrados
    }
    questoes = (await Storage.get('questoes')) || [];
  }

  // Atualiza classificação (quente/pct/categoria/miniassuntos) a partir do data.js sem
  // perder o progresso do usuário (registros), e adiciona subtópicos novos do edital.
  function mesclarComEdital(persistidos) {
    const porId = new Map(persistidos.map(s => [s.id, s]));
    return EDITAL_MECANICA.map(s => {
      const existente = porId.get(s.id);
      if (!existente) return { ...s, registros: [] };
      return {
        ...s,
        registros: existente.registros || [],
        critico: existente.critico || false
      };
    });
  }

  async function salvarSubtopicos() {
    await Storage.set('subtopicos', subtopicos);
  }
  async function salvarQuestoes() {
    await Storage.set('questoes', questoes);
  }

  // -------- consultas de navegação --------

  function subtopicosPorDisciplina(disciplina) {
    const categoria = disciplina === 'PT' ? 'portugues' : disciplina === 'EN' ? 'ingles' : 'especifica';
    return subtopicos.filter(s => s.categoria === categoria);
  }

  // Lista de tópicos (matérias) de uma disciplina que ainda têm algo pendente —
  // um tópico some da navegação quando todos os seus subtópicos estão estudados.
  function topicosPendentes(disciplina) {
    const subs = subtopicosPorDisciplina(disciplina);
    const materias = [...new Set(subs.map(s => s.materia))];
    return materias
      .map(materia => {
        const subsDaMateria = subs.filter(s => s.materia === materia);
        const pendentes = subsDaMateria.filter(s => !subtopicoEstudado(s));
        return {
          materia,
          quente: MATERIA_QUENTE.has(materia.trim()) || subsDaMateria.every(s => s.categoria !== 'especifica'),
          totalSubtopicos: subsDaMateria.length,
          pendentes: pendentes.length
        };
      })
      .filter(t => t.pendentes > 0);
  }

  function subtopicosPendentesDoTopico(materia) {
    return subtopicos.filter(s => s.materia === materia);
  }

  // -------- regra de progresso --------

  // Um subtópico "esmaece" (estudado) quando todos os seus miniassuntos foram registrados.
  // Enquanto a lista de miniassuntos não existir (placeholder vazio), cai no fallback:
  // basta ter pelo menos 1 questão registrada nele.
  function subtopicoEstudado(s) {
    if (s.miniassuntos && s.miniassuntos.length > 0) {
      return s.miniassuntos.every(m => (s.registros || []).includes(m.id));
    }
    return questoes.some(q => q.subtopicoId === s.id);
  }

  function miniassuntoRegistrado(s, miniassuntoId) {
    return (s.registros || []).includes(miniassuntoId);
  }

  // -------- registrar questão --------

  async function registrarQuestao({ subtopicoId, miniassuntoId, caderno, numero, resultado }) {
    const s = subtopicos.find(x => x.id === subtopicoId);
    if (!s) throw new Error('subtópico não encontrado');

    const duplicada = questoes.some(q => q.caderno === caderno && q.numero === numero && q.subtopicoId === subtopicoId);
    if (duplicada) throw new Error('duplicada');

    questoes.push({
      id: crypto.randomUUID(),
      subtopicoId,
      miniassuntoId: miniassuntoId || null,
      caderno: caderno || '',
      numero,
      resultado, // 'certo' | 'errado' | 'pulou'
      data: new Date().toISOString()
    });

    if (miniassuntoId) {
      s.registros = s.registros || [];
      if (!s.registros.includes(miniassuntoId)) s.registros.push(miniassuntoId);
    }

    // 3 erros no mesmo subtópico acende como crítico (mesma regra do app antigo)
    const errosNoSub = questoes.filter(q => q.subtopicoId === subtopicoId && q.resultado === 'errado').length;
    if (errosNoSub >= 3) s.critico = true;

    await salvarSubtopicos();
    await salvarQuestoes();
  }

  // -------- estatísticas --------

  function questoesDoSubtopico(subtopicoId) {
    return questoes.filter(q => q.subtopicoId === subtopicoId);
  }

  function pctAcerto(subtopicoId) {
    const qs = questoesDoSubtopico(subtopicoId).filter(q => q.resultado !== 'pulou');
    if (qs.length === 0) return null;
    const certos = qs.filter(q => q.resultado === 'certo').length;
    return Math.round((certos / qs.length) * 100);
  }

  function tendencia(subtopicoId) {
    const qs = questoesDoSubtopico(subtopicoId)
      .filter(q => q.resultado !== 'pulou')
      .sort((a, b) => new Date(b.data) - new Date(a.data))
      .slice(0, 3);
    if (qs.length < 2) return null;
    const certos = qs.filter(q => q.resultado === 'certo').length;
    if (certos === qs.length) return 'subindo';
    if (certos === 0) return 'descendo';
    return 'estavel';
  }

  function ultimasQuestoes(subtopicoId, n) {
    return questoesDoSubtopico(subtopicoId)
      .sort((a, b) => new Date(b.data) - new Date(a.data))
      .slice(0, n || 10);
  }

  return {
    init,
    get subtopicos() { return subtopicos; },
    get questoes() { return questoes; },
    subtopicosPorDisciplina,
    topicosPendentes,
    subtopicosPendentesDoTopico,
    subtopicoEstudado,
    miniassuntoRegistrado,
    registrarQuestao,
    questoesDoSubtopico,
    pctAcerto,
    tendencia,
    ultimasQuestoes
  };
})();
