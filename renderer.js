// renderer.js (CommonJS continua ok com nodeIntegration: true)
const dashboard = require('../dashboard.js');
const cadastro  = require('../cadastro.js');
const despesas  = require('../despesas.js');
const relatorio = require('../relatorio.js');

let folhaPagamento;
try {
  folhaPagamento = require('../folha-pagamento.js');
  console.log('✅ RENDERER: folha-pagamento.js carregado com sucesso');
} catch (error) {
  console.error('❌ RENDERER: Erro ao carregar folha-pagamento.js:', error);
  folhaPagamento = { init: () => console.error('❌ folha-pagamento não disponível') };
}

const config    = require('../config.js');   // só tema
const utils     = require('../utils.js');    // utilitários gerais

let currentPage = null;
let isInitializing = false;

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
async function initCurrentPage() {
  // Evita inicializações simultâneas
  if (isInitializing) return;
  isInitializing = true;
  
  try {
    // qual arquivo está aberto?  ex.: dashboard.html → "dashboard"
    const page = window.location.pathname.split('/').pop().replace('.html', '');
    
    // Evita reinicializar a mesma página
    if (currentPage === page) {
      isInitializing = false;
      return;
    }
    currentPage = page;
    
    console.log('🚀 RENDERER: Inicializando página:', page);
    
    // Limpa possíveis conflitos de inicialização múltipla
    
    // Inicializa o sistema de modais globais
    utils.initModals();
    
    // Aplica tema antes de tudo
    config.initTheme();
    
    // Executa a inicialização com base na página
    switch (page) {
      case 'dashboard': 
        console.log('🚀 RENDERER: Inicializando dashboard...');
        // Inicia com um pequeno atraso para permitir a renderização da UI primeiro
        setTimeout(() => dashboard.init(), 50);
        break;
      case 'cadastro': 
        console.log('🚀 RENDERER: Inicializando cadastro...');
        cadastro.init();  
        break;
      case 'despesas': 
        console.log('🚀 RENDERER: Inicializando despesas...');
        despesas.init();  
        break;
      case 'relatorio': 
        console.log('🚀 RENDERER: Inicializando relatorio...');
        relatorio.init(); 
        break;
      case 'folha-pagamento':
        console.log('🚀 RENDERER: Inicializando folha-pagamento...');
        folhaPagamento.init();
        break;
      case 'graficos': 
        console.log('🚀 RENDERER: Inicializando gráficos...');
        setTimeout(() => dashboard.init(), 50);
        break;
      case 'settings': 
        console.log('🚀 RENDERER: Inicializando settings...');
        config.init();    
        break;      // tela de tema
      default:
        console.log('🚀 RENDERER: Página não reconhecida:', page);
    }
  } catch (error) {
    console.error(`Erro ao inicializar página:`, error);
  } finally {
    isInitializing = false;
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

// Função para configurar navegação suave sem flash - Otimizada
function setupSmoothNavigation() {
  document.body.addEventListener('click', (e) => {
    // Verifica se o clique foi em um link
    let target = e.target;
    while (target && target !== document.body) {
      if (target.tagName === 'A' && target.href) {
        // Ignora links externos
        if (!target.href.includes(window.location.origin) || target.getAttribute('target')) {
          return;
        }
        
        e.preventDefault();
        
        // Adiciona classe de transição
        document.body.classList.add('page-transition');
        
        // Aguarda a transição acontecer antes de navegar
        setTimeout(() => {
          window.location.href = target.href;
        }, 50); // Pequeno delay para a transição visual acontecer
        
        return;
      }
      target = target.parentNode;
    }
  });
}