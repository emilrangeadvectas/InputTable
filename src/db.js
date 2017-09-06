var mssql = require('mssql')
var async = require('async');

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


var sql2 = "SELECT "+field+" FROM "+table_name+" GROUP BY "+field

var innersql = "SELECT "+table_key+", "+field+", "+value+" FROM "+table_name;
innersql = "SELECT _key, field, (SELECT TOP(1) value FROM "+table_name+" WHERE _key = d1._key AND field = d1.field ORDER BY created DESC) AS value FROM "+table_name+" AS d1 GROUP BY _key, field"


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


function build_matrix(callback,mssql,error)
{
  if(error===undefined) error = {}
  new mssql.Request().query(sql2, function(err, recordsets, returnValue)
  {
    fields = []
    console.log(recordsets.recordsets[0])
    for(u in recordsets.recordsets[0])
    {
      console.log(u)
      fields.push( recordsets.recordsets[0][u][field] );
    }
    var pivot_styled_field_list = "["+fields.join("],[")+"]"

      var sql = "SELECT * FROM ("+innersql+") as g "+
      "PIVOT ( max("+value+") for field in ("+pivot_styled_field_list+") ) AS d;";

      var sql3 = "SELECT * FROM (SELECT "+table_key+", "+field+", "+editable+" FROM "+table_name+") as g "+
      "PIVOT ( max("+editable+") for field in ("+pivot_styled_field_list+") ) AS d;";

      console.log(sql)
      
      new mssql.Request().query(sql, function(err, recordsets, returnValue)
      {
        console.log(err)
        new mssql.Request().query(sql3, function(err, recordsets3, returnValue3)
        {
          data = []
          recordsets.recordsets[0].forEach(function(x)
          {
            var the_key = x[table_key]
            row = [{value:the_key}]
            for (var _key in x)
            {
              if(_key===table_key) continue;
              var cell = {value:do_output(x[_key]),form:get_if_form(_key, the_key,recordsets3.recordsets[0])};
              if( error[_key+";"+the_key]!==undefined )
              {
                cell.error = true
                cell.value = error[_key+";"+the_key]
              }

              row.push(cell)
            }
            data.push(row)
          })
          var matrix = {}
          matrix.headers = [''].concat(fields)
          matrix.body = data
          callback(matrix);
        });
      });
    });

}

function update_data(mssql,callback_when_all_update_done,data)
{
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

}

exports.get = function(config,callback)
{
    mssql.connect(config, function (err)
    {
        var db = {}

        db.get_matrix = function(callback)
        {
            build_matrix(callback,mssql);
        }

        db.update_and_get_matrix = function(callback,data)
        {
            update_data(mssql,function(error)
            {
                build_matrix(callback,mssql,error);
            },data)
        }

        db.add_key = function(key,on_field,done)
        {
            var sql = "INSERT INTO "+table_name+" ("+field+","+table_key+","+editable+") VALUES ('"+on_field+"','"+key+"',1)";
            console.log(sql)
            new mssql.Request()
              .query(sql,function(err)
              {
                done();
              })
        }

        db.get_raw_newest_data = function(callback)
        {
            sql = "SELECT _key, field, (SELECT TOP(1) value FROM data2 WHERE _key = d1._key AND field = d1.field ORDER BY created DESC) AS value FROM data2 AS d1 GROUP BY _key, field";
            new mssql.Request()
              .query(sql,function(err,recordsets)
              {
                body = []
                recordsets.recordsets[0].forEach(function(x)
                {
                    body.push([x[table_key],x[field],x[value]])
                    console.log(x)
                })
                callback({"headers":[table_key,field,value],"body":body});
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
    
        db.close = function()
        {
          mssql.close()
        }
    
        callback(db)
  })
}
