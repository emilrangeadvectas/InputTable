
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));

require('./src/db.js').get(config, function(db)
{
  var field_to_lock = process.argv[2]
  console.log("try lock field: "+field_to_lock)
  db.lock_field(field_to_lock,function(){  db.close()});
  
})