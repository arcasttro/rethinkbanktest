# Rethink Bank Test

Parabéns, se este teste chegou até você significa que confiamos no potencial do seu trabalho e agora precisamos verificar suas habilidades técnicas. Para isso, montamos um desafio técnico que simula o ambiente real em que você atuará.

## Introdução

Este é o repositório do Rethink Bank Test. Ele está disponível para você consultar as lógicas e regras de negócio implementadas no código principal. Toda a lógica está em src/index.js

Este mesmo repositório está online, em https://points-app-backend.vercel.app/

Através deste link, você poderá fazer requisições diretas para a API para cumprir seu desafio. 

No Rethink Test Bank o usuário pode se cadastrar, enviar ou receber pontos e também guardar pontos em caixinhas. A rota de cadastro é a única pública, todas as demais são protegidas por token que é adquirido na rota de login. Atenção: o Token tem duração de apenas 10 minutos. 

A jornada do usuário é: 
- Cadastra
- Confirma email
- Faz login
- Envia pontos a alguém
- Guarda parte do saldo na caixinha
- Confere o saldo
- Exclui sua conta

Calma, os endpoints e os contratos estão logo abaixo. 

## Instruções

Você deverá:

1- Criar testes end-to-end automatizados da jornada do usuário usando Jest OU Karatê OU Robot Framework. Os testes deverão registrar evidências. 

2- Responder as seguintes perguntas:

    a- Há bugs? Se sim, quais são e quais são os cenários esperados?
    
    b- Se houver bugs, classifique-os em nível de criticidade.
    
    c- Diante do cenário, o sistema está pronto para subir em produção?
    


Os testes end-to-end deverão ser entregues em um repositório público do GitHub, e as respostas do item 2 deverão estar no readme.md do repositório. 

Além disso, no readme.md deixe claro:

- A forma de rodar o seus testes (ajuda o colega a rodar, configura um comando no package.json pra ir tudo de uma vez, por favor)

- As respostas do Item 2.

  


## Rotas e Contratos

### 1. Cadastro de Usuário

**POST** `/cadastro`

**Request Body**

```json
{
  "cpf": "12345678901",
  "full_name": "João da Silva",
  "email": "joao@example.com",
  "password": "Senha@123",
  "confirmPassword": "Senha@123"
}
```

Validação: 
CPF: 11 números | Único
Full_name: pelo menos dois nomes
email: Único
password: Pelo menos um símbolo especial, números, uma letra maiúscula e uma minúscula e pelo menos 8 caracteres no total. 


**Response 201**

```json
{
  "message": "Cadastro realizado com sucesso.",
  "confirmToken": "<jwt_token>"
}
```

---

### 2. Confirmação de E-mail

**GET** `/confirm-email?token=<confirmToken>`

**Query Params**

| Parâmetro | Descrição                |
| --------- | ------------------------ |
| token     | JWT de confirmação (24h) |

**Response 200** (texto)

E-mail confirmado com sucesso.

---

### 3. Login

**POST** `/login`

**Request Body**

```json
{
  "email": "joao@example.com",
  "password": "Senha@123"
}
```

**Response 200**

```json
{
  "token": "<session_jwt>"
}
```

---



### 4. Excluir Conta (Soft Delete)

**DELETE** `/account`

**Headers**\
Authorization: Bearer `<session_jwt>`

**Request Body**

```json
{
  "password": "Senha@123"
}
```

**Response 200**

```json
{
  "message": "Conta marcada como deletada."
}
```

---

### 5. Enviar Pontos

**POST** `/points/send`

**Headers**\
Authorization: Bearer `<session_jwt>`

**Request Body**

```json
{
  "recipientCpf": "10987654321",
  "amount": 50
}
```

**Response 200**

```json
{
  "message": "Pontos enviados com sucesso."
}
```

---

### 6. Extrato de Pontos

**GET** `/points/extrato`

**Headers**\
Authorization: Bearer `<session_jwt>`

**Response 200**

```json
[
  {
    "id": "uuid",
    "from_user": "uuid",
    "to_user": "uuid",
    "amount": 50,
    "created_at": "2025-06-17T21:00:00.000Z"
  },
  ...
]
```

---

### 7. Caixinha de Pontos

#### 7.1 Deposit

**POST** `/caixinha/deposit`

**Headers**\
Authorization: Bearer `<session_jwt>`

**Request Body**

```json
{ "amount": 30 }
```

**Response 200**

```json
{ "message": "Depósito na caixinha realizado." }
```

#### 7.2 Withdraw

**POST** `/caixinha/withdraw`

**Headers**\
Authorization: Bearer `<session_jwt>`

**Request Body**

```json
{ "amount": 10 }
```

**Response 200**

```json
{ "message": "Resgate da caixinha realizado." }
```

#### 7.3 Extrato

**GET** `/caixinha/extrato`

**Headers**\
Authorization: Bearer `<session_jwt>`

**Response 200**

```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "type": "deposit",
    "amount": 30,
    "created_at": "2025-06-17T21:05:00.000Z"
  },
  ...
]
```

---

### 8. Saldo Geral

**GET** `/points/saldo`

**Headers**\
Authorization: Bearer `<session_jwt>`

**Response 200**

```json
{
  "normal_balance": 120,
  "piggy_bank_balance": 45
}
```

---

## Sucesso no teste

Ah, o joao@example.com com a senha Senha@123 normalmente tem pontos para enviar. 

Esperamos você em breve com a gente! :D
