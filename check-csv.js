const fs = require('fs');

const csvPath = '/Users/2302-n0214/Downloads/비즈케어 내 대웅 건강제도 정리_최종_다나아.csv';
const content = fs.readFileSync(csvPath, 'utf-8');

const lines = content.split('\n');
console.log('Total lines:', lines.length);
console.log('\nFirst 10 lines:');
for (let i = 0; i < 10 && i < lines.length; i++) {
    console.log(`[${i}]: ${lines[i].substring(0, 100)}`);
}
