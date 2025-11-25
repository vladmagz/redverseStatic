// functions/views.js
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'views.json');

// Читаем или создаём файл
function readDB() {
  if (!fs.existsSync(dbPath)) return {};
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

exports.handler = async function(event) {
  const slug = event.queryStringParameters?.slug;
  if (!slug) return { statusCode: 400, body: 'Missing slug' };

  const db = readDB();
  db[slug] = (db[slug] || 0) + 1;
  writeDB(db);

  return {
    statusCode: 200,
    body: JSON.stringify({ views: db[slug] }),
  };
};
