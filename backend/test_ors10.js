const { default: axios } = require('axios');
(async () => {
    try {
        const response = await axios.post('http://localhost:5001/api/routes/optimize', { coordinates: [{ lat: 48.8566, lng: 2.3522 }, { lat: 48.8584, lng: 2.2945 }, { lat: 48.8606, lng: 2.3376 }] }, { headers: { 'Content-Type': 'application/json' } });
        console.log(response.data);
    } catch (e) {
        console.log(e.response ? e.response.data : e.message);
    }
})();
