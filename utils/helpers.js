const faker = require('faker-br');
const request = require('supertest');
const config = require('../config');

function generateValidPassword() { //gera uma senha com pelo menos uma letra maiuscula, uma letra minuscula, um numero e um simbolo
   return faker.internet.password(12, false, /[A-Za-z0-9!@#$%^&*]/);
}

function getUser(overrides = {}) { //para pegar um usuario dinamico ou sobrescrever qualquer propriedade
    const password = generateValidPassword();
    
    //valores padrão para o usuario
    const defaultUser = {
      full_name: faker.name.firstName() + ' ' + faker.name.lastName(),
      password: password,
      confirmPassword: password,
      cpf: faker.br.cpf(),
      email: `user${faker.random.number()}@example.com`
    };
    
    // Retorna objeto mesclado, permitindo sobrescrever qualquer propriedade
    return { ...defaultUser, ...overrides };
  };

  async function generateUser (){ // setup para gerar um usuario novo
    const u = getUser()
    let t;
    const cadastro = await request(config.BASE_URL)
            .post('/cadastro')
            .send(u);
    t = cadastro.body.confirmToken
    
    await request(config.BASE_URL)
        .get('/confirm-email')
        .query({token: t})
    
    return u
};

async function helperLogin(email, pwd) {//faz login com usuario/senha fixo
    const res = await request(config.BASE_URL)
        .post('/login')
        .send({ email: email, password: pwd })
        .expect(200);

    return res.body.token
}

async function helperCadastroELogin() { //faz login com um usuario gerado dinamicamente
    user = generateUser()
    const res = await request(config.BASE_URL)
        .post('/login')
        .send({ email: user.email, password: user.password })
        .expect(200);

    return res.body.token
}

async function helperExcluirUsuario(email, pwd) { //faz login com o usuario passado e deleta-o
    const login = await request(config.BASE_URL)
        .post('/login')
        .send({ email: email, password: pwd })
        .expect(200);
        
    await request(config.BASE_URL)
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
