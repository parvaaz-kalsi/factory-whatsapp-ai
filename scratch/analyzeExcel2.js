const xlsx = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, '..', 'Stock_22march2025_SORTED.xlsx');
try {
  const workbook = xlsx.readFile(excelPath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(worksheet);
  console.log('Total items loaded:', data.length);
  console.log('Sample data items (first 10):');
  console.log(JSON.stringify(data.slice(0, 10), null, 2));
} catch (err) {
  console.error('Error:', err);
}
