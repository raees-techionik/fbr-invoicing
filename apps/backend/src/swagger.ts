import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "FBR E-Invoicing API",
      version: "1.0.0",
      description:
        "REST API for the FBR-compliant e-invoicing platform (JWT + bcrypt per SOW). Multi-tenant users with personal and business companies.",
    },
    servers: [{ url: "/", description: "Current host" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/**/*.ts", "./dist/routes/**/*.js"],
};

export const swaggerSpec = swaggerJsdoc(options);
