2- Responder as seguintes perguntas:

    a- Há bugs? Se sim, quais são e quais são os cenários esperados?

    b- Se houver bugs, classifique-os em nível de criticidade.

    c- Diante do cenário, o sistema está pronto para subir em produção?

---


a- Ao rodar todos os testes automatizados por mim, verá que 4 test cases dão como falhas, com as seguintes falhas:
    - incongruência entre documentacão do swagger e codigo implementado x2
b-      - criticidade baixa
    - endpoint DELETE /account não está apagando o usuário no banco
b-     - criticidade alta, impeditivo de deploy
    - endpoint POST /caixinha/deposit está permitindo o deposito de valores negativos
      - criticidade média
c-  Não está pronto para subida por apresentar erros críticos em fluxos sensiveis da aplicação.