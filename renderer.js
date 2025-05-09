// renderer.js (CommonJS continua ok com nodeIntegration: true)
const dashboard = require('../dashboard.js');
const cadastro  = require('../cadastro.js');
const despesas  = require('../despesas.js');
const relatorio = require('../relatorio.js');
const config    = require('../config.js');   // só tema

// Aplica o tema imediatamente, antes mesmo de qualquer renderização
(function() {
  try {
    // Tenta executar o mais cedo possível
    const saved = localStorage.getItem('theme');
    const dark = saved ? saved === 'dark' : true; // default = escuro
    if (dark) {
      document.documentElement.classList.add('preload-dark');
      document.body.classList.add('dark');
    }
  } catch (e) {
    console.warn('Erro ao aplicar tema precoce:', e);
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  config.initTheme();              // aplica tema antes de tudo

  // qual arquivo está aberto?  ex.: dashboard.html → "dashboard"
  const page = window.location.pathname.split('/').pop().replace('.html', '');

  // chama init correspondente
  switch (page) {
    case 'dashboard': dashboard.init(); break;
    case 'cadastro' : cadastro.init();  break;
    case 'despesas' : despesas.init();  break;
    case 'relatorio': relatorio.init(); break;
    case 'settings' : config.init();    break;      // tela de tema
  }
  
  // Adiciona classe para mostrar que o DOM está carregado
  document.body.classList.add('dom-loaded');
  
  // Ajusta a navegação para prevenir flash
  setupSmoothNavigation();
});

// Função para configurar navegação suave sem flash
function setupSmoothNavigation() {
  document.querySelectorAll('a[href]').forEach(link => {
    // Ignora links externos
    if (!link.href.includes(window.location.origin) || link.getAttribute('target')) {
      return;
    }
    
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Adiciona classe de transição
      document.body.classList.add('page-transition');
      
      // Aguarda a transição acontecer antes de navegar
      setTimeout(() => {
        window.location.href = link.href;
      }, 50); // Pequeno delay para a transição visual acontecer
    });
  });
}