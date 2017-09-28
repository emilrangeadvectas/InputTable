function get_all_field_for_key(key)
{
    var r = [
//        {"key":key,"field":"01","value":150,editable:false},
//        {"key":key,"field":"02","value": key==="coconut" ? 134 : 123,editable:false},
//        {"key":key,"field":"03","value":107,editable: key==="cherry" ? false : true},
        {"key":key,"field":"01","value":null},
        {"key":key,"field":"02","value":null},
        {"key":key,"field":"03","value":null},
        {"key":key,"field":"04","value":null},
        {"key":key,"field":"05","value":null},
        {"key":key,"field":"06","value":null},
        {"key":key,"field":"07","value":null},
        {"key":key,"field":"08","value":null},
        {"key":key,"field":"09","value":null},
        {"key":key,"field":"10","value":null},
        {"key":key,"field":"11","value":null},
        {"key":key,"field":"12","value":null}
    ];
    return r
}


exports.get = function(user) //TODO: add plan_group , ex: year
{

    var r = get_all_field_for_key("apple")
    
    r = r.concat(get_all_field_for_key("pear"))
    r = r.concat(get_all_field_for_key("cherry"))
    r = r.concat(get_all_field_for_key("coconut"))
    r = r.concat(get_all_field_for_key("marionberry"))
    r = r.concat(get_all_field_for_key("blood orange"))
    
    if(user=="apa")
    {
        r = r.concat(get_all_field_for_key("banana"))
    }
        
    return r
}


//exports.get_available_plans = function(user){} // get avaiable plan groups. ex 2017, 2018. om redan gjort export till 2017 så ska inte den dyka upp igen. om 2018 är långt i framtiden så visa ej 2018

//exports.export_plan(user)