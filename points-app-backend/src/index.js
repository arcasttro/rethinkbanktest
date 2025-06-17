import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { supabase } from './supabaseClient.js';

dotenv.config();
const app = express();
app.use(express.json());

// Configuração do transportador de e-mail
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  secure: false,               // use TLS if true
  connectionTimeout: 5000,     // 5s para estabelecer conexão
  greetingTimeout: 5000,       // 5s para saudação do servidor
  // opcionalmente habilite debug: debug: true, logger: true
});

// --- Helper: gerar JWT (session & confirmação/reset) ---
function generateToken(payload, expiresIn) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

// --- Middleware de autenticação ---
function ensureAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Não autorizado' });
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Formato inválido' });

  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// --- 1. Cadastro ---
app.post('/cadastro', async (req, res) => {
  const { cpf, full_name, email, password, confirmPassword } = req.body;
  // Validações básicas
  if (!/^[0-9]{11}$/.test(cpf)) return res.status(400).json({ error: 'CPF inválido' });
  if (!/^\S+\s+\S+/.test(full_name)) return res.status(400).json({ error: 'Nome completo obrigatório' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Senhas não conferem' });
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/.test(password)) {
    return res.status(400).json({ error: 'Senha fraca' });
  }

  // Hash da senha
  const password_hash = await bcrypt.hash(password, 10);

  // Insere no Supabase e retorna os dados
  const { data, error } = await supabase
    .from('users')
    .insert([{ cpf, full_name, email, password_hash }])
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }
  if (!data || !data.id) {
    return res.status(500).json({ error: 'Erro interno ao criar usuário' });
  }

  // Gera token de confirmação de e-mail (24h) e retorna no response
  const confirmToken = generateToken({ userId: data.id }, '24h');

  res.status(201).json({
    message: 'Cadastro realizado com sucesso.',
    confirmToken
  });
});

// --- 2. Confirmação de E-mail ---
app.get('/confirm-email', async (req, res) => {
  const { token } = req.query;
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    await supabase
      .from('users')
      .update({ email_confirmed: true })
      .eq('id', userId);
    res.send('E-mail confirmado com sucesso.');
  } catch {
    res.status(400).send('Token inválido ou expirado.');
  }
});

// --- 3. Login ---
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) return res.status(400).json({ error: 'Credenciais inválidas' });
  if (!user.email_confirmed) return res.status(403).json({ error: 'E-mail não confirmado' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Credenciais inválidas' });

  const sessionToken = generateToken({ userId: user.id }, '10m');
  res.json({ token: sessionToken });
});

// --- 4. Esqueci Senha ---
app.post('/forgot-password', async (req, res) => {
  const { cpf } = req.body;
  const { data: user, error } = await supabase
    .from('users')
    .select('id,email')
    .eq('cpf', cpf)
    .single();

  if (error || !user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const resetToken = generateToken({ userId: user.id }, '1h');
  const resetLink = `${process.env.APP_URL}/reset-password?token=${resetToken}`;

  await transport.sendMail({
    to: user.email,
    subject: 'Redefinição de senha - Points App',
    html: `<p>Clique <a href="${resetLink}">aqui</a> para redefinir sua senha.</p>`
  });

  res.json({ message: 'E-mail de redefinição enviado.' });
});

// --- 5. Redefinir Senha ---
app.post('/reset-password', async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;
  if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Senhas não conferem' });
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/.test(newPassword)) {
    return res.status(400).json({ error: 'Senha fraca' });
  }

  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const password_hash = await bcrypt.hash(newPassword, 10);
    await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', userId);
    res.json({ message: 'Senha redefinida com sucesso.' });
  } catch {
    res.status(400).json({ error: 'Token inválido ou expirado' });
  }
});

// --- 6. Excluir Conta (soft delete) ---
app.delete('/account', ensureAuth, async (req, res) => {
  const { password } = req.body;
  const { data: user } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', req.userId)
    .single();

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Senha inválida' });

  await supabase
    .from('users')
    .update({ status: 'deleted_by_user' })
    .eq('id', req.userId);

  res.json({ message: 'Conta marcada como deletada.' });
});

// --- 7. Enviar Pontos ---
app.post('/points/send', ensureAuth, async (req, res) => {
  const { recipientCpf, amount } = req.body;
  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Valor inválido' });

  // Transação atômica:
  const { data: sender } = await supabase
    .from('users')
    .select('normal_balance')
    .eq('id', req.userId)
    .single();
  if (sender.normal_balance < amt) return res.status(400).json({ error: 'Saldo insuficiente' });

  const { data: recipient } = await supabase
    .from('users')
    .select('id')
    .eq('cpf', recipientCpf)
    .eq('status', 'active')
    .single();
  if (!recipient) return res.status(404).json({ error: 'Usuário destino não encontrado' });

  const updates = [];
  updates.push(
    supabase.from('users').update({ normal_balance: sender.normal_balance - amt }).eq('id', req.userId)
  );
  updates.push(
    supabase.from('users').update({ normal_balance: recipient.normal_balance + amt }).eq('id', recipient.id)
  );
  updates.push(
    supabase.from('point_transactions').insert([{ from_user: req.userId, to_user: recipient.id, amount: amt }])
  );
  await Promise.all(updates);

  res.json({ message: 'Pontos enviados com sucesso.' });
});

// --- 8. Extrato de Pontos ---
app.get('/points/extrato', ensureAuth, async (req, res) => {
  const { data: tx } = await supabase
    .from('point_transactions')
    .select('*')
    .or(`from_user.eq.${req.userId},to_user.eq.${req.userId}`)
    .order('created_at', { ascending: false });
  res.json(tx);
});

// --- 9. Caixinha de Pontos ---
app.post('/caixinha/deposit', ensureAuth, async (req, res) => {
  const { amount } = req.body;
  const amt = Number(amount);
  const { data: user } = await supabase
    .from('users')
    .select('normal_balance')
    .eq('id', req.userId)
    .single();
  if (user.normal_balance < amt) return res.status(400).json({ error: 'Saldo insuficiente' });

  await supabase.from('users')
    .update({ normal_balance: user.normal_balance - amt, piggy_bank_balance: user.piggy_bank_balance + amt })
    .eq('id', req.userId);
  await supabase.from('piggy_bank_transactions')
    .insert([{ user_id: req.userId, type: 'deposit', amount: amt }]);

  res.json({ message: 'Depósito na caixinha realizado.' });
});

app.post('/caixinha/withdraw', ensureAuth, async (req, res) => {
  const { amount } = req.body;
  const amt = Number(amount);
  const { data: user } = await supabase
    .from('users')
    .select('piggy_bank_balance')
    .eq('id', req.userId)
    .single();
  if (user.piggy_bank_balance < amt) return res.status(400).json({ error: 'Saldo na caixinha insuficiente' });

  await supabase.from('users')
    .update({ normal_balance: user.normal_balance + amt, piggy_bank_balance: user.piggy_bank_balance - amt })
    .eq('id', req.userId);
  await supabase.from('piggy_bank_transactions')
    .insert([{ user_id: req.userId, type: 'withdraw', amount: amt }]);

  res.json({ message: 'Resgate da caixinha realizado.' });
});

app.get('/caixinha/extrato', ensureAuth, async (req, res) => {
  const { data } = await supabase
    .from('piggy_bank_transactions')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });
  res.json(data);
});

app.get('/points/saldo', ensureAuth, async (req, res) => {
  const userId = req.userId;

  // Saldo base
  const { data: userData, error: userErr } = await supabase
    .from('users')
    .select('normal_balance, piggy_bank_balance')
    .eq('id', userId)
    .single();
  if (userErr || !userData) return res.status(500).json({ error: 'Erro ao obter saldo base' });

  const baseBalance = Number(userData.normal_balance) || 0;
  const piggyBankBalance = Number(userData.piggy_bank_balance) || 0;

  // Calcula saldo recebidos
  let totalReceived = 0;
  const { data: recvData, error: recvErr } = await supabase
    .from('point_transactions')
    .select('sum(amount)')
    .eq('to_user', userId)
    .single();
  if (!recvErr && recvData && recvData.sum) totalReceived = Number(recvData.sum);

  // Calcula saldo enviados
  let totalSent = 0;
  const { data: sentData, error: sentErr } = await supabase
    .from('point_transactions')
    .select('sum(amount)')
    .eq('from_user', userId)
    .single();
  if (!sentErr && sentData && sentData.sum) totalSent = Number(sentData.sum);

  // Saldo normal consolidado
  const normalBalance = baseBalance + (totalReceived - totalSent);

  res.json({
    normal_balance: normalBalance,
    piggy_bank_balance: piggyBankBalance
  });
});


// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));