const d = require('./board-data.json');
const posts = [];
for (const k in d) {
    if (d[k].board_type === 'health-policy' && !d[k].is_deleted) {
        posts.push(d[k]);
    }
}
posts.sort((a, b) => a.id - b.id);

console.log('All 31 health-policy titles:\n');
posts.forEach((p, i) => {
    console.log(`[${i + 1}] ID ${p.id}: ${p.title}`);
});
