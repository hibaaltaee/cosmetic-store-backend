require('dotenv').config();
const express = require('express');
const cors = require('cors');

const routes = require('./routes');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));


app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);



app.listen(PORT, () => {
  console.log(`\n🚀 Cosmetic Store API  →  http://localhost:${PORT}`);
  console.log(`   Environment         →  ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health check        →  http://localhost:${PORT}/health\n`);
});
 
module.exports = app;
 