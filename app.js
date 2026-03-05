const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const methodOverride = require('method-override');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'posts.json');

function loadPosts() {
    try {
        if (!fs.existsSync(DATA_FILE)) return [];
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw || '[]');
    } catch (e) {
        console.error('Failed to load posts:', e);
        return [];
    }
}

function savePosts(posts) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save posts:', e);
    }
}

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Add a relaxed Content Security Policy for local development so DevTools and
// XHR/fetch requests from the same origin are not blocked.
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy",
        "default-src 'self'; connect-src 'self' ws: http: https:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';");
    next();
});

app.use(express.urlencoded({ extended: true }));
// Support method override from either a hidden form field (`_method`) or query string
app.use(methodOverride(function (req, res) {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
        const method = req.body._method;
        delete req.body._method;
        return method;
    }
    if (req.query && req.query._method) return req.query._method;
}));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    const posts = loadPosts().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.render('index', { posts });
});

app.get('/posts/new', (req, res) => res.render('new'));

app.post('/posts', (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
        return res.status(400).send('Title and content are required');
    }
    const posts = loadPosts();
    const post = { id: uuidv4(), title: title.trim(), content: content.trim(), createdAt: new Date().toISOString() };
    posts.push(post);
    savePosts(posts);
    res.redirect('/');
});

app.get('/posts/:id', (req, res) => {
    const posts = loadPosts();
    const post = posts.find(p => p.id === req.params.id);
    if (!post) return res.status(404).send('Post not found');
    res.render('show', { post });
});

app.get('/posts/:id/edit', (req, res) => {
    const posts = loadPosts();
    const post = posts.find(p => p.id === req.params.id);
    if (!post) return res.status(404).send('Post not found');
    console.log('GET /posts/:id/edit', { id: req.params.id });
    res.render('edit', { post });
});

app.put('/posts/:id', (req, res) => {
    console.log('PUT /posts/:id - raw', { id: req.params.id, method: req.method, body: req.body, query: req.query });
    const { title, content } = req.body;
    const posts = loadPosts();
    const idx = posts.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).send('Post not found');
    posts[idx].title = (title || '').trim();
    posts[idx].content = (content || '').trim();
    posts[idx].updatedAt = new Date().toISOString();
    savePosts(posts);
    res.redirect(`/posts/${req.params.id}`);
});

app.delete('/posts/:id', (req, res) => {
    console.log('DELETE /posts/:id - raw', { id: req.params.id, method: req.method, body: req.body, query: req.query });
    const posts = loadPosts();
    const idx = posts.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).send('Post not found');
    posts.splice(idx, 1);
    savePosts(posts);
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Simple Blog running at http://localhost:${PORT}`));
