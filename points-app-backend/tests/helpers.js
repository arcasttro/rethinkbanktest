const faker = require('faker-br');
const request = require('supertest');
const BASE_URL = 'https://points-app-backend.vercel.app'

function getUser({ email, cpf } = {}) { //para pegar um usuario dinamico ou setar email/cpf
    return {
      full_name: 'rato teste',
      password: 'Senha@123',
      confirmPassword: 'Senha@123',
      cpf: cpf || faker.br.cpf(),
      email: email || `rato${faker.random.number()}@example.com`
    };
  };

  async function generateUser (){ // setup para gerar um usuario novo
    const u = getUser()
    let t;
    const cadastro = await request(BASE_URL)
            .post('/cadastro')
            .send(u);
    t = cadastro.body.confirmToken
    
    await request(BASE_URL)
        .get('/confirm-email')
        .query({token: t})
    
    return u
};

async function helperLogin(email, pwd) {//faz login com usuario/senha fixo
    const res = await request(BASE_URL)
        .post('/login')
        .send({ email: email, password: pwd })
        .expect(200);

    return res.body.token
}

async function helperCadastroELogin() { //faz login com um usuario gerado dinamicamente
    user = generateUser()
    const res = await request(BASE_URL)
        .post('/login')
        .send({ email: user.email, password: user.password })
        .expect(200);

    return res.body.token
}

async function helperExcluirUsuario(email, pwd) { //faz login com o usuario passado e deleta-o
    const login = await request(BASE_URL)
        .post('/login')
        .send({ email: email, password: pwd })
        .expect(200);
        
    await request(BASE_URL)
        .delete('/account')
        .set('Authorization', `Bearer ${login.body.token}`)
        .send({ password: pwd })

    return
}

module.exports = {
    getUser,
    generateUser,
    helperLogin,
    helperCadastroELogin,
    helperExcluirUsuario
  };
  