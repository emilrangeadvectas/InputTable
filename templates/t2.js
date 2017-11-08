var async = require('async')

exports.get = function(){
    
    var o = {}
    o.name = "EMPTY"
 
    o.run = function(ins,c)
    {
        c();
    }
 
    return o;
}