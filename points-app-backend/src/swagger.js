import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Points App Backend',
    version: '1.0.0',
    description: 'API para gerenciamento de sistema de pontos',
  },
  servers: [
    { url: process.env.APP_URL || 'http://localhost:3000', description: 'Servidor de teste de candidatos' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  security: [{ bearerAuth: [] }]
};

const options = {
  swaggerDefinition,
  apis: ['./src/index.js']
};

export const swaggerSpec = swaggerJSDoc(options);

export function setupSwagger(app) {
  // Rota que serve CSS/ícone customizados
  app.use('/docs-static', swaggerUi.serveFiles(swaggerSpec, {}));

  // Swagger UI com overrides
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: `
        /* fundo do header */
        .swagger-ui .topbar { background-color: #202020; }

        /* esconde logo padrão */
        .swagger-ui .topbar .topbar-wrapper img { display: none; }

        /* insere sua logo no lugar */
        .swagger-ui .topbar .topbar-wrapper:before {
          content: '';
          display: inline-block;
          background: url('https://755udsewnzdtcvpg.public.blob.vercel-storage.com/images/logosRethink/logo_negativo-QSqX1DU5U33GczS3mR856luwzvRMVI.svg') no-repeat center;
          background-size: contain;
          width: 150px;
          height: 50px;
          margin-right: 1rem;
        }

        /* opcional: troca cores dos títulos */
        .swagger-ui .info .title { color: #00d1b2; }

        /* opcional: corpo com background sutil */
      `,
      customfavIcon:
        'https://755udsewnzdtcvpg.public.blob.vercel-storage.com/images/logosRethink/logo_negativo-QSqX1DU5U33GczS3mR856luwzvRMVI.svg',
      customSiteTitle: 'Points App API Docs'
    })
  );
}
