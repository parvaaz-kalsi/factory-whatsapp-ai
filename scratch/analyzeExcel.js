const xlsx = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, '..', 'Stock_22march2025_SORTED.xlsx');
console.log('Reading Excel file from:', excelPath);

try {
  const workbook = xlsx.readFile(excelPath);
  const sheetNames = workbook.SheetNames;
  console.log('Sheet names:', sheetNames);

  if (sheetNames.length > 0) {
    const firstSheetName = sheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    if (data.length > 0) {
      console.log('Header row:', data[0]);
      console.log('First data row:', data[1]);
      console.log('Second data row:', data[2]);
    } else {
      console.log('Sheet is empty!');
    }
  }
} catch (err) {
  console.error('Error reading Excel:', err);
}
