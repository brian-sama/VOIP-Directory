const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000/api'; // Adjust port if needed

async function measureLogin() {
    const start = Date.now();
    try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            username: 'admin',
            password: 'bccit'
        });
        const duration = Date.now() - start;
        console.log(`Login took: ${duration}ms`);
        return duration;
    } catch (err) {
        console.error('Login failed:', err.message);
        return null;
    }
}

async function runTests() {
    console.log('--- Starting Performance Tests ---');
    let totalDuration = 0;
    let successfulTests = 0;

    for (let i = 0; i < 5; i++) {
        const duration = await measureLogin();
        if (duration !== null) {
            totalDuration += duration;
            successfulTests++;
        }
    }

    if (successfulTests > 0) {
        console.log(`Average Login Duration: ${totalDuration / successfulTests}ms`);
    }
}

runTests();
