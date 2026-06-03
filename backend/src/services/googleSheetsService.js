const { google } = require('googleapis');

const SPREADSHEET_ID = '14QSTB1DJeaY44Ec2WTA12znOW6L5AsLALhLLEedwVpI';
const RANGE = 'Sheet1!A:I';

async function getSheetsClient() {
    try {
        if (!require('fs').existsSync('credentials.json') && !require('fs').existsSync(require('path').join(process.cwd(), 'credentials.json'))) {
            console.warn('[Google Sheets] Warning: credentials.json not found. Google Sheets integration will be disabled.');
            return null;
        }
        const auth = new google.auth.GoogleAuth({
            keyFile: 'credentials.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        return google.sheets({ version: 'v4', auth });
    } catch (err) {
        console.warn('[Google Sheets] Error initializing client:', err.message);
        return null;
    }
}

async function appendToSheet(rowData) {
    const sheets = await getSheetsClient();
    if (!sheets) {
        console.warn('[Google Sheets] client not available, skipping appendToSheet');
        return;
    }
    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[
                rowData.partName,
                rowData.qty,
                rowData.size,
                rowData.material,
                rowData.machine,
                rowData.vendor,
                rowData.requestedBy,
                rowData.receivedAt,
                rowData.demandTimestamp
            ]]
        }
    });
}

async function getSheetRows() {
    const sheets = await getSheetsClient();
    if (!sheets) {
        console.warn('[Google Sheets] client not available, returning empty rows');
        return [];
    }
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE
    });
    return response.data.values || [];
}

module.exports = { getSheetsClient, appendToSheet, getSheetRows, SPREADSHEET_ID, RANGE };
