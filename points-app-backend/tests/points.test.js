const request = require('supertest');
const BASE_URL = 'https://points-app-backend.vercel.app';
const { helperLogin, generateUser, helperExcluirUsuario} = require('./helpers');



describe('Sessão de pontos da aplicação', () => {
    
    // Setup antes dos testes
    beforeAll(async () => {
        userSender = await generateUser();
        userReceiver = await generateUser();
        tokenSender = await helperLogin(userSender.email, userSender.password);
    }, 100000);

    // Cleanup depois dos testes
    afterAll(async () => {
        await helperExcluirUsuario(userSender.email, userSender.password);
        await helperExcluirUsuario(userReceiver.email, userReceiver.password);
    }, 100000);

    
    it('Enviar pontos', async () => {
        const res = await request(BASE_URL)
            .post('/points/send')
            .set('Authorization', `Bearer ${tokenSender}`)
            .send({ recipientCpf: userReceiver.cpf, amount:  1})
            .expect(200);

            expect(res.body).toBeTruthy()
        })

    it('Enviar pontos com saldo insuficiente ou invalido', async () => {
        const res = await request(BASE_URL)
            .post('/points/send')
            .set('Authorization', `Bearer ${tokenSender}`)
            .send({ recipientCpf: userReceiver.cpf, amount:  -1})
            .expect(400);

            expect(res.body).toHaveProperty('error')
            expect(res.body.error).toContain('Valor inválido')
        })
 

    it('Gerar extrato de pontos', async () => {
        const res = await request(BASE_URL)
          .get('/points/extrato')
          .set('Authorization', `Bearer ${tokenSender}`)
          .expect(200);
          //TODO: conferir schema

        expect(res.body).toBeTruthy()

    })

    it('Gerar saldo de pontos', async () => {
        const res = await request(BASE_URL)
          .get('/points/saldo')
          .set('Authorization', `Bearer ${tokenSender}`)
          .expect(200);

    })

})
