require("dotenv").config();
const express = require("express");
const app = express();
const cors = require('cors');

const PORT = process.env.PORT || 3000

app.use(cors({origin : "*"}));
app.use(express.json());

// Routes 
const itineraryRoutes = require("./routes/itineraryRoutes");

// Use Routes 
app.use("/itinerary", itineraryRoutes);

app.listen(PORT, ()=>{
    console.log(`Server Running on ${PORT}`);
})