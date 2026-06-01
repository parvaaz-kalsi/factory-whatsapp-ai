require('dotenv').config();
const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    const res = await client.query('SELECT DISTINCT part_group FROM inventory');
    console.log('Distinct part_groups:');
    console.log(res.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}
check();
