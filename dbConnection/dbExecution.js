const catchBlock = require("../utils/errorHandler");
let { poolPromise } = require('../dbConnection/dbConfiguration');

async function executeStoredProcedure(spname, params){
    try {
        const pool = await poolPromise;
        const request = pool.request();
        if(params && Array.isArray(params) && params.length > 0){
            for(const object of params){
                request.input(object.name, object.type, object.value);
            }
        }
        const result = await request.execute(spname);
        return result.recordset;
    } catch (error) {
        catchBlock(error, 'Executing Stored Procedure')
    }

}

async function executeQuery(query, params){
    try {
        const pool = await poolPromise;
        const request = pool.request();
        if(params){
            const paramsKeyArray = Object.keys(params);
            if(paramsKeyArray.length > 0){
                paramsKeyArray.forEach( valueKey =>{
                    request.input(valueKey, params[valueKey])
                });
            }
        }
        const result = await request.query(query);
        return result.recordset;
    } catch (error) {
        catchBlock(error, params)
    }
}



module.exports = {
    executeQuery,
    executeStoredProcedure
}