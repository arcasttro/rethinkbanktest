const request = require('supertest');
const config = require('../config');
const { helperLogin, generateUser, helperExcluirUsuario} = require('../utils/helpers');

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

    it('Gerar saldo de pontos', async () => { 
        const res = await request(config.BASE_URL)
          .get('/points/saldo')
          .set('Authorization', `Bearer ${tokenUser}`)
          .expect(200);

        expect(res.body).toHaveProperty('normal_balance');
        expect(res.body).toHaveProperty('piggy_bank_balance');
        expect(typeof res.body.normal_balance).toBe('number');
        expect(typeof res.body.piggy_bank_balance).toBe('number');
        expect(res.body.normal_balance).toBe(100);
        expect(res.body.piggy_bank_balance).toBe(0);
      });
  
    
    it('Depositar na caixinha e conferir saldo', async () => {
        const res = await request(config.BASE_URL)
            .post('/caixinha/deposit')
            .set('Authorization', `Bearer ${tokenUser}`)
            .send({ amount:  2})
            .expect(200);
        
        const resSaldo = await request(config.BASE_URL)
            .get('/points/saldo')
            .set('Authorization', `Bearer ${tokenUser}`)
            .expect(200);

        expect(resSaldo.body.normal_balance).toBe(98);
        expect(resSaldo.body.piggy_bank_balance).toBe(2);
        expect(res.body).toHaveProperty('message');
        expect(typeof res.body.message).toBe('string');
        expect(res.body.message).toContain('Depósito');
        expect(res.body.message.length).toBeGreaterThan(0);
    })

    it('Depositar valores negativos na caixinha', async () => { //BUG permitindo depositar valores negativos 
        const res = await request(config.BASE_URL)
            .post('/caixinha/deposit')
            .set('Authorization', `Bearer ${tokenUser}`)
            .send({ amount: -1})
            .expect(400); 
        
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error).toContain('Valor inválido');
        expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Depositar valores acima do saldo na caixinha', async () => { 
        const res = await request(config.BASE_URL)
            .post('/caixinha/deposit')
            .set('Authorization', `Bearer ${tokenUser}`)
            .send({ amount: 1000})
            .expect(400); 
        
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error).toContain('Valor inválido');
        expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Depositar valores com token invalido', async () => { 
        const res = await request(config.BASE_URL)
            .post('/caixinha/deposit')
            .set('Authorization', `Bearer ${'tokeninvalido'}`)
            .send({ amount: 0})
            .expect(401); 
        
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error).toContain('Não autorizado');
        expect(res.body.error.length).toBeGreaterThan(0);
    })

    it('Sacar valores na caixinha e conferir saldo', async () => {
        const res = await request(config.BASE_URL)
          .post('/caixinha/withdraw')
          .set('Authorization', `Bearer ${tokenUser}`)
          .send({ amount:  1})
          .expect(200);

        const resSaldo = await request(config.BASE_URL)
            .get('/points/saldo')
            .set('Authorization', `Bearer ${tokenUser}`)
            .expect(200);

        expect(res.body).toHaveProperty('message');
        expect(typeof res.body.message).toBe('string');
        expect(res.body.message).toContain('Resgate');
        expect(res.body.message.length).toBeGreaterThan(0);
        expect(resSaldo.body.normal_balance).toBe(100);
        expect(resSaldo.body.piggy_bank_balance).toBe(0);
    })

    it('Gerar extrato da caixinha', async () => {
        const res = await request(config.BASE_URL)
          .get('/caixinha/extrato')
          .set('Authorization', `Bearer ${tokenUser}`)
          .expect(200);

        // validar estrutura do extrato
        expect(Array.isArray(res.body)).toBe(true);
        if (res.body.length > 0) {
            const transaction = res.body[0];
            expect(transaction).toHaveProperty('id');
            expect(transaction).toHaveProperty('user_id');
            expect(transaction).toHaveProperty('type');
            expect(transaction).toHaveProperty('amount');
            expect(transaction).toHaveProperty('created_at');
            expect(typeof transaction.amount).toBe('number');
            expect(typeof transaction.type).toBe('string');
            expect(typeof transaction.created_at).toBe('string');
            expect(['deposit', 'withdraw']).toContain(transaction.type);
        }
        // validar se o extrato contem a transação de saque
        expect(res.body).toContainEqual({
            id: expect.any(Number),
            user_id: caixinhaUser.cpf,
            type: 'withdraw',
            amount: 1,
        })
    })

    it('Saldo geral apos saque', async () => { 
      const res = await request(config.BASE_URL)
        .get('/points/saldo')
        .set('Authorization', `Bearer ${tokenUser}`)
        .expect(200);
      expect(res.body).toHaveProperty('normal_balance');
      expect(res.body).toHaveProperty('piggy_bank_balance');
      expect(typeof res.body.normal_balance).toBe('number');
      expect(typeof res.body.piggy_bank_balance).toBe('number');
      expect(res.body.normal_balance).toBe(99);
      expect(res.body.piggy_bank_balance).toBe(1);
    });

})
