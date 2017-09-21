var express = require('express');
const bodyParser = require('body-parser');
var fs = require('fs');
var cookieParser = require('cookie-parser');
var async = require('async');

var config = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));

require('./src/db.js').get(config, function(db)
{
  var app = express();
  app.set('views', __dirname);
  app.set('view engine', 'pug');
  app.use(bodyParser.urlencoded());
  app.use(bodyParser.json());
  app.use(cookieParser());

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
    },update_data,req.cookies['login_name'] )
  });

  app.post('/create_plan', function(req, res)
  {
    var id = req.body['id']
    db.create_plan(  req.cookies['login_name'], id, function(s,info)
    {
        res.render('info', { header: s ? "create plan success" : "create plan failed", info: info ? info : "click ok to goto plan" });        
    })
  });

  app.post('/admin/create_group_plan', function(req, res)
  {
    db.add_group_plan(req.body['name'],function()
    {
        res.redirect("/admin")        
    })
  })
  
  app.post('/login', function(req, res)
  {
    n = req.body['login_name'];
    if(n)
    {
        res.cookie('login_name',n)
        res.redirect("/")        
    }
    else
    {
        res.redirect("/login")        
    }
  })
  
  app.get('/admin',function(req, res)
  {
    db.get_group_plans(function(a)
    {
      res.render('admin',{group_plans:a});        
    })
  })
  
  app.get('/login', function(req, res)
  {
    if(req.cookies['login_name'])
    {
        res.redirect("/")
        return;
    }
    res.render('login', {});  
  })

  app.get('/logout', function(req, res)
  {
      res.clearCookie('login_name')
      res.redirect("/")
  })

  app.post('/lock_plan', function(req, res)
  {
      db.set_plan_state("6",req.cookies['login_name'],req.body["group_plan_id"],function()
      {
        res.write("")
        res.end() 
        //res.redirect("/")  
      })
  })
  
  app.get('/rest_sum', function(req, res)
  {
    db.get_report(function(l)
    {
        var csv = "group_plan;field;value" + '\n';
        l.forEach(function(u)
        {
            csv += u.join(";")  + '\n';
        })
        /*
        csv += "2017;01;1415"  + '\n';
        csv += "2017;02;11415"  + '\n';
        csv += "2017;03;1415"  + '\n';
        csv += "2017;04;1415"  + '\n';
        csv += "2017;05;11415"  + '\n';
        csv += "2017;06;1415"  + '\n';
        csv += "2017;07;1415"  + '\n';
        csv += "2017;08;6415"  + '\n';
        csv += "2017;09;1415"  + '\n';
        csv += "2017;10;1415"  + '\n';
        csv += "2017;11;1415"  + '\n';
        csv += "2017;12;1415"  + '\n';*/
        res.write(csv)
        res.end()         
    })
  })

  app.get('/rest', function(req, res)
  {
    res.writeHeader(200,{"Content-Type":"text/csv"})

    var csv = "user;key;field;value";
    
    db.get_all_users(function(users)
    {
        var add_csv_report_to_body = function(user,d)
        {
            db.get_raw_newest_data(function(matrix)
            {
                matrix.forEach(function(x)
                {
                    csv += "\n"+(x.join(";"))
                })
                d();
            },user)        
        }

        async.each(users,add_csv_report_to_body,function()
        {
            res.write(csv)
            res.end()  
        });        
    })
  })
  
  app.get('/rest_old', function(req, res)
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
          
    if(!req.cookies['login_name'])
    {
        res.redirect("/login")
        return;
    }
    db.user_has_plan(req.cookies['login_name'], function(b)
    {
        if(b)
        {
            db.get_matrix(function(matrix)
            {
              console.log(matrix.body[0])
              res.render('index', { matrix: matrix,"user":req.cookies['login_name'],"group_plan_id":"1" });
            },req.cookies['login_name'])            
        }
        else
        {
            db.is_admin(req.cookies['login_name'],function(is_admin)
            {
                
                
                db.get_group_plans(function(plans)
                {
                    var d = plans.map(function(o)
                    {
                        return {"name":o.name,"id":o.id};
                    })
                    res.render('create_plan',{"user":req.cookies['login_name'],"is_admin": is_admin,"group_plans":d});                                
                });

                
                
                
            })
        }
    })
  });

  app.listen(8066);
});
