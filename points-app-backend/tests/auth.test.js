const request = require('supertest');
const BASE_URL = 'https://points-app-backend.vercel.app';
const { getUser, helperLogin, generateUser, helperExcluirUsuario } = require('./helpers');

describe('Autenticação da aplicação', () => {
    let confirmToken;
    let tempUser;
    let token;

    it('Cadastrar um usuário', async () => {
        tempUser = getUser();
        const res = await request(BASE_URL)
            .post('/cadastro')
            .send(tempUser)
            .expect(201);
  
        expect(res.body).toHaveProperty('confirmToken');
        confirmToken = res.body.confirmToken
    });

    it('Cadastro com nome incorreto', async () => {
      const incorrectUser = {
        full_name: 'NOME_UNICO',
        password: 'Senha@123',
        confirmPassword: 'Senha@123',
        cpf: 14404864680,
        email: 'nomeunico@example.com'
      };
    
      const res = await request(BASE_URL)
          .post('/cadastro')
          .send(incorrectUser)
          .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('Nome completo obrigatório')
    })

    it('Validar o cadastro do usuário', async () => {
        const res = await request(BASE_URL)
          .get('/confirm-email')
          .query({token: confirmToken})
          .expect(200);
    
        expect(res.body).toBeTruthy()
      });


    it('Validar cadastro de usuário com token inválido', async () => {
        const res = await request(BASE_URL)
          .get('/confirm-email')
          .query({token: null})
          .expect(400);
 
    })
  
    it('Executar o login do usuário cadastrado', async () => {
      const res = await request(BASE_URL)
        .post('/login')
        .send({ email: tempUser.email, password: tempUser.password })
        .expect(200);
  
      expect(res.body).toHaveProperty('token');
      token = res.body.token
    });

    it('Executar login do usuário com senha incorreta', async () => { 
        const res = await request(BASE_URL)
          .post('/login')
          .send({ email: tempUser.email, password: "senhaincorreta" })
          .expect(400);

        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toContain('Credenciais inválidas');

    })

    it('Deletar o usuário com token invalido', async () => { //TODO: repetir validação com token invalido
        const res = await request(BASE_URL)
          .delete('/account')
          .set('Authorization', `Bearer ${'tokeninvalido'}`)
          .send({password: tempUser.password })
          .expect(401);

        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toContain('Não autorizado'); //BUG de documentação
  
    })
    it('Deletar o usuário cadastrado', async () => { 
        const res = await request(BASE_URL)
          .delete('/account')
          .set('Authorization', `Bearer ${token}`)
          .send({password: tempUser.password })
          .expect(200);
    
        expect(res.body).toBeTruthy();
      });

    it('Executar login com usuário deletado', async () => { //BUG: nao está excluindo o usuário no banco
        const res = await request(BASE_URL)
        .post('/login')
        .send({ email: tempUser.email, password: tempUser.password })
        .expect(400);
      });
});
  