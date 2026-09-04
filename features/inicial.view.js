// features/inicial.view.js
//
// Tela inicial: mostra o assunto atual (visor, vem do banco depois) e 4 ações:
//   - Reteste            (vermelho)
//   - Trocar disciplina   (amarelo)
//   - Registrar questão   (azul)
//   - Desempenho          (verde)
//
// Cada ação por enquanto só faz console.log('ir para: <nome>') e chama
// onNavigate(nome) se ela for passada — a troca real de tela fica a cargo
// do main.js, que ainda não existe.
import "./inicial.style.css";
export function mount(container, { onNavigate } = {}) {
  container.innerHTML = `
    <section class="inicial">
      <div class="inicial__card">
        <button
          type="button"
          class="inicial__desempenho"
          data-nav="desempenho"
        >
          Desempenho <span data-el="desempenho-valor">--%</span>
        </button>

        <div class="inicial__visor">
          <p class="inicial__visor-label">Assunto atual</p>
          <p class="inicial__visor-texto" data-el="subtopico-texto">
            Carregando…
          </p>
        </div>

        <div class="inicial__acoes">
          <button
            type="button"
            class="inicial__botao inicial__botao--vermelho"
            data-nav="reteste"
            aria-label="Ir para reteste"
          >
            <span aria-hidden="true">✕</span>
          </button>

          <button
            type="button"
            class="inicial__botao inicial__botao--amarelo"
            data-nav="trocar-disciplina"
            aria-label="Trocar disciplina"
          >
            <span aria-hidden="true">↻</span>
          </button>

          <button
            type="button"
            class="inicial__botao inicial__botao--azul"
            data-nav="registrar-questao"
            aria-label="Registrar questão"
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>
    </section>
  `;

  container.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => {
      const destino = el.dataset.nav;
      console.log('ir para: ' + destino);
      if (typeof onNavigate === 'function') {
        onNavigate(destino);
      }
    });
  });
//
  // TODO: puxar do Supabase (lib/supabase.js) o subtópico atual e o
  // desempenho quando essa integração existir. Por enquanto é só placeholder.
  preencherVisorPlaceholder(container);

}
function preencherVisorPlaceholder(container) {
  const texto = container.querySelector('[data-el="subtopico-texto"]');
  const desempenho = container.querySelector('[data-el="desempenho-valor"]');

  if (texto) {
    texto.textContent =
      'Subtópico determinado pelo algoritmo / escolhido via botão de trocar disciplina';
  }
  if (desempenho) {
    desempenho.textContent = '--%';
  }
}
export { mount as renderInicial };