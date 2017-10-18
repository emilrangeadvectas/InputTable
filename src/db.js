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



SELECT ita.name,it.value,_plan_id,it_._group_plan_id,it_._division_id,itgp.name, itd.name,[month] FROM
(
	SELECT MAX(id) AS id FROM input_table_input GROUP BY _plan_id, _accounts_id, [month]

) AS it_max_id
JOIN input_table_input AS it ON it.id = it_max_id.id
JOIN input_table_accounts AS ita ON ita.id = it._accounts_id
JOIN input_table AS it_ ON it_.id = it._plan_id
JOIN input_table_group_plans AS itgp ON itgp.ID = it_._group_plan_id
JOIN input_table_division AS itd ON itd.id = it_._division_id
*/

// escape värden i query. (iaf dom som är input relaterade)
// en connection per request, eller en global, se till att connection stängs om fel. stäng connection om servern stängs
// få tabelen dynamsik. kunna definera kolumnnamn. ordningen spelar ingen roll?
// spelar ordning på datan roll
// får det exitera dubletter? hur hanteras det (nu är det max värdet som räknas)
// Vad händer om en post inte existerar

// fel. skapa plan. gå in ändra värde. skapa ny plan. krashar

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
  var v = x.split(' ').join('');
  return v;
}

function do_output(x)
{
    if(x===null) return '';
	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}





function get_if_form(x,y,rs)
{
  return false;
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

function get_user_plan(mssql,user,plan_id,callback)
{
    //var sql = "SELECT [table], status FROM input_table WHERE [user] = @user";
    var sql = "SELECT [table], status, name FROM input_table JOIN input_table_group_plans ON input_table.group_plan_id = input_table_group_plans.id  WHERE input_table.[id] = @plan_id"
    new mssql.Request()
	  .input('plan_id',mssql.VarChar(255),plan_id)
      .query(sql,function(err,recordsets)
      {
        var t = recordsets.recordsets[0][0].table;
        var s = recordsets.recordsets[0][0].status;
        var n = recordsets.recordsets[0][0].name;
        callback(t,s,n);
      })    
}

function get_user_plans(mssql,user,callback)
{
    //var sql = "SELECT [table], status FROM input_table WHERE [user] = @user";
    var sql = "SELECT [table], status, name FROM input_table JOIN input_table_group_plans ON input_table.group_plan_id = input_table_group_plans.id  WHERE [user] = @user"
    new mssql.Request()
	  .input('user',mssql.VarChar(255),user)
      .query(sql,function(err,recordsets)
      {
        var t = recordsets.recordsets[0][0].table;
        var s = recordsets.recordsets[0][0].status;
        var n = recordsets.recordsets[0][0].name;
        
        var b = {}
        b.table = t;
        b.status = s;
        b.name = n;
        
        callback([ b ]);
      })    
}

function build_matrix(callback,mssql,error,user,_plan_id)
{
    get_user_plan(mssql,user,_plan_id,function(plan_id,status)
    {
      var table_name = "input_table_"+plan_id;

      var get_fields_sql = "SELECT "+field+" FROM "+table_name+" GROUP BY "+field

      var innersql = "SELECT _key, field, (SELECT TOP(1) value FROM "+table_name+" WHERE _key = d1._key AND field = d1.field ORDER BY created DESC) AS value FROM "+table_name+" AS d1 GROUP BY _key, field";

      
      if(error===undefined) error = {}
      new mssql.Request().query(get_fields_sql, function(err, recordsets, returnValue)
      {
        fields = []

        for(u in recordsets.recordsets[0])
        {
          fields.push( recordsets.recordsets[0][u][field] );
        }
        var pivot_styled_field_list = "["+fields.join("],[")+"]"

          var sql = "SELECT * FROM ("+innersql+") as g "+
          "PIVOT ( max("+value+") for field in ("+pivot_styled_field_list+") ) AS d";

          var sql3 = "SELECT * FROM (SELECT "+table_key+", "+field+", "+editable+" FROM "+table_name+") as g "+
          "PIVOT ( max("+editable+") for field in ("+pivot_styled_field_list+") ) AS d";

          var data = []
          new mssql.Request().query(sql, function(err, recordsets, returnValue)
          {
            new mssql.Request().query(sql3, function(err, recordsets3, returnValue3)
            {
              recordsets.recordsets[0].forEach(function(x)
              {
                var the_key = x[table_key]
                row = [{value:the_key}]
                rrr = ['_key','01','02','03','04','05','06','07','08','09','10','11','12'];
                rrr.forEach(function(_key)
                {
                  if(_key===table_key) return;
//                  var cell = {value:do_output(x[_key]),form:get_if_form(_key, the_key,recordsets3.recordsets[0])};
                  var cell = {value:do_output(x[_key]),form: status==0 ? _key+";"+the_key : false  };
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
                    row.forEach(function(x)
                    {
                        if(x['form']===undefined) return;
                        if(x['form']===false) return;


                        
                        if(x['form'].substring(0,2)==a){

                        real_row[x['form']] = x;
                        }
                    })
                })
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

function update_data(mssql,callback_when_all_update_done,data,user,group_plan_id)
{
    if(!user) throw "invalid user"

    get_user_plan(mssql,user,group_plan_id,function(plan_id)
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

        db.get_matrix = function(callback,user,group_plan_id)
        {
            build_matrix(callback,mssql,undefined,user,group_plan_id); 
        }

        db.update_and_get_matrix = function(callback,data,user,group_plan_id)
        {
            update_data(mssql,function(error)
            {
                build_matrix(callback,mssql,error,user,group_plan_id);
            },data,user,group_plan_id)
        }

        db.get_raw_newest_data3 = function(c)
        {
            var sql = "SELECT [user],[name],[table] FROM input_table AS it "+
            "JOIN input_table_group_plans AS gp ON it.group_plan_id = gp.ID";

            new mssql.Request()
              .query(sql,function(err,r)
              {
                d = r.recordset;
                
                var g = function(x,c)
                {
                    var table_name = "input_table_"+x.table;

                                            body = []

                    sql = "SELECT _key, field, (SELECT TOP(1) value FROM "+table_name+" WHERE _key = d1._key AND field = d1.field ORDER BY created DESC) AS value FROM "+table_name+" AS d1 GROUP BY _key, field";
                    new mssql.Request()
                      .query(sql,function(err,recordsets)
                      {
                        recordsets.recordsets[0].forEach(function(i)
                        {
                            if(i['value']!==null)
                                body.push([x['user'],x['name'],i['_key'],i['field'],i['value']])
                        })
                        c();
                      }) 

                      
                }

                async.each(d,g,function(){c(body)});
                

              })
            

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

                                  get_total(i.ID,uu2,function(t)
                                  {
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

        db.get_plan_state = function(user,plan_id,callback)
        {
            var sql = "SELECT status, name FROM input_table JOIN input_table_group_plans ON input_table_group_plans.id = input_table.group_plan_id WHERE input_table.[id] = @plan_id ";
            new mssql.Request()
              .input('plan_id',mssql.BigInt,plan_id)
              .query(sql,function(err,r)
              {

                  callback(r.recordset[0]['status'], r.recordset[0]['name']);              
              })            
        }
        
        db.set_plan_state = function(state,plan_id,callback)
        {
            console.log(state+","+plan_id)
            var sql = "UPDATE input_table SET status = @state WHERE id = @plan_id";
            new mssql.Request()
              .input('state',mssql.BigInt,state)
              .input('plan_id',mssql.BigInt,plan_id)
              .query(sql,function(err,r)
              {
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
            get_user_plan(mssql,user,function(plan_id,status,group_plan_name)
            {
                var table_name = "input_table_"+plan_id;

                sql = "SELECT _key, field, (SELECT TOP(1) value FROM "+table_name+" WHERE _key = d1._key AND field = d1.field ORDER BY created DESC) AS value FROM "+table_name+" AS d1 GROUP BY _key, field";
                new mssql.Request()
                  .query(sql,function(err,recordsets)
                  {
                    body = []
                    recordsets.recordsets[0].forEach(function(x)
                    {
                        body.push([user,x[table_key],x[field],x[value],group_plan_name])
                    })
                    callback(body);
                  })                
            })
        }

        db.get_plans_of_users = function(user,callback)
        {
            sql = "SELECT CASE WHEN [status] is null THEN 0 ELSE 1 END as have_plan, [name],[status],[user],ID AS group_plan_id "+
                  "FROM input_table_group_plans AS gp "+
                  "LEFT JOIN input_table AS it ON it.group_plan_id=gp.ID AND [user] = @user ";
                  
                 new mssql.Request()
                  .input('user',mssql.VarChar(255),user)
                  .query(sql,function(err,recordsets)
                  {
                    callback(recordsets.recordset)
                  })
        }
        
        db.get_raw_newest_data2 = function(callback,user)
        {
            get_user_plans(mssql,user,function(d)
            {
                body = []
                var x = function(o,callback)
                {
                    plan_id = o.table;
                    status = o.status;
                    group_plan_name = o.name;
                    var table_name = "input_table_"+plan_id;

                    sql = "SELECT _key, field, (SELECT TOP(1) value FROM "+table_name+" WHERE _key = d1._key AND field = d1.field ORDER BY created DESC) AS value FROM "+table_name+" AS d1 GROUP BY _key, field";
                    new mssql.Request()
                      .query(sql,function(err,recordsets)
                      {
                        recordsets.recordsets[0].forEach(function(x)
                        {
                            body.push([user,x[table_key],x[field],x[value],group_plan_name])
                        })
                        callback();
                      })                
                    
                }
                
                async.each(d,x,function(){callback(body)})
                
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
        
        db.is_admin2 = function(user_id)
        {
            return new Promise(function(res,rej)
			{
                sql = "SELECT is_admin FROM input_table_users WHERE id = @user_id"; ;
                new mssql.Request()
                    .input('user_id',mssql.BigInt,user_id)
                    .query(sql,function(err,r)
                    {
                        console.log(user_id)
                        res(r.recordset[0]['is_admin']===1)
                    })            
            });
        }
        
        db.create_plan = function(division_id,group_plan_id,callback)
        {
            var sql = "INSERT INTO input_table ([_division_id],[_group_plan_id],[status]) VALUES (@division_id,@group_plan_id,0)";
            new mssql.Request()
                .input('division_id',mssql.BigInt,division_id)
                .input('group_plan_id',mssql.BigInt,group_plan_id)
                .query(sql,function(err,recordsets)
                {
                    console.log(err)
                    callback();
                })            
        };

        db.valid_admin = function(callback)
        {
            new mssql.Request()
                .query("SELECT COUNT(*) AS c FROM input_table",function(err,recordsets)
                {
                    callback(recordsets.recordset[0].c>0);
                    
                });
        }
        
        db.get_pivot_user_group_plan = function()
        {
			return new Promise(function(res,rej)
			{
                var sql = "DECLARE @PivotColumnHeaders VARCHAR(MAX) "+
                          "SELECT @PivotColumnHeaders = "+
                          "COALESCE( "+
                          "@PivotColumnHeaders + ',[' + [name] + ']', "+
                          "'[' + [name] + ']' "+
                          ") "+
                          "FROM ( SELECT * FROM input_table_division) as d; "+

                          "DECLARE @PivotTableSQL NVARCHAR(MAX) "+
                          "SET @PivotTableSQL = N' "+
                          "SELECT * FROM  (SELECT itd.name AS d ,CONCAT(status,''|'',  (SELECT it.id FROM input_table AS it WHERE itd.id = it._division_id AND itgp.id = it._group_plan_id )   ) as status, itgp.name AS group_plan FROM input_table_group_plans AS itgp "+
                          "JOIN input_table_division AS itd ON 1=1 "+
                          "LEFT JOIN input_table AS it ON it._division_id = itd.id AND it._group_plan_id = itgp.ID) AS r "+
                          "PIVOT (   max([status]) for [d] IN ( "+
                          "' + @PivotColumnHeaders + ' "+
                          ") ) as t; "+
                          "'; "+
                          "EXECUTE(@PivotTableSQL); ";

            new mssql.Request()
                .query(sql,function(err,recordsets)
                {
                    if(err) rej();
                    else res(recordsets);
                })
			})                       
        }
        
        db.add_field = function(f,done)
        {
            update = function(k,callback_when_done)
            {
                var sql = "INSERT INTO "+table_name+" ("+field+","+table_key+","+editable+") VALUES ('"+f+"','"+k+"',1)";
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
            var sql = "SELECT group_plan_id FROM input_table WHERE [user] = @user";
            new mssql.Request()
              .input('user',mssql.VarChar(255),user)
              .input('table',mssql.VarChar(255),user)
              .query(sql,function(err,recordsets)
              {
                  callback(recordsets.recordset.length>0, recordsets.recordset.length>0 ? recordsets.recordset[0]['group_plan_id'] : null )
              })            
        }
        
        db.close = function()
        {
            mssql.close()
        }

        // -----
        db.get_division_user_state = function(callback)
        {
            return new Promise(function(res,rej)
            {
                var sql = "DECLARE @PivotColumnHeaders VARCHAR(MAX) "+
                          "SELECT @PivotColumnHeaders = "+
                          "COALESCE( "+
                          "    @PivotColumnHeaders + ',[' + [name] + ']', "+
                          "    '[' + [name] + ']' "+
                          "   ) "+
                          " FROM input_table_division; "+
                          " DECLARE @PivotTableSQL NVARCHAR(MAX) "+

                          "SET @PivotTableSQL = N' "+
                          "SELECT * FROM  (  SELECT input_table_users.[name], [rights],input_table_division.[name] AS d_name FROM input_table_divsion_user JOIN input_table_users ON input_table_divsion_user.user_id = input_table_users.id JOIN input_table_division ON input_table_divsion_user.divions_id = input_table_division.id) AS r "+
                          "PIVOT (   max([rights]) for [d_name] IN ("+
                          "' + @PivotColumnHeaders + '"+
                          "   ) ) as t; "+
                          "  '"+
                          "  EXECUTE(@PivotTableSQL) ";

                new mssql.Request()
                    .query(sql,function(err,r)
                    {                    
                        console.log(err)
                        res( {"body":r.recordset, "header":Object.keys(r.recordset[0]) })
                    })      
                
            });
        }
        // -----

        
        db.get_user = function(user_name,c)
        {
            var sql = "SELECT [id] FROM input_table_users WHERE name = @name"

            new mssql.Request()
                .input('name',mssql.VarChar(255),user_name)
                .query(sql,function(err,r)
                {
                    console.log(err)
                    c(r.recordset)
                });
            
        }

        db.get_new_plan = function(plan_id,callback)
        {


            var sql = "DROP TABLE IF EXISTS #temp; "+
                      "DROP TABLE IF EXISTS #temp2; "+

                      "WITH X ([root_id],[id],[type],[root_type],[parent_id]) "+
                      "AS "+
                      "( "+
                      "SELECT [id] as root_id, [id],[type],a.type AS [root_type],[parent_id] "+
                      "FROM input_table_accounts AS a "+
                      "WHERE a.type = 0 OR a.type = 2 "+

                      "UNION ALL "+
                      "SELECT [root_id],a.[id],a.[type],[root_type],a.[parent_id] "+
                      "FROM input_table_accounts AS a "+
                      "INNER JOIN X AS d ON ([root_type]=2 and d.[parent_id] = a.[id] and a.[type]=2 ) "+
                      "OR ( [root_type]=1 and (( d.[parent_id] = a.[parent_id] AND a.id != d.id AND d.type = 1 ) OR d.[id] = a.[parent_id])) "+
                      "OR ( [root_type]=0 and d.[id] = a.[parent_id] ) "+
                      ") SELECT root_id, id INTO dbo.#temp FROM X WHERE NOT (root_id = id and type = 1 and root_type = 1) GROUP BY root_id, id; "+

                      "SELECT * INTO dbo.#temp2 FROM  ( SELECT root_id AS id, SUM([value]) AS value, [month] FROM #temp AS x JOIN (SELECT input_table_input.* FROM input_table_input JOIN ( SELECT MAX(id) AS id FROM input_table_input WHERE _plan_id = @plan_id GROUP BY _accounts_id, [month] ) AS k ON k.id = input_table_input.id) AS iti ON iti._accounts_id = x.id GROUP BY root_id, [month] ) AS r "+
                      "PIVOT (   max([value]) for [month] IN ([JAN],[FEB],[MAR],[APR],[MAY],[JUN],[JUL],[AUG],[SEP],[OCT],[NOV],[DEC]) ) as t; "+

                      "WITH LevelCalculater ([parent_id],[id],[v], Level) "+
                      "AS "+
                      "( "+
                      "SELECT a.[parent_id], a.[id],CAST('1000000' AS varchar(7)) AS v, "+
                      "0 AS Level "+
                      "FROM input_table_accounts AS a "+
                      "WHERE parent_id IS NULL "+
                      "UNION ALL "+
                      "SELECT a.[parent_id], a.[id], CAST(  concat( SUBSTRING(v,1,Level+1), [order],'00000')  AS varchar(7)) as v, "+
                      "Level + LEN([order]) "+
                      "FROM input_table_accounts AS a "+
                      "INNER JOIN LevelCalculater AS d ON d.id = a.parent_id "+
                      ") "+
                      "SELECT v,a.id,a.name,d.level,a.type,a.parent_id,[JAN],[FEB],[MAR],[APR],[MAY],[JUN],[JUL],[AUG],[SEP],[OCT],[NOV],[DEC] "+
                      "FROM LevelCalculater AS d "+
                      "JOIN input_table_accounts AS a ON d.id = a.id "+
                      "LEFT JOIN #temp2 ON #temp2.id = d.id "+
                      "ORDER BY v; "+
                      
                      "SELECT it.status, itgp.name AS group_plan_name, itd.name AS division_name FROM input_table AS it JOIN input_table_group_plans AS itgp ON itgp.ID = it._group_plan_id JOIN input_table_division AS itd ON itd.id = it._division_id WHERE it.id = @plan_id";
                      
            new mssql.Request()
                .input('plan_id',mssql.BigInt,plan_id)
                .query(sql,function(err,r)
                {            
                    console.log(err)
                    console.log(r.recordset)
                    callback( {"body":r.recordset, "header":Object.keys(r.recordset[0]),"status":r.recordsets[1][0]['status'],"group_plan_name":r.recordsets[1][0]['group_plan_name'],"division_name":r.recordsets[1][0]['division_name'] })
                })          
                
                
                //TODO: add sum. make som untion with sum table and give them some last order values. Or just add sum as account. I think add sum as account feels less hacky if we need to "make up" a order on it
        }


        db.update_new_plan = function(plan_id,d,callback)
        {
            var l = []
            for(k in d)
            { 
                var value = d[k]
                var id = k.split(';')[0]
                var month = k.split(';')[1]
                l.push( {"id":id,"month":month,"value":value} )                                   
            }
            async.each(
                l,
                function(v,c)
                {
                    var sql = "INSERT INTO input_table_input ([value], [month], [_accounts_id], [_plan_id]) VALUES (@value,@month,@id,@plan_id);"
                    new mssql.Request()
                        .input('plan_id',mssql.BigInt,plan_id)
                        .input('id',mssql.BigInt,v.id)
                        .input('month',mssql.VarChar(3),v.month)
                        .input('value',mssql.Decimal(18,4),v.value)
                        .query(sql,function(err,r)
                        {      
                            c();
                        })                    
                },
                function()
                {
                    callback()
                }
            )    
        }

        db.get_user_id_by_qlik_user = function(qlik_user_id, qlik_user_directory)
        {
            return new Promise(function(res,rej)
            {
                var sql = "SELECT id FROM input_table_users WHERE qlik_user = '"+qlik_user_id+"|"+qlik_user_directory+"'";
				new mssql.Request()
					.query(sql,function(err,r)
					{
                        res(r.recordset[0].id)
                    });
            })
        }
        
        db.get_division_group_plan_for_user = function(user_id)
        {
			return new Promise( function(res,rej)
			{
				var sql = "DECLARE @PivotColumnHeaders VARCHAR(MAX) "+
						  "SELECT @PivotColumnHeaders = "+
						  "COALESCE( "+
						  "    @PivotColumnHeaders + ',[' + [name] + ']', "+
						  "    '[' + [name] + ']' "+
						  "   ) "+
						  " FROM ( SELECT MAX([name]) AS [name] FROM input_table_division JOIN input_table_divsion_user ON input_table_divsion_user.divions_id = input_table_division.id WHERE input_table_divsion_user.[user_id] = @user_id GROUP BY [name]  ) AS d"+
						  " DECLARE @PivotTableSQL NVARCHAR(MAX) "+

						  " DECLARE @user BIGINT; "+
						  " SET @user_id = @user_id; "+
						  
						  "SET @PivotTableSQL = N' "+
						  "SELECT * FROM "+
						  "( "+
						  "SELECT itg.name AS gp_name, itd.name AS d_id, CASE WHEN status IS NULL THEN CONCAT(''c|'',itg.ID,''|'',itd.id) ELSE CONCAT(''x|'',it.id,''|'',it.status) END as f "+
						  "FROM input_table_group_plans AS itg "+
						  "JOIN input_table_divsion_user AS itdu ON [user_id]=' + @user_id + '  "+
						  "JOIN input_table_division AS itd ON itdu.divions_id = itd.id "+
						  "LEFT JOIN input_table AS it ON it._division_id = itd.id AND it._group_plan_id = itg.ID "+
						  ") AS r "+
						  "PIVOT (   max([f]) for [d_id] IN ( "+
						  "' + @PivotColumnHeaders + ' "+
						  ") ) as t; "+
						  "' "+
						  
						  "EXECUTE(@PivotTableSQL) ";

						  
				new mssql.Request()
					.input('user_id',mssql.VarChar(255),user_id) //can we have this as a bigint some how. SET @user_id = @user_id do not seem to allow it (maybe we can cast it)
					.query(sql,function(err,r)
					{
						if(err || r.recordset===undefined || r.recordset.length==0) rej();
						else res( {"body":r.recordset, "header":Object.keys(r.recordset[0]) })
					})          
			});
        }
        
        db.get_rapport = function()
        {
            return new Promise( function(res,rej)
            {
                var sql = "SELECT ita.name AS account_name ,it.value AS value, itgp.name AS group_plan, itd.name AS division, [month] AS month, itap.name AS parent_account, itapp.name AS grand_parent_account "+
                          "FROM "+
                          "( "+
                          "SELECT MAX(id) AS id FROM input_table_input GROUP BY _plan_id, _accounts_id, [month] "+
                          ") AS it_max_id "+
                          "JOIN input_table_input AS it ON it.id = it_max_id.id "+
                          "JOIN input_table_accounts AS ita ON ita.id = it._accounts_id "+
                          "JOIN input_table AS it_ ON it_.id = it._plan_id "+
                          "JOIN input_table_group_plans AS itgp ON itgp.ID = it_._group_plan_id "+
                          "JOIN input_table_division AS itd ON itd.id = it_._division_id "+
                          "JOIN input_table_accounts AS itap ON itap.id = ita.parent_id "+ 
                          "JOIN input_table_accounts AS itapp ON itapp.id = itap.parent_id ";   

                new mssql.Request()
                    .query(sql,function(err,r)
                    {
                        res( {"body":r.recordset, "header":['account_name','value','group_plan','division','month','parent_account','grand_parent_account']} )
                    }) 
            })
        }
    
        callback(db,mssql)
	})
    

}
