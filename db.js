const { Pool } = require('pg');
require('dotenv').config();


const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'cosmetic_store',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ PostgreSQL connected successfully');
    release();
  }
});
 
const query     = (text, params) => pool.query(text, params);
const getClient = ()             => pool.connect();
 
module.exports = { query, getClient };