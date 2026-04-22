const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });
mongoose.connect(process.env.MONGODB_URI);

const Trip = require('./backend/src/models/Trip');
(async () => {
    const trip = await Trip.findOne({ _id: { $exists: true } });
    if (!trip) { console.log('no trips'); process.exit(0); }
    const day = trip.days.find(d => d.stops && d.stops.length >= 2);
    if (!day) { console.log('no days with >=2 stops'); process.exit(0); }
    console.log('Got a day with stops:', day.stops.map(s => `(${s.lat}, ${s.lng})`));
    process.exit(0);    
})();
