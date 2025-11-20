const d = require('./board-data.json');
const purposes = require('./purposes.json');

const posts = [];
for (const k in d) {
    if (d[k].board_type === 'health-policy' && !d[k].is_deleted) {
        posts.push(d[k]);
    }
}
posts.sort((a, b) => a.id - b.id);

console.log('Content title vs Current title vs Expected purpose:\n');
posts.forEach((p, i) => {
    const match = p.content.match(/<b>([^<]+)<\/b>/);
    const contentTitle = match ? match[1] : 'N/A';
    const expectedPurpose = purposes[i];

    console.log(`ID ${p.id}:`);
    console.log(`  Content: ${contentTitle}`);
    console.log(`  Current: ${p.title.substring(0, 60)}${p.title.length > 60 ? '...' : ''}`);
    console.log(`  Expected: ${expectedPurpose.substring(0, 60)}${expectedPurpose.length > 60 ? '...' : ''}`);
    console.log();
});
