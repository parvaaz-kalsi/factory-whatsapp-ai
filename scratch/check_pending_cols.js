const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  console.log("PENDING REQUESTS COLUMNS:");
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'pending_requests'
  `);
  console.log(res.rows);
  
  await client.end();
}

main().catch(console.error);
