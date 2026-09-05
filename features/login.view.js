// features/login.view.js
//
// Tela de login: email + senha, autentica via lib/supabase.js (login()).
// Sem isso, todo insert/select em questoes_v2 falha (RLS exige auth.uid()).
import "./login.style.css";
import { login } from "../lib/supabase.js";

export function mount(container, { onLoginSuccess } = {}) {
  container.innerHTML = `
    <section class="login">
      <div class="login__card">
        <h1 class="login__titulo">Entrar</h1>

        <div class="login__field">
          <label class="login__label" for="login-email">E-mail</label>
          <input class="login__input" id="login-email" type="email" autocomplete="username" />
        </div>

        <div class="login__field">
          <label class="login__label" for="login-senha">Senha</label>
          <input class="login__input" id="login-senha" type="password" autocomplete="current-password" />
        </div>

        <p class="login__erro" hidden></p>

        <button type="button" class="login__btn" id="login-btn">Entrar</button>
      </div>
    </section>
  `;

  const emailInput = container.querySelector("#login-email");
  const senhaInput = container.querySelector("#login-senha");
  const erroEl = container.querySelector(".login__erro");
  const btn = container.querySelector("#login-btn");

  async function tentarLogin() {
    erroEl.hidden = true;

    const email = emailInput.value.trim();
    const senha = senhaInput.value;

    if (!email || !senha) {
      erroEl.textContent = "Preencha e-mail e senha.";
      erroEl.hidden = false;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Entrando…";

    const { data, error } = await login(email, senha);

    if (error) {
      erroEl.textContent = "E-mail ou senha inválidos.";
      erroEl.hidden = false;
      btn.disabled = false;
      btn.textContent = "Entrar";
      return;
    }

    if (typeof onLoginSuccess === "function") onLoginSuccess(data);
  }

  btn.addEventListener("click", tentarLogin);
  senhaInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tentarLogin();
  });
}
