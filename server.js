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

var templates = []
var index = 0
fs.readdirSync('./templates/').forEach(function(x)
{
    var template = require('./templates/'+x).get()
    template.filename = x
    templates.push(template)
    template.index = index
    index += 1
})

console.log(templates)


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
            console.log(x)
			if(x[0].length===0)
			{
				res(0);
				return;
			}
			
            var f = x[0][0]
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
            // 0 not access, no valid user, OR no valid plan
            // 1 access, can write
            // 2 access, but is locked
            res(0);            
        }).catch(function(err)
        {
            rej(err)
        });
    })
}

var fallback_page = function(req,res,next,status)
{
    res.clearCookie('start_page')     
    res.status(status)
    res.setHeader("Content-Type","text/html")
    res.render('fallback',{"status":status});
    next();
}


function is_valid_value(x)
{
    return isNaN(Number(x))===false;
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
      res.locals.it_log = []
      res.locals.it_log.push(req.method+" "+req.url)
      res.locals.it_log.push(JSON.stringify(req.body))
      res.locals.it_log.push("user: "+req.session.user_id)
      res.locals.it_log.push("- - - - - - - - - - - - - - - - - - - - - ")
      
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

    app.post('/reload',function(req,res,next)
    {
        if(req.session.user_id)
        {
            qrs_reload.reload().then(function()
            {
                res.writeHeader(204)
                res.end()
                next();
            })
            .catch(function()
            {
                res.writeHeader(500)                
                res.end()
                next();
            });
        }
        else
        {
            res.writeHeader(403);            
            res.end()
            next();
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
            res.locals.it_log.push("ERROR: db.get_rapport failed")
            res.locals.it_log.push(db_err.message)
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
            res.locals.it_log.push("ERROR: db.get_rapport_user failed")
            res.locals.it_log.push(db_err.message)
            res.writeHeader(500) 
            res.end();
        })
    })

    // ----
  
    // ---- /
    app.get('/', function(req, res,next)
    {          
        if(!req.session.user_id)
        {
            res.redirect("/auth")
            next();
        }
        else
        {
            if(req.cookies['start_page'] && req.cookies['start_page']!="/")
            {
                res.redirect(req.cookies['start_page'])
                next();
            }
            else
            {
                res.redirect("/plans")
                next();
            }
        }
    });
    // ----

    // ---- AUTH
    app.get('/auth', function(req, res,next)
    {
        var x_qlik_session = req.cookies['X-Qlik-Session'];

        if(x_qlik_session)
        {
            qps_auth.auth(x_qlik_session,db).then(function(user_id)
            {
                if(user_id!==false)
                {
                    res.locals.it_log.push('as user id = '+user_id)
                    req.session.user_id = user_id
                    res.redirect("/")               
                    next();
                }
                else
                {
                    res.locals.it_log.push("could not auth")
                    res.locals.it_log.push("redirects to login page")
                    res.redirect("/login")
                    next();
                }
            
            }).catch(function(a)
            {
                res.locals.it_log.push("error in auth. redirect to login")
                res.redirect("/login")            
                next();
            })
        }
        else
        {
            res.locals.it_log.push("no x-qlik-session found. redirect to login")
            res.redirect("/login")     
            next();
        }
    });
    // ----

    // ---- LOGIN
    app.get('/login', function(req, res, next)
    {
        res.render('login', {});  
        
        next();
    })

    app.post('/login', function(req, res,next)
    {
        n = req.body['login_name'];
        if(n)
        {
            db.get_user_by_name(n).then(function(user)
            {
                if(user)
                {
                    req.session.user_id = user
                    res.redirect("/plans")
                    next();
                }
                else
                {
                    res.redirect("/")                    
                    next();
                }
            })
        }
        else
        {
            res.redirect("/")
            next();
        }
    })
    // ----

    // ---- LOGOUT
    app.get('/logout', function(req, res)
    {
        req.session.user_id = null
        res.redirect("/")
        next();
    })    
    // ----
  
    // ---- ADMIN
    app.get('/admin',function(req, resp,next)
    {
        if(!req.session.user_id)
        {
            res.locals.it_log.push("try to access page that requires login. redirect to /")
            resp.redirect('/')
            next();
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
                        resp.render('admin',{division_user:du, user_group_plan:t, templates:templates,  header:{title:"Admin","user":req.cookies['login_user_id']}});        
                        next();
                    })                    
                    
                }
                else
                {
                    fallback_page(req,resp,next,403)                    
                }
            })                
            

            
        }
    })


    app.post('/admin/create_group_plan', function(req, res)
    {
        if(!req.session.user_id)
        {
            res.locals.it_log.push("try to access page that requires login. redirect to /")
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
    app.get('/plans', function(req, res,next)
    {
        if(!req.session.user_id)
        {
            res.locals.it_log.push("try to access page that requires login. redirect to /")
            res.redirect('/')
            next();
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
                    
                    res.render('plans', { "templates":templates, plans:d,"header":{"title":"Plans","user":req.session.user_id,"is_admin":is_admin,"hide_plan_view_link":true}})                
                    next();
                })
                .catch(function()
                {
                    res.render('plans', { plans:{header:[],body:[]},"header":{"title":"Plans","user":req.session.user_id,"is_admin":is_admin,"hide_plan_view_link":true,}})                
                    next();
                })   
            })
        }
    })

    app.post('/plans',function(req,res,next)
    {
        if(!req.session.user_id)
        {
            res.locals.it_log.push("try to access page that requires login. redirect to /")
            res.redirect('/')
            next();
        }
        else
        {
            db.create_plan(req.body['division_id'],req.body['group_plan_id']).then(function(plan_id)
            {

                res.locals.it_log.push("using template with index: "+req.body['template'])

                var template = templates.find(function(x){ return x.index == req.body['template'] })

                var o = {}
                var i = 
                o.insert = function(m,a,v,c)
                {
                    db.update_plan_cell(plan_id,m,a,v).then(function()
                    {
                        c();
                    })
                }
                
                template.run(o,function()
                {
                    res.redirect('/plans')
                    next();
                    
                })

            })
            /*
            db.create_plan(req.body['division_id'],req.body['group_plan_id'],function(plan_id)
            {

            })*/
        }
    })
    
    app.get('/plans/:plan_id',function(req,res,next)
    {
        if(!req.session.user_id)
        {
            res.locals.it_log.push("try to access page that requires login. redirect to /")
            res.redirect('/')
            next();
        }
        else
        {
            get_user_state_for_plan(db,req.session.user_id,req.params.plan_id).then(function(state)
			{
				if(state==0)
				{
                    fallback_page(req,res,next,403)
				}
				else
				{
					res.cookie('start_page',req.url) 
					db.is_admin(req.session.user_id).then(function(is_admin)
					{
						db.get_plan(req.params.plan_id).then(function(x)
						{
							res.render('plan',{"disable_form": x.status === 0 || (x.status === 1 && is_admin) ? false : ""  ,data:x.body,plan_id:req.params.plan_id, "header":{"user":req.cookies['login_user_id'],"is_admin":is_admin,  "plan":{"state":x.status},"title":"Plan: "+x.group_plan_name+", "+x.division_name,"plan_id":req.params.plan_id,"is_locked":x.status===1}   });
							next();
						}).catch(function(err)
						{
							res.locals.it_log.push("ERROR:")
							res.locals.it_log.push(err.message)
							fallback_page(req,res,next,500)           
						})
					})
				}
			}).catch(function(err)
            {
                res.locals.it_log.push("ERROR:")
				res.locals.it_log.push(err.message)
				fallback_page(req,res,next,500)                           
            })
        }
    })

    app.put('/plans/key',function(req,res,next)
    {        
        var plan_id = req.body['plan_id']
        var account_id = req.body['a_id']
        var value = req.body['value']
        res.locals.it_log.push("plan id: "+plan_id)
        res.locals.it_log.push("account id: "+account_id)
        res.locals.it_log.push("value: "+value)

        db.share_value(plan_id,account_id,value).then(function()
        {
            res.end()
            next();
            
        })
        


    })
    
    app.put('/plans',function(req,res,next)
    {        
        if(!req.session.user_id)
        {
            res.locals.it_log.push("do not update. login required")
            res.writeHeader(403,{"Content-Type":"application/json"})
            res.write(JSON.stringify({}))
            res.end()
            next();
        }
        else
        {
            get_user_state_for_plan(db,req.session.user_id,req.body['plan_id']).then(function(state)
            {
				console.log(req.session.user_id)
				console.log(req.session.user_id,req.body['plan_id'])
				
				console.log(state)
                if(state!=1)
                {
                    res.locals.it_log.push("do not have access to write this plan")
                    res.writeHeader(403,{"Content-Type":"application/json"})
                    res.write(JSON.stringify({}))
                    res.end()
                    next();
                }
                else if( !is_valid_value(req.body['value'])  )
                {
                    res.locals.it_log.push("invalid value")
                    res.writeHeader(400,{"Content-Type":"application/json"})
                    res.write(JSON.stringify({}))
                    res.end()
                    next();
                }
                else if(!req.body['month'])
                {
                    res.locals.it_log.push("invalid month")
                    res.writeHeader(400,{"Content-Type":"application/json"})
                    res.write(JSON.stringify({}))
                    res.end()
                    next();                    
                }
                else if(!req.body['key'])
                {
                    res.locals.it_log.push("invalid key")
                    res.writeHeader(400,{"Content-Type":"application/json"})
                    res.write(JSON.stringify({}))
                    res.end()
                    next();                    
                }
                else
                {
                    db.update_plan_cell( req.body['plan_id'], req.body['month'], req.body['key'], req.body['value']).then(function(x)
                    {
                        res.locals.it_log.push("updated!")
                        res.writeHeader(200,{"Content-Type":"application/json"})
                        res.write(JSON.stringify({}))
                        res.end()
                        next();
                    })
                }                
            }).catch(function(x)
            {
                res.writeHeader(500)
                res.end()                
                next();
            })
            
        }
        
        

    })
    
    
    app.put('/plans/:plan_id/work',function(req,res)
    {
        if(!req.session.user_id)
        {
            res.locals.it_log.push("try to access page that requires login. redirect to /")
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
            res.locals.it_log.push("try to access page that requires login. redirect to /")
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
            res.locals.it_log.push("try to access page that requires login. redirect to /")
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

    app.use(function(req,res,next)
    {
        console.log('\x1b[36m%s\x1b[0m', '===============================')
        res.locals.it_log.forEach(function(i,u)
        {
            console.log('\x1b[36m%s\x1b[0m', i)            
        })
        console.log('http status: \x1b[33m%s\x1b[0m', res.statusCode)            
        next();
        
    });
    

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
