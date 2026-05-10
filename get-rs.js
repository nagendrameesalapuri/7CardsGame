const mongoose = require('./server/node_modules/mongoose');
const uri = 'mongodb://nagendrameesalapuri_db_user:1lpb6Sai6HMyzXfs@ac-1kt30x1-shard-00-00.lyve01n.mongodb.net:27017/seven-cards-show?authSource=admin&directConnection=true&tls=true';
mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, family: 4 })
  .then(async () => {
    console.log('connected!');
    const admin = mongoose.connection.db.admin();
    const info = await admin.command({ isMaster: 1 });
    console.log('setName:', info.setName);
    console.log('primary:', info.primary);
    process.exit(0);
  })
  .catch(e => { console.log('error:', e.message); process.exit(1); });
