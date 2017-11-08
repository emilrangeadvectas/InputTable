var async = require('async')

exports.get = function(){
    
    var o = {}
    o.name = "JAN/MAY"
 
    o.run = function(ins,c)
    {
        console.log("run")
        var l = [];

        for(var i=81; i<529; i++)
        {
            l.push( ["JAN",i,i*2] ) 
            l.push( ["MAY",i,i*4] ) 
        }
        async.each( l , function(a,b)
        {
            ins.insert( a[0], a[1], a[2],b )
        },c  )
    }
 
    return o;
}