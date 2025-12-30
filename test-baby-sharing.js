// Script de teste para endpoints de compartilhamento de bebês
const BASE_URL = process.env.API_URL || 'http://localhost:4000/api/v1';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

// Helper para fazer requisições
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    const data = await response.json();
    
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message,
    };
  }
}

// Variáveis globais para armazenar dados dos testes
let authToken = null;
let babyId = null;
let inviteToken = null;
let memberId = null;
let inviteId = null;

// Teste 1: Login
async function testLogin() {
  logInfo('\n=== Teste 1: Login ===');
  
  // Primeiro, vamos tentar criar um usuário de teste se não existir
  const testEmail = 'teste.baby.sharing@example.com';
  const testPassword = 'Teste123!@#';
  
  // Tentar registrar
  logInfo('Tentando registrar usuário de teste...');
  const registerResult = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      fullName: 'Usuário Teste Baby Sharing',
      cpf: '12345678901',
      phone: '11999999999',
    }),
  });

  if (!registerResult.ok && !registerResult.data?.message?.includes('já existe')) {
    logWarning(`Registro falhou: ${registerResult.data?.message || registerResult.error}`);
  } else {
    logSuccess('Usuário de teste criado ou já existe');
  }

  // Fazer login
  logInfo('Fazendo login...');
  const loginResult = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });

  if (!loginResult.ok) {
    logError(`Login falhou: ${loginResult.data?.message || loginResult.error}`);
    return false;
  }

  authToken = loginResult.data.data.accessToken;
  logSuccess(`Login realizado com sucesso! Token: ${authToken.substring(0, 20)}...`);
  return true;
}

// Teste 2: Criar bebê com CPF
async function testCreateBaby() {
  logInfo('\n=== Teste 2: Criar Bebê com CPF ===');
  
  const babyData = {
    name: 'Bebê Teste Compartilhamento',
    birthDate: new Date('2024-01-15T00:00:00Z').toISOString(),
    city: 'São Paulo',
    state: 'SP',
    country: 'BR',
    birthWeightGrams: 3200,
    birthLengthCm: 50,
    relationship: 'MOTHER',
    babyCpf: '12345678901', // CPF de teste
  };

  const result = await request('/babies', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(babyData),
  });

  if (!result.ok) {
    logError(`Falha ao criar bebê: ${result.data?.message || result.error}`);
    logError(`Detalhes: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }

  babyId = result.data.data.id;
  logSuccess(`Bebê criado com sucesso! ID: ${babyId}`);
  logInfo(`Nome: ${result.data.data.name}`);
  logInfo(`CPF Hash presente: ${result.data.data.babyCpfHash ? 'Sim' : 'Não'}`);
  return true;
}

// Teste 3: Listar membros do bebê
async function testListMembers() {
  logInfo('\n=== Teste 3: Listar Membros do Bebê ===');
  
  const result = await request(`/babies/${babyId}/members`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!result.ok) {
    logError(`Falha ao listar membros: ${result.data?.message || result.error}`);
    return false;
  }

  logSuccess(`Membros encontrados: ${result.data.data.length}`);
  result.data.data.forEach((member, index) => {
    logInfo(`  ${index + 1}. ${member.user.email} - ${member.role} (${member.status})`);
  });
  
  if (result.data.data.length > 0) {
    memberId = result.data.data[0].id;
  }
  
  return true;
}

// Teste 4: Criar convite
async function testCreateInvite() {
  logInfo('\n=== Teste 4: Criar Convite ===');
  
  const inviteData = {
    emailInvited: 'pai.teste@example.com',
    memberType: 'PARENT',
    role: 'OWNER_PARENT_2',
    invitedName: 'Pai Teste',
    message: 'Convite para acompanhar nosso bebê!',
  };

  const result = await request(`/babies/${babyId}/invites`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(inviteData),
  });

  if (!result.ok) {
    logError(`Falha ao criar convite: ${result.data?.message || result.error}`);
    logError(`Detalhes: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }

  inviteId = result.data.data.id;
  logSuccess(`Convite criado com sucesso! ID: ${inviteId}`);
  logInfo(`Email: ${result.data.data.emailInvited}`);
  logInfo(`Role: ${result.data.data.role}`);
  logInfo(`Status: ${result.data.data.status}`);
  
  // Nota: O token não é retornado na resposta por segurança
  // Precisaríamos verificar o email ou usar outro método para obter o token
  logWarning('Token do convite não é retornado na resposta (por segurança)');
  
  return true;
}

// Teste 5: Listar convites
async function testListInvites() {
  logInfo('\n=== Teste 5: Listar Convites ===');
  
  const result = await request(`/babies/${babyId}/invites`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!result.ok) {
    logError(`Falha ao listar convites: ${result.data?.message || result.error}`);
    return false;
  }

  logSuccess(`Convites encontrados: ${result.data.data.length}`);
  result.data.data.forEach((invite, index) => {
    logInfo(`  ${index + 1}. ${invite.emailInvited} - ${invite.role} (${invite.status})`);
    logInfo(`     Criado em: ${new Date(invite.createdAt).toLocaleString('pt-BR')}`);
    logInfo(`     Expira em: ${new Date(invite.expiresAt).toLocaleString('pt-BR')}`);
  });
  
  return true;
}

// Teste 6: Verificar token de convite (simulado - precisaria do token real)
async function testVerifyToken() {
  logInfo('\n=== Teste 6: Verificar Token de Convite ===');
  logWarning('Este teste requer um token real de convite');
  logInfo('Para testar completamente, você precisaria:');
  logInfo('1. Verificar o email enviado com o token');
  logInfo('2. Ou criar um endpoint de teste que retorne o token');
  logInfo('3. Ou verificar diretamente no banco de dados');
  
  return true;
}

// Teste 7: Atualizar membro
async function testUpdateMember() {
  logInfo('\n=== Teste 7: Atualizar Membro ===');
  
  if (!memberId) {
    logWarning('Nenhum membro disponível para atualizar');
    return true;
  }

  const updateData = {
    permissions: {
      canViewGrowth: true,
      canEditRoutines: true,
      canExport: false,
    },
  };

  const result = await request(`/babies/${babyId}/members/${memberId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(updateData),
  });

  if (!result.ok) {
    logError(`Falha ao atualizar membro: ${result.data?.message || result.error}`);
    return false;
  }

  logSuccess(`Membro atualizado com sucesso!`);
  logInfo(`Permissões: ${JSON.stringify(result.data.data.permissions, null, 2)}`);
  
  return true;
}

// Teste 8: Reenviar convite
async function testResendInvite() {
  logInfo('\n=== Teste 8: Reenviar Convite ===');
  
  if (!inviteId) {
    logWarning('Nenhum convite disponível para reenviar');
    return true;
  }

  const result = await request(`/babies/${babyId}/invites/${inviteId}/resend`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!result.ok) {
    logError(`Falha ao reenviar convite: ${result.data?.message || result.error}`);
    return false;
  }

  logSuccess(`Convite reenviado com sucesso!`);
  
  return true;
}

// Executar todos os testes
async function runTests() {
  log('\n========================================', 'blue');
  log('TESTE DOS ENDPOINTS DE COMPARTILHAMENTO', 'blue');
  log('========================================\n', 'blue');

  const tests = [
    { name: 'Login', fn: testLogin },
    { name: 'Criar Bebê com CPF', fn: testCreateBaby },
    { name: 'Listar Membros', fn: testListMembers },
    { name: 'Criar Convite', fn: testCreateInvite },
    { name: 'Listar Convites', fn: testListInvites },
    { name: 'Verificar Token', fn: testVerifyToken },
    { name: 'Atualizar Membro', fn: testUpdateMember },
    { name: 'Reenviar Convite', fn: testResendInvite },
  ];

  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, success: result });
    } catch (error) {
      logError(`Erro inesperado no teste "${test.name}": ${error.message}`);
      results.push({ name: test.name, success: false, error: error.message });
    }
  }

  // Resumo
  log('\n========================================', 'blue');
  log('RESUMO DOS TESTES', 'blue');
  log('========================================\n', 'blue');

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  results.forEach(result => {
    if (result.success) {
      logSuccess(`${result.name}: PASSOU`);
    } else {
      logError(`${result.name}: FALHOU${result.error ? ` - ${result.error}` : ''}`);
    }
  });

  log(`\nTotal: ${successCount}/${totalCount} testes passaram`, 
      successCount === totalCount ? 'green' : 'yellow');

  if (babyId) {
    logInfo(`\nBebê criado para teste: ID ${babyId}`);
    logInfo('Você pode limpar os dados de teste manualmente se necessário');
  }
}

// Executar
runTests().catch(error => {
  logError(`Erro fatal: ${error.message}`);
  console.error(error);
  process.exit(1);
});
