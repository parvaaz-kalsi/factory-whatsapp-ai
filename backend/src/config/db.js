const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace('?sslmode=require', '').replace('&sslmode=require', '') : '',
    ssl: { rejectUnauthorized: false },
    max: process.env.NODE_ENV === 'production' ? 20 : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

module.exports = pool;
