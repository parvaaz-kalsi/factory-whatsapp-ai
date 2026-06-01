const bcrypt = require('bcrypt');

const hashes = {
  editor: "$2b$10$R5DjB2EBADoUn6NIozgXPuDC0VNcGSYopZnDOujPyIddVLBZtBFX6",
  approver: "$2b$10$zZCvBUJCUqitbP/kjrR2c.2EqJc49QBLQPorw9KwkZIh6dfc4SkPm"
};

async function test(user, guess) {
  const match = await bcrypt.compare(guess, hashes[user]);
  console.log(`${user} with guess "${guess}": ${match}`);
}

async function main() {
  await test('editor', 'editor');
  await test('editor', 'editor123');
  await test('editor', 'password');
  await test('editor', 'admin');
  
  await test('approver', 'approver');
  await test('approver', 'approver123');
  await test('approver', 'password');
  await test('approver', 'admin');
}

main().catch(console.error);
