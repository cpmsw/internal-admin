const fastify = require("fastify")({ logger: true });
const cors = require("@fastify/cors");
const swagger = require("@fastify/swagger");
const swaggerUi = require("@fastify/swagger-ui");
const path = require("path");
const AutoLoad = require("@fastify/autoload");


// ---------------------------------
// CORS
// ---------------------------------
fastify.register(cors, {
  origin: (origin, cb) => {
    const allowed = [
      "http://localhost:4100",
      "http://127.0.0.1:4100",
      "https://console.cpmsoft.app"
    ];

    if (!origin || allowed.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error("Not allowed by CORS"), false);
    }
  },

  methods: [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "OPTIONS"
  ],

  allowedHeaders: [
    "Content-Type"
  ]
});


// ---------------------------------
// SWAGGER / OPENAPI
// ---------------------------------
fastify.register(swagger, {
  openapi: {
    info: {
      title: "CPMSOFT Platform Console API",
      description:
        "Private CPMSOFT platform administration API",
      version: "1.0.0"
    },

    servers: [
      {
        url: "https://console.cpmsoft.app",
        description: "CPMSOFT Platform Console"
      }
    ],

    tags: [
      {
        name: "System",
        description: "Platform Console status"
      },
      {
        name: "Tenants",
        description: "Tenant administration"
      },
      {
        name: "Resources",
        description:
          "CPMSOFT resource catalog and tenant entitlements"
      },
      {
        name: "Packages",
        description: "CPMSOFT commercial package catalog"
      }
    ]
  }
});


// ---------------------------------
// SWAGGER UI
// ---------------------------------
fastify.register(swaggerUi, {
  routePrefix: "/api/docs",

  uiConfig: {
    docExpansion: "list",
    deepLinking: true
  },

  staticCSP: true
});


// ---------------------------------
// BASIC STATUS ENDPOINT
// ---------------------------------
fastify.get("/", {
  schema: {
    tags: ["System"],
    summary: "Platform Console status",

    response: {
      200: {
        type: "object",

        properties: {
          status: {
            type: "string"
          },

          application: {
            type: "string"
          }
        }
      }
    }
  }
}, async () => {
  return {
    status: "ok",
    application: "CPMSOFT Platform Console"
  };
});


// ---------------------------------
// LOAD GENERAL ROUTES
// ---------------------------------
fastify.register(AutoLoad, {
  dir: path.join(__dirname, "routes"),

  options: {
    prefix: "/api/platform"
  }
});


// ---------------------------------
// LOAD BUSINESS MODULES
// ---------------------------------
fastify.register(AutoLoad, {
  dir: path.join(__dirname, "modules"),

  options: {
    prefix: "/api/platform"
  }
});


// ---------------------------------
// START SERVER
// ---------------------------------
const start = async () => {
  const requiredEnv = [
    "DB_PASSWORD"
  ];

  const missing = requiredEnv.filter(
    variableName =>
      !process.env[variableName]
  );

  if (missing.length) {
    fastify.log.error(
      `Missing environment variables: ${missing.join(", ")}`
    );

    process.exit(1);
  }

  const host =
    process.env.HOST ||
    "127.0.0.1";

  const port =
    Number(
      process.env.PORT ||
      4100
    );

  try {
    await fastify.listen({
      host,
      port
    });

    fastify.log.info(
      `CPMSOFT Platform Console running on http://${host}:${port}`
    );

  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};


start();