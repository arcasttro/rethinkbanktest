const request = require('supertest');
const BASE_URL = 'https://points-app-backend.vercel.app';
const { helperLogin, generateUser, helperExcluirUsuario} = require('./helpers');

describe('Sessão de caixinha da aplicação', () => {
    
    //Setup antes dos testes
    beforeAll(async () => {
        caixinhaUser = await generateUser();
        tokenUser = await helperLogin(caixinhaUser.email, caixinhaUser.password);
    }, 100000);

    // Cleanup depois dos testes
    afterAll(async () => {
        await helperExcluirUsuario(caixinhaUser.email, caixinhaUser.password);
    }, 100000);

    
    it('Depositar na caixinha', async () => {
        const res = await request(BASE_URL)
            .post('/caixinha/deposit')
            .set('Authorization', `Bearer ${tokenUser}`)
            .send({ amount:  1})
            .expect(200);

            expect(res.body).toBeTruthy()
        })

    it('Depositar valores negativos na caixinha', async () => {
        const res = await request(BASE_URL)
            .post('/caixinha/deposit')
            .set('Authorization', `Bearer ${tokenUser}`)
            .send({ amount: -1})
            .expect(400); //BUG permitindo depositar valores negativos 
        
        expect(res.body).toHaveProperty('error')
        expect(res.body.error).toContain('Valor inválido')
        
    })
 
    it('token invalido - 401', async () => {
        const res = await request(BASE_URL)
            .post('/caixinha/deposit')
            .set('Authorization', `Bearer ${'tokeninvalido'}`)
            .send({ amount: 0})
            .expect(401);
        
        expect(res.body).toHaveProperty('error')
        expect(res.body.error).toContain('Não autorizado') //BUG de documentação vide swagger
    })

    it('Sacar valores na caixinha', async () => {
        const res = await request(BASE_URL)
          .post('/caixinha/withdraw')
          .set('Authorization', `Bearer ${tokenUser}`)
          .send({ amount:  0})
          .expect(200);

        expect(res.body).toBeTruthy()

    })

    it('Gerar extrato da caixinha', async () => {
        const res = await request(BASE_URL)
          .get('/caixinha/extrato')
          .set('Authorization', `Bearer ${tokenUser}`)
          .expect(200);

    })

})
