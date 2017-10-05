var express = require('express');
const bodyParser = require('body-parser');
var fs = require('fs');
var cookieParser = require('cookie-parser');
var http = require('http');
var async = require('async');
var session = require('express-session')

var config = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));

main_password = "jkl"

function status_code_to_text(x)
{
    if( x==1 ) return "locked/ready";
    if( x==0 ) return "open";
    if( x==null ) return "not created"
}

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
    console.log(req.url)  
    if (req.session.know_password===true || req.url == '/'+main_password || req.url == '/rest5' || req.url == '/iframe') {
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
    fs.readFile('files/style.css', 'utf8', function (err,data)
    {
      res.writeHeader(200,{"Content-Type":"text/css"})
      res.write(data)
      res.end()
    });
  })

  app.get('/style2.css', function(req, res)
  {
    fs.readFile('files/style2.css', 'utf8', function (err,data)
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
        db.get_user(n,function(a)
        {
            res.cookie('login_user_id',a[0].id)
            res.cookie('login_name',n)
            res.redirect("/")        
            
        })
    }
    else
    {
        res.redirect("/login")        
    }
  })

    app.get('/test7',function(req,res)
    {
        db.get_new_plan(function(x)
        {
            res.render('new_plan',{data:x.body});              
        })
    })
  
  app.get('/iframe',function(req, res)
  {
    res.render('iframe');        
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

  app.get('/test', function(req, res)
  {

  })
  
  app.get('/rest5', function(req, res)
  {
    db.get_raw_newest_data3(function(d)
    {
        csv ="user;group_plan;key;field;value";
        d.forEach(function(x)
        {
            csv += "\n"+(x.join(";"))  
        })
        res.end(csv) 
    });
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
    res.writeHeader(200)
    db.get_raw_newest_data(function(matrix)
    {
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


  app.get('/plans/:plan_id', function(req, res)
  {
    db.get_matrix(function(matrix)
    {
      db.get_plan_state(req.cookies['login_name'],req.params.plan_id,function(state,name)
      {
        res.render('index', { "header":{"title":"Group plan: "+name}, matrix: matrix,"user":req.cookies['login_name'],"group_plan_id":req.params.plan_id,is_locked:state==1 });  
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
        if(req.body[key]!=req.body["_"+key])
        {
          update_data[key] = req.body[key]
        }
      }
    }
    db.update_and_get_matrix(function(matrix)
    {
      db.get_plan_state(req.cookies['login_name'],req.params.plan_id,function(state,name)
      {
        res.render('index', { "header":{"title":"Group plan: "+name}, matrix: matrix,"user":req.cookies['login_name'],"group_plan_id":req.params.plan_id,is_locked:state==1 });  
      })
    },update_data,req.cookies['login_name'],req.params.plan_id )
  })
  
  app.get('/', function(req, res)
  {
          
    if(!req.cookies['login_name'])
    {
        res.redirect("/login")
    }
    else
    {
        res.redirect("/plans")
    }
    
  });

    // ---
    app.get('/admin',function(req, res)
    {
        db.valid_admin(function(valid_admin)
        {
            if(valid_admin)
            {
                db.get_pivot_user_group_plan(function(d,h)
                {
                    db.get_division_user_state(function(du)
                    {
                      
                        d = d.map(function(x)
                        {
                            for(var f in x)
                            {
                                if(f!="name")
                                    x[f] = status_code_to_text(x[f])
                            }
                            return x;
                        })      
                        h.push("export")            
                        console.log(du)
                        res.render('admin',{division_user:du,group_plans:d,theaders:h,header:{title:"Admin","user":req.cookies['login_name']}});        
                    });
                })
            }
            else
            {
                res.render('admin',{group_plans:[],theaders:[],header:{title:"Admin","user":req.cookies['login_name']}});        
            }
        })
    })


    app.get('/plans', function(req, res)
    {
        db.is_admin(req.cookies['login_name'],function(is_admin)
        {
            db.get_division_group_plan_for_user(req.cookies['login_user_id'],function(d)
            {
                
                d.body = d.body.map(function(x)
                {
                    for(var f in x)
                    {
                        console.log(f)
                        if(f!="gp_name")
                        {
                            if(x[f]!==null)
                            {
                                x[f] = x[f].split("|")
                                x[f][1] = status_code_to_text(x[f][1])
                            }
                            else
                                x[f] = status_code_to_text(null)
                        }
                    }
                    return x;
                })
                
                res.render('plans', { plans:d,"header":{"title":"Plans","user":req.cookies['login_name'],"is_admin":is_admin,"hide_plan_view_link":true,}})                
            })
        })
    })
    // ---
    
    http_server = http.createServer(app);
    http_server.listen(8066)
});
