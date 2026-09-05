import "./seletor.style.css";
import { getAppData, getAppDataByKey } from "../lib/supabase.js";

const MATERIA_QUENTE = new Set([
  'Mecânica dos Fluidos', 'Máquinas de Fluxo', 'Termodinâmica', 'Motores de Combustão Interna',
  'Ciclos de Geração de Potência', 'Transmissão do Calor', 'Resistência dos Materiais',
  'Fundamentos da Dinâmica', 'Vibrações Mecânicas', 'Soldagem', 'Corrosão'
]);

function uniq(arr) {
  return [...new Set(arr)];
}

export function mount(container, { onSelect, onClose }) {
  let subtopicos = [];
    let state = {
    level: 1, // 1=categoria, 2=materia, 3=subtopico, 4=miniassunto
    categoria: null,
    materia: null,
    subtopico: null,
    subtopicoId: null,
  };

  const root = document.createElement("div");
  root.className = "seletor-overlay";
  container.appendChild(root);

  function close() {
    root.remove();
    if (onClose) onClose();
  }

    function back() {
    if (state.level === 2) {
      state.level = 1;
      state.grupo = null;
    } else if (state.level === 3) {
      state.level = 2;
      state.materia = null;
      state.categoria = null;
    } else if (state.level === 4) {
      state.level = 3;
      state.subtopico = null;
      state.subtopicoId = null;
    }
    render();
  }

  function finish(miniassunto) {
    const payload = {
      categoria: state.categoria,
      materia: state.materia,
      subtopico: state.subtopico,
      subtopicoId: state.subtopicoId,
      miniassunto: miniassunto || null,
    };
    close();
    if (onSelect) onSelect(payload);
  }

    function getItemsForLevel() {
    if (state.level === 1) {
      return ["Conhecimento Geral", "Conhecimento Específico"];
    }
    if (state.level === 2) {
      const categorias = state.grupo === "Conhecimento Geral"
        ? ["portugues", "ingles"]
        : ["especifica"];
      return uniq(
        subtopicos
          .filter((s) => categorias.includes(s.categoria))
          .map((s) => s.materia)
      );
    }
    if (state.level === 3) {
      return subtopicos.filter((s) => s.materia === state.materia);
    }
    if (state.level === 4) {
      const item = subtopicos.find((s) => s.id === state.subtopicoId);
      return item ? item.miniassuntos : [];
    }
    return [];
  }

    function getTitle() {
    if (state.level === 1) return "Área";
    if (state.level === 2) return "Matéria";
    if (state.level === 3) return "Subtópico";
    if (state.level === 4) return "Miniassunto";
    return "";
  }

    function selectItem(item) {
    if (state.level === 1) {
      state.grupo = item;
      state.level = 2;
      render();
    } else if (state.level === 2) {
      state.materia = item;
      const match = subtopicos.find((s) => s.materia === item);
      state.categoria = match ? match.categoria : null;
      state.level = 3;
      render();
    } else if (state.level === 3) {
      // item é o objeto subtopico completo
      state.subtopico = item.subtopico;
      state.subtopicoId = item.id;
      if (item.miniassuntos && item.miniassuntos.length > 0) {
        state.level = 4;
        render();
      } else {
        finish(null);
      }
    } else if (state.level === 4) {
      finish(item);
    }
  }

  function render() {
    root.innerHTML = "";

    const modal = document.createElement("div");
    modal.className = "seletor-modal";

    const header = document.createElement("div");
    header.className = "seletor-header";

    const backBtn = document.createElement("button");
    backBtn.className = "seletor-back-btn";
    backBtn.textContent = "←";
    backBtn.style.visibility = state.level === 1 ? "hidden" : "visible";
    backBtn.onclick = back;

    const title = document.createElement("span");
    title.className = "seletor-title";
    title.textContent = getTitle();

    const closeBtn = document.createElement("button");
    closeBtn.className = "seletor-close-btn";
    closeBtn.textContent = "×";
    closeBtn.onclick = close;

    header.appendChild(backBtn);
    header.appendChild(title);
    header.appendChild(closeBtn);

    const list = document.createElement("div");
    list.className = "seletor-list";

    const items = getItemsForLevel();

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "seletor-empty";
      empty.textContent = "Nada encontrado";
      list.appendChild(empty);
    } else {
      items.forEach((item) => {
        const row = document.createElement("button");
        row.className = "seletor-item";

        if (state.level === 3) {
          row.textContent = item.subtopico;
          const completo = item.status === "completo";
          row.classList.add(item.quente ? "seletor-item--quente" : "seletor-item--frio");
          if (completo) row.classList.add("seletor-item--completo");
        } else if (state.level === 2) {
          row.textContent = item;
          row.classList.add(MATERIA_QUENTE.has(item.trim()) ? "seletor-item--quente" : "seletor-item--frio");
        } else {
          row.textContent = item;
        }

        row.onclick = () => selectItem(item);
        list.appendChild(row);
      });
    }
    modal.appendChild(header);

    modal.appendChild(list);
    root.appendChild(modal);
  }

  getAppDataByKey("subtopicos")
  .then((data) => {
    subtopicos = Array.isArray(data) ? data : [];
    console.log("subtopicos carregados:", subtopicos);
    render();
  })
  .catch((err) => {
    console.error("Erro ao buscar subtopicos:", err);
  });
}
