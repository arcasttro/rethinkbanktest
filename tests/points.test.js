const request = require('supertest');
const config = require('../config');
const { helperLogin, generateUser, helperExcluirUsuario} = require('../utils/helpers');



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

    
    it('Gerar saldo de pontos', async () => {
        const res = await request(config.BASE_URL)
          .get('/points/saldo')
          .set('Authorization', `Bearer ${tokenSender}`)
          .expect(200);

        expect(res.body).toHaveProperty('normal_balance');
        expect(res.body).toHaveProperty('piggy_bank_balance');
        expect(typeof res.body.normal_balance).toBe('number');
        expect(typeof res.body.piggy_bank_balance).toBe('number');
        expect(res.body.normal_balance).toBe(100);
        expect(res.body.piggy_bank_balance).toBe(0);
    })


    it('Enviar pontos e conferir saldo', async () => {
        const res = await request(config.BASE_URL)
            .post('/points/send')
            .set('Authorization', `Bearer ${tokenSender}`)
            .send({ recipientCpf: userReceiver.cpf, amount:  1})
            .expect(200);
        
        const resSaldo = await request(config.BASE_URL)
          .get('/points/saldo')
          .set('Authorization', `Bearer ${tokenSender}`)
          .expect(200);

        expect(res.body).toHaveProperty('message');
        expect(typeof res.body.message).toBe('string');
        expect(res.body.message).toContain('sucesso');
        expect(res.body.message.length).toBeGreaterThan(0);

        expect(resSaldo.body.normal_balance).toBe(99);
        expect(resSaldo.body.piggy_bank_balance).toBe(0);
    })

    it('Enviar pontos com saldo insuficiente ou invalido', async () => {
        const res = await request(config.BASE_URL)
            .post('/points/send')
            .set('Authorization', `Bearer ${tokenSender}`)
            .send({ recipientCpf: userReceiver.cpf, amount:  -1})
            .expect(400);

        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error).toContain('Valor inválido');
        expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Enviar pontos com saldo insuficiente', async () => {
        const res = await request(config.BASE_URL)
            .post('/points/send')
            .set('Authorization', `Bearer ${tokenSender}`)
            .send({ recipientCpf: userReceiver.cpf, amount:  1000})
            .expect(400);

        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error).toContain('Saldo insuficiente');
        expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Enviar pontos para usuario inexistente', async () => {
        const res = await request(config.BASE_URL)
            .post('/points/send')
            .set('Authorization', `Bearer ${tokenSender}`)
            .send({ recipientCpf: null, amount:  1})
            .expect(404);

        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error).toContain('Usuário destino não encontrado');
        expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Enviar pontos com token invalido', async () => {
        const res = await request(config.BASE_URL)
            .post('/points/send')
            .set('Authorization', `Bearer ${"token_invalido"}`)
            .send({ recipientCpf: userReceiver.cpf, amount:  1})
            .expect(401);

        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error).toContain('Não autorizado');
        expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Enviar pontos body vazio', async () => {
        const res = await request(config.BASE_URL)
            .post('/points/send')
            .set('Authorization', `Bearer ${tokenSender}`)
            .send({})
            .expect(res => {
                if (![400, 404].includes(res.status)) {
                  throw new Error(`Esperado status 400 ou 404, mas recebeu ${res.status}`);
                }
              })
      
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error).toContain('Bad Request');
        expect(res.body.error.length).toBeGreaterThan(0);
    })


    it('Gerar extrato de pontos', async () => {
        const res = await request(config.BASE_URL)
          .get('/points/extrato')
          .set('Authorization', `Bearer ${tokenSender}`)
          .expect(200);

          // Validar estrutura do extrato
        expect(Array.isArray(res.body)).toBe(true);
        if (res.body.length > 0) {
            const transaction = res.body[0];
            expect(transaction).toHaveProperty('id');
            expect(transaction).toHaveProperty('from_user');
            expect(transaction).toHaveProperty('to_user');
            expect(transaction).toHaveProperty('amount');
            expect(transaction).toHaveProperty('created_at');
            expect(typeof transaction.amount).toBe('number');
            expect(typeof transaction.created_at).toBe('string');
        }

        // validar se o extrato contem a transação de envio de pontos
        expect(res.body.some(transacao => transacao.amount === 1)).toBe(true);
    })

})
