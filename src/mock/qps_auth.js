

exports.auth = function(x_qlik_session,db)
{
    return new Promise(function(res,rej)
    {
        console.log(1)
        
        if(x_qlik_session=='secret_x_qlik_session_that_login_as_user_1') res(1)
		else res(false)
    })
}