
exports.reload = function(x_qlik_session,db)
{
    return new Promise(function(res,rej)
    {
        console.log("called mocked QRS RELOAD")
        res(true)
    })
}