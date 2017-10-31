var express = require('express');
const bodyParser = require('body-parser');
var fs = require('fs');
var cookieParser = require('cookie-parser');
var http = require('http');
var https = require('https');
var async = require('async');
var session = require('express-session')

var config = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));

var qps_auth = undefined

if(config.cert)
{
    console.log("Init QPS AUTH...")
    qps_auth = require('./src/qps_auth.js').cert(fs.readFileSync(config.cert.key),fs.readFileSync(config.cert.cert));
    console.log("...success")
    console.log("Init QPS RELOAD...")
    qrs_reload = require('./src/qrs_reload.js').cert(fs.readFileSync(config.cert.key),fs.readFileSync(config.cert.cert));
    console.log("...success")
}
else
{
    console.log("Warning: using mocked QPS AUTH")
    qps_auth = require('./src/mock/qps_auth.js');

    console.log("Warning: using mocked QPS RELOAD")
    qrs_reload = require('./src/mock/qrs_reload.js');
}



main_password = "jkl_987654321"
var https_options = false

/*
var https_options = {
  pfx: fs.readFileSync("c:\\certs\\server.pfx")
};
*/

function status_code_to_text(x)
{
    if( x==1 ) return "locked/ready";
    if( x==0 ) return "open";
    if( x==null ) return "not created"
}

function get_user_state_for_plan(db,user_id,plan_id)
{
    return new Promise(function(res,rej)
    {
        db.get_user_state_for_plan(user_id,plan_id).then(function(x)
        {
			if(x[0].length===0)
			{
				res(0);
				return;
			}
			
            var f = x[0][0]
            console.log(f)
            if(f['is_admin'])
            {
                if(f['status']==2) { res(2); return; }
                res(1);
                return;
            }
            else
            {
                if(f['status']==2 || f['status']==1 ) { res(2); return; }
                res(1);
                return;
            }
            console.log("?")
            // 0 not access, no valid user, OR no valid plan
            // 1 access, can write
            // 2 access, but is locked
            res(0);            
        });
    })
}

var fallback_page = function(req,res,next,status)
{
    res.clearCookie('start_page')     
    res.status(status)
    res.setHeader("Content-Type","text/html")
    res.render('fallback',{"status":status});
  
}


function is_valid_value(x)
{
  x = ""+x;
  if(x==="") return false;
  var reg = /^[0-9 ]+$/ //spaces are allowed since they are being trimmed
  if(!reg.test(x)) return false;
  
  var v = x.split(' ').join('');
  
  if(v>1000000) return false;
  if(v<0) return false;
  return true;
}

require('./src/db.js').get(config.db, function(db)
{
  var app = express();

  app.set('views', __dirname+'/views');
  app.set('view engine', 'pug');

  app.use(session({ secret: 'fhjketipq3', cookie: {  }}))
  

  
  app.use(bodyParser.urlencoded());
  app.use(bodyParser.json());
  app.use(cookieParser());
  app.use(require('express-method-override')('_method'));
  app.use(cookieParser());
  
  app.use(function(req,res,next)
  {
      console.log("==========================================")
      console.log(req.method+" "+req.url)
      console.log(req.body)
      console.log("user: "+req.session.user_id)
      console.log("- - - - - - - - - - - - - - - - - - - - - ")
      
    if (true || req.session.know_password===true || req.url == '/'+main_password || req.url == '/rest5' || req.url == '/rest_user' || req.url == '/iframe')
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
            var expires = new Date(Date.now()+86400000).toUTCString()
          res.writeHeader(200,{"Content-Type":"text/css","Cache-Control":"max-age=86400"})
          res.write(data)
          res.end()
        });
    })

    app.post('/reload',function(req,res)
    {
        if(req.session.user_id)
        {
            qrs_reload.reload().then(function()
            {
                res.writeHeader(204)
                res.end()
            })
            .catch(function()
            {
                res.writeHeader(500)                
                res.end()
            });
        }
        else
        {
            res.writeHeader(403);            
            res.end()
        }
    })
    
    // ---- IFRAME
    app.get('/iframe',function(req, res,next)
    {
        page404(req,res,next)
//        res.render('iframe');        
    })
    // ----
    
    // ---- REST
    app.get('/rest5', function(req, res)
    {
        db.get_rapport().then(function(x)
        {
            var csv = x.header.join(";")
            if(x.body.length==0) csv += "\n"

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
        .catch(function(db_err)
        {
            console.log("ERROR: db.get_rapport failed")
            console.log(db_err.message)
            res.writeHeader(500) 
            res.end();
        })
    })

    app.get('/rest_user', function(req, res)
    {
        var f = function(i,l,ind)
        {
            if(ind==0) return i[l].split("|").reverse().join("/")
            return new String(i[l])
        }
        
        db.get_rapport_user().then(function(x)
        {
            var csv = x.header.join(";")
            x.body.forEach(function(i)
            {
                csv += "\n"
                x.header.forEach(function(l,ind)
                {
                    csv += (ind!==0 ? ";" : "")+(  f(i,l,ind)  ).trim()
                })
            })
            res.writeHeader(200,{"Content-Type":"text/plain"})
            res.write(csv)
            res.end();
        })
        .catch(function(db_err)
        {
            console.log("ERROR: db.get_rapport_user failed")
            console.log(db_err.message)
            res.writeHeader(500) 
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
            if(req.cookies['start_page'] && req.cookies['start_page']!="/")
            {
                res.redirect(req.cookies['start_page'])
            }
            else
            {
                res.redirect("/plans")
            }
        }
    });
    // ----

    // ---- AUTH
    app.get('/auth', function(req, res)
    {
		console.log(req.cookies['X-Qlik-Session'])
        var x_qlik_session = req.cookies['X-Qlik-Session'];

        if(x_qlik_session)
        {
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
                console.log("error in auth. redirect to login")
                res.redirect("/login")            
            })
        }
        else
        {
            console.log("no x-qlik-session found. redirect to login")
            res.redirect("/login")                        
        }
    });
    // ----

    // ---- LOGIN
    app.get('/login', function(req, res)
    {
        res.render('login', {});  
    })

    app.post('/login', function(req, res)
    {
        console.log(req.body)
        n = req.body['login_name'];
        if(n)
        {
            db.get_user_by_name(n).then(function(user)
            {
                if(user)
                {
                    req.session.user_id = user
                    res.redirect("/plans")
                }
                else
                {
                    res.redirect("/")                    
                }
            })
        }
        else
        {
            res.redirect("/")
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
    app.get('/admin',function(req, resp,next)
    {
        if(!req.session.user_id)
        {
            console.log("try to access page that requires login. redirect to /")
            resp.redirect('/')
        }
        else
        {
            
            db.is_admin( req.session.user_id ).then(function(is_admin)
            {
                if(is_admin)
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
                    
                }
                else
                {
                    console.log("!!!!!.")
                    fallback_page(req,resp,next,403)                    
                }
            })                
            

            
        }
    })


    app.post('/admin/create_group_plan', function(req, res)
    {
        if(!req.session.user_id)
        {
            console.log("try to access page that requires login. redirect to /")
            res.redirect('/')
        }
        else
        {
            db.add_group_plan(req.body['name'],function()
            {
                res.redirect("/admin")        
            })
        }
    })

    // ----
    
    // ---- PLAN:
    app.get('/plans', function(req, res)
    {
        if(!req.session.user_id)
        {
            console.log("try to access page that requires login. redirect to /")
            res.redirect('/')
        }
        else
        {
            db.is_admin( req.session.user_id ).then(function(is_admin)
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
        }
    })

    app.post('/plans',function(req,res)
    {
        if(!req.session.user_id)
        {
            console.log("try to access page that requires login. redirect to /")
            res.redirect('/')
        }
        else
        {
            db.create_plan(req.body['division_id'],req.body['group_plan_id'],function()
            {
                res.redirect('/plans')                         
            })
        }
    })
    
    app.get('/plans/:plan_id',function(req,res,next)
    {
        if(!req.session.user_id)
        {
            console.log("try to access page that requires login. redirect to /")
            res.redirect('/')
        }
        else
        {
            res.cookie('start_page',req.url) 
            db.is_admin(req.session.user_id).then(function(is_admin)
            {
                db.get_plan(req.params.plan_id).then(function(x)
                {
                    res.render('plan',{"disable_form": x.status === 0 || (x.status === 1 && is_admin) ? false : ""  ,data:x.body,plan_id:req.params.plan_id, "header":{"user":req.cookies['login_user_id'],"is_admin":is_admin,  "plan":{"state":x.status},"title":"Plan: "+x.group_plan_name+", "+x.division_name,"plan_id":req.params.plan_id,"is_locked":x.status===1}   });
                    
                }).catch(function(err)
                {
                    console.log("ERROR:")
                    console.log(err.message)
                    fallback_page(req,res,next,500)           
                })
                /*
                db.get_new_plan(req.params.plan_id,function(x)
                {
                })
                .catch(function(err)
                {
                    
                })*/
            })
        }
    })

    app.put('/plans',function(req,res)
    {        
        if(!req.session.user_id)
        {
            console.log("do not update. login required")
            res.writeHeader(403,{"Content-Type":"application/json"})
            res.write(JSON.stringify({}))
            res.end()
        }
        else
        {
            get_user_state_for_plan(db,req.session.user_id,req.body['plan_id']).then(function(state)
            {
                if(state!=1)
                {
                    console.log("do not have access to write this plan")
                    res.writeHeader(403,{"Content-Type":"application/json"})
                    res.write(JSON.stringify({}))
                    res.end()
                    
                }
                else if( !is_valid_value(req.body['value'])  )
                {
                    console.log("invalid value")
                    res.writeHeader(400,{"Content-Type":"application/json"})
                    res.write(JSON.stringify({}))
                    res.end()
                }
                else if(!req.body['month'])
                {
                    console.log("invalid month")
                    res.writeHeader(400,{"Content-Type":"application/json"})
                    res.write(JSON.stringify({}))
                    res.end()
                    
                }
                else if(!req.body['key'])
                {
                    console.log("invalid key")
                    res.writeHeader(400,{"Content-Type":"application/json"})
                    res.write(JSON.stringify({}))
                    res.end()
                    
                }
                else
                {
                    db.update_plan_cell( req.body['plan_id'], req.body['month'], req.body['key'], req.body['value']).then(function(x)
                    {
                        console.log("updated!")
                        res.writeHeader(200,{"Content-Type":"application/json"})
                        res.write(JSON.stringify({}))
                        res.end()
                    })
                }                
            }).catch(function(x)
            {
                res.writeHeader(500)
                res.end()                
            })
            
        }
        
        

    })
    
    
    app.put('/plans/:plan_id/work',function(req,res)
    {
        if(!req.session.user_id)
        {
            console.log("try to access page that requires login. redirect to /")
            res.redirect('/')
        }
        else
        {
            db.set_plan_state("0",req.params.plan_id,function()
            {
                res.redirect("/plans/"+req.params.plan_id)  
            })
        }
    })
    
    
    app.put('/plans/:plan_id/review',function(req,res)
    {
        if(!req.session.user_id)
        {
            console.log("try to access page that requires login. redirect to /")
            res.redirect('/')
        }
        else
        {
            db.set_plan_state("1",req.params.plan_id,function()
            {
                res.redirect("/plans/"+req.params.plan_id)  
            })
        }
    })

    app.put('/plans/:plan_id/sign',function(req,res)
    {
        if(!req.session.user_id)
        {
            console.log("try to access page that requires login. redirect to /")
            res.redirect('/')
        }
        else
        {
            db.set_plan_state("2",req.params.plan_id,function()
            {
                res.redirect("/plans/"+req.params.plan_id)  
            })
        }
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
