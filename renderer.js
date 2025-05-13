// renderer.js (CommonJS continua ok com nodeIntegration: true)
const dashboard = require('../dashboard.js');
const cadastro  = require('../cadastro.js');
const despesas  = require('../despesas.js');
const relatorio = require('../relatorio.js');
const config    = require('../config.js');   // só tema

let currentPage = null;

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

// Função para inicializar a página atual
function initCurrentPage() {
  // qual arquivo está aberto?  ex.: dashboard.html → "dashboard"
  const page = window.location.pathname.split('/').pop().replace('.html', '');
  
  // Evita reinicializar a mesma página
  if (currentPage === page) return;
  currentPage = page;
  
  // Limpa quaisquer timers ou event listeners pendentes
  window.clearTimeout();
  
  // Aplica tema antes de tudo
  config.initTheme();
  
  // chama init correspondente com tratamento de erros
  try {
    switch (page) {
      case 'dashboard': dashboard.init(); break;
      case 'cadastro' : cadastro.init();  break;
      case 'despesas' : despesas.init();  break;
      case 'relatorio': relatorio.init(); break;
      case 'settings' : config.init();    break;      // tela de tema
    }
  } catch (error) {
    console.error(`Erro ao inicializar página ${page}:`, error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Inicializa a página atual
  initCurrentPage();
  
  // Adiciona classe para mostrar que o DOM está carregado
  document.body.classList.add('dom-loaded');
  
  // Ajusta a navegação para prevenir flash
  setupSmoothNavigation();
});

// Função para configurar navegação suave sem flash
function setupSmoothNavigation() {
  document.querySelectorAll('a[href]').forEach(link => {
    // Remove event listeners antigos para evitar duplicação
    const newLink = link.cloneNode(true);
    link.parentNode.replaceChild(newLink, link);
    
    // Ignora links externos
    if (!newLink.href.includes(window.location.origin) || newLink.getAttribute('target')) {
      return;
    }
    
    newLink.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Adiciona classe de transição
      document.body.classList.add('page-transition');
      
      // Aguarda a transição acontecer antes de navegar
      setTimeout(() => {
        window.location.href = newLink.href;
      }, 50); // Pequeno delay para a transição visual acontecer
    });
  });
}