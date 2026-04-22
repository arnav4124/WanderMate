require('dotenv').config();
const ORSAdapter = require('./src/services/orsAdapter');
const ors = new ORSAdapter(process.env.ORS_API_KEY);
const coords = [
    { lat: undefined, lng: undefined },
    { lat: undefined, lng: undefined }
];
ors.optimizeRoute(coords).then(res => {
    if (!res) console.log('Returned null');
    else console.log('Returned success');
}).catch(console.error);
