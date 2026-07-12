const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });
const { execSync } = require('child_process');

module.exports = async () => {
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });
};
