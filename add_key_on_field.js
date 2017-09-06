
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));

require('./src/db.js').get(config, function(db)
{
  var key_to_add = process.argv[2]
  var on_field = process.argv[3]
  console.log("try add key: "+key_to_add+", on field: "+on_field)
  db.add_key(key_to_add,on_field,function(){  db.close()});
  
})