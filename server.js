const fastify = require("fastify")({ logger: true });
const cors = require("@fastify/cors");
const path = require("path");
const AutoLoad = require("@fastify/autoload");

// The console is private and accessed through an SSH tunnel.
fastify.register(cors, {
  origin: (origin, cb) => {
    const allowed = [
      "http://localhost:4100",
      "http://127.0.0.1:4100"
    ];

    if (!origin || allowed.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error("Not allowed by CORS"), false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
});

// Basic status endpoint
fastify.get("/", async () => {
  return {
    status: "ok",
    application: "CPMSOFT Platform Console"
  };
});

// Load general routes, when added
fastify.register(AutoLoad, {
  dir: path.join(__dirname, "routes"),
  options: {
    prefix: "/api/platform"
  }
});

// Load business modules
fastify.register(AutoLoad, {
  dir: path.join(__dirname, "modules"),
  options: {
    prefix: "/api/platform"
  }
});

const start = async () => {
  const requiredEnv = [
    "DB_PASSWORD"
  ];

  const missing = requiredEnv.filter(
    variableName => !process.env[variableName]
  );

  if (missing.length) {
    fastify.log.error(
      `Missing environment variables: ${missing.join(", ")}`
    );
    process.exit(1);
  }

  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT || 4100);

  try {
    await fastify.listen({ host, port });

    fastify.log.info(
      `CPMSOFT Platform Console running on http://${host}:${port}`
    );
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start();