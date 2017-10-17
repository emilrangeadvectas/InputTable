var express = require('express');
const bodyParser = require('body-parser');
var fs = require('fs');
var cookieParser = require('cookie-parser');
var http = require('http');
var https = require('https');
var async = require('async');
var session = require('express-session')
var qps_auth = require('./src/qps_auth.js')
var config = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));

main_password = "jkl"

var https_options = {
  pfx: fs.readFileSync("c:\\certs\\server.pfx")
};

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

  app.use(session({ secret: 'fhjketipq3', cookie: {  }}))
  

  
  app.use(bodyParser.urlencoded());
  app.use(bodyParser.json());
  app.use(cookieParser());
  app.use(require('express-method-override')('_method'));

  app.use(function(req,res,next)
  {
      console.log("==========================================")
      console.log("url: "+req.url)
      console.log("user: "+req.session.user_id)
      console.log("- - - - - - - - - - - - - - - - - - - - - ")
      
    if (req.session.know_password===true || req.url == '/'+main_password || req.url == '/rest5' || req.url == '/iframe')
    {
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
  

    // ---- IFRAME
    app.get('/iframe',function(req, res)
    {
        res.render('iframe');        
    })
    // ----
    
    // ---- REST
    app.get('/rest5', function(req, res)
    {
        db.get_rapport().then(function(x)
        {
            csv = x.header.join(";")
            x.body.forEach(function(i)
            {
                csv += "\n"
                x.header.forEach(function(l,ind)
                {
                    csv += (ind!==0 ? ";" : "")+(new String(i[l])).trim()
                })
            })
            res.writeHeader(200,{"Content-Type":"text/plain"})
            res.write(csv)
            res.end();
        })
    })
    // ----
  
    // ---- /
    app.get('/', function(req, res)
    {          
        if(!req.session.user_id)
        {
            res.redirect("/auth")
        }
        else
        {
            res.redirect("/plans")
        }
    });
    // ----

    // ---- AUTH
    app.get('/auth/:x_qlik_session?', function(req, res)
    {
        console.log(req.cookies)
        var x_qlik_session = req.params.x_qlik_session ? req.params.x_qlik_session : req.cookies['X-Qlik-Session'];
        
        qps_auth.auth(x_qlik_session,db).then(function(user_id)
        {
            if(user_id!==false)
            {
                console.log('as user id = '+user_id)
                req.session.user_id = user_id
                res.redirect("/")               
            }
            else
            {
                console.log("could not auth")
                console.log("redirects to login page")
                res.redirect("/login")
            }
        
        }).catch(function(a)
        {
            console.log(a)
            console.log("error in auth. redirect to login")
            res.redirect("/login")            
        })
    });
    // ----

    // ---- LOGIN
    app.get('/login', function(req, res)
    {
        if(req.session.user_id)
        {
            res.redirect("/")
            return;
        }
        res.render('login', {});  
    })

    app.post('/login', function(req, res)
    {
        n = req.body['login_name'];
        if(n)
        {
            db.get_user(n,function(a)
            {
                req.session.user_id = a[0].id
                res.redirect("/")
            })
        }
        else
        {
            res.redirect("/login")        
        }
    })
    // ----

    // ---- LOGOUT
    app.get('/logout', function(req, res)
    {
        req.session.user_id = null
        res.redirect("/")
    })    
    // ----
  
    // ---- ADMIN
    app.get('/admin',function(req, resp)
    {
        var t = undefined
        db.get_pivot_user_group_plan().then(function(o)
        {
            t = o
            return db.get_division_user_state();
            
        }).then(function(du)
        {
            body = t.recordset
            if(body.length===0)
            {
                t = {"header":[],"body":[]}
                
            }
            else
            {
                body = body.map(function(x)
                {
                    for(k in x)
                    {
                        if(k=='group_plan')
                            x[k] = {"text":x[k]}                            
                        else
                        {
                            if(x[k]==="|")
                            {
                                x[k] = {"text":   'not created'}                                
                            }
                            else
                            {
                                o = x[k].split("|")
                                y = parseInt(o[0])
                                x[k] = {"text":   y===0 ? 'work' : y===1 ? 'review' : y===2 ? 'sign' : '?'    ,"style":y===0 ? 'work' : y===1 ? 'review' : y===2 ? 'sign' : ''}
                                x[k].link = o[1]
                            }
                        }
                    }
                    return x
                })
                t = {"header":Object.keys(t.recordset[0]),"body":body}
            }
            resp.render('admin',{division_user:du, user_group_plan:t,header:{title:"Admin","user":req.cookies['login_user_id']}});        
        })
        .catch(function()
        {
            resp.status(500)
            resp.end()
        })
    })


    app.post('/admin/create_group_plan', function(req, res)
    {
        db.add_group_plan(req.body['name'],function()
        {
            res.redirect("/admin")        
        })
    })

    // ----
    
    // ---- PLAN:
    app.get('/plans', function(req, res)
    {
        db.is_admin2( req.session.user_id ).then(function(is_admin)
        {
			db.get_division_group_plan_for_user(req.session.user_id).then(function(d)
			{
                d.body = d.body.map(function(x)
                {
                    for(var f in x)
                    {
                        if(f!="gp_name")
                        {
                            var d = x[f].split("|")
                            if(d[0]=='x')
                                x[f] = {"type":"exists","id":d[1],"status": d[2]==0 ? 'work' : d[2]==1 ? 'review' : d[2]==2 ? 'sign' : d[2]===null ? 'not created' : '?'  }
                            else
                                x[f] = {"type":"create","group_plan_id":d[1],"division_id":d[2]}
                        }
                    }
                    return x
                })
                
                res.render('plans', { plans:d,"header":{"title":"Plans","user":req.session.user_id,"is_admin":is_admin,"hide_plan_view_link":true,}})                
			})
			.catch(function()
			{
                res.render('plans', { plans:{header:[],body:[]},"header":{"title":"Plans","user":req.session.user_id,"is_admin":is_admin,"hide_plan_view_link":true,}})                
			})   
        })
    })

    app.post('/plans',function(req,res)
    {
        db.create_plan(req.body['division_id'],req.body['group_plan_id'],function()
        {
            res.redirect('/plans')                         
        })
    })
    
    app.get('/plans/:plan_id',function(req,res)
    {
        db.is_admin2(req.session.user_id).then(function(is_admin)
        {
            db.get_new_plan(req.params.plan_id,function(x)
            {
                res.render('new_plan',{"disable_form": x.status === 0 || (x.status === 1 && is_admin) ? false : ""  ,data:x.body,plan_id:req.params.plan_id, "header":{"user":req.cookies['login_user_id'],"is_admin":is_admin,  "plan":{"state":x.status},"title":"Plan: "+x.group_plan_name+", "+x.division_name,"plan_id":req.params.plan_id,"is_locked":x.status===1}   });                              
            })            
        })
    })

    app.put('/plans/:plan_id/work',function(req,res)
    {
      db.set_plan_state("0",req.params.plan_id,function()
      {
        res.redirect("/plans/"+req.params.plan_id)  
      })
    })
    
    
    app.put('/plans/:plan_id/review',function(req,res)
    {
      db.set_plan_state("1",req.params.plan_id,function()
      {
        res.redirect("/plans/"+req.params.plan_id)  
      })
    })

    app.put('/plans/:plan_id/sign',function(req,res)
    {
      db.set_plan_state("2",req.params.plan_id,function()
      {
        res.redirect("/plans/"+req.params.plan_id)  
      })
    })
    
    app.put('/plans/:plan_id',function(req,res)
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
        db.update_new_plan(req.params.plan_id,update_data,function()
        {
            res.redirect('/plans/'+req.params.plan_id)             
        })
    })
    // ----
    

    if(!https_options)
    {
        web_server = http.createServer(app);
        web_server.listen(8066)                
    }
    else
    {
        web_server = https.createServer(https_options, app);
        web_server.listen(8066)        
    }
    
});
