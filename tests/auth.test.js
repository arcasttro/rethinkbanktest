const request = require('supertest');
const config = require('../config');
const { getUser } = require('../utils/helpers');

describe('Autenticação da aplicação', () => {
    let confirmToken;
    let tempUser;
    let token;

    it('Cadastrar um usuário corretamente', async () => {
        tempUser = getUser();
        const res = await request(config.BASE_URL)
            .post('/cadastro')
            .send(tempUser)
            .expect(201);

        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('confirmToken');
        expect(typeof res.body.message).toBe('string');
        expect(typeof res.body.confirmToken).toBe('string');
        expect(res.body.message).toContain('sucesso');
        expect(res.body.confirmToken.length).toBeGreaterThan(0);
        
        confirmToken = res.body.confirmToken;
    });

    it('Cadastro com nome incorreto', async () => {
      const incorrectUser = getUser({ full_name: 'NOME_UNICO'});
      const res = await request(config.BASE_URL)
          .post('/cadastro')
          .send(incorrectUser)
          .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error).toContain('Nome completo obrigatório');
      expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Cadastro com CPF incorreto', async () => {
      const incorrectUser = getUser({ cpf: '123455'});
      const res = await request(config.BASE_URL)
          .post('/cadastro')
          .send(incorrectUser)
          .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error).toContain('CPF inválido');
      expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Cadastro com senha divergente', async () => {
      const incorrectUser = getUser({ confirmPassword: 'senhaerrada'});
      const res = await request(config.BASE_URL)
          .post('/cadastro')
          .send(incorrectUser)
          .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error).toContain('Senhas não conferem');
      expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Cadastro com senha fraca', async () => {
      const incorrectUser = getUser({ password: 'senha123', confirmPassword: 'senha123'});
      const res = await request(config.BASE_URL)
          .post('/cadastro')
          .send(incorrectUser)
          .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error).toContain('Senha fraca');
      expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Cadastro com body vazio', async () => {  //BUG: mensagem de erro incorreta. recebido: cpf inválido
      const res = await request(config.BASE_URL)
          .post('/cadastro')
          .send({})
          .expect(400);
      
      expect(res.body.error).toContain('Bad Request')
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Validar o cadastro do usuário', async () => {
        const res = await request(config.BASE_URL)
          .get('/confirm-email')
          .query({token: confirmToken})
          .expect(200);
    
        expect(typeof res.body).toBe('object');
        expect(res.body).toContain('sucesso');
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('Validar cadastro de usuário com token vazio/inválido', async () => {
        const res = await request(config.BASE_URL)
          .get('/confirm-email')
          .query({token: null})
          .expect(400);
        
        expect(typeof res.body).toBe('object');
        expect(res.body).toContain('Token inválido');
        expect(res.body.length).toBeGreaterThan(0);
    })
  
    it('Executar o login do usuário cadastrado', async () => {
      const res = await request(config.BASE_URL)
        .post('/login')
        .send({ email: tempUser.email, password: tempUser.password })
        .expect(200);
  
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(0);
      
      token = res.body.token;
    });

    it('Executar login do usuário com senha incorreta', async () => { 
          const res = await request(config.BASE_URL)
            .post('/login')
            .send({ email: tempUser.email, password: "senhaincorreta" })
            .expect(400);

          expect(res.body).toHaveProperty('error');
          expect(typeof res.body.error).toBe('string');
          expect(res.body.error).toContain('Credenciais inválidas');
          expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Executar login do usuário com body vazio', async () => {
      const res = await request(config.BASE_URL)
        .post('/login')
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error).toContain('Credenciais inválidas');
      expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Executar login com usuário nao confirmado', async () => {
      tempUser = getUser();
      await request(config.BASE_URL)
          .post('/cadastro')
          .send(tempUser)
          .expect(201);

      const res = await request(config.BASE_URL)
        .post('/login')
        .send({ email: tempUser.email, password: tempUser.password })
        .expect(403);

      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error).toContain('E-mail não confirmado');
      expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Deletar o usuário com token invalido', async () => { //TODO: repetir validação com token invalido
        const res = await request(config.BASE_URL)
          .delete('/account')
          .set('Authorization', `Bearer ${'tokeninvalido'}`)
          .send({password: tempUser.password })
          .expect(401);

        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error).toContain('Não autorizado');
        expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Deletar o usuário cadastrado', async () => { 
      const res = await request(config.BASE_URL)
        .delete('/account')
        .set('Authorization', `Bearer ${token}`)
        .send({password: tempUser.password })
        .expect(200);
  
      expect(res.body).toHaveProperty('message');
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message).toContain('deletada');
      expect(res.body.message.length).toBeGreaterThan(0);
    });

    it('Deletar o usuário com body vazio', async () => { //BUG: esperado erro 400 ao invés de 500
      const res = await request(config.BASE_URL)
        .delete('/account')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Executar login com usuário deletado', async () => { //BUG: usuário nao perde acesso a conta
        const res = await request(config.BASE_URL)
        .post('/login')
        .send({ email: tempUser.email, password: tempUser.password })
        .expect(400);
        
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error.length).toBeGreaterThan(0);
    });

    it('SQL injection login', async () => {
      const res = await request(config.BASE_URL)
        .post('/login')
        .send({ email: "' OR '1'='1", password: tempUser.password })
        .expect(res => {
          if (![400, 403].includes(res.status)) {
            throw new Error(`Esperado status 400 ou 403, mas recebeu ${res.status}`);
          }
        })
  
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error).toContain('Credenciais inválidas');
      expect(res.body.error.length).toBeGreaterThan(0);
    });
});



