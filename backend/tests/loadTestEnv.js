const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Tests read backend/.env.test (gitignored). When it is absent — a fresh
// clone, or CI — fall back to the committed .env.test.example so that
// `npm run test:unit` works out of the box.
function resolveTestEnv() {
  const local = path.resolve(__dirname, '../.env.test');
  if (fs.existsSync(local)) return local;
  return path.resolve(__dirname, '../.env.test.example');
}

dotenv.config({ path: resolveTestEnv() });

module.exports = { resolveTestEnv };
