const d = require('./board-data.json');
const posts = [];
for (const k in d) {
    if (d[k].board_type === 'health-policy' && !d[k].is_deleted) {
        posts.push(d[k]);
    }
}
posts.sort((a, b) => a.id - b.id);
console.log('Total:', posts.length);
console.log('Last post: ID', posts[posts.length - 1].id, '-', posts[posts.length - 1].title);
