var async = require('async')

exports.get = function(){
    
    var o = {}
    o.name = "ZEROES"
 
    o.run = function(ins,c)
    {
        console.log("run")
        var l = [];

        for(var i=81; i<529; i++)
        {
            l.push( ["JAN",i,0] ) 
            l.push( ["FEB",i,0] ) 
            l.push( ["MAR",i,0] ) 
            l.push( ["APR",i,0] ) 
            l.push( ["MAY",i,0] ) 
            l.push( ["JUN",i,0] ) 
            l.push( ["JUL",i,0] ) 
            l.push( ["AUG",i,0] ) 
            l.push( ["SEP",i,0] ) 
            l.push( ["OCT",i,0] ) 
            l.push( ["NOV",i,0] ) 
            l.push( ["DEC",i,0] ) 
        }
        async.each( l , function(a,b)
        {
            ins.insert( a[0], a[1], a[2],b )
        },c  )
    }
 
    return o;
}