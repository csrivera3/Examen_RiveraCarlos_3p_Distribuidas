const { Client } = require('pg');

async function createDatabase() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '123456',
    database: 'postgres'  // Connect to default postgres DB to create bookingsdb
  });

  try {
    await client.connect();
    console.log('✅ Connected to Postgres');

    // Create app-reservas (if not exists)
    await client.query('CREATE DATABASE "app-reservas";');
    console.log('✅ Database app-reservas created');

    await client.end();
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('ℹ️  Database app-reservas already exists');
    } else {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }
}

createDatabase();
