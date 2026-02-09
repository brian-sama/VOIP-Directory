const { generateUsername } = require('./userUtils');

const testCases = [
    { input: 'Mpazamiso Ndebele', expected: 'mndebele' },
    { input: 'M. Ndebele', expected: 'mndebele' },
    { input: 'John Doe', expected: 'jdoe' },
    { input: 'John Michael Doe', expected: 'jdoe' },
    { input: 'Mary-Jane Watson', expected: 'mwatson' },
    { input: 'A.B. Smith', expected: 'asmith' },
    { input: '  Spaces  Test  ', expected: 'stest' }
];

console.log('--- Testing Username Generation ---');
testCases.forEach(({ input, expected }) => {
    const result = generateUsername(input);
    const status = result === expected ? 'PASS' : 'FAIL';
    console.log(`[${status}] Input: "${input}" -> Result: "${result}" (Expected: "${expected}")`);
});
