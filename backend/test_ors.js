require('dotenv').config();
const ORSAdapter = require('./src/services/orsAdapter');
const ors = new ORSAdapter(process.env.ORS_API_KEY);
const coords = [
    { lat: 48.8566, lng: 2.3522 },
    { lat: 48.8584, lng: 2.2945 },
    { lat: 48.8606, lng: 2.3376 },
    { lat: 48.8706, lng: 2.3476 }
];
ors.optimizeRoute(coords).then(res => {
    if (!res) console.log('Returned null');
    else console.log('Returned success');
}).catch(console.error);
