// env-config.js
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Função para determinar se estamos rodando em um executável empacotado
function isRunningAsPackaged() {
  // Verifica se estamos rodando a partir de um arquivo asar
  const isAsar = process.mainModule?.filename.includes('app.asar');
  
  // Verifica se a versão do Electron é a de produção
  const isProduction = process.env.NODE_ENV === 'production';
  
  return isAsar || isProduction;
}

// Obtém o caminho para o arquivo .env
function getEnvPath() {
  if (isRunningAsPackaged()) {
    // No ambiente de produção, o .env estará nos recursos extras
    return path.join(process.resourcesPath, '.env');
  } else {
    // Em desenvolvimento, usa o caminho relativo
    return path.join(__dirname, '.env');
  }
}

// Tenta carregar as variáveis de ambiente do arquivo .env
let envLoaded = false;
try {
  const envPath = getEnvPath();
  if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
    envLoaded = true;
  } else {
    console.warn('Arquivo .env não encontrado em:', envPath);
  }
} catch (err) {
  console.warn('Erro ao carregar .env:', err);
}

// URL da API padrão caso não esteja definida no .env
const DEFAULT_API_URL = 'https://marumbigerenciaback-production.up.railway.app/api';

// Exporta a URL da API
module.exports = {
  API_URL: process.env.VITE_API_URL || DEFAULT_API_URL,
  envLoaded: envLoaded
};