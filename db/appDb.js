const { Pool } = require("pg");

const appDb = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.APP_DB_NAME || "appdb",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

appDb.on("error", (error) => {
  console.error("Unexpected appDb connection error:", error);
});

module.exports = appDb;