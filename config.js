/* config.js — agora com tema funcionando corretamente e sem flash */

// Script para aplicar tema imediatamente, mesmo antes da renderização do DOM
(function() {
  // Tenta executar o mais cedo possível
  const saved = localStorage.getItem('theme');
  const dark = saved ? saved === 'dark' : true; // default = escuro
  if (dark) {
    document.documentElement.classList.add('preload-dark');
    document.body.classList.add('dark');
  }
})();

function applyTheme(dark) {
  // Aplica classe dark no BODY e no HTML
  document.documentElement.classList.toggle('preload-dark', dark);
  document.body.classList.toggle('dark', dark);

  // Define a meta tag theme-color para ajustar a cor da UI do sistema
  let metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (!metaThemeColor) {
    metaThemeColor = document.createElement('meta');
    metaThemeColor.name = 'theme-color';
    document.head.appendChild(metaThemeColor);
  }
  metaThemeColor.content = dark ? '#181a1b' : '#f5f7fa';

  // Atualiza legenda, se existir na página
  const lbl = document.getElementById('themeLabel');
  if (lbl) lbl.textContent = dark ? 'Tema Escuro' : 'Tema Claro';
}

function initTheme() {
  /* 1) busca valor salvo; 2) se não existir, assume escuro */
  const saved = localStorage.getItem('theme');          // "dark" | "light" | null
  const dark  = saved ? saved === 'dark' : true;        // default = escuro
  applyTheme(dark);

  /* liga o toggle se a página for settings.html */
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.checked = dark;
    toggle.onchange = () => {
      localStorage.setItem('theme', toggle.checked ? 'dark' : 'light');
      applyTheme(toggle.checked);
    };
  }
}

function init() { /* vazio (apenas para cumprir interface) */ }

module.exports = { initTheme, init };