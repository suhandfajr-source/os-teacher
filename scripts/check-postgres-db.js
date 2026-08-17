import { Client } from 'pg';

async function checkDb() {
  const client = new Client({
    connectionString: "postgres://postgres:postgres@localhost:51214/postgres?sslmode=disable"
  });

  try {
    await client.connect();
    console.log('Connected to postgres database!');
  } catch (e) {
    console.log(e.message);
  } finally {
    await client.end();
  }
}

checkDb();
