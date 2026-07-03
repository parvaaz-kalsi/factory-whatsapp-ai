const fs = require('fs');
const backup = fs.readFileSync('app_jsx_backup.txt', 'utf8');

const startIdx = backup.indexOf('<DemandTable');
const endIdx = backup.indexOf(") : activeTab === 'whatsapp_settings' ? (");

if (startIdx > -1 && endIdx > -1) {
  console.log(backup.substring(startIdx, endIdx));
} else {
  console.log('Not found');
}
