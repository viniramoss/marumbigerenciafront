/* cadastro.js – formulário de lançamento com integração API */

const { API_URL } = require('./env-config');
let initialized = false;
let buffer = [];

function init() {
  if (initialized) return;
  initialized = true;

  const form = document.getElementById('entryForm');
  const tbody = document.querySelector('#preview tbody');

  setHoje();
    setTimeout(() => {
    const dataInput = form.querySelector('input[name="data"]');
    if (dataInput) dataInput.focus();
  }, 100);
  carregarUltimosLancamentos();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    
    // Prepara o objeto para enviar à API
    const formData = new FormData(form);
    const entrada = {
      data: formData.get('data'),
      operador: formData.get('operador'),
      unidade: formData.get('unidade'),
      dinheiro: parseFloat(formData.get('din') || 0),
      debito: parseFloat(formData.get('deb') || 0),
      credito: parseFloat(formData.get('cre') || 0),
      pix: parseFloat(formData.get('pix') || 0),
      voucher: parseFloat(formData.get('vou') || 0)
    };
    
    try {
      // Envia para a API
      const response = await fetch(`${API_URL}/api/entradas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entrada)
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao salvar entrada: ${response.status}`);
      }
      
      const savedEntry = await response.json();
      
      // Atualiza o buffer local e a tabela
      buffer.push(savedEntry);
      appendRow(savedEntry);
      
      // Limpa o formulário e mantém o foco
      form.reset();
      setHoje();
      form.data.focus();
      
    } catch (error) {
      console.error('Erro ao salvar entrada:', error);
      alert('Falha ao salvar entrada - veja o console');
    }
  });

  // Função para definir a data de hoje no formulário
  function setHoje() {
    form.data.value = new Date().toISOString().slice(0, 10);
  }

  // Função para formatar valores monetários
  function money(v) {
    return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }

  // Função para adicionar linha na tabela de preview
  function appendRow(o) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${o.data}</td>
      <td>${o.operador}</td>
      <td>${o.unidade}</td>
      <td>${money(o.dinheiro)}</td>
      <td>${money(o.debito)}</td>
      <td>${money(o.credito)}</td>
      <td>${money(o.pix)}</td>
      <td>${money(o.voucher)}</td>
      <td>${money(o.total)}</td>
      <td>
        <button class="btn-delete" data-id="${o.id}" title="Excluir">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>`;
      
    // Adiciona event listener para o botão de exclusão
    tr.querySelector('.btn-delete').addEventListener('click', async function() {
      const id = this.getAttribute('data-id');
      if (confirm('Tem certeza que deseja excluir este lançamento?')) {
        try {
          const response = await fetch(`${API_URL}/api/entradas/${id}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            throw new Error(`Erro ao excluir: ${response.status}`);
          }
          
          // Remove do buffer e da tabela
          const index = buffer.findIndex(item => item.id == id);
          if (index !== -1) {
            buffer.splice(index, 1);
          }
          
          tr.remove();
          
        } catch (error) {
          console.error('Erro ao excluir entrada:', error);
          alert('Falha ao excluir entrada - veja o console');
        }
      }
    });
    
    tbody.prepend(tr);
  }
  
  // Função para carregar os últimos lançamentos da API
  async function carregarUltimosLancamentos() {
    try {
      const response = await fetch(`${API_URL}/api/entradas`);
      
      if (!response.ok) {
        throw new Error(`Erro ao carregar entradas: ${response.status}`);
      }
      
      const entradas = await response.json();
      
      // Limita aos últimos 10 lançamentos
      const ultimasEntradas = entradas
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .slice(0, 10);
      
      // Atualiza o buffer local
      buffer = ultimasEntradas;
      
      // Limpa a tabela e adiciona as entradas
      tbody.innerHTML = '';
      ultimasEntradas.forEach(entrada => appendRow(entrada));
      
    } catch (error) {
      console.error('Erro ao carregar entradas:', error);
      tbody.innerHTML = '<tr><td colspan="10">Erro ao carregar dados - veja o console</td></tr>';
    }
  }
}

module.exports.init = init;