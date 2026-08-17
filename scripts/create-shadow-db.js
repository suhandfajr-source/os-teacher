import { Client } from 'pg';

async function createShadowDb() {
  const client = new Client({
    connectionString: "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"
  });

  await client.connect();
  try {
    await client.query('DROP DATABASE IF EXISTS shadow_db;');
    console.log('shadow_db dropped');
    await client.query('CREATE DATABASE shadow_db;');
    console.log('shadow_db created');
  } catch (e) {
    console.log(e.message);
  } finally {
    await client.end();
  }
}

createShadowDb();
