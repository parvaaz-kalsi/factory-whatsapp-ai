require('dotenv').config();
const { Client } = require('pg');
const xlsx = require('xlsx');
const path = require('path');

// Excel File path
const EXCEL_FILE = path.join(__dirname, 'Stock_22march2025_SORTED.xlsx');

async function dbInit() {
  console.log('--- FACTORY DATABASE INITIALIZATION AND EXCEL IMPORT ---');
  
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not defined in your .env file!');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Neon DB...');
    await client.connect();
    console.log('Connected successfully!');

    // 1. Create tables
    console.log('Creating tables if they do not exist...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        part_name VARCHAR(255),
        drawing_no VARCHAR(255),
        product_description TEXT,
        part_group VARCHAR(255),
        material VARCHAR(255),
        detail1 VARCHAR(255),
        detail2 VARCHAR(255),
        category VARCHAR(255),
        reg_no VARCHAR(255),
        sku VARCHAR(255),
        vendor VARCHAR(255),
        location VARCHAR(255),
        available_qty INTEGER DEFAULT 0,
        unit VARCHAR(50),
        price NUMERIC(10, 2) DEFAULT 0.00,
        rate NUMERIC(10, 2) DEFAULT 0.00
      );
    `);
    await client.query(`
      ALTER TABLE inventory ADD COLUMN IF NOT EXISTS rate NUMERIC(10, 2) DEFAULT 0.00;
    `);
    console.log('Table "inventory" verified.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS pending_requests (
        id VARCHAR(100) PRIMARY KEY,
        part_name VARCHAR(255),
        qty VARCHAR(50),
        size VARCHAR(100),
        material VARCHAR(100),
        machine VARCHAR(255),
        vendor VARCHAR(255),
        requested_by VARCHAR(255),
        received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        demand_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending_review',
        rate VARCHAR(100),
        approved_by VARCHAR(255),
        approved_at TIMESTAMP WITH TIME ZONE,
        edited_by VARCHAR(255),
        edited_at TIMESTAMP WITH TIME ZONE,
        forwarded_at TIMESTAMP WITH TIME ZONE,
        unit VARCHAR(50),
        sku VARCHAR(100),
        category VARCHAR(100),
        price VARCHAR(100),
        available_stock VARCHAR(100),
        stock_warning TEXT,
        suggested_match TEXT
      );
    `);
    console.log('Table "pending_requests" verified.');

    await client.query(`
      ALTER TABLE pending_requests ADD COLUMN IF NOT EXISTS unit VARCHAR(50);
      ALTER TABLE pending_requests ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
      ALTER TABLE pending_requests ADD COLUMN IF NOT EXISTS category VARCHAR(100);
      ALTER TABLE pending_requests ADD COLUMN IF NOT EXISTS price VARCHAR(100);
      ALTER TABLE pending_requests ADD COLUMN IF NOT EXISTS reg_no VARCHAR(100);
      ALTER TABLE pending_requests ADD COLUMN IF NOT EXISTS is_ordered BOOLEAN DEFAULT FALSE;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_groups (
        id SERIAL PRIMARY KEY,
        group_id VARCHAR(100) UNIQUE,
        group_name VARCHAR(255),
        active BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "whatsapp_groups" verified.');

    // 2. Read and parse Excel file
    console.log(`Loading Excel file from: ${EXCEL_FILE}`);
    const workbook = xlsx.readFile(EXCEL_FILE);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${rawRows.length} rows in the sheet.`);

    // 3. Upsert inventory records into Postgres
    console.log('Importing records into inventory table...');
    let successCount = 0;
    
    for (const row of rawRows) {
      const partName = (row[' Name '] || row['Product Description'] || '').toString().trim();
      if (!partName) continue; // Skip empty rows

      const drawingNo = (row['Drawing no'] || '').toString().trim();
      const productDescription = (row['Product Description'] || '').toString().trim();
      const partGroup = (row['Group'] || '').toString().trim();
      const material = (row['Material'] || '').toString().trim();
      const detail1 = (row['Detail1'] || '').toString().trim();
      const detail2 = (row['Detail2'] || '').toString().trim();
      const category = (row['Category'] || '').toString().trim();
      const regNo = (row['Reg. No.'] || '').toString().trim();
      
      // SKU (P.No. in the spreadsheet)
      let sku = (row['P.No.'] || '').toString().trim();

      const vendor = (row['Vendor'] || '').toString().trim();
      const location = (row['Locations'] || '').toString().trim();
      
      // Parse QTY
      let qty = parseInt(row['QTY'], 10);
      if (isNaN(qty)) qty = 0;

      const unit = (row['Unit'] || '').toString().trim();
      
      // Parse price
      let price = parseFloat(row['Unit price']);
      if (isNaN(price)) price = 0.00;

      // Upsert logic based on part_name instead of sku constraint
      const existingRes = await client.query('SELECT id FROM inventory WHERE part_name = $1', [partName]);
      if (existingRes.rows.length > 0) {
        await client.query(`
          UPDATE inventory SET
            drawing_no = $2, product_description = $3, part_group = $4,
            material = $5, detail1 = $6, detail2 = $7, category = $8, reg_no = $9, sku = $10,
            vendor = $11, location = $12, available_qty = $13, unit = $14, price = $15
          WHERE id = $1
        `, [
          existingRes.rows[0].id, drawingNo, productDescription, partGroup,
          material, detail1, detail2, category, regNo, sku,
          vendor, location, qty, unit, price
        ]);
      } else {
        await client.query(`
          INSERT INTO inventory (
            part_name, drawing_no, product_description, part_group, 
            material, detail1, detail2, category, reg_no, sku, 
            vendor, location, available_qty, unit, price
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
          partName, drawingNo, productDescription, partGroup,
          material, detail1, detail2, category, regNo, sku,
          vendor, location, qty, unit, price
        ]);
      }

      successCount++;
    }

    console.log(`Successfully upserted ${successCount} records into the inventory table!`);
    console.log('Database initialization and Excel import is COMPLETE.');

  } catch (err) {
    console.error('Error during database initialization/import:', err);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

// Run the script if called directly
if (require.main === module) {
  dbInit();
}

module.exports = { dbInit };
