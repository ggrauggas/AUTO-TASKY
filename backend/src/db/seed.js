require('dotenv').config();
const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcrypt');
const pool   = require('../config/db');

const USERS = [
  { username: 'admin',  pin: '0000', role: 'admin' },
  { username: 'jefe1',  pin: '1111', role: 'jefe_zona' },
  { username: 'peon1',  pin: '2222', role: 'peon_almacen' },
  { username: 'peon2',  pin: '3333', role: 'peon_almacen' },
];

async function seed() {
  const sql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Datos semilla insertados (materials, machines, locations, inventory).');

    for (const u of USERS) {
      const hash = await bcrypt.hash(u.pin, 10);
      await pool.query(
        `INSERT INTO users (username, pin_hash, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (username) DO NOTHING`,
        [u.username, hash, u.role]
      );
    }
    console.log('✅ Usuarios creados (admin/0000, jefe1/1111, peon1/2222, peon2/3333).');
  } catch (err) {
    console.error('❌ Error en seed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
