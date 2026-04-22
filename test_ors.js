require('dotenv').config({ path: '/Users/sanyamagrawal/Desktop/WanderMate/backend/.env' });
const ORSAdapter = require('/Users/sanyamagrawal/Desktop/WanderMate/backend/src/services/orsAdapter');

(async () => {
    const ors = new ORSAdapter(process.env.ORS_API_KEY);
    const coords = [
        { lat: 48.8566, lng: 2.3522 },
        { lat: 48.8584, lng: 2.2945 },
        { lat: 48.8606, lng: 2.3376 }
    ];
    console.log('Testing optimizeRoute...');
    const result = await ors.optimizeRoute(coords);
    console.log('Result:', result ? 'Success' : 'Failed');
})();
