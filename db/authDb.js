const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  database: 'authdb',
  user: 'cpmsoft_user',
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

pool.on('connect', () => {
  console.log('✅ PostgreSQL authdb connected');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL authdb error', err);
  process.exit(1);
});

module.exports = pool;