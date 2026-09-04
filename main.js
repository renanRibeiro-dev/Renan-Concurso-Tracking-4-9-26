import "./style.css";
import { mount as mountInicial } from "./features/inicial.view.js";
import { mount as mountRegistrarQuestao } from "./features/registrar-questao.view.js";

const currentScreen = "inicial";
const app = document.getElementById("app");

function onNavigate(screen) {
  if (screen === "registrar-questao") {
    const popupContainer = document.createElement("div");
    document.body.appendChild(popupContainer);
    mountRegistrarQuestao(popupContainer, {
      onClose: () => popupContainer.remove()
    });
    return;
  }
  console.log("ir para:", screen);
}

function render() {
  switch (currentScreen) {
    case "inicial":
      mountInicial(app, { onNavigate });
      break;

    default:
      mountInicial(app, { onNavigate });
      break;
  }
}

render();