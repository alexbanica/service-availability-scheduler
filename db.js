const mysql = require('mysql2/promise');

function getConnectionConfig() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return {
    uri: url,
    dateStrings: true,
    timezone: 'Z'
  };
}

async function initDb() {
  const db = await mysql.createPool(getConnectionConfig());
  await db.query('SELECT 1');
  return db;
}

module.exports = {
  initDb
};
