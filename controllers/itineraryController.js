const catchBlock = require("../utils/errorHandler");
const { sql } = require("../dbConnection/dbConfiguration");
const { executeStoredProcedure } = require("../dbConnection/dbExecution");


async function getItineraryDetails(req, res, next){
    // Usp_GetPackageitinerarySection_API   --> For Itnerary Details
    // Usp_GetPackageDetailsSection_API     --> For Package Details Section
    // Usp_GetPackageHotelSection_API       --> For Hotel Rates
    // Usp_GetPackageRateSection_API        --> For Package Rates
    const requireType = req.query.require;
    try {
        const {userid, pkgid, date} = req.body;
        // Parameters Array for all SP's
        const paramArray = [
            {name : "userId", type : sql.NVarChar(50), value : userid},
            {name : "PKGID", type : sql.BigInt, value : pkgid}
        ];
        if(!requireType || requireType == 'all'){
            // If no requirement is passed then send all details
            const itineraryDetails = executeStoredProcedure("Usp_GetPackageitinerarySection_API", paramArray);
            const packageDetails = executeStoredProcedure("Usp_GetPackageDetailsSection_API", paramArray);
            const hotelRates = executeStoredProcedure("Usp_GetPackageHotelSection_API", paramArray);
            const packageRates = executeStoredProcedure("Usp_GetPackageRateSection_API", paramArray);
            const [{value : itnryDtls}, {value : pkgDtls}, {value : hotlRts}, {value : pkgRts}] = await Promise.allSettled([itineraryDetails, packageDetails, hotelRates, packageRates]);
            return res.status(200).json([itnryDtls, pkgDtls, hotlRts, pkgRts]);
        }else if(requireType == "itinerary"){
            // Itinerary details in case of itinerary
            const itineraryDetails = await executeStoredProcedure("Usp_GetPackageitinerarySection_API", paramArray);
            return res.status(200).json(itineraryDetails);
        }else if(requireType == 'pkgdetail'){
            // Only package Details when required pkgdetail
            const packageDetails = await executeStoredProcedure("Usp_GetPackageDetailsSection_API", paramArray);
            return res.status(200).json(packageDetails);
        }else if(requireType == 'pkgrate'){
            // Push Additionally date parameter for fetching date wise package rate or if date is not provided it will fetch rates for all date
            paramArray.push({name : "AVAIL_DATE", type : sql.VarChar(50), value : date});
            const packageRates = await executeStoredProcedure("Usp_GetPackageRateSection_API", paramArray);
            return res.status(200).json(packageRates);
        }else if( requireType == 'hotel'){
            // Hotel Details in requirements of hotel
            const hotelRates = await executeStoredProcedure("Usp_GetPackageHotelSection_API", paramArray);
            return res.status(200).json(hotelRates);
        }
    } catch (error) {
        catchBlock(error, "Getting Itinerary Details", res)
    }
}

module.exports = {
    getItineraryDetails
}