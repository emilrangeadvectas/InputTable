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

exports.get = function(config,callback)
{
    mssql.connect(config, function (err)
    {
        var db = {}

        db.get_plan_state = function(user,plan_id,callback)
        {
            var sql = "SELECT status, name FROM input_table_plans JOIN input_table_group_plans ON input_table_group_plans.id = input_table.group_plan_id WHERE input_table.[id] = @plan_id ";
            new mssql.Request()
              .input('plan_id',mssql.BigInt,plan_id)
              .query(sql,function(err,r)
              {

                  callback(r.recordset[0]['status'], r.recordset[0]['name']);              
              })            
        }
        
        db.set_plan_state = function(state,plan_id,callback)
        {
            var sql = "UPDATE input_table_plans SET status = @state WHERE id = @plan_id";
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
                        .query("SELECT * FROM input_table_plans WHERE group_plan_id = @group_plan_id",function(err,r)
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
        
        db.is_admin = function(user_id)
        {
            console.log("=====")
            console.log(user_id)
            return new Promise(function(res,rej)
			{
                var sql = "SELECT is_admin FROM input_table_users WHERE id = @user_id"; ;
                new mssql.Request()
                    .input('user_id',mssql.BigInt,user_id)
                    .query(sql,function(err,r)
                    {
                        res(r.recordset[0]['is_admin']===1)
                    })            
            });
        }
        
        db.create_plan = function(division_id,group_plan_id,callback)
        {
            var sql = "INSERT INTO input_table_plans ([_division_id],[_group_plan_id],[status]) VALUES (@division_id,@group_plan_id,0)";
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
                          "SELECT * FROM  (SELECT itd.name AS d ,CONCAT(status,''|'',  (SELECT it.id FROM input_table_plans AS it WHERE itd.id = it._division_id AND itgp.id = it._group_plan_id )   ) as status, itgp.name AS group_plan FROM input_table_group_plans AS itgp "+
                          "JOIN input_table_division AS itd ON 1=1 "+
                          "LEFT JOIN input_table_plans AS it ON it._division_id = itd.id AND it._group_plan_id = itgp.ID) AS r "+
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

        
        db.get_user_by_name = function(user_name)
        {
            return new Promise(function(res,rej)
            {
                var sql = "SELECT [id] FROM input_table_users WHERE name = @name"

                new mssql.Request()
                    .input('name',mssql.VarChar(255),user_name)
                    .query(sql,function(err,r)
                    {
                        if(err) rej(err)
                        else if(!r.recordset || r.recordset.length==0) res(false)  
                        else res(r.recordset[0].id)
                    });
                
            })            
        }

        db.get_plan = function(plan_id)
        {

            return new Promise(function(res,rej)
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
                          
                          "SELECT it.status, itgp.name AS group_plan_name, itd.name AS division_name FROM input_table_plans AS it JOIN input_table_group_plans AS itgp ON itgp.ID = it._group_plan_id JOIN input_table_division AS itd ON itd.id = it._division_id WHERE it.id = @plan_id";
                          
                new mssql.Request()
                    .input('plan_id',mssql.BigInt,plan_id)
                    .query(sql,function(err,r)
                    {
                        if(err) rej(err)
                        else if(r.recordsets[1].length==0) rej(new Error("could not find plan"))
                        else res( {"body":r.recordset, "header":Object.keys(r.recordset[0]),"status":r.recordsets[1][0]['status'],"group_plan_name":r.recordsets[1][0]['group_plan_name'],"division_name":r.recordsets[1][0]['division_name'] })
                    })          

            })
                            
        }


        db.update_plan_cell = function(plan_id,month,id,value)
        {
            return new Promise(function(res,rej)
            {
                var sql = "INSERT INTO input_table_input ([value], [month], [_accounts_id], [_plan_id]) VALUES (@value,@month,@id,@plan_id);"
                new mssql.Request()
                    .input('plan_id',mssql.BigInt,plan_id)
                    .input('id',mssql.BigInt,id)
                    .input('month',mssql.VarChar(3),month)
                    .input('value',mssql.Decimal(18,4),value)
                    .query(sql,function(err,r)
                    {      
                        if(err) rej()
                        else res();
                    })                    
                
            })

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
						  "LEFT JOIN input_table_plans AS it ON it._division_id = itd.id AND it._group_plan_id = itg.ID "+
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
                var sql = "SELECT ita.name AS account_name, ita.number AS account_number, it.value AS value, itgp.name AS group_plan, itd.name AS division, [month] AS month, itap.name AS parent_account, itapp.name AS grand_parent_account "+
                          "FROM "+
                          "( "+
                          "SELECT MAX(id) AS id FROM input_table_input GROUP BY _plan_id, _accounts_id, [month] "+
                          ") AS it_max_id "+
                          "JOIN input_table_input AS it ON it.id = it_max_id.id "+
                          "JOIN input_table_accounts AS ita ON ita.id = it._accounts_id "+
                          "JOIN input_table_plans AS it_ ON it_.id = it._plan_id "+
                          "JOIN input_table_group_plans AS itgp ON itgp.ID = it_._group_plan_id "+
                          "JOIN input_table_division AS itd ON itd.id = it_._division_id "+
                          "JOIN input_table_accounts AS itap ON itap.id = ita.parent_id "+ 
                          "JOIN input_table_accounts AS itapp ON itapp.id = itap.parent_id ";   

                new mssql.Request()
                    .query(sql,function(err,r)
                    {
                        if(err) rej(err);
                        else res( {"body":r.recordset, "header":['account_name','account_number','value','group_plan','division','month','parent_account','grand_parent_account']} )
                    }) 
            })
        }

        db.get_rapport_user = function()
        {
            return new Promise( function(res,rej)
            {
                var sql = "SELECT qlik_user FROM input_table_users WHERE [qlik_user] IS NOT NULL"   

                new mssql.Request()
                    .query(sql,function(err,r)
                    {
                        if(err) rej(err);
                        else res( {"body":r.recordset, "header":['qlik_user']} )
                    }) 
            })
        }

        db.get_user_state_for_plan = function(user_id,plan_id)
        {
            return new Promise( function(res,rej)
            {
                var sql = "SELECT is_admin, status FROM input_table_divsion_user AS itdv "+
                      "JOIN input_table_plans AS itp ON itp.id =  itdv.divions_id "+
                      "JOIN input_table_users AS itu ON itu.id =  itp.id "+
                      "WHERE itp.id = @plan AND itdv.user_id = @user ";
                new mssql.Request()
					.input('user',mssql.BigInt,user_id) 
					.input('plan',mssql.BigInt,plan_id)
                    .query(sql,function(err,r)
                    {
                        if(err) rej(err);
                        else res( r.recordsets )
                    }) 
            })
        }
        
        callback(db,mssql)
	})
    

}
