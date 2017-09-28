var express = require('express');
const bodyParser = require('body-parser');
var fs = require('fs');
var cookieParser = require('cookie-parser');
var http = require('http');
var async = require('async');
var session = require('express-session')

var config = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));

main_password = "jkl"

require('./src/db.js').get(config, function(db)
{
  var app = express();

  app.set('views', __dirname);
  app.set('view engine', 'pug');

  app.use(session({ secret: 'fhjketipq3', cookie: { maxAge: 600000 }}))
  

  
  app.use(bodyParser.urlencoded());
  app.use(bodyParser.json());
  app.use(cookieParser());

    app.use(function(req,res,next)
  {
    if (req.session.know_password===true || req.url == '/'+main_password) {
      req.session.know_password = true
      next()
      return;
    }
    res.writeHeader(401,{"Content-Type":"text/html"})
    res.write('not allowed')
    res.end()    
  })


  app.get('/'+main_password, function(req, res)
  {
    res.redirect("/")        
  })
  
  app.get('/style.css', function(req, res)
  {
      console.log("test")
    fs.readFile('files/style.css', 'utf8', function (err,data)
    {
      res.writeHeader(200,{"Content-Type":"text/css"})
      res.write(data)
      res.end()
    });
  })
  
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
      db.set_plan_state("1",req.cookies['login_name'],req.body["group_plan_id"],function()
      {
        res.redirect("/plans/"+req.body["group_plan_id"])  
      })
  })

  app.post('/unlock_plan', function(req, res)
  {
      db.set_plan_state("0",req.cookies['login_name'],req.body["group_plan_id"],function()
      {
        res.redirect("/plans/"+req.body["group_plan_id"])  
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
//    res.writeHeader(200,{"Content-Type":"text/csv"})
    res.writeHeader(200,{"Content-Type":"text"})

    var csv = "user;key;field;value;group_plan";
    
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

  app.get('/rest2', function(req, res)
  {
//    res.writeHeader(200,{"Content-Type":"text/csv"})
    res.writeHeader(200,{"Content-Type":"text"})

    var csv = "user;key;field;value;group_plan";
    
    db.get_all_users(function(users)
    {
        var add_csv_report_to_body = function(user,d)
        {
            db.get_raw_newest_data2(function(matrix)
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

  app.get('/plans', function(req, res)
  {
    db.get_plans_of_users(req.cookies['login_name'],function(plans)
    {
        
//        [  {"name":"2017","status":0},{"name":"2018","status":1},{"name":"2019","status":-1} ]
        res.render('plans', { plans: plans.map(function(o)
        {
            console.log(o)
            return {"name":o.name,"status": o.have_plan===1 ? o.status : -1,"group_plan_id":o.group_plan_id};
        })});          
    })
  })

  app.get('/plans/:plan_id', function(req, res)
  {
    db.get_matrix(function(matrix)
    {
      db.get_plan_state(req.cookies['login_name'],req.params.plan_id,function(state,name)
      {
        res.render('index', { matrix: matrix,"user":req.cookies['login_name'],"group_plan_id":req.params.plan_id,is_locked:state==1,"group_plan_name":name });  
      })
    },req.cookies['login_name'],req.params.plan_id)

  })

  app.post('/plans/:plan_id', function(req, res)
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
        console.log("----!")
        res.redirect("/plans/"+req.params.plan_id)      

    },update_data,req.cookies['login_name'],req.params.plan_id )
  })
  
  app.get('/', function(req, res)
  {
          
    if(!req.cookies['login_name'])
    {
        res.redirect("/login")
        return;
    }
    db.user_has_plan(req.cookies['login_name'], function(b,plan)
    {
        if(b)
        {
            res.redirect("/plans")
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

  http_server = http.createServer(app);
  http_server.listen(8066)
});
