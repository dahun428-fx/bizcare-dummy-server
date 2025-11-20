const d = require('./board-data.json');
const posts = [];
for (const k in d) {
    if (d[k].board_type === 'health-policy' && !d[k].is_deleted) {
        posts.push(d[k]);
    }
}
posts.sort((a, b) => a.id - b.id);

console.log('First 5 health-policy titles:');
posts.slice(0, 5).forEach(p => console.log(`  ID ${p.id}: ${p.title}`));

console.log('\nLast 5 health-policy titles:');
posts.slice(-5).forEach(p => console.log(`  ID ${p.id}: ${p.title}`));

console.log(`\nTotal: ${posts.length} posts`);
