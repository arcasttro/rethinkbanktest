import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Rethink Bank Test API',
    version: '1.0.0',
    description: 'API para gerenciamento de sistema de pontos',
  },
  servers: [
    { url: process.env.APP_URL || 'http://localhost:3000', description: 'Servidor de teste de candidatos' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
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
  // opcional: expõe o JSON em /docs/swagger.json
  app.get('/docs/swagger.json', (req, res) => res.json(swaggerSpec));

  // serve: monta HTML + JS + CSS automaticamente em /docs
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: `
        .swagger-ui .topbar { background-color: #202020 }
        .swagger-ui .topbar .topbar-wrapper img { display: none; }
        .swagger-ui .topbar .topbar-wrapper:before {
          content: '';
          display: inline-block;
          background: url('https://755udsewnzdtcvpg.public.blob.vercel-storage.com/images/logosRethink/logo_negativo-QSqX1DU5U33GczS3mR856luwzvRMVI.svg') no-repeat center;
          background-size: contain;
          width: 150px;
          height: 50px;
          margin-right: 1rem;
        }
      `,
      customfavIcon:
        'https://755udsewnzdtcvpg.public.blob.vercel-storage.com/images/logosRethink/logo_negativo-QSqX1DU5U33GczS3mR856luwzvRMVI.svg',
      customSiteTitle: 'Points App API Docs',
      swaggerOptions: {
        url: '/docs/swagger.json'
      }
    })
  );
}
