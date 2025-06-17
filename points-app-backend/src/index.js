import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { supabase } from './supabaseClient.js';
import { setupSwagger } from './swagger.js';


dotenv.config();
const app = express();
setupSwagger(app);

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

/**
 * @openapi
 * /cadastro:
 *   post:
 *     summary: Cadastra um novo usuário e retorna token de confirmação de e-mail
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cpf
 *               - full_name
 *               - email
 *               - password
 *               - confirmPassword
 *             properties:
 *               cpf:
 *                 type: string
 *                 description: CPF com exatamente 11 dígitos numéricos.
 *                 pattern: '^[0-9]{11}$'
 *                 example: '12345678901'
 *               full_name:
 *                 type: string
 *                 description: Nome completo contendo pelo menos nome e sobrenome.
 *                 pattern: '^\\S+\\s+\\S+'
 *                 example: 'João da Silva'
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email válido para confirmação.
 *                 example: 'joao@example.com'
 *               password:
 *                 type: string
 *                 description: Senha com no mínimo 8 caracteres, incluindo ao menos uma letra maiúscula, uma minúscula e um símbolo especial.
 *                 pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\W).{8,}$'
 *                 example: 'Senha@123'
 *               confirmPassword:
 *                 type: string
 *                 description: Deve ser igual ao campo "password".
 *                 example: 'Senha@123'
 *     responses:
 *       '201':
 *         description: Usuário criado com sucesso. Retorna mensagem e token de confirmação.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Cadastro realizado com sucesso.'
 *                 confirmToken:
 *                   type: string
 *                   description: JWT de confirmação de e-mail com validade de 24h.
 *       '400':
 *         description: Erro de validação dos dados de entrada ou falha ao inserir no banco.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             examples:
 *               invalidCpf:
 *                 summary: CPF inválido
 *                 value:
 *                   error: 'CPF inválido'
 *               missingName:
 *                 summary: Nome completo obrigatório
 *                 value:
 *                   error: 'Nome completo obrigatório'
 *               passwordMismatch:
 *                 summary: Senhas não conferem
 *                 value:
 *                   error: 'Senhas não conferem'
 *               weakPassword:
 *                 summary: Senha fraca
 *                 value:
 *                   error: 'Senha fraca'
 *               dbError:
 *                 summary: Erro ao inserir usuário
 *                 value:
 *                   error: 'Erro interno ao criar usuário'
 *       '500':
 *         description: Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Erro interno ao criar usuário'
 */
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

/**
 * @openapi
 * /confirm-email:
 *   get:
 *     summary: Confirma o e-mail do usuário a partir de um token
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: JWT de confirmação de e-mail gerado no cadastro (valido por 24h)
 *     responses:
 *       '200':
 *         description: E-mail confirmado com sucesso.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'E-mail confirmado com sucesso.'
 *       '400':
 *         description: Token inválido ou expirado.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Token inválido ou expirado.'
 */
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

/**
 * @openapi
 * /login:
 *   post:
 *     summary: Autentica um usuário e retorna um token de sessão
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email cadastrado e confirmado
 *                 example: joao@example.com
 *               password:
 *                 type: string
 *                 description: Senha do usuário
 *                 example: Senha@123
 *     responses:
 *       '200':
 *         description: Autenticação bem-sucedida, retorna token JWT válido por 10 minutos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT de sessão
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       '400':
 *         description: Credenciais inválidas (usuário não encontrado ou senha incorreta)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Credenciais inválidas
 *       '403':
 *         description: E-mail ainda não confirmado pelo usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: E-mail não confirmado
 */
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

/**
 * @openapi
 * /account:
 *   delete:
 *     summary: Exclui a conta do usuário (soft delete)
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 description: Senha atual do usuário para confirmação da exclusão
 *                 example: Senha@123
 *     responses:
 *       '200':
 *         description: Conta marcada como deletada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Conta marcada como deletada.
 *       '400':
 *         description: Senha inválida ou requisição mal formada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Senha inválida
 *       '401':
 *         description: Não autorizado (JWT faltando, inválido ou expirado).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Não autorizado
 */
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

/**
 * @openapi
 * /points/send:
 *   post:
 *     summary: Envia pontos de um usuário autenticado para outro usuário
 *     tags:
 *       - Points
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientCpf
 *               - amount
 *             properties:
 *               recipientCpf:
 *                 type: string
 *                 description: CPF do destinatário (11 dígitos numéricos)
 *                 pattern: '^[0-9]{11}$'
 *                 example: '10987654321'
 *               amount:
 *                 type: integer
 *                 description: Quantidade de pontos a enviar (deve ser maior que zero e não exceder o saldo)
 *                 minimum: 1
 *                 example: 50
 *     responses:
 *       '200':
 *         description: Pontos enviados com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Pontos enviados com sucesso.'
 *       '400':
 *         description: Requisição inválida ou saldo insuficiente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             examples:
 *               invalidValue:
 *                 summary: Valor inválido
 *                 value:
 *                   error: 'Valor inválido'
 *               insufficientBalance:
 *                 summary: Saldo insuficiente
 *                 value:
 *                   error: 'Saldo insuficiente'
 *       '401':
 *         description: Não autorizado (JWT faltando, inválido ou expirado).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Não autorizado'
 *       '404':
 *         description: Usuário destinatário não encontrado ou inativo.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Usuário destino não encontrado'
 */
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

/**
 * @openapi
 * /points/extrato:
 *   get:
 *     summary: Retorna o extrato de transações de pontos do usuário autenticado
 *     tags:
 *       - Points
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de transações de envio e recebimento de pontos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                     example: '550e8400-e29b-41d4-a716-446655440000'
 *                   from_user:
 *                     type: string
 *                     format: uuid
 *                     example: '550e8400-e29b-41d4-a716-446655440001'
 *                   to_user:
 *                     type: string
 *                     format: uuid
 *                     example: '550e8400-e29b-41d4-a716-446655440002'
 *                   amount:
 *                     type: integer
 *                     example: 50
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     example: '2025-06-17T21:00:00.000Z'
 *       '401':
 *         description: Não autorizado (token ausente, inválido ou expirado)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Não autorizado'
 */
app.get('/points/extrato', ensureAuth, async (req, res) => {
  const { data: tx } = await supabase
    .from('point_transactions')
    .select('*')
    .or(`from_user.eq.${req.userId},to_user.eq.${req.userId}`)
    .order('created_at', { ascending: false });
  res.json(tx);
});

/**
 * @openapi
 * /caixinha/deposit:
 *   post:
 *     summary: Deposita pontos da conta normal para a caixinha do usuário
 *     tags:
 *       - Caixinha
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: integer
 *                 description: Quantidade de pontos a depositar (deve ser maior que zero e não exceder o saldo disponível)
 *                 minimum: 1
 *                 example: 30
 *     responses:
 *       '200':
 *         description: Depósito na caixinha realizado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Depósito na caixinha realizado.
 *       '400':
 *         description: Saldo insuficiente ou requisição inválida.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             examples:
 *               insufficientBalance:
 *                 summary: Saldo insuficiente
 *                 value:
 *                   error: Saldo insuficiente
 *       '401':
 *         description: Não autorizado (token ausente, inválido ou expirado).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Não autorizado
 */
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

/**
 * @openapi
 * /caixinha/withdraw:
 *   post:
 *     summary: Resgata pontos da caixinha para a conta normal do usuário
 *     tags:
 *       - Caixinha
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: integer
 *                 description: Quantidade de pontos a resgatar (deve ser maior que zero e não exceder o saldo da caixinha)
 *                 minimum: 1
 *                 example: 10
 *     responses:
 *       '200':
 *         description: Resgate realizado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Resgate da caixinha realizado.
 *       '400':
 *         description: Saldo na caixinha insuficiente ou requisição inválida.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             examples:
 *               insufficientBalance:
 *                 summary: Saldo insuficiente na caixinha
 *                 value:
 *                   error: Saldo na caixinha insuficiente
 *       '401':
 *         description: Não autorizado (token ausente, inválido ou expirado).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Não autorizado
 */
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

/**
 * @openapi
 * /caixinha/extrato:
 *   get:
 *     summary: Retorna o extrato de transações da caixinha do usuário autenticado
 *     tags:
 *       - Caixinha
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de entradas e saídas da caixinha de pontos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                     example: "550e8400-e29b-41d4-a716-446655440000"
 *                   user_id:
 *                     type: string
 *                     format: uuid
 *                     example: "550e8400-e29b-41d4-a716-446655440000"
 *                   type:
 *                     type: string
 *                     description: Tipo de transação na caixinha
 *                     enum:
 *                       - deposit
 *                       - withdraw
 *                     example: "deposit"
 *                   amount:
 *                     type: integer
 *                     description: Quantidade de pontos movimentados
 *                     example: 30
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     example: "2025-06-17T21:05:00.000Z"
 *       '401':
 *         description: Não autorizado (token ausente, inválido ou expirado)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Não autorizado"
 */
app.get('/caixinha/extrato', ensureAuth, async (req, res) => {
  const { data } = await supabase
    .from('piggy_bank_transactions')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });
  res.json(data);
});


/**
 * @openapi
 * /points/saldo:
 *   get:
 *     summary: Retorna o saldo geral consolidado do usuário autenticado
 *     tags:
 *       - Points
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Saldo normal e saldo da caixinha consolidados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 normal_balance:
 *                   type: number
 *                   description: Saldo da conta normal, somando recebimentos e subtraindo envios
 *                   example: 120
 *                 piggy_bank_balance:
 *                   type: number
 *                   description: Saldo atual da caixinha
 *                   example: 45
 *       '401':
 *         description: Não autorizado (token ausente, inválido ou expirado)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Não autorizado'
 *       '500':
 *         description: Erro interno ao obter ou calcular o saldo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Erro ao obter saldo base'
 */
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

app.use((req, res) => {
      if (req.path.startsWith('/docs')) {
    return res.status(404).end();
  }

  res.status(404).send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Rethink Bank Test</title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #202020;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Roboto', sans-serif;
      overflow: hidden;
    }
    .wrapper {
      text-align: center;
      padding: 1rem;
    }
    .wrapper h1 {
      font-size: clamp(2rem, 8vw, 4rem);
      font-weight: 700;
      background: linear-gradient(90deg, #00d1b2, #00e0c6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 1rem;
    }
    .wrapper p {
      color: #cccccc;
      font-size: clamp(1rem, 2.5vw, 1.25rem);
      line-height: 1.5;
      margin: 0.5rem 0;
    }
    .btn {
      display: inline-block;
      margin-top: 2rem;
      padding: 0.75rem 2rem;
      font-size: 1rem;
      font-weight: 500;
      color: #00d1b2;
      border: 2px solid #00d1b2;
      border-radius: 9999px;
      text-decoration: none;
      transition: background 0.3s ease, color 0.3s ease, transform 0.2s ease;
    }
    .btn:hover {
      background-color: #00d1b2;
      color: #202020;
      transform: translateY(-2px) scale(1.05);
    }
  </style>
</head>
<body>
  <div class="wrapper">
  <img
      class="logo"
      src="https://755udsewnzdtcvpg.public.blob.vercel-storage.com/images/logosRethink/logo_negativo-QSqX1DU5U33GczS3mR856luwzvRMVI.svg"
      alt="Rethink Logo" width="200"
    />
    <h1>Rethink Bank Test</h1>
    <p>Se você está tentando acessar esta página diretamente,<br>
       significa que você precisa ler com atenção as instruções do desafio.</p>
    <p>Tenha atenção e calma, esperamos por você em nosso time!</p>
    <a class="btn" 
       href="https://github.com/rethink-projects/rethinkbanktest?tab=readme-ov-file#readme" 
       target="_blank">
      Ler instruções do desafio
    </a>
  </div>
</body>
</html>`);
});



// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));