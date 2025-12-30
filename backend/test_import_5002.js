
const http = require('http');
const fs = require('fs');
const path = require('path');

const boundary = '--------------------------1234567890';
const filePath = path.join(__dirname, 'test_users_real.csv');
const fileContent = fs.readFileSync(filePath);

const postDataStart = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test_users_real.csv"\r\nContent-Type: text/csv\r\n\r\n`);
const postDataEnd = Buffer.from(`\r\n--${boundary}--\r\n`);

const postData = Buffer.concat([postDataStart, fileContent, postDataEnd]);

const options = {
    hostname: 'localhost',
    port: 5002,
    path: '/api/import/users',
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': postData.length,
    },
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log('BODY:', data);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(postData);
req.end();
