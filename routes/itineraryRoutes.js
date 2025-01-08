const Router = require("express").Router();
const { getItineraryDetails } = require("../controllers/itineraryController");

Router.post("/getdetails", getItineraryDetails);

module.exports = Router;