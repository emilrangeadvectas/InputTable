var http = require('http');



function get_options(path,method,body,connect_sid,is_json)
{
    var options = {
        host: 'localhost',
        port: 8066,
        path: path,
        method: method,
        headers:{
        'Content-Type': is_json ? 'application/json' : 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)}
    };
    
    if(connect_sid)
    {
        options.headers['Cookie'] = "connect.sid="+connect_sid
    }

    return options;
}


function m(a)
{
    //console.log(a.headers)
    var o = {"status":a.statusCode}
    if(a.headers['location'])
    {
        o['location'] = a.headers['location']
    }
    return o
}

function test_(path,o,method,body,connect_sid,is_json)
{
    is_json = is_json===true ? true : false
    
    return new Promise(function(res,rej)
    {

        var request = http.request(get_options(path,method,body,connect_sid,is_json),
        function(a)
        {
            console.log("-----------")
            console.log(path)
            console.log(m(a))
            if(  JSON.stringify(m(a))  ==  JSON.stringify(o)) res(a)
            else rej()
        });
        request.end(body)
    })
}

/*
http.request(get_options('/'),callback_).end();

http.request(get_options('/login'),callback_).end();

http.request(get_options('/login'),callback_).end();

http.request(get_options('/plans'),callback_).end();

http.request(get_options('/plans/678696'),callback_).end();

http.request(get_options('/admin'),callback_).end();
*/




Promise.all( [

    // NOT LOGGED IN
    test_('/',{"status":302,"location":"/auth"},'GET',''),
    test_('/login',{"status":200},'GET',''),
    test_('/login',{"status":302,"location":"/plans"},'POST','login_name=emil'),
    test_('/login',{"status":302,"location":"/plans"},'POST','login_name=karl'),
    test_('/login',{"status":302,"location":"/"},'POST','login_name=does_not_exists'),
    test_('/plans',{"status":302,"location":"/"},'GET',''),
    test_('/plans/1',{"status":302,"location":"/"},'GET',''),
    test_('/plans/this_do_not_exist',{"status":302,"location":"/"},'GET',''),
    test_('/this_do_not_exist',{"status":404},'GET',''),


]).then(function(x)
{
    var connect_sid_admin = x[2].headers['set-cookie'][0].split(";")[0].split("=")[1]
    var connect_sid_none_admin = x[3].headers['set-cookie'][0].split(";")[0].split("=")[1]
    
    // ADMIN
    test_('/',{"status":302,"location":"/plans"},'GET','',connect_sid_admin);
    test_('/plans',{"status":200},'GET','',connect_sid_admin);
    test_('/plans/1',{"status":200},'GET','',connect_sid_admin);
    test_('/plans/10000000000000',{"status":500},'GET','',connect_sid_admin);
    test_('/plans/this_do_not_exist',{"status":500},'GET','',connect_sid_admin);
    test_('/admin',{"status":200},'GET','',connect_sid_admin);

    // NONE-ADMIN
    test_('/',{"status":302,"location":"/plans"},'GET','',connect_sid_none_admin);
    test_('/plans',{"status":200},'GET','',connect_sid_none_admin);
    test_('/plans/1',{"status":200},'GET','',connect_sid_none_admin);
    test_('/plans/10000000000000',{"status":500},'GET','',connect_sid_none_admin);
    test_('/plans/this_do_not_exist',{"status":500},'GET','',connect_sid_none_admin);
    test_('/admin',{"status":403},'GET','',connect_sid_none_admin);
    
    // PUT VALUE
    test_('/plans/1',{"status":400},'PUT',JSON.stringify({"plan_id":1,"value":2}),connect_sid_admin,true);
    test_('/plans/1',{"status":200},'PUT',JSON.stringify({"plan_id":1,"value":2,"month":"JAN","key":12}),connect_sid_admin,true);
    
    
    
    
})