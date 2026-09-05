// features/reteste.view.js
//
// Tela de reteste: lista questões com resultado 'errado' ou 'pulou' que ainda
// não bateram retest_ok. Cada card tem 3 botões (Errado / Certo / Pulou).
// 2 acertos seguidos (r_seq_acertos >= 2) -> retest_ok = true -> card some.
// 'Errado' zera a sequência e soma em r_erros_total. 'Pulou' só reordena
// localmente (não grava nada).
import "./reteste.style.css";
import {
  getQuestoesParaReteste,
  registrarTentativaReteste,
  getAppDataByKey,
} from "../lib/supabase.js";

export function mount(container, { onNavigate } = {}) {
  let questoes = [];
  let subtopicoLabels = {};
  let carregando = true;
  let erro = null;

  render();
  carregar();

  async function carregar() {
    try {
      const [qs, subtopicos] = await Promise.all([
        getQuestoesParaReteste(),
        getAppDataByKey("subtopicos").catch(() => []),
      ]);
      questoes = qs || [];
      subtopicoLabels = montarLabels(subtopicos || []);
      erro = null;
    } catch (e) {
      console.error("Erro ao carregar reteste:", e);
      erro = "Erro ao carregar questões. Tente novamente.";
    } finally {
      carregando = false;
      render();
    }
  }

  function montarLabels(subtopicos) {
    const map = {};
    subtopicos.forEach((s) => {
      map[s.id] = `${s.materia} — ${s.subtopico}`;
    });
    return map;
  }

  async function onResultado(questao, resultado, btnGroup) {
    btnGroup.querySelectorAll("button").forEach((b) => (b.disabled = true));

    if (resultado === "pulou") {
      questoes = questoes.filter((q) => q.id !== questao.id).concat(questao);
      render();
      return;
    }

    try {
      const { r_seq_acertos, r_erros_total, retest_ok } =
        await registrarTentativaReteste(questao.id, resultado, {
          r_seq_acertos: questao.r_seq_acertos,
          r_erros_total: questao.r_erros_total,
        });

      if (retest_ok) {
        questoes = questoes.filter((q) => q.id !== questao.id);
      } else {
        questoes = questoes.map((q) =>
          q.id === questao.id
            ? { ...q, r_seq_acertos, r_erros_total, retest_ok }
            : q
        );
        if (resultado === "errado") {
          const atual = questoes.find((q) => q.id === questao.id);
          questoes = questoes.filter((q) => q.id !== questao.id).concat(atual);
        }
      }
      render();
    } catch (e) {
      console.error("Erro ao registrar tentativa de reteste:", e);
      btnGroup.querySelectorAll("button").forEach((b) => (b.disabled = false));
      alert("Erro ao salvar. Tente novamente.");
    }
  }

  function render() {
    container.innerHTML = `
      <section class="rt">
        <header class="rt__header">
          <button type="button" class="rt__voltar" aria-label="Voltar">←</button>
          <h1 class="rt__titulo">Reteste</h1>
        </header>
        <div class="rt__lista" data-el="lista"></div>
      </section>
    `;

    container.querySelector(".rt__voltar").addEventListener("click", () => {
      if (typeof onNavigate === "function") onNavigate("inicial");
    });

    const lista = container.querySelector('[data-el="lista"]');

    if (carregando) {
      lista.innerHTML = `<p class="rt__estado">Carregando…</p>`;
      return;
    }

    if (erro) {
      lista.innerHTML = `<p class="rt__estado rt__estado--erro">${erro}</p>`;
      return;
    }

    if (questoes.length === 0) {
      lista.innerHTML = `<p class="rt__estado">Nenhuma questão pendente de reteste 🎉</p>`;
      return;
    }

    questoes.forEach((questao) => {
      const card = document.createElement("div");
      card.className = "rt__card";

      const seq = questao.r_seq_acertos || 0;
      const label = subtopicoLabels[questao.subtopico_id] || "Assunto não identificado";

      card.innerHTML = `
        <p class="rt__card-assunto">${escapeHtml(label)}</p>
        <p class="rt__card-info">
          ${escapeHtml(questao.caderno || "")}${questao.caderno ? " · " : ""}Questão ${escapeHtml(String(questao.numero))}
        </p>
        <p class="rt__card-progresso">Sequência de acertos: ${seq}/2</p>
        <div class="rt__card-acoes">
          <button type="button" class="rt__btn rt__btn--errado" data-resultado="errado">Errado</button>
          <button type="button" class="rt__btn rt__btn--pulou" data-resultado="pulou">Pulou</button>
          <button type="button" class="rt__btn rt__btn--certo" data-resultado="certo">Certo</button>
        </div>
      `;

      const btnGroup = card.querySelector(".rt__card-acoes");
      btnGroup.querySelectorAll("[data-resultado]").forEach((btn) => {
        btn.addEventListener("click", () => {
          onResultado(questao, btn.dataset.resultado, btnGroup);
        });
      });

      lista.appendChild(card);
    });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
