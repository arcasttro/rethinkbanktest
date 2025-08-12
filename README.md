# Cenários de Testes - RethinkBankTest

Este documento descreve de forma simples os testes implementados na aplicação.

## O que testamos

### Autenticação
Testamos o fluxo completo de um usuário: cadastro, confirmação de email, login e exclusão de conta. Cobrimos casos de sucesso e também cenários de erro como senhas incorretas, dados inválidos e tentativas de acesso não autorizado.

### Sistema de Pontos
Verificamos se o usuário consegue enviar pontos para outros usuários, se o saldo é atualizado corretamente e se o extrato mostra as transações. Também testamos casos de erro como saldo insuficiente e valores negativos.

### Caixinha
Testamos se o usuário consegue depositar pontos na caixinha, sacar quando necessário e se os saldos são mantidos corretamente. Validamos se a API impede operações inválidas como depósitos negativos.

## Como testamos

Usamos Jest para executar os testes e Supertest para fazer as requisições HTTP. Cada teste verifica:
- Se a resposta tem o status correto
- Se os campos esperados existem na resposta
- Se os tipos de dados estão corretos
- Se as mensagens contêm o texto esperado

## Problemas encontrados

Durante os testes, identificamos alguns bugs:
- A exclusão de conta não está funcionando completamente
- A API permite depósitos de valores negativos na caixinha
- Algumas mensagens de erro não estão padronizadas

## Como executar

```bash
npm test                    # roda todos os testes
```

## Estrutura dos arquivos

- `tests/auth.test.js` - testes de autenticação
- `tests/points.test.js` - testes do sistema de pontos  
- `tests/caixinha.test.js` - testes da funcionalidade caixinha
- `utils/helpers.js` - funções auxiliares para os testes
- `config.js` - configurações da aplicação

## Resumo

Implementamos uma suíte de testes que cobre os principais fluxos da aplicação, validando tanto os casos de sucesso quanto os cenários de erro. Os testes ajudam a identificar problemas e garantir que as funcionalidades básicas estejam funcionando.


---

# 2- Responder as seguintes perguntas:

    a- Há bugs? Se sim, quais são e quais são os cenários esperados?

    b- Se houver bugs, classifique-os em nível de criticidade.

    c- Diante do cenário, o sistema está pronto para subir em produção?

## Bugs:
- B1 Usuário consegue fazer login em uma conta que passou por soft-delete
  - Esperado: que a conta fosse bloqueada para acesso comum
  - Criticidade: Alta
- B2 Saldo não é alterado após depósito na caixinha
  - Esperado: Que as movimentações de pontos e caixinha reflitam no banco de dados em tempo real
  - Criticidade: Alta
- B3 Saques da caixinha não são contabilizados no extrato
  - Esperado: Que extrato reflita as movimentações em tempo real (similar ao B2)
  - Criticidade: Alta
- B4 Não é possível sacar o valor depositado na caixinha
  - Esperado: Que o usuário possa sacar
  - Criticidade: Alta
- B5 Endpoint de depósito na caixinha permite valores negativos
  - Esperado: Que permita valores acima de 0 e menores que o saldo total
  - Criticidade: Baixa
- B6 Aplicação não suporta a execução de todos os cenarios de testes desenvolvidos
  - Esperado: Um ambiente mais robusto e estável para execução
  - Criticidade: Alta
- B7 Mensagens de erro e status_code despadronizados
  - Esperado: Utilização das boas práticas do protocolo HTTP
  - Criticidade: Baixa

## c- Diante do cenário, o sistema está pronto para subir em produção?
Não, além de apresentar os bugs reportados acima, a aplicação se mostra muito frágil para ser liberada ao público. 
É altamente recomendado uma validação de dois fatores na etapa de confirmação de senha.
Não se faz necessário a utilização de e-mail, se o mesmo não é utilizado de forma prática em nenhum momento.
É altamente recomendado uma validação mais minuciosa no campo de CPF.
É altamente recomendado a limitação de requisições nos endpoits, principalmente de login, de forma a evitar ataques DDOS e invasões.
É altamente recomendado o desenvolvimento da funcionalidade de "Esqueci minha senha".

# Observações
Na raiz desse projeto, você pode encontrar um mapa-mental.jpeg, onde sintetizei algumas informações do projeto, como:
- Dúvidas para o PO
- Bugs
- Possíveis Riscos
- Cenários de testes
- Critérios de aceitação
- Funcionalidades
- etc.