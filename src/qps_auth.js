
var https = require('https');
var fs = require('fs');


exports.auth = function(session_id,db)
{
    return new Promise(function(res,rej)
    {
        console.log("try to auth with x-qlik-session: "+session_id)
        var path_to_certs = ''
        var host = ''
        var key = fs.readFileSync(path_to_certs+"client_key.pem")
        var cert = fs.readFileSync(path_to_certs+"client.pem")


        var random_xrfkey = function()
        {
            var r = "";
            var p = "0123456789abcdef";
            for (var i = 0; i < 16; i++) r += p.charAt(Math.floor(Math.random() * p.length));
            return r;
        }

        var xrfkey = random_xrfkey()

        var options = {
            key:   key,
            cert:  cert,
            rejectUnauthorized: false,
            host: host,
            port: 4243,
            path: '/qps/session/'+session_id+'?Xrfkey='+xrfkey,
            headers: {'x-Qlik-Xrfkey': xrfkey}
        };

        callback_ = function(response)
        {
            if(response.statusCode==200)
            {
                var b = "";
                response.on('data',function(c){ b +=c })
                response.on('end',function()
                {
                    var r = JSON.parse(b)
                    console.log("qps tells us that session belongs to "+r.UserId+", "+r.UserDirectory)
                    db.get_user_id_by_qlik_user(r.UserId,r.UserDirectory).then(function(o)
                    {
                        if(o===false)
                        {
                            console.log("No input table user associated with that qlik user")
                            res(false)
                        }
                        else
                        {
                            console.log("User id "+o+" associated")
                            res(o)
                        }
                    })
                })                
            }
            else
            {
                res(false)
            }
        }
        https.request(options,callback_).end();
    })

}