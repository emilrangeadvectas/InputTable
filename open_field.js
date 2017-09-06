
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));

require('./src/db.js').get(config, function(db)
{
  var field_to_add = process.argv[2]
  console.log("try add field: "+field_to_add)
  db.add_field(field_to_add,function(){  db.close()});
  
})