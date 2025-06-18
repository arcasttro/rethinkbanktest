import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Rethink Bank Points API',
    version: '1.0.0',
    description: 'API para gerenciamento de sistema de pontos',
  },
  servers: [
    { url: process.env.APP_URL || 'http://localhost:3000' }
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
