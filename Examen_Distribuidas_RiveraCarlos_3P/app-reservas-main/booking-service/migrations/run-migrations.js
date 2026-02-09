const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const sql = fs.readFileSync(__dirname + '/schema.sql', 'utf8');
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '123456',
    database: process.env.DB_NAME || 'app-reservas'
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Migrations applied');
  } catch (err) {
    console.error('Migration error', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
