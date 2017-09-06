var express = require('express');
const bodyParser = require('body-parser');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));

require('./src/db.js').get(config, function(db)
{
  var app = express();
  app.set('views', __dirname);
  app.set('view engine', 'pug');
  app.use(bodyParser.urlencoded());
  app.use(bodyParser.json());

  app.get('/style.css', function(req, res)
  {
    fs.readFile('files/style.css', 'utf8', function (err,data)
    {
      res.writeHeader(200,{"Content-Type":"text/css"})
      res.write(data)
      res.end()
    });
  })
  
  app.post('/', function(req, res)
  {
    var update_data = {}
    for(key in req.body)
    {
      if(key[0]!="_")
      {
        console.log(req.body[key]+" "+req.body["_"+key])
        if(req.body[key]!=req.body["_"+key])
        {
          update_data[key] = req.body[key]
        }
      }
    }
    db.update_and_get_matrix(function(matrix)
    {
      res.render('index', { matrix: matrix });
    },update_data )
  });

  app.get('/rest', function(req, res)
  {
    res.writeHeader(200,{"Content-Type":"application/json"})
    db.get_raw_newest_data(function(matrix)
    {
        console.log(matrix)
        header = matrix.headers.join(";")
        body = ""
        matrix.body.forEach(function(x)
        {
            body += "\n"+(x.join(";"))
        })
        res.write(header+body)
        res.end()    
    })
  })
  
  app.get('/', function(req, res)
  {

    db.get_matrix(function(matrix)
    {
      res.render('index', { matrix: matrix });
    })

  });

  app.listen(8066);
});
