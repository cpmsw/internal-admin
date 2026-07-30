const { Pool } = require("pg");

const authDb = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.AUTH_DB_NAME || "authdb",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

authDb.on("error", (error) => {
  console.error("Unexpected authDb connection error:", error);
});

module.exports = authDb;