require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("--- pending_requests columns ---");
  const res1 = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'pending_requests'
  `);
  res1.rows.forEach(row => {
    console.log(`${row.column_name}: ${row.data_type}`);
  });

  console.log("\n--- inventory columns ---");
  const res2 = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'inventory'
  `);
  res2.rows.forEach(row => {
    console.log(`${row.column_name}: ${row.data_type}`);
  });

  await client.end();
}

main().catch(err => console.error(err));
