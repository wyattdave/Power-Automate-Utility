// Simple test runner that runs all test files ending with 'Test.js' in the test directory
const fs = require('fs');
const path = require('path');

const sTestDir = __dirname;
const aFiles = fs.readdirSync(sTestDir).filter(function (s) {
    return s.match(/Test\.js$/);
});

if (aFiles.length === 0) {
    console.log('No tests found.');
    process.exit(0);
}

let iFailed = 0;

for (let i = 0; i < aFiles.length; i++) {
    const sFile = aFiles[i];
    console.log('\n==== Running ' + sFile + ' ====');
    try {
        require(path.join(sTestDir, sFile));
    } catch (e) {
        console.error('Test file ' + sFile + ' failed with error: ' + (e && e.message));
        iFailed++;
    }
}

if (iFailed > 0) {
    console.error('\n' + iFailed + ' test file(s) failed');
    process.exit(1);
}

console.log('\nAll test files completed successfully.');
