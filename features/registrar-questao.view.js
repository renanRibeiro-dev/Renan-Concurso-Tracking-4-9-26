import "./registrar-questao.style.css";
import { salvarQuestao } from "../lib/supabase.js";

export function mount(container, { onClose, subtopicoId, miniAssunto = "", caderno: cadernoInicial = "" } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "rq-overlay";

  const card = document.createElement("div");
  card.className = "rq-card";
  overlay.appendChild(card);

  card.innerHTML = `
    <button class="rq-close" type="button" aria-label="Fechar">✕</button>

    <div class="rq-field">
      <label class="rq-label" for="rq-caderno">Caderno / Link</label>
      <input class="rq-input" id="rq-caderno" type="text" placeholder="Ex: link do Tecconcursos" value="${escapeHtml(cadernoInicial)}" />
    </div>

    <div class="rq-field">
      <label class="rq-label">Mini-Assunto</label>
      <div class="rq-static">${escapeHtml(miniAssunto)}</div>
    </div>

    <div class="rq-field">
      <label class="rq-label" for="rq-numero">Nº da Questão</label>
      <input class="rq-input" id="rq-numero" type="text" inputmode="numeric" placeholder="Ex: 12" />
    </div>

    <div class="rq-resultado">
      <button class="rq-btn rq-btn-certo" type="button" data-resultado="certo">Certo</button>
      <button class="rq-btn rq-btn-pulou" type="button" data-resultado="pulou">Pulou</button>
      <button class="rq-btn rq-btn-errado" type="button" data-resultado="errado">Errado</button>
    </div>

    <p class="rq-erro" hidden></p>
  `;

  container.appendChild(overlay);

  const closeBtn = card.querySelector(".rq-close");
  const erroEl = card.querySelector(".rq-erro");
  const numeroInput = card.querySelector("#rq-numero");
  const cadernoInput = card.querySelector("#rq-caderno");
  const resultadoBtns = card.querySelectorAll("[data-resultado]");

  function fechar() {
    overlay.remove();
    if (typeof onClose === "function") onClose();
  }

  function onOverlayClick(e) {
    if (e.target === overlay) fechar();
  }

  closeBtn.addEventListener("click", fechar);
  overlay.addEventListener("click", onOverlayClick);

  resultadoBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      erroEl.hidden = true;

      const numero = numeroInput.value.trim();
      if (!numero) {
        erroEl.textContent = "Informe o número da questão.";
        erroEl.hidden = false;
        numeroInput.focus();
        return;
      }

      if (!subtopicoId) {
        erroEl.textContent = "Subtópico não informado (erro interno).";
        erroEl.hidden = false;
        return;
      }

      resultadoBtns.forEach((b) => (b.disabled = true));

      const resultado = btn.dataset.resultado; // 'certo' | 'errado' | 'pulou'

      try {
        await salvarQuestao({
          subtopico_id: subtopicoId,
          caderno: cadernoInput.value.trim(),
          numero,
          resultado,
        });
        fechar();
      } catch (err) {
        console.error("Erro ao salvar questão:", err);
        erroEl.textContent = "Erro ao salvar. Tente novamente.";
        erroEl.hidden = false;
        resultadoBtns.forEach((b) => (b.disabled = false));
      }
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
