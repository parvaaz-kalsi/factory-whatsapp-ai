require('dotenv').config();
const prisma = require('./src/config/db');
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

  try {
    console.log('Connecting to Neon DB via Prisma...');
    // Prisma connects automatically on first query, but we can test it
    await prisma.$connect();
    console.log('Connected successfully!');

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

      // Upsert logic based on part_name
      const existingRes = await prisma.inventory.findFirst({
        where: { part_name: partName }
      });
      
      if (existingRes) {
        await prisma.inventory.update({
          where: { id: existingRes.id },
          data: {
            drawing_no: drawingNo,
            product_description: productDescription,
            part_group: partGroup,
            material: material,
            detail1: detail1,
            detail2: detail2,
            category: category,
            reg_no: regNo,
            sku: sku,
            vendor: vendor,
            location: location,
            available_qty: qty,
            unit: unit,
            price: price
          }
        });
      } else {
        await prisma.inventory.create({
          data: {
            part_name: partName,
            drawing_no: drawingNo,
            product_description: productDescription,
            part_group: partGroup,
            material: material,
            detail1: detail1,
            detail2: detail2,
            category: category,
            reg_no: regNo,
            sku: sku,
            vendor: vendor,
            location: location,
            available_qty: qty,
            unit: unit,
            price: price
          }
        });
      }

      successCount++;
    }

    console.log(`Successfully upserted ${successCount} records into the inventory table!`);
    console.log('Database initialization and Excel import is COMPLETE.');

  } catch (err) {
    console.error('Error during database initialization/import:', err);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

// Run the script if called directly
if (require.main === module) {
  dbInit();
}

module.exports = { dbInit };
