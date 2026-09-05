import "./style.css";
import { mount as mountInicial } from "./features/inicial.view.js";
import { mount as mountRegistrarQuestao } from "./features/registrar-questao.view.js";
import { mount as mountSeletor } from "./features/seletor.view.js";
import { mount as mountReteste } from "./features/reteste.view.js";
import { mount as mountLogin } from "./features/login.view.js";
import { setCurrentAssunto } from "./lib/state.js";
import { getSession } from "./lib/supabase.js";

let currentScreen = "inicial";
const app = document.getElementById("app");

function render() {
  switch (currentScreen) {
    case "inicial":
      mountInicial(app, { onNavigate });
      break;

    case "reteste":
      mountReteste(app, { onNavigate });
      break;

    default:
      mountInicial(app, { onNavigate });
      break;
  }
}

function abrirSeletor(onDone) {
  const popupContainer = document.createElement("div");
  document.body.appendChild(popupContainer);
  mountSeletor(popupContainer, {
    onSelect: (assunto) => {
      setCurrentAssunto(assunto);
      popupContainer.remove();
      if (onDone) onDone(assunto);
    },
    onClose: () => popupContainer.remove()

  });
}

function onNavigate(screen) {
  if (screen === "inicial" || screen === "reteste") {
    currentScreen = screen;
    render();
    return;
  }

  if (screen === "registrar-questao") {
    const c = document.createElement("div");
    document.body.appendChild(c);
    let assuntoAtual = null;
    mountRegistrarQuestao(c, {
      onClose: () => c.remove(),
      onEscolherAssunto: () => {
        c.remove();
        abrirSeletor((assunto) => {
          assuntoAtual = assunto;
          const c2 = document.createElement("div");
          document.body.appendChild(c2);
          mountRegistrarQuestao(c2, {
            onClose: () => c2.remove(),
            subtopicoId: assunto.subtopicoId,
            miniAssunto: assunto.miniassunto || assunto.subtopico,
            miniAssuntoSelecionado: !!assunto.miniassunto,
            onEscolherAssunto: () => {
              c2.remove();
              onNavigate("registrar-questao");
            },
          });
        });
      },
    });
    return;
  }
 if (screen === "trocar-disciplina" || screen === "miniassunto") {
    abrirSeletor(() => render()); // atualiza a tela inicial após escolher
    return;
  }
  console.log("ir para:", screen);
}

async function boot() {
  const { session } = await getSession();
  if (session) {
    render();
  } else {
    mountLogin(app, {
      onLoginSuccess: () => {
        currentScreen = "inicial";
        render();
      },
    });
  }
}

boot();
