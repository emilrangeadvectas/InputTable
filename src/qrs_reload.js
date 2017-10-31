var https = require('https');
var fs = require('fs');

exports.cert = function(key,cert)
{
    var o = {}
    o.reload = function()
    {
        return new Promise(function(res,rej)
        {
            var host = 'localhost'

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
                port: 4242,
                method: 'post',
                path: '/qrs/app/2c4decc5-acdc-40eb-8cdd-d948acf1b7e6/reload?Xrfkey='+xrfkey,
                headers: {'x-Qlik-Xrfkey': xrfkey, 'X-Qlik-User': 'UserDirectory=INTERNAL; UserId=sa_repository'}
            };

            callback_ = function(response)
            {
                res(response.statusCode==204)
            }
            https.request(options,callback_).end();
        })        
    }
    return o;
}
