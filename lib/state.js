// lib/state.js
let currentAssunto = null;

export function getCurrentAssunto() {
  return currentAssunto;
}

export function setCurrentAssunto(assunto) {
  currentAssunto = assunto;
}