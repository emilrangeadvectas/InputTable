var mssql = require('mssql')
var async = require('async');
var aggregator = require('../aggregator.js');

var table_name = 'data2'
var value = 'value'
var field = 'field'
var table_key = '_key'
var editable = 'editable'

/*
TODO: lägg in den här query så att vi plockar den senaste (notera att vi kör insert istället för update i fortsättningen)
;
*/

// escape värden i query. (iaf dom som är input relaterade)
// en connection per request, eller en global, se till att connection stängs om fel. stäng connection om servern stängs
// få tabelen dynamsik. kunna definera kolumnnamn. ordningen spelar ingen roll?
// spelar ordning på datan roll
// får det exitera dubletter? hur hanteras det (nu är det max värdet som räknas)
// Vad händer om en post inte existerar

get_next_table_name = function()
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < 5; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return ["input_table_"+text,text];
}


function get_total(gp_id,field,callback)
{
//    callback(123)
  //  return;
    var total = 0
    console.log(gp_id+","+field)
    fields = []
    var sql = "SELECT [table] FROM input_table WHERE group_plan_id = @group_plan_id";
    new mssql.Request()
      .input('group_plan_id',mssql.BigInt,gp_id)
      .query(sql,function(err,r)
      {
          async.each(r.recordset.map(function(o){ return o.table }),function(ii2,uu2)
          {
              var sql = "SELECT SUM([value]) AS s FROM input_table_"+ii2+" WHERE field = @field"
              new mssql.Request()
                .input('field',mssql.VarChar(255),field)
                .query(sql,function(err,r){
                    
                    
                    total += r.recordset[0].s
                    uu2();        
                })

          },function()
          {
              console.log(total)
              callback(total)
          })
      })
}

function is_valid(x)
{
  if(x==="") return false;
  var reg = /^[0-9 ]+$/ //spaces are allowed since they are being trimmed
  if(!reg.test(x)) return false;
  
  var v = x.split(' ').join('');
  
  if(v>1000000) return false;
  if(v<0) return false;
  return true;
}

function do_process(x)
{
  console.log(x)
  var v = x.split(' ').join('');
  console.log(v)
  return v;
}

function do_output(x)
{
    if(x===null) return '';
	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}





function get_if_form(x,y,rs)
{
  var r = false;
  rs.forEach(function(l)
  {
    if(l[table_key]===y)
    {
      for(var j in l){
        if(j===x)
        {
          if(l[j]===1)
          {
            r = x+";"+y
          }
        }
      }
    }
  })
  return r;
}

function get_user_plan(mssql,user,callback)
{
    var sql = "SELECT [table] FROM input_table WHERE [user] = @user";
    new mssql.Request()
	  .input('user',mssql.VarChar(255),user)
      .query(sql,function(err,recordsets)
      {
        var t = recordsets.recordsets[0][0].table;
        callback(t);
      })    
}

function build_matrix(callback,mssql,error,user)
{
    get_user_plan(mssql,user,function(plan_id)
    {
      var table_name = "input_table_"+plan_id;

      var get_fields_sql = "SELECT "+field+" FROM "+table_name+" GROUP BY "+field

      var innersql = "SELECT _key, field, (SELECT TOP(1) value FROM "+table_name+" WHERE _key = d1._key AND field = d1.field ORDER BY created DESC) AS value FROM "+table_name+" AS d1 GROUP BY _key, field";

      
      if(error===undefined) error = {}
      new mssql.Request().query(get_fields_sql, function(err, recordsets, returnValue)
      {
        console.log(err)
        fields = []
        console.log("-----")
        console.log(recordsets.recordsets[0])
        for(u in recordsets.recordsets[0])
        {
          console.log(u)
          fields.push( recordsets.recordsets[0][u][field] );
        }
        var pivot_styled_field_list = "["+fields.join("],[")+"]"

          var sql = "SELECT * FROM ("+innersql+") as g "+
          "PIVOT ( max("+value+") for field in ("+pivot_styled_field_list+") ) AS d";

          var sql3 = "SELECT * FROM (SELECT "+table_key+", "+field+", "+editable+" FROM "+table_name+") as g "+
          "PIVOT ( max("+editable+") for field in ("+pivot_styled_field_list+") ) AS d";

          console.log(sql3)
          var data = []
          new mssql.Request().query(sql, function(err, recordsets, returnValue)
          {
            console.log(err)
            new mssql.Request().query(sql3, function(err, recordsets3, returnValue3)
            {
              console.log(recordsets.recordsets[0])
              recordsets.recordsets[0].forEach(function(x)
              {
                console.log(",")
                console.log(x)
                var the_key = x[table_key]
                row = [{value:the_key}]
                rrr = ['_key','01','02','03','04','05','06','07','08','09','10','11','12'];
                rrr.forEach(function(_key)
                {
                  if(_key===table_key) return;
                  var cell = {value:do_output(x[_key]),form:get_if_form(_key, the_key,recordsets3.recordsets[0])};
                  if( error[_key+";"+the_key]!==undefined )
                  {
                    cell.error = true
                    cell.value = error[_key+";"+the_key]
                  }

                  row.push(cell)
                });
                var real_row = {}
                fields.forEach(function(a,b)
                {
                    return;
                    console.log(a)
                    console.log(b)
                    row.forEach(function(x)
                    {
                        if(x['form']===undefined) return;
                        if(x['form']===false) return;

                        console.log(x['form'])
                        console.log(x['form'])
                        console.log(a.substring(0,2))
                        
                        if(x['form'].substring(0,2)==a){
                            console.log("...")
                            console.log(x['form']);
                        real_row[x['form']] = x;
                        }
                    })
                })
                console.log(real_row)
                data.push(row)
//                data.push(real_row)
              })
              var matrix = {}
              matrix.headers = [''].concat(fields)
              matrix.body = data
              callback(matrix);
            });
          });
        });



    
    })
}

function get_all_fields_of_group_plan(id,callback)
{
    fields = []
    var sql = "SELECT [table] FROM input_table WHERE group_plan_id = @group_plan_id";
    new mssql.Request()
      .input('group_plan_id',mssql.BigInt,id)
      .query(sql,function(err,r)
      {
          async.each(r.recordset,function(i,u)
          {
              var sql = "SELECT field FROM input_table_"+i.table;
              new mssql.Request()
                .query(sql,function(err,r)
                {
                    fields = fields.concat(r.recordset.map(function(o){ return o.field}))
                    u();
                })
          },function()
          {
              callback(fields.filter(function(v,i,s){return s.indexOf(v)===i}));
          })
      })
}

function update_data(mssql,callback_when_all_update_done,data,user)
{
    if(!user) throw "invalid user"

    get_user_plan(mssql,user,function(plan_id)
    {
        var table_name = "input_table_"+plan_id;
              
        error_fields = {}
        to_update_list = []
        for(key in data)
        {
            if( !is_valid(data[key]) )
            {
              error_fields[ key ] = data[key]
            }
            else
            {
              to_update_list.push([key,do_process(data[key])])
            }
        }

        update = function(avp,callback_when_done)
        {
            var keys = avp[0].split(";")
            var sql = "INSERT INTO "+table_name+" (value,field,_key,created) VALUES(@value,@field,@key,GETDATE())";
            new mssql.Request()
              .input('value',mssql.Int,avp[1])
              .input('field',mssql.VarChar(32),keys[0])
              .input('key',mssql.VarChar(32),keys[1])
              .query(sql,function(err)
              {
                  callback_when_done();
              })
        }
        done = function()
        {
            callback_when_all_update_done(error_fields);
        }
        async.each(to_update_list,update,done)
    })
    
}

exports.get = function(config,callback)
{
    mssql.connect(config, function (err)
    {
        var db = {}

        db.get_matrix = function(callback,user)
        {
            build_matrix(callback,mssql,undefined,user); 
        }

        db.update_and_get_matrix = function(callback,data,user)
        {
            update_data(mssql,function(error)
            {
                build_matrix(callback,mssql,error,user);
            },data,user)
        }

        db.add_key = function(key,on_field,done)
        {
            var sql = "INSERT INTO "+table_name+" ("+field+","+table_key+","+editable+") VALUES ('"+on_field+"','"+key+"',1)";
            new mssql.Request()
              .query(sql,function(err)
              {
                done();
              })
        }

        db.get_report = function(callback)
        {
            ll = []
            var sql = "SELECT * FROM input_table_group_plans"
            new mssql.Request()
              .query(sql,function(err,r)
              {
                  async.each(r.recordset,function(i,u)
                  {
                      get_all_fields_of_group_plan(i.ID,function(ui)
                      {
                          async.each(ui,function(uu2,iei2)
                          {
                                                                    console.log("?")

                                  get_total(i.ID,uu2,function(t)
                                  {
                                      console.log("!")
                                      ll.push([i.name,uu2,t])
                                      iei2();
                                  })
                                  
                              /*
                              ui.forEach(function(g)
                              {

                              })*/
                              
                              
                          },function()
                          {
                              u();
                          })
                      })
                  },function()
                  {
                      callback(ll)
                  })
              })

        }

        db.set_plan_state = function(state,user,group_plan_id,callback)
        {
            var sql = "UPDATE input_table SET status = @state WHERE [user] LIKE @user AND group_plan_id = @group_plan_id";
            new mssql.Request()
              .input('state',mssql.BigInt,state)
              .input('user',mssql.VarChar(255),"karl")
              .input('group_plan_id',mssql.BigInt,group_plan_id)
              .query(sql,function(err,r)
              {
                  console.log("!")
                  console.log(err)
                  callback();              
              })
        }
        
        db.get_group_plans = function(callback)
        {
            var sql = "SELECT * FROM input_table_group_plans"
            new mssql.Request()
              .query(sql,function(err,r)
              {
                  var data = []
                  async.each(r.recordset,function(i,u)
                  {
                      new mssql.Request()
                        .input('group_plan_id',mssql.VarChar(255),i.ID)
                        .query("SELECT * FROM input_table WHERE group_plan_id = @group_plan_id",function(err,r)
                        {
                          var up = []
                          r.recordset.forEach(function(uu)
                          {
                              up.push({"name":uu.user,"status":uu.status});
                          })
                          data.push({"id":i.ID,"name":i.name,"users_plans":up});
                          u(); 
                        })
                  },function()
                  {
                      callback(data);                      
                  })
              
              //                var data = [ {"name":"budget 2019","users_plans":[]}, {"name":"budget 2018", "users_plans":[{name:"emil", status:"started"},{name:"karl",status:"started"},{name:"lisa",status:"done"}]} ,  {"name":"budget 2017","users_plans":[{name:"tim",status:"started"},{name:"lisa",status:"done"} ]]}
              })

            
        
        }
        
        db.add_group_plan = function(name,callback)
        {
            var sql = "INSERT INTO input_table_group_plans (name) VALUES (@name)";
            new mssql.Request()
              .input('name',mssql.VarChar(255),name)
              .query(sql,function(err)
              {
                callback();
              })
        }
        
        db.get_all_users = function(callback)
        {
            var users = []
            var sql = "SELECT [user] FROM input_table";
            new mssql.Request()
              .query(sql,function(err,recordsets)
              {
                  recordsets.recordsets[0].forEach(function(i,u)
                  {
                      users.push(i.user);
                  })
                  callback(users);
              });
        }
        
        db.get_raw_newest_data = function(callback,user)
        {
            get_user_plan(mssql,user,function(plan_id)
            {
                var table_name = "input_table_"+plan_id;

                sql = "SELECT _key, field, (SELECT TOP(1) value FROM "+table_name+" WHERE _key = d1._key AND field = d1.field ORDER BY created DESC) AS value FROM "+table_name+" AS d1 GROUP BY _key, field";
                new mssql.Request()
                  .query(sql,function(err,recordsets)
                  {
                    body = []
                    recordsets.recordsets[0].forEach(function(x)
                    {
                        body.push([user,x[table_key],x[field],x[value]])
                    })
                    callback(body);
                  })                
            })
        }
        
        db.lock_field = function(f,callback_when_done)
        {
            sql = "UPDATE "+table_name+" SET editable = 0 WHERE "+field+"='"+f+"'" ;
            new mssql.Request()
              .query(sql,function(err)
              {
                  callback_when_done();
              })
        }

        db.is_admin = function(user,c)
        {
            var sql = "SELECT COUNT(*) AS is_admin FROM input_table_setup WHERE concat('|',admins,'|') LIKE '%|"+user+"%|'";            
            //TODO: use an actual @param
            new mssql.Request()
            .query(sql,function(err,r)
            {
                c(r.recordset[0].is_admin===1)
            })
        }
        
        db.create_plan = function(user,group_plan_id,d)
        {
            if(!user)
            {
                d(false,"User is 'false'");
                return;
            }
                
            var table_name = get_next_table_name()
            var sql = "CREATE TABLE ["+table_name[0]+"]("+
                "[_key] [nvarchar](32) NULL,"+
                "[field] [nvarchar](32) NULL,"+
                "[value] [int] NULL,"+
                "[editable] [tinyint] NULL,"+
                "[created] [datetime] NULL"+
            ") ON [PRIMARY]";
            
            
            new mssql.Request()
            .query(sql,function(err)
            {


                var insert = function(i,done)
                {
                    var sql3 = "INSERT INTO "+table_name[0]+"([_key],[field],[value],[editable]) VALUES (@key,@field,@value,@editable)"
                    new mssql.Request()
                      .input('key',mssql.VarChar(255),i.key)
                      .input('field',mssql.VarChar(255),i.field)
                      .input('value',mssql.VarChar(255),i.value)
                      .input('editable',mssql.TinyInt,i.editable===false ? 0 : 1)
                      .query(sql3,function(err)
                      {
                          console.log(err)
                          done();
                      })
                }
                
                async.each(aggregator.get(user),insert,function()
                {
                    var sql2 = "INSERT INTO input_table VALUES(@user,@table_sufix,@group_plan_id,0)"

                    new mssql.Request()
                      .input('user',mssql.VarChar(255),user)
                      .input('table_sufix',mssql.VarChar(255),table_name[1])
                      .input('group_plan_id',mssql.BigInt,group_plan_id)
                      .query(sql2,function(err)
                      {
                          console.log(err)
                          d(true);
                      })
                  
                });




            })
        };
        
        db.add_field = function(f,done)
        {
            update = function(k,callback_when_done)
            {
                var sql = "INSERT INTO "+table_name+" ("+field+","+table_key+","+editable+") VALUES ('"+f+"','"+k+"',1)";
                console.log(sql)
                new mssql.Request()
                .query(sql,function(err)
                {
                    callback_when_done();
                })
            }

            keys = []
            new mssql.Request()
                .query("SELECT _key FROM "+table_name+" GROUP BY _key",function(err,recordsets)
                {
                    recordsets.recordsets[0].forEach(function(d)
                    {
                        for(var k in d)
                        {
                            keys.push(d[k])
                        }
                    })
                    async.each(keys,update,done)
                })

        }

        db.user_has_plan = function(user,callback)
        {
            var sql = "SELECT COUNT(*) AS c FROM input_table WHERE [user] = @user";
            new mssql.Request()
              .input('user',mssql.VarChar(255),user)
              .input('table',mssql.VarChar(255),user)
              .query(sql,function(err,recordsets)
              {
                  callback(recordsets.recordset[0]['c']!==0)
              })            
        }
        
        db.close = function()
        {
            mssql.close()
        }
    
        callback(db)
  })
}
