require('dotenv').config();
const { connectDB, getDB, oid } = require('./src/db');
const { cloudinary, uploadImage, deleteFile } = require('./src/cloudinary');

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(color, icon, msg) {
  console.log(`${COLORS[color]} ${icon} ${msg}${COLORS.reset}`);
}

async function testMongoDB() {
  console.log('\n' + '='.repeat(50));
  log('cyan', '>', 'TESTING MONGODB ATLAS CONNECTION');
  console.log('='.repeat(50));

  try {
    const db = await connectDB();
    log('green', '✓', 'MongoDB connected successfully');

    const admin = db.admin();
    const info = await admin.serverStatus();
    log('green', '✓', `Server: ${info.host}`);
    log('green', '✓', `Version: ${info.version}`);
    log('green', '✓', `Uptime: ${info.uptime}s`);

    const collections = await db.listCollections().toArray();
    log('green', '✓', `Collections found: ${collections.length}`);
    collections.forEach(c => log('yellow', '  •', c.name));

    const testDoc = { _id: oid(), test: true, timestamp: new Date() };
    await db.collection('_test_collection').insertOne(testDoc);
    log('green', '✓', 'Test document inserted');

    const found = await db.collection('_test_collection').findOne({ test: true });
    log('green', '✓', `Test document retrieved: ${JSON.stringify(found)}`);

    await db.collection('_test_collection').deleteMany({});
    log('green', '✓', 'Test documents cleaned up');

    return true;
  } catch (err) {
    log('red', '✗', `MongoDB FAILED: ${err.message}`);
    return false;
  }
}

async function testCloudinary() {
  console.log('\n' + '='.repeat(50));
  log('cyan', '>', 'TESTING CLOUDINARY CONNECTION');
  console.log('='.repeat(50));

  try {
    const result = await cloudinary.api.ping();
    log('green', '✓', `Cloudinary ping: ${result.status}`);

    log('yellow', '>', 'Uploading test image...');
    const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadResult = await uploadImage(testBase64, 'vishva-erp-test');
    log('green', '✓', `Image uploaded: ${uploadResult.url}`);
    log('green', '✓', `Public ID: ${uploadResult.public_id}`);

    log('yellow', '>', 'Deleting test image...');
    const deleteResult = await deleteFile(uploadResult.public_id);
    log('green', '✓', `Image deleted: ${deleteResult.result}`);

    return true;
  } catch (err) {
    log('red', '✗', `Cloudinary FAILED: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n' + '═'.repeat(50));
  log('cyan', '>', 'VISHVA ERP - SERVICE HEALTH CHECK');
  console.log('═'.repeat(50));

  const mongoOk = await testMongoDB();
  const cloudinaryOk = await testCloudinary();

  console.log('\n' + '═'.repeat(50));
  log('cyan', '>', 'RESULTS SUMMARY');
  console.log('═'.repeat(50));

  log(mongoOk ? 'green' : 'red', mongoOk ? '✓' : '✗', `MongoDB Atlas: ${mongoOk ? 'PASS' : 'FAIL'}`);
  log(cloudinaryOk ? 'green' : 'red', cloudinaryOk ? '✓' : '✗', `Cloudinary: ${cloudinaryOk ? 'PASS' : 'FAIL'}`);

  console.log('\n' + '═'.repeat(50));

  process.exit(mongoOk && cloudinaryOk ? 0 : 1);
}

main();
