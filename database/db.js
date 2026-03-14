require('dotenv').config();
const sql = require('mssql');

const config = {
  server:   process.env.DB_SERVER   || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 59477,
  database: process.env.DB_DATABASE || 'ApprovIQ',
  options: {
    encrypt:                false,
    trustServerCertificate: true,
    enableArithAbort:       true,
    trustedConnection:      true,
  },
};

// Allow SQL Server Auth if credentials are provided
if (process.env.DB_TRUSTED_CONNECTION !== 'true' && process.env.DB_USER) {
  delete config.options.trustedConnection;
  config.user     = process.env.DB_USER;
  config.password = process.env.DB_PASSWORD;
}

let pool = null;

async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(config);
  console.log(`✅ Connected → ${config.server}:${config.port} / ${config.database}`);
  return pool;
}

module.exports = { getPool, sql };
