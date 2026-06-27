const prisma = require('./src/config/db.js');
prisma.$executeRawUnsafe('ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_sku_key CASCADE;')
  .then(() => console.log('Dropped'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
