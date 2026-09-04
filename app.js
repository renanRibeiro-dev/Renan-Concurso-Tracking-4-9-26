// app.js
// Telas e interação: navegação disciplina → tópico → subtópico → miniassunto,
// botão "+", tela de estudo em andamento, formulário de registro e o painel de métricas.
// Toda regra de negócio mora em state.js; aqui só chamamos e desenhamos o resultado.

let disciplinaAtual = 'Esp';
let topicoAtual = null;   // nome da matéria selecionada na tela Estudar
let estudoAtual = null;   // { subtopicoId, miniassuntoId } em andamento

// ---------------- boot / login ----------------

async function boot() {
  if (!Storage.configured()) {
    document.getElementById('loginConfigNote').textContent =
      'Preencha SUPABASE_CONFIG (url/anon) em storage.js pra habilitar o login.';
  }
  const logado = await Storage.hasSession();
  if (logado) {
    mostrarApp();
  } else {
    document.getElementById('loginOverlay').style.display = 'flex';
  }
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const err = document.getElementById('loginErr');
  err.textContent = '';
  if (!Storage.configured()) { err.textContent = 'preencha SUPABASE_CONFIG em storage.js'; return; }
  if (!email || !pass) { err.textContent = 'preencha email e senha'; return; }
  try {
    await Storage.login(email, pass);
    mostrarApp();
  } catch (e) {
    err.textContent = 'email ou senha inválidos';
  }
});

async function mostrarApp() {
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('appContent').style.display = 'block';
  await EstudoState.init();
  renderTopicos();
  renderMetricas();
}

// ---------------- tabs principais ----------------

document.querySelectorAll('.tab[data-view]').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab[data-view]').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('v-' + t.dataset.view).classList.add('active');
    if (t.dataset.view === 'metricas') renderMetricas();
  });
});

document.querySelectorAll('.tab[data-disc]').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab[data-disc]').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    disciplinaAtual = t.dataset.disc;
    topicoAtual = null;
    renderTopicos();
  });
});

// ---------------- tela Estudar: tópicos ----------------

function renderTopicos() {
  const div = document.getElementById('listaTopicos');
  const topicos = EstudoState.topicosPendentes(disciplinaAtual);
  document.getElementById('detalheTopico').innerHTML = '';
  topicoAtual = null;

  if (topicos.length === 0) {
    div.innerHTML = '<div class="empty">Tudo estudado nessa disciplina 🎉</div>';
    return;
  }
  div.innerHTML = '<div class="grid-topicos">' + topicos.map(t => `
    <div class="card-topico ${t.quente ? 'quente' : 'frio'}" data-materia="${escapeAttr(t.materia)}">
      <div class="nome">${t.materia}</div>
      <div class="conta">${t.pendentes}/${t.totalSubtopicos} pendente${t.pendentes > 1 ? 's' : ''}</div>
    </div>`).join('') + '</div>';

  div.querySelectorAll('.card-topico').forEach(el => {
    el.addEventListener('click', () => {
      topicoAtual = el.dataset.materia;
      renderDetalheTopico();
    });
  });
}

function renderDetalheTopico() {
  const div = document.getElementById('detalheTopico');
  if (!topicoAtual) { div.innerHTML = ''; return; }

  const subs = EstudoState.subtopicosPendentesDoTopico(topicoAtual);
  div.innerHTML = `
    <button class="btn-voltar" id="voltarTopicos">← voltar aos tópicos</button>
    <h2 style="margin-top:12px;">${topicoAtual}</h2>
    <div class="lista-subtopicos" id="listaSubs"></div>`;

  document.getElementById('voltarTopicos').addEventListener('click', () => {
    topicoAtual = null;
    div.innerHTML = '';
  });

  const listaSubs = document.getElementById('listaSubs');
  listaSubs.innerHTML = subs.map(s => {
    const estudado = EstudoState.subtopicoEstudado(s);
    const pct = EstudoState.pctAcerto(s.id);
    return `<div class="item-subtopico ${s.quente ? 'quente' : 'frio'} ${estudado ? 'estudado' : ''}" data-id="${s.id}">
      <div class="nome">${s.critico ? '⚠️ ' : ''}${s.subtopico}</div>
      <div class="pct">${pct === null ? '—' : pct + '%'}</div>
    </div>`;
  }).join('');

  listaSubs.querySelectorAll('.item-subtopico').forEach(el => {
    el.addEventListener('click', () => {
      const s = subs.find(x => x.id === el.dataset.id);
      selecionarSubtopicoParaEstudo(s);
    });
  });
}

function escapeAttr(s) { return s.replace(/"/g, '&quot;'); }

// ---------------- seleção de estudo + barra "em andamento" ----------------

function selecionarSubtopicoParaEstudo(s) {
  if (s.miniassuntos && s.miniassuntos.length > 0) {
    abrirEscolhaMiniassunto(s);
  } else {
    iniciarEstudo(s, null);
  }
}

function iniciarEstudo(subtopico, miniassuntoId) {
  estudoAtual = { subtopicoId: subtopico.id, miniassuntoId: miniassuntoId || null };
  atualizarBarraEstudo();
  fecharModalEscolha();
  abrirFormularioRegistro();
}

function atualizarBarraEstudo() {
  const bar = document.getElementById('estudoAndamento');
  if (!estudoAtual) { bar.classList.remove('show'); return; }
  const s = EstudoState.subtopicos.find(x => x.id === estudoAtual.subtopicoId);
  if (!s) { bar.classList.remove('show'); return; }
  document.getElementById('eaMateria').textContent = s.materia;
  document.getElementById('eaSubtopico').textContent = s.subtopico;

  const qs = EstudoState.questoesDoSubtopico(s.id);
  const certos = qs.filter(q => q.resultado === 'certo').length;
  const errados = qs.filter(q => q.resultado === 'errado').length;
  const pulados = qs.filter(q => q.resultado === 'pulou').length;
  const barra = document.getElementById('eaBarra');
  barra.innerHTML = qs.length === 0 ? '' : [
    certos > 0 ? `<div style="flex:${certos}; background:var(--green);"></div>` : '',
    errados > 0 ? `<div style="flex:${errados}; background:var(--quente);"></div>` : '',
    pulados > 0 ? `<div style="flex:${pulados}; background:var(--frio);"></div>` : ''
  ].join('');
  bar.classList.add('show');
}

document.getElementById('eaFechar').addEventListener('click', () => {
  estudoAtual = null;
  atualizarBarraEstudo();
});
document.getElementById('estudoAndamento').addEventListener('click', (e) => {
  if (e.target.id === 'eaFechar') return;
  abrirFormularioRegistro();
});

// ---------------- botão + : assistente de escolha ----------------

document.getElementById('fabBtn').addEventListener('click', abrirEscolhaDisciplina);
document.getElementById('modalFechar').addEventListener('click', fecharModalEscolha);
document.getElementById('modalEscolha').addEventListener('click', (e) => {
  if (e.target.id === 'modalEscolha') fecharModalEscolha();
});

function fecharModalEscolha() {
  document.getElementById('modalEscolha').classList.remove('show');
  document.getElementById('modalVoltar').style.display = 'none';
}

function abrirEscolhaDisciplina() {
  document.getElementById('modalTitulo').textContent = 'Escolha a disciplina';
  document.getElementById('modalSubtitulo').textContent = '';
  document.getElementById('modalVoltar').style.display = 'none';
  const corpo = document.getElementById('modalCorpo');
  corpo.innerHTML = `<div class="grid-escolha">
    <div class="opcao-escolha frio" data-disc="Esp">Específica</div>
    <div class="opcao-escolha frio" data-disc="PT">Português</div>
    <div class="opcao-escolha frio" data-disc="EN">Inglês</div>
  </div>`;
  corpo.querySelectorAll('.opcao-escolha').forEach(el => {
    el.addEventListener('click', () => abrirEscolhaTopico(el.dataset.disc));
  });
  document.getElementById('modalEscolha').classList.add('show');
}

function abrirEscolhaTopico(disciplina) {
  document.getElementById('modalTitulo').textContent = 'Escolha um tópico';
  document.getElementById('modalVoltar').style.display = 'inline-block';
  document.getElementById('modalVoltar').onclick = abrirEscolhaDisciplina;
  const topicos = EstudoState.topicosPendentes(disciplina);
  const corpo = document.getElementById('modalCorpo');
  if (topicos.length === 0) {
    corpo.innerHTML = '<div class="empty">Tudo estudado aqui 🎉</div>';
    return;
  }
  corpo.innerHTML = '<div class="grid-escolha">' + topicos.map(t =>
    `<div class="opcao-escolha ${t.quente ? 'quente' : 'frio'}" data-materia="${escapeAttr(t.materia)}">${t.materia}</div>`
  ).join('') + '</div>';
  corpo.querySelectorAll('.opcao-escolha').forEach(el => {
    el.addEventListener('click', () => abrirEscolhaSubtopico(el.dataset.materia, disciplina));
  });
}

function abrirEscolhaSubtopico(materia, disciplina) {
  document.getElementById('modalTitulo').textContent = 'Escolha um subtópico';
  document.getElementById('modalVoltar').onclick = () => abrirEscolhaTopico(disciplina);
  const subs = EstudoState.subtopicosPendentesDoTopico(materia).filter(s => !EstudoState.subtopicoEstudado(s));
  const corpo = document.getElementById('modalCorpo');
  if (subs.length === 0) {
    corpo.innerHTML = '<div class="empty">Tópico concluído 🎉</div>';
    return;
  }
  corpo.innerHTML = '<div class="grid-escolha">' + subs.map(s =>
    `<div class="opcao-escolha ${s.quente ? 'quente' : 'frio'}" data-id="${s.id}">${s.subtopico}</div>`
  ).join('') + '</div>';
  corpo.querySelectorAll('.opcao-escolha').forEach(el => {
    el.addEventListener('click', () => {
      const s = subs.find(x => x.id === el.dataset.id);
      if (s.miniassuntos && s.miniassuntos.length > 0) abrirEscolhaMiniassunto(s);
      else iniciarEstudo(s, null);
    });
  });
}

function abrirEscolhaMiniassunto(s) {
  document.getElementById('modalTitulo').textContent = 'Escolha um miniassunto';
  document.getElementById('modalVoltar').style.display = 'inline-block';
  document.getElementById('modalVoltar').onclick = () => abrirEscolhaSubtopico(s.materia, disciplinaDaCategoria(s.categoria));
  const pendentes = s.miniassuntos.filter(m => !EstudoState.miniassuntoRegistrado(s, m.id));
  const corpo = document.getElementById('modalCorpo');
  corpo.innerHTML = '<div class="grid-escolha">' + pendentes.map(m =>
    `<div class="opcao-escolha frio" data-mid="${m.id}">${m.nome}</div>`
  ).join('') + '</div>';
  corpo.querySelectorAll('.opcao-escolha').forEach(el => {
    el.addEventListener('click', () => iniciarEstudo(s, el.dataset.mid));
  });
  document.getElementById('modalEscolha').classList.add('show');
}

// ---------------- formulário de registro (com highlight amarelo caminhando) ----------------

function abrirFormularioRegistro() {
  const s = EstudoState.subtopicos.find(x => x.id === estudoAtual.subtopicoId);
  document.getElementById('modalTitulo').textContent = 'Registrar questão';
  document.getElementById('modalSubtitulo').textContent = s.materia + ' — ' + s.subtopico;
  document.getElementById('modalVoltar').style.display = 'none';

  const corpo = document.getElementById('modalCorpo');
  corpo.innerHTML = `
    <div class="form-registro">
      <div class="campo-registro" data-campo="caderno">
        <label>Caderno — link (opcional)</label>
        <input type="text" id="fCaderno" placeholder="link do caderno">
      </div>
      <div class="campo-registro" data-campo="numero">
        <label>Nº da questão</label>
        <input type="text" id="fNumero" placeholder="nº">
      </div>
      <div>
        <label style="display:block; font-size:12px; color:var(--text-dim); margin-bottom:6px;">Resultado</label>
        <div class="result-btns">
          <button class="certo" data-r="certo">certo</button>
          <button class="errado" data-r="errado">errado</button>
          <button class="pulou" data-r="pulou">pulou</button>
        </div>
      </div>
      <div id="fMsgErro" style="color:var(--red); font-size:12px; min-height:14px;"></div>
    </div>`;

  document.getElementById('modalEscolha').classList.add('show');
  configurarHighlightForm();

  corpo.querySelectorAll('.result-btns button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const caderno = document.getElementById('fCaderno').value.trim();
      const numero = document.getElementById('fNumero').value.trim();
      const msg = document.getElementById('fMsgErro');
      if (!numero) { msg.textContent = 'informe o número da questão.'; return; }
      try {
        await EstudoState.registrarQuestao({
          subtopicoId: estudoAtual.subtopicoId,
          miniassuntoId: estudoAtual.miniassuntoId,
          caderno, numero, resultado: btn.dataset.r
        });
      } catch (e) {
        msg.textContent = e.message === 'duplicada' ? 'essa questão já foi cadastrada.' : 'erro ao salvar.';
        return;
      }
      fecharModalEscolha();
      atualizarBarraEstudo();
      renderTopicos();
      if (topicoAtual) renderDetalheTopico();
      renderMetricas();
    });
  });
}

// A borda amarela começa no primeiro campo vazio; ao preencher, o campo fica
// totalmente amarelo e o destaque avança pro próximo campo vazio.
function configurarHighlightForm() {
  const campos = [...document.querySelectorAll('.campo-registro')];
  function atualizar() {
    let ativoDefinido = false;
    campos.forEach(c => {
      const input = c.querySelector('input, select');
      const preenchido = input.value.trim().length > 0;
      c.classList.toggle('preenchido', preenchido);
      c.classList.remove('ativo');
      if (!preenchido && !ativoDefinido) {
        c.classList.add('ativo');
        ativoDefinido = true;
      }
    });
  }
  campos.forEach(c => {
    c.querySelector('input, select').addEventListener('input', atualizar);
  });
  atualizar();
  const primeiro = campos[0] && campos[0].querySelector('input, select');
  if (primeiro) primeiro.focus();
}

// ---------------- métricas ----------------

function renderMetricas() {
  const div = document.getElementById('conteudoMetricas');
  if (EstudoState.questoes.length === 0) {
    div.innerHTML = '<div class="empty">Nenhuma questão registrada ainda.</div>';
    return;
  }
  const materias = [...new Set(EstudoState.subtopicos.map(s => s.materia))];
  div.innerHTML = materias.map(materia => {
    const subs = EstudoState.subtopicos.filter(s => s.materia === materia);
    const qs = subs.flatMap(s => EstudoState.questoesDoSubtopico(s.id));
    if (qs.length === 0) return '';
    const certos = qs.filter(q => q.resultado === 'certo').length;
    const errados = qs.filter(q => q.resultado === 'errado').length;
    const pulados = qs.filter(q => q.resultado === 'pulou').length;
    const pct = Math.round((certos / qs.length) * 100);
    return `<div class="metr-mat" data-materia="${escapeAttr(materia)}">
      <div class="head">
        <div class="nome">${materia}</div>
        <div style="color:var(--text-dim); font-size:12px;">${qs.length}q</div>
        <div class="pct">${pct}%</div>
      </div>
      <div class="barra">
        ${certos > 0 ? `<div style="flex:${certos}; background:var(--green);"></div>` : ''}
        ${errados > 0 ? `<div style="flex:${errados}; background:var(--quente);"></div>` : ''}
        ${pulados > 0 ? `<div style="flex:${pulados}; background:var(--frio);"></div>` : ''}
      </div>
    </div>`;
  }).join('');

  div.querySelectorAll('.metr-mat').forEach(el => {
    el.addEventListener('click', () => abrirHistoricoMateria(el.dataset.materia));
  });
}

function abrirHistoricoMateria(materia) {
  const subs = EstudoState.subtopicos.filter(s => s.materia === materia);
  const box = document.getElementById('modalHistoricoBox');
  box.innerHTML = `<div class="titulo">${materia}</div>` + subs.map(s => {
    const pct = EstudoState.pctAcerto(s.id);
    if (pct === null) return '';
    const hist = EstudoState.ultimasQuestoes(s.id, 10);
    const icones = hist.map(q => {
      const cor = q.resultado === 'certo' ? 'var(--green)' : q.resultado === 'errado' ? 'var(--red)' : 'var(--quente)';
      const ic = q.resultado === 'certo' ? '✓' : q.resultado === 'errado' ? '✗' : '→';
      return `<span style="color:${cor}; font-weight:700; margin-right:6px;">${ic}</span>`;
    }).join('');
    return `<div style="margin-top:14px; padding-top:10px; border-top:1px solid var(--border);">
      <div style="font-size:13px; font-weight:700;">${s.subtopico} <span style="color:var(--text-dim); font-weight:400;">${pct}%</span></div>
      <div style="margin-top:6px;">${icones}</div>
    </div>`;
  }).join('') + `<button class="btn-voltar" id="fecharHistorico">fechar</button>`;
  document.getElementById('fecharHistorico').addEventListener('click', () => {
    document.getElementById('modalHistorico').classList.remove('show');
  });
  document.getElementById('modalHistorico').classList.add('show');
}
document.getElementById('modalHistorico').addEventListener('click', (e) => {
  if (e.target.id === 'modalHistorico') e.currentTarget.classList.remove('show');
});

boot();
// data.js
// Dados estáticos do edital: matérias, subtópicos, classificação quente/frio,
// agrupamento em campos temáticos. Nenhuma lógica de estado ou UI aqui.

// Cada subtópico já sai com "id" (estável, usado em toda a app) e "miniassuntos": []
// (placeholder — a lista real de miniassuntos ainda será levantada; até lá, o app
// trata um subtópico sem miniassuntos cadastrados como completo assim que tiver
// pelo menos 1 questão registrada nele — ver EstudoState.subtopicoEstudado em state.js).
const EDITAL_MECANICA = [
  {
    "materia": "Português",
    "subtopico": "Compreensão de textos",
    "quente": true,
    "pct": 100.0,
    "categoria": "portugues",
    "ordem": 0,
    "id": "s0",
    "miniassuntos": []
  },
  {
    "materia": "Português",
    "subtopico": "Ortografia oficial",
    "quente": false,
    "pct": 10.0,
    "categoria": "portugues",
    "ordem": 1,
    "id": "s1",
    "miniassuntos": []
  },
  {
    "materia": "Português",
    "subtopico": "Mecanismos de coesão textual",
    "quente": true,
    "pct": 80.0,
    "categoria": "portugues",
    "ordem": 2,
    "id": "s2",
    "miniassuntos": []
  },
  {
    "materia": "Português",
    "subtopico": "Significação das palavras",
    "quente": true,
    "pct": 70.0,
    "categoria": "portugues",
    "ordem": 3,
    "id": "s3",
    "miniassuntos": []
  },
  {
    "materia": "Português",
    "subtopico": "Emprego de tempos e modos verbais",
    "quente": true,
    "pct": 80.0,
    "categoria": "portugues",
    "ordem": 4,
    "id": "s4",
    "miniassuntos": []
  },
  {
    "materia": "Português",
    "subtopico": "Emprego das classes de palavras",
    "quente": true,
    "pct": 70.0,
    "categoria": "portugues",
    "ordem": 5,
    "id": "s5",
    "miniassuntos": []
  },
  {
    "materia": "Português",
    "subtopico": "Coordenação e subordinação (Conjunções)",
    "quente": true,
    "pct": 95.0,
    "categoria": "portugues",
    "ordem": 6,
    "id": "s6",
    "miniassuntos": []
  },
  {
    "materia": "Português",
    "subtopico": "Emprego dos sinais de pontuação (Vírgula)",
    "quente": true,
    "pct": 80.0,
    "categoria": "portugues",
    "ordem": 7,
    "id": "s7",
    "miniassuntos": []
  },
  {
    "materia": "Português",
    "subtopico": "Concordância verbal e nominal",
    "quente": true,
    "pct": 90.0,
    "categoria": "portugues",
    "ordem": 8,
    "id": "s8",
    "miniassuntos": []
  },
  {
    "materia": "Português",
    "subtopico": "Regência verbal e nominal",
    "quente": true,
    "pct": 75.0,
    "categoria": "portugues",
    "ordem": 9,
    "id": "s9",
    "miniassuntos": []
  },
  {
    "materia": "Português",
    "subtopico": "Emprego do sinal indicativo de crase",
    "quente": true,
    "pct": 85.0,
    "categoria": "portugues",
    "ordem": 10,
    "id": "s10",
    "miniassuntos": []
  },
  {
    "materia": "Português",
    "subtopico": "Colocação dos pronomes átonos",
    "quente": false,
    "pct": 40.0,
    "categoria": "portugues",
    "ordem": 11,
    "id": "s11",
    "miniassuntos": []
  },
  {
    "materia": "Inglês",
    "subtopico": "Compreensão de texto — Propósito Principal (Main Idea) e Localização de Informações",
    "quente": true,
    "pct": 100.0,
    "categoria": "ingles",
    "ordem": 0,
    "id": "s12",
    "miniassuntos": []
  },
  {
    "materia": "Inglês",
    "subtopico": "Compreensão de texto — Inferências Textuais",
    "quente": true,
    "pct": 100.0,
    "categoria": "ingles",
    "ordem": 1,
    "id": "s13",
    "miniassuntos": []
  },
  {
    "materia": "Inglês",
    "subtopico": "Itens Gramaticais — Conectores Lógicos (Conjunções)",
    "quente": true,
    "pct": 95.0,
    "categoria": "ingles",
    "ordem": 2,
    "id": "s14",
    "miniassuntos": []
  },
  {
    "materia": "Inglês",
    "subtopico": "Itens Gramaticais — Referência Pronominal",
    "quente": true,
    "pct": 95.0,
    "categoria": "ingles",
    "ordem": 3,
    "id": "s15",
    "miniassuntos": []
  },
  {
    "materia": "Inglês",
    "subtopico": "Itens Gramaticais — Sinonímia e Vocabulário",
    "quente": true,
    "pct": 95.0,
    "categoria": "ingles",
    "ordem": 4,
    "id": "s16",
    "miniassuntos": []
  },
  {
    "materia": "Inglês",
    "subtopico": "Itens Gramaticais — Verbos Modais",
    "quente": true,
    "pct": 95.0,
    "categoria": "ingles",
    "ordem": 5,
    "id": "s17",
    "miniassuntos": []
  },
  {
    "materia": "Inglês",
    "subtopico": "Itens Gramaticais — Voz Passiva",
    "quente": true,
    "pct": 95.0,
    "categoria": "ingles",
    "ordem": 6,
    "id": "s18",
    "miniassuntos": []
  },
  {
    "materia": "Resistência dos Materiais",
    "subtopico": "Solicitações axiais, flexão e torção",
    "quente": true,
    "pct": 90.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s19",
    "miniassuntos": []
  },
  {
    "materia": "Resistência dos Materiais",
    "subtopico": "Diagramas de força cortante e momento fletor",
    "quente": true,
    "pct": 95.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s20",
    "miniassuntos": []
  },
  {
    "materia": "Resistência dos Materiais",
    "subtopico": "Momento de inércia das figuras planas",
    "quente": true,
    "pct": 75.0,
    "categoria": "especifica",
    "ordem": 2,
    "id": "s21",
    "miniassuntos": []
  },
  {
    "materia": "Resistência dos Materiais",
    "subtopico": "Análise das tensões e deformações",
    "quente": true,
    "pct": 90.0,
    "categoria": "especifica",
    "ordem": 3,
    "id": "s22",
    "miniassuntos": []
  },
  {
    "materia": "Resistência dos Materiais",
    "subtopico": "Estado plano de tensões",
    "quente": true,
    "pct": 90.0,
    "categoria": "especifica",
    "ordem": 4,
    "id": "s23",
    "miniassuntos": []
  },
  {
    "materia": "Resistência dos Materiais",
    "subtopico": "Tensões/deformações em vigas carregadas transversalmente",
    "quente": true,
    "pct": 80.0,
    "categoria": "especifica",
    "ordem": 5,
    "id": "s24",
    "miniassuntos": []
  },
  {
    "materia": "Resistência dos Materiais",
    "subtopico": "Problemas de flexão estaticamente indeterminados",
    "quente": false,
    "pct": 40.0,
    "categoria": "especifica",
    "ordem": 6,
    "id": "s25",
    "miniassuntos": []
  },
  {
    "materia": "Resistência dos Materiais",
    "subtopico": "Flambagem",
    "quente": false,
    "pct": 25.0,
    "categoria": "especifica",
    "ordem": 7,
    "id": "s26",
    "miniassuntos": []
  },
  {
    "materia": "Resistência dos Materiais",
    "subtopico": "Medições de deformações com extensômetros",
    "quente": false,
    "pct": 20.0,
    "categoria": "especifica",
    "ordem": 8,
    "id": "s27",
    "miniassuntos": []
  },
  {
    "materia": "Resistência dos Materiais",
    "subtopico": "Lei de Hooke",
    "quente": true,
    "pct": 85.0,
    "categoria": "especifica",
    "ordem": 9,
    "id": "s28",
    "miniassuntos": []
  },
  {
    "materia": "Resistência dos Materiais",
    "subtopico": "Estática: reações de apoio, equilíbrio de corpo rígido, treliças e grau de hiperestaticidade",
    "quente": true,
    "pct": 85.0,
    "categoria": "especifica",
    "ordem": 10,
    "id": "s29",
    "miniassuntos": []
  },
  {
    "materia": "Mecânica dos Fluidos",
    "subtopico": "Propriedades e natureza dos fluidos",
    "quente": false,
    "pct": 40.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s30",
    "miniassuntos": []
  },
  {
    "materia": "Mecânica dos Fluidos",
    "subtopico": "Hidrostática",
    "quente": false,
    "pct": 35.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s31",
    "miniassuntos": []
  },
  {
    "materia": "Mecânica dos Fluidos",
    "subtopico": "Equações constitutivas da dinâmica dos fluidos",
    "quente": true,
    "pct": 80.0,
    "categoria": "especifica",
    "ordem": 2,
    "id": "s32",
    "miniassuntos": []
  },
  {
    "materia": "Mecânica dos Fluidos",
    "subtopico": "Análise dimensional e relações de semelhança",
    "quente": true,
    "pct": 75.0,
    "categoria": "especifica",
    "ordem": 3,
    "id": "s33",
    "miniassuntos": []
  },
  {
    "materia": "Mecânica dos Fluidos",
    "subtopico": "Escoamento em tubulações",
    "quente": true,
    "pct": 90.0,
    "categoria": "especifica",
    "ordem": 4,
    "id": "s34",
    "miniassuntos": []
  },
  {
    "materia": "Mecânica dos Fluidos",
    "subtopico": "Noções de escoamento compressível em bocais",
    "quente": false,
    "pct": 40.0,
    "categoria": "especifica",
    "ordem": 5,
    "id": "s35",
    "miniassuntos": []
  },
  {
    "materia": "Mecânica dos Fluidos",
    "subtopico": "Perdas de carga",
    "quente": true,
    "pct": 90.0,
    "categoria": "especifica",
    "ordem": 6,
    "id": "s36",
    "miniassuntos": []
  },
  {
    "materia": "Mecânica dos Fluidos",
    "subtopico": "Tubulações industriais: montagem de flanges, normas e inspeção de soldas em dutos",
    "quente": false,
    "pct": 35.0,
    "categoria": "especifica",
    "ordem": 7,
    "id": "s37",
    "miniassuntos": []
  },
  {
    "materia": "Máquinas de Fluxo",
    "subtopico": "Princípios de funcionamento e operação de bombas centrífugas e de deslocamento positivo",
    "quente": true,
    "pct": 95.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s38",
    "miniassuntos": []
  },
  {
    "materia": "Máquinas de Fluxo",
    "subtopico": "Compressores alternativos, centrífugos e axiais",
    "quente": true,
    "pct": 65.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s39",
    "miniassuntos": []
  },
  {
    "materia": "Máquinas de Fluxo",
    "subtopico": "Turbinas a vapor e a gás",
    "quente": false,
    "pct": 45.0,
    "categoria": "especifica",
    "ordem": 2,
    "id": "s40",
    "miniassuntos": []
  },
  {
    "materia": "Máquinas de Fluxo",
    "subtopico": "Aspectos termodinâmicos associados a essas máquinas",
    "quente": true,
    "pct": 80.0,
    "categoria": "especifica",
    "ordem": 3,
    "id": "s41",
    "miniassuntos": []
  },
  {
    "materia": "Máquinas de Fluxo",
    "subtopico": "Influência das condições do serviço sobre o desempenho e cálculo de potência de operação",
    "quente": true,
    "pct": 90.0,
    "categoria": "especifica",
    "ordem": 4,
    "id": "s42",
    "miniassuntos": []
  },
  {
    "materia": "Máquinas de Fluxo",
    "subtopico": "Sistemas hidráulicos e pneumáticos: módulo de compressibilidade, fluidos hidráulicos, comparação hidráulico x pneumático",
    "quente": false,
    "pct": 30.0,
    "categoria": "especifica",
    "ordem": 5,
    "id": "s43",
    "miniassuntos": []
  },
  {
    "materia": "Termodinâmica",
    "subtopico": "Estado termodinâmico e propriedades termodinâmicas",
    "quente": false,
    "pct": 30.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s44",
    "miniassuntos": []
  },
  {
    "materia": "Termodinâmica",
    "subtopico": "Primeira Lei e a conservação de energia",
    "quente": true,
    "pct": 85.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s45",
    "miniassuntos": []
  },
  {
    "materia": "Termodinâmica",
    "subtopico": "Segunda Lei aplicada a ciclos e processos",
    "quente": true,
    "pct": 85.0,
    "categoria": "especifica",
    "ordem": 2,
    "id": "s46",
    "miniassuntos": []
  },
  {
    "materia": "Termodinâmica",
    "subtopico": "Gases perfeitos",
    "quente": true,
    "pct": 85.0,
    "categoria": "especifica",
    "ordem": 3,
    "id": "s47",
    "miniassuntos": []
  },
  {
    "materia": "Termodinâmica",
    "subtopico": "Ciclos teóricos de geração de potência e refrigeração",
    "quente": true,
    "pct": 70.0,
    "categoria": "especifica",
    "ordem": 4,
    "id": "s48",
    "miniassuntos": []
  },
  {
    "materia": "Elementos de Máquinas",
    "subtopico": "Eixos",
    "quente": true,
    "pct": 75.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s49",
    "miniassuntos": []
  },
  {
    "materia": "Elementos de Máquinas",
    "subtopico": "Engrenagens",
    "quente": true,
    "pct": 95.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s50",
    "miniassuntos": []
  },
  {
    "materia": "Elementos de Máquinas",
    "subtopico": "Mancais",
    "quente": false,
    "pct": 40.0,
    "categoria": "especifica",
    "ordem": 2,
    "id": "s51",
    "miniassuntos": []
  },
  {
    "materia": "Elementos de Máquinas",
    "subtopico": "Fadiga",
    "quente": false,
    "pct": 45.0,
    "categoria": "especifica",
    "ordem": 3,
    "id": "s52",
    "miniassuntos": []
  },
  {
    "materia": "Elementos de Máquinas",
    "subtopico": "Lubrificação industrial: viscosidade, óleos multigrade SAE, regimes de lubrificação em mancais",
    "quente": false,
    "pct": 40.0,
    "categoria": "especifica",
    "ordem": 4,
    "id": "s53",
    "miniassuntos": []
  },
  {
    "materia": "Metalurgia",
    "subtopico": "Estrutura cristalina dos metais",
    "quente": false,
    "pct": 45.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s54",
    "miniassuntos": []
  },
  {
    "materia": "Metalurgia",
    "subtopico": "Propriedades mecânicas dos materiais",
    "quente": true,
    "pct": 75.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s55",
    "miniassuntos": []
  },
  {
    "materia": "Metalurgia",
    "subtopico": "Transformações de fase e Diagramas de equilíbrio",
    "quente": true,
    "pct": 90.0,
    "categoria": "especifica",
    "ordem": 2,
    "id": "s56",
    "miniassuntos": []
  },
  {
    "materia": "Metalurgia",
    "subtopico": "Diagramas de equilíbrio",
    "quente": true,
    "pct": 95.0,
    "categoria": "especifica",
    "ordem": 3,
    "id": "s57",
    "miniassuntos": []
  },
  {
    "materia": "Metalurgia",
    "subtopico": "Ligas ferro-carbono e Tratamentos térmicos",
    "quente": true,
    "pct": 95.0,
    "categoria": "especifica",
    "ordem": 4,
    "id": "s58",
    "miniassuntos": []
  },
  {
    "materia": "Metalurgia",
    "subtopico": "Mecanismos para aumento da resistência mecânica e tenacidade dos aços-carbono",
    "quente": true,
    "pct": 85.0,
    "categoria": "especifica",
    "ordem": 5,
    "id": "s59",
    "miniassuntos": []
  },
  {
    "materia": "Transmissão do Calor",
    "subtopico": "Fundamentos e mecanismos de transferência de calor",
    "quente": false,
    "pct": 40.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s60",
    "miniassuntos": []
  },
  {
    "materia": "Transmissão do Calor",
    "subtopico": "Abordagem elementar dos processos de condução convecção e radiação",
    "quente": true,
    "pct": 90.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s61",
    "miniassuntos": []
  },
  {
    "materia": "Transmissão do Calor",
    "subtopico": "Princípios de operação dos trocadores de calor",
    "quente": true,
    "pct": 90.0,
    "categoria": "especifica",
    "ordem": 2,
    "id": "s62",
    "miniassuntos": []
  },
  {
    "materia": "Fundamentos da Dinâmica",
    "subtopico": "Dinâmica das partículas",
    "quente": true,
    "pct": 70.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s63",
    "miniassuntos": []
  },
  {
    "materia": "Fundamentos da Dinâmica",
    "subtopico": "Dinâmica de sistemas de partículas",
    "quente": false,
    "pct": 30.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s64",
    "miniassuntos": []
  },
  {
    "materia": "Fundamentos da Dinâmica",
    "subtopico": "Dinâmica de corpos rígidos",
    "quente": true,
    "pct": 75.0,
    "categoria": "especifica",
    "ordem": 2,
    "id": "s65",
    "miniassuntos": []
  },
  {
    "materia": "Fundamentos da Dinâmica",
    "subtopico": "Cinemática e dinâmica de mecanismos (mecanismos planos, barras articuladas)",
    "quente": false,
    "pct": 30.0,
    "categoria": "especifica",
    "ordem": 3,
    "id": "s66",
    "miniassuntos": []
  },
  {
    "materia": "Eletrotécnica",
    "subtopico": "Princípios de funcionamento de geradores e motores elétricos",
    "quente": true,
    "pct": 55.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s67",
    "miniassuntos": []
  },
  {
    "materia": "Vibrações Mecânicas",
    "subtopico": "Sistemas com um grau de liberdade (livre, forçada, transiente, amortecida e não-amortecida)",
    "quente": true,
    "pct": 90.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s68",
    "miniassuntos": []
  },
  {
    "materia": "Vibrações Mecânicas",
    "subtopico": "Sistemas com múltiplos graus de liberdade (frequências, modos naturais, livres e forçadas)",
    "quente": true,
    "pct": 60.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s69",
    "miniassuntos": []
  },
  {
    "materia": "Vibrações Mecânicas",
    "subtopico": "Medições de vibrações: transdutores",
    "quente": false,
    "pct": 15.0,
    "categoria": "especifica",
    "ordem": 2,
    "id": "s70",
    "miniassuntos": []
  },
  {
    "materia": "Soldagem",
    "subtopico": "Ciclo térmico, pré/pós-aquecimento, tratamentos térmicos, fissuração a quente e interlamelar",
    "quente": true,
    "pct": 55.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s71",
    "miniassuntos": []
  },
  {
    "materia": "Soldagem",
    "subtopico": "Processos: soldagem a gás, oxicorte, eletrodo revestido, TIG, MIG, MAG, arco submerso",
    "quente": true,
    "pct": 95.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s72",
    "miniassuntos": []
  },
  {
    "materia": "Processos de Fabricação Mecânica",
    "subtopico": "Conformação mecânica",
    "quente": true,
    "pct": 55.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s73",
    "miniassuntos": []
  },
  {
    "materia": "Processos de Fabricação Mecânica",
    "subtopico": "Torneamento, fresamento, furação e retífica",
    "quente": false,
    "pct": 20.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s74",
    "miniassuntos": []
  },
  {
    "materia": "Corrosão",
    "subtopico": "Corrosão química e eletroquímica",
    "quente": true,
    "pct": 85.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s75",
    "miniassuntos": []
  },
  {
    "materia": "Corrosão",
    "subtopico": "Métodos de proteção anticorrosiva",
    "quente": true,
    "pct": 90.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s76",
    "miniassuntos": []
  },
  {
    "materia": "Seleção de Materiais",
    "subtopico": "Fatores gerais de influência na seleção de materiais",
    "quente": true,
    "pct": 75.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s77",
    "miniassuntos": []
  },
  {
    "materia": "Seleção de Materiais",
    "subtopico": "Principais materiais metálicos e não metálicos industriais e indicações de uso",
    "quente": true,
    "pct": 80.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s78",
    "miniassuntos": []
  },
  {
    "materia": "Motores de Combustão Interna",
    "subtopico": "Ciclos ar-combustível e real (diagramas P-V Otto e Diesel; P vs ângulo de manivela)",
    "quente": true,
    "pct": 85.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s79",
    "miniassuntos": []
  },
  {
    "materia": "Motores de Combustão Interna",
    "subtopico": "Motores de dois e de quatro tempos",
    "quente": false,
    "pct": 30.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s80",
    "miniassuntos": []
  },
  {
    "materia": "Motores de Combustão Interna",
    "subtopico": "Comparações entre motores ICE e ICO",
    "quente": false,
    "pct": 45.0,
    "categoria": "especifica",
    "ordem": 2,
    "id": "s81",
    "miniassuntos": []
  },
  {
    "materia": "Motores de Combustão Interna",
    "subtopico": "Parâmetros do motor (cilindradas, taxa comp., dimensões, rendimentos, torque, potências, atrito, líquida, consumo horário e específico de combustível, razão de corte)",
    "quente": true,
    "pct": 95.0,
    "categoria": "especifica",
    "ordem": 3,
    "id": "s82",
    "miniassuntos": []
  },
  {
    "materia": "Motores de Combustão Interna",
    "subtopico": "Motores a álcool, diesel, gasolina, GNV e combustíveis alternativos",
    "quente": true,
    "pct": 80.0,
    "categoria": "especifica",
    "ordem": 4,
    "id": "s83",
    "miniassuntos": []
  },
  {
    "materia": "Motores de Combustão Interna",
    "subtopico": "Propriedades do óleo lubrificante usado em Motores de combustão interna (MCI)",
    "quente": false,
    "pct": 35.0,
    "categoria": "especifica",
    "ordem": 5,
    "id": "s84",
    "miniassuntos": []
  },
  {
    "materia": "Motores de Combustão Interna",
    "subtopico": "Mecânica automotiva: nomenclatura e componentes construtivos do motor (cambota/árvore de manivelas etc.)",
    "quente": false,
    "pct": 30.0,
    "categoria": "especifica",
    "ordem": 6,
    "id": "s85",
    "miniassuntos": []
  },
  {
    "materia": "Ciclos de Geração de Potência",
    "subtopico": "Conceitos práticos relativos aos ciclos de Rankine e Brayton",
    "quente": true,
    "pct": 90.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s86",
    "miniassuntos": []
  },
  {
    "materia": "Ciclos de Geração de Potência",
    "subtopico": "Balanço energético e cálculo de eficiência do ciclo",
    "quente": true,
    "pct": 90.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s87",
    "miniassuntos": []
  },
  {
    "materia": "Ciclos de Geração de Potência",
    "subtopico": "Principais fatores da perda de eficiência",
    "quente": true,
    "pct": 85.0,
    "categoria": "especifica",
    "ordem": 2,
    "id": "s88",
    "miniassuntos": []
  },
  {
    "materia": "Ciclos de Geração de Potência",
    "subtopico": "Equipamentos auxiliares para implementação desses ciclos",
    "quente": true,
    "pct": 80.0,
    "categoria": "especifica",
    "ordem": 3,
    "id": "s89",
    "miniassuntos": []
  },
  {
    "materia": "Segurança do Trabalho e Meio Ambiente",
    "subtopico": "Normas regulamentadoras sobre Equipamentos de Proteção Individual (EPI)",
    "quente": false,
    "pct": 40.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s90",
    "miniassuntos": []
  },
  {
    "materia": "Segurança do Trabalho e Meio Ambiente",
    "subtopico": "Programa de Prevenção de Riscos Ambientais (PPRA)",
    "quente": false,
    "pct": 35.0,
    "categoria": "especifica",
    "ordem": 1,
    "id": "s91",
    "miniassuntos": []
  },
  {
    "materia": "Segurança do Trabalho e Meio Ambiente",
    "subtopico": "Segurança no Trabalho em Máquinas, Equipamentos, Atividades e Operações Perigosas",
    "quente": false,
    "pct": 45.0,
    "categoria": "especifica",
    "ordem": 2,
    "id": "s92",
    "miniassuntos": []
  },
  {
    "materia": "Noções de Estatística e Probabilidade",
    "subtopico": "Aplicações em Engenharia",
    "quente": false,
    "pct": 80.0,
    "categoria": "especifica",
    "ordem": 0,
    "id": "s93",
    "miniassuntos": []
  }
];

// Agrupamento em "campos" temáticos: cada campo une uma matéria-base (fundamentos) com
// sua(s) matéria(s)-aplicada(s). Usado hoje só para navegação/organização visual
// (a antiga lógica de distribuição automática por campo foi removida).
const CAMPOS = {
  fluidos:    { basica: ['Mecânica dos Fluidos'], aplicada: ['Máquinas de Fluxo'] },
  termico:    { basica: ['Termodinâmica'], aplicada: ['Motores de Combustão Interna', 'Ciclos de Geração de Potência', 'Transmissão do Calor'] },
  estrutural: { basica: ['Resistência dos Materiais'], aplicada: ['Elementos de Máquinas'] },
  materiais:  { basica: ['Metalurgia'], aplicada: ['Soldagem', 'Corrosão', 'Seleção de Materiais'] },
  dinamica:   { basica: ['Fundamentos da Dinâmica'], aplicada: ['Vibrações Mecânicas'] },
  avulsas:    { basica: [], aplicada: ['Eletrotécnica', 'Processos de Fabricação Mecânica', 'Segurança do Trabalho e Meio Ambiente', 'Noções de Estatística e Probabilidade'] }
};
const ORDEM_CAMPOS = ['fluidos', 'termico', 'estrutural', 'materiais', 'dinamica', 'avulsas'];

// matérias "quente" (tópico quente) segundo o mapeamento de frequência x edital.
// Usado para colorir o TÓPICO de laranja (quente) ou azul (frio) na tela de navegação.
// Subtópicos têm sua própria flag "quente" independente (também colorida laranja/azul).
const MATERIA_QUENTE = new Set([
  'Mecânica dos Fluidos', 'Máquinas de Fluxo', 'Termodinâmica', 'Motores de Combustão Interna',
  'Ciclos de Geração de Potência', 'Transmissão do Calor', 'Resistência dos Materiais',
  'Fundamentos da Dinâmica', 'Vibrações Mecânicas', 'Soldagem', 'Corrosão'
]);

// camada 1 = tópico quente + subtópico quente (maior prioridade) ... camada 4 = tópico frio + subtópico frio
function camada(s){
  const topicoQuente = MATERIA_QUENTE.has(s.materia.trim());
  if(topicoQuente && s.quente) return 1;
  if(topicoQuente && !s.quente) return 2;
  if(!topicoQuente && s.quente) return 3;
  return 4;
}
function campoDaMateria(materia){
  for(const c of ORDEM_CAMPOS){
    if(CAMPOS[c].basica.includes(materia) || CAMPOS[c].aplicada.includes(materia)) return c;
  }
  return 'avulsas';
}
function tipoDaMateria(materia, campo){
  return CAMPOS[campo].basica.includes(materia) ? 'basica' : 'aplicada';
}
// disciplina (PT / EN / Esp) a partir da categoria do subtópico — usado na navegação por disciplina.
function disciplinaDaCategoria(categoria){
  if(categoria === 'portugues') return 'PT';
  if(categoria === 'ingles') return 'EN';
  return 'Esp';
}
// storage.js
// Login e sincronização. Único lugar que fala com o Supabase e com window.storage.
// Nada aqui sabe desenhar tela nem conhece a regra de negócio (isso é do state.js).

// Preencha com o seu projeto Supabase (URL + anon key). Fica só no seu dispositivo.
const SUPABASE_CONFIG = {
  anonkey'', 
  url''};

// Fora do preview de artifact do Claude, window.storage não existe.
// Esse polyfill usa localStorage no navegador pra manter o app funcionando standalone
// (ex: hospedado no GitHub Pages ou aberto localmente).
if (!window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem('estudoTranspetro_' + key);
      if (v === null) throw new Error('not found: ' + key);
      return { key, value: v };
    },
    async set(key, value) {
      localStorage.setItem('estudoTranspetro_' + key, value);
      return { key, value };
    }
  };
}

const Storage = (() => {
  let authSession = { access_token: '', refresh_token: '', expires_at: 0 };

  function headers(withPrefer) {
    const h = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_CONFIG.anon,
      'Authorization': 'Bearer ' + (authSession.access_token || SUPABASE_CONFIG.anon)
    };
    if (withPrefer) h['Prefer'] = 'resolution=merge-duplicates';
    return h;
  }

  function baseUrl() {
    return SUPABASE_CONFIG.url.replace(/\/$/, '');
  }

  function uidFromToken() {
    if (!authSession.access_token) return null;
    try {
      return JSON.parse(atob(authSession.access_token.split('.')[1])).sub;
    } catch (e) {
      return null;
    }
  }

  async function loadAuthSession() {
    try {
      const r = await window.storage.get('authSession');
      authSession = JSON.parse(r.value);
    } catch (e) {
      authSession = { access_token: '', refresh_token: '', expires_at: 0 };
    }
  }
  async function saveAuthSession() {
    await window.storage.set('authSession', JSON.stringify(authSession));
  }

  async function login(email, password) {
    const res = await fetch(baseUrl() + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_CONFIG.anon },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || 'falha no login');
    authSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000
    };
    await saveAuthSession();
  }

  async function refresh() {
    if (!authSession.refresh_token) return false;
    try {
      const res = await fetch(baseUrl() + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_CONFIG.anon },
        body: JSON.stringify({ refresh_token: authSession.refresh_token })
      });
      if (!res.ok) return false;
      const data = await res.json();
      authSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000
      };
      await saveAuthSession();
      return true;
    } catch (e) {
      return false;
    }
  }

  async function ensureFreshToken() {
    if (!authSession.access_token) return false;
    if (Date.now() < authSession.expires_at - 30000) return true;
    return await refresh();
  }

  async function hasSession() {
    await loadAuthSession();
    return await ensureFreshToken();
  }

  function configured() {
    return !!(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anon);
  }

  // Grava (upsert) um valor simples na tabela app_data: key = nome do dado (ex: 'subtopicos').
  async function set(key, value) {
    if (!configured()) return { ok: false, reason: 'not-configured' };
    await ensureFreshToken();
    const uid = uidFromToken();
    if (!uid) return { ok: false, reason: 'no-uid' };
    try {
      const res = await fetch(baseUrl() + '/rest/v1/app_data?on_conflict=key,user_id', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify([{ key, value, user_id: uid, updated_at: new Date().toISOString() }])
      });
      return { ok: res.ok };
    } catch (e) {
      return { ok: false, reason: 'network' };
    }
  }

  async function get(key) {
    if (!configured()) return null;
    await ensureFreshToken();
    const uid = uidFromToken();
    if (!uid) return null;
    try {
      const res = await fetch(
        baseUrl() + '/rest/v1/app_data?key=eq.' + encodeURIComponent(key) + '&user_id=eq.' + uid + '&select=value',
        { headers: headers(false) }
      );
      if (!res.ok) return null;
      const rows = await res.json();
      if (!rows || rows.length === 0) return null;
      return JSON.parse(rows[0].value);
    } catch (e) {
      return null;
    }
  }

  return { loadAuthSession, login, hasSession, configured, get, set };
})();
:root {
  --bg: #0a0a0c;
  --panel: #17181c;
  --panel2: #1e2025;
  --border: #2b2d33;
  --text: #f2f2f2;
  --text-dim: #9a9ba3;

  --quente: #ffa94d;   /* laranja */
  --frio: #4da6ff;     /* azul */
  --green: #4ade80;
  --red: #ff4f4f;
  --yellow: #ffd43b;
}

* { box-sizing: border-box; }

body {
  font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  margin: 0;
  padding: 16px;
  font-size: 14px;
}

h1 { font-size: 17px; margin: 0 0 14px; }
h2 { font-size: 15px; margin: 0 0 10px; color: var(--text-dim); font-weight: 600; }

button { font-family: inherit; }

/* ---------- tabs superiores ---------- */
.tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.tab {
  padding: 9px 14px; border: 1px solid var(--border); border-radius: 10px;
  background: var(--panel); color: var(--text-dim); cursor: pointer;
  font-size: 14px; font-weight: 600;
}
.tab.active { background: var(--frio); color: #04101f; border-color: var(--frio); }

.view { display: none; }
.view.active { display: block; }

/* ---------- cards de tópico / subtópico ---------- */
.grid-topicos { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }

.card-topico {
  border-radius: 12px; padding: 14px; cursor: pointer;
  background: var(--panel); border: 1.5px solid var(--border);
  transition: opacity .15s, transform .1s;
}
.card-topico.quente { border-color: var(--quente); }
.card-topico.frio { border-color: var(--frio); }
.card-topico:active { transform: scale(0.98); }
.card-topico .nome { font-weight: 700; font-size: 14px; }
.card-topico .conta { color: var(--text-dim); font-size: 12px; margin-top: 4px; }

.lista-subtopicos { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.item-subtopico {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  border-radius: 10px; padding: 10px 12px; cursor: pointer;
  background: var(--panel); border: 1px solid var(--border); border-left: 4px solid var(--border);
  transition: opacity .3s;
}
.item-subtopico.quente { border-left-color: var(--quente); }
.item-subtopico.frio { border-left-color: var(--frio); }
.item-subtopico.estudado { opacity: 0.35; }
.item-subtopico .nome { font-size: 13px; }
.item-subtopico .pct { font-size: 13px; font-weight: 700; color: var(--text-dim); min-width: 30px; text-align: right; }

.tag-quente { color: var(--quente); }
.tag-frio { color: var(--frio); }

.empty { color: var(--text-dim); text-align: center; padding: 24px; font-size: 14px; }

/* ---------- estudo em andamento ---------- */
#estudoAndamento {
  position: fixed; left: 16px; right: 16px; bottom: 96px;
  background: var(--panel2); border: 1px solid var(--border); border-radius: 14px;
  padding: 14px 16px; display: none; z-index: 90;
}
#estudoAndamento.show { display: block; }
#estudoAndamento .topo { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
#estudoAndamento .materia { font-size: 12px; color: var(--text-dim); }
#estudoAndamento .subtopico { font-weight: 700; font-size: 14px; margin-top: 2px; }
#estudoAndamento .fechar { background: transparent; border: none; color: var(--red); font-size: 20px; cursor: pointer; line-height: 1; }
#estudoAndamento .barra-desempenho { height: 6px; border-radius: 4px; overflow: hidden; display: flex; gap: 1px; margin-top: 10px; }

/* ---------- botão + flutuante ---------- */
#fabBtn {
  position: fixed; bottom: 24px; right: 24px; width: 60px; height: 60px; border-radius: 50%;
  background: var(--frio); color: #04101f; border: none; font-size: 28px; font-weight: 700;
  cursor: pointer; z-index: 100; box-shadow: 0 4px 20px rgba(77,166,255,.4);
  display: flex; align-items: center; justify-content: center; line-height: 1;
}

/* ---------- overlays / modais ---------- */
.overlay {
  display: none; position: fixed; inset: 0; background: rgba(0,0,0,.65);
  align-items: center; justify-content: center; z-index: 200; padding: 16px;
}
.overlay.show { display: flex; }
.modal-box {
  background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
  padding: 22px; width: 100%; max-width: 400px; max-height: 85vh; overflow-y: auto;
}
.modal-box .titulo { font-weight: 700; color: var(--frio); font-size: 15px; margin-bottom: 4px; }
.modal-box .subtitulo { color: var(--text-dim); font-size: 13px; margin-bottom: 16px; }

.grid-escolha { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.opcao-escolha {
  border-radius: 10px; padding: 12px 10px; text-align: center; cursor: pointer;
  background: var(--panel2); border: 1.5px solid var(--border); font-size: 13px; font-weight: 600;
}
.opcao-escolha.quente { border-color: var(--quente); color: var(--quente); }
.opcao-escolha.frio { border-color: var(--frio); color: var(--frio); }
.opcao-escolha:active { transform: scale(0.97); }

/* ---------- formulário de registro (highlight amarelo caminhando) ---------- */
.form-registro { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
.campo-registro label { display: block; font-size: 12px; color: var(--text-dim); margin-bottom: 4px; }
.campo-registro input, .campo-registro select {
  width: 100%; padding: 10px; background: var(--panel2); color: var(--text);
  border: 2px solid var(--border); border-radius: 8px; font-size: 14px;
  transition: border-color .2s, background-color .2s;
}
.campo-registro.ativo input, .campo-registro.ativo select { border-color: var(--yellow); }
.campo-registro.preenchido input, .campo-registro.preenchido select {
  border-color: var(--yellow); background-color: rgba(255,212,59,.12);
}

.result-btns { display: flex; gap: 8px; margin-top: 4px; }
.result-btns button {
  flex: 1; padding: 10px; border-radius: 8px; border: 1.5px solid var(--border);
  background: var(--panel2); color: var(--text); font-weight: 700; cursor: pointer; font-size: 14px;
}
.result-btns button.certo { border-color: var(--green); color: var(--green); }
.result-btns button.errado { border-color: var(--quente); color: var(--quente); }
.result-btns button.pulou { border-color: var(--frio); color: var(--frio); }

.btn-voltar {
  background: transparent; border: 1px solid var(--border); color: var(--text-dim);
  padding: 8px 14px; border-radius: 8px; font-size: 13px; cursor: pointer; margin-top: 14px;
}

/* ---------- métricas ---------- */
.metr-mat { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; margin-bottom: 8px; }
.metr-mat .head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.metr-mat .head .nome { flex: 1; font-weight: 700; font-size: 13px; }
.metr-mat .head .pct { font-weight: 700; font-size: 13px; }
.metr-mat .barra { display: flex; height: 10px; border-radius: 6px; overflow: hidden; gap: 1px; }

/* ---------- login ---------- */
#loginOverlay { position: fixed; inset: 0; background: var(--bg); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 20px; }
#loginBox { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 26px; width: 100%; max-width: 340px; }
#loginBox input { width: 100%; padding: 10px; margin-bottom: 10px; background: var(--panel2); color: var(--text); border: 1px solid var(--border); border-radius: 8px; }
#loginBox button.primary { width: 100%; background: var(--frio); color: #04101f; border: none; padding: 11px; border-radius: 10px; font-weight: 700; cursor: pointer; }
#loginErr { color: var(--quente); font-size: 12px; min-height: 16px; margin-top: 6px; }
#loginConfigNote { color: var(--text-dim); font-size: 12px; margin-bottom: 14px; line-height: 1.4; }
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Estudo Transpetro</title>
<link rel="stylesheet" href="style.css">
</head>
<body>

<!-- LOGIN -->
<div id="loginOverlay">
  <div id="loginBox">
    <div class="titulo" style="font-weight:700; font-size:16px; margin-bottom:10px; color:var(--frio);">Entrar</div>
    <div id="loginConfigNote"></div>
    <input id="loginEmail" type="email" placeholder="email" autocomplete="username">
    <input id="loginPass" type="password" placeholder="senha" autocomplete="current-password">
    <div id="loginErr"></div>
    <button id="loginBtn" class="primary">Entrar</button>
  </div>
</div>

<!-- APP -->
<div id="appContent" style="display:none;">
  <h1>Estudo Transpetro</h1>

  <div class="tabs">
    <div class="tab active" data-view="estudar">Estudar</div>
    <div class="tab" data-view="metricas">Métricas</div>
  </div>

  <!-- TELA: ESTUDAR (navegação disciplina > tópico > subtópico) -->
  <div class="view active" id="v-estudar">
    <div class="tabs" id="disciplinaTabs">
      <div class="tab active" data-disc="Esp">Específica</div>
      <div class="tab" data-disc="PT">Português</div>
      <div class="tab" data-disc="EN">Inglês</div>
    </div>

    <div id="listaTopicos"></div>
    <div id="detalheTopico"></div>
  </div>

  <!-- TELA: MÉTRICAS -->
  <div class="view" id="v-metricas">
    <div id="conteudoMetricas"></div>
  </div>

  <!-- ESTUDO EM ANDAMENTO (barra persistente) -->
  <div id="estudoAndamento">
    <div class="topo">
      <div>
        <div class="materia" id="eaMateria"></div>
        <div class="subtopico" id="eaSubtopico"></div>
      </div>
      <button class="fechar" id="eaFechar" title="Encerrar estudo">×</button>
    </div>
    <div class="barra-desempenho" id="eaBarra"></div>
  </div>

  <button id="fabBtn" title="Registrar questão">+</button>
</div>

<!-- MODAL: fluxo de escolha (disciplina > tópico > subtópico > miniassunto > formulário) -->
<div class="overlay" id="modalEscolha">
  <div class="modal-box">
    <div class="titulo" id="modalTitulo"></div>
    <div class="subtitulo" id="modalSubtitulo"></div>
    <div id="modalCorpo"></div>
    <button class="btn-voltar" id="modalVoltar" style="display:none;">← voltar</button>
    <button class="btn-voltar" id="modalFechar">fechar</button>
  </div>
</div>

<!-- MODAL: histórico de um subtópico (últimas questões) -->
<div class="overlay" id="modalHistorico">
  <div class="modal-box" id="modalHistoricoBox"></div>
</div>

<script src="data.js"></script>
<script src="storage.js"></script>
<script src="state.js"></script>
<script src="app.js"></script>
</body>
</html>
