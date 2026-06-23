require('dotenv').config();
const { Client } = require('pg');

async function dropConstraint() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB');
    await client.query('ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_sku_key;');
    console.log('Dropped inventory_sku_key constraint successfully (if it existed).');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

dropConstraint();
