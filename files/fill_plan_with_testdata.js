var fs = require('fs');
var config = JSON.parse(fs.readFileSync('../config/config.json', 'utf8'));
var async = require('async');

require('../src/db.js').get(config, function(db,mssql)
{
    console.log(1)

        var l = []
        months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
        
        months.forEach(function(x,t)
        {
            
            for(var i=81; i<=528; i++)
            {
                var o = Object()
                o.month = x;
                o.id = i;
                o.value = Math.random()*10000;
                o.plan_id = 30004;
                l.push(o)
            }
        })
    
    var f = function(d,c)
    {
        console.log("1")
        
        var plan_id = d['plan_id']
        var id = d['id']
        var month = d['month']
        var value = d['value']
        
        
        var sql = "INSERT INTO input_table_input ([value], [month], [_accounts_id], [_plan_id]) VALUES (@value,@month,@id,@plan_id);"
        new mssql.Request()
            .input('plan_id',mssql.BigInt,plan_id)
            .input('id',mssql.BigInt,id)
            .input('month',mssql.VarChar(3),month)
            .input('value',mssql.Decimal(18,4),value)
            .query(sql,function(err,r)
            {      
                console.log(err)
                c();
            })       
    }
    console.log(2)
  
  
    async.each(l,f)

    console.log(3)
    
})