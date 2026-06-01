require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('../config/db');

async function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(schema);
    console.log('✅ Schema aplicado correctamente.');
  } catch (err) {
    console.error('❌ Error aplicando schema:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

init();
