<?php
require_once '../includes/db_connect.php';
require_once '../includes/auth.php';
require_once 'includes/admin_auth.php';

$page_title = "Admin News";
$additional_css = ['css/admin.css'];
$body_class = 'admin-page';

function slugify($text) {
    $text = strtolower(trim($text));
    $text = preg_replace('/[^a-z0-9]+/', '-', $text);
    return trim($text, '-');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if ($action === 'save') {
        $title = trim($_POST['title'] ?? '');
        $excerpt = trim($_POST['excerpt'] ?? '');
        $body = trim($_POST['body'] ?? '');
        $status = $_POST['status'] ?? 'draft';
        $cover = trim($_POST['cover_image_url'] ?? '');

        if (!empty($_FILES['cover_image']) && $_FILES['cover_image']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['cover_image'];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            if (in_array($ext, $allowed, true)) {
                $upload_dir = __DIR__ . '/../uploads/news/';
                if (!is_dir($upload_dir)) {
                    mkdir($upload_dir, 0777, true);
                }
                $filename = 'news_' . $_SESSION['user_id'] . '_' . uniqid() . '.' . $ext;
                $target = $upload_dir . $filename;
                if (move_uploaded_file($file['tmp_name'], $target)) {
                    $cover = 'uploads/news/' . $filename;
                }
            }
        }
        if ($title !== '' && $body !== '') {
            $slugBase = slugify($title);
            $slug = $slugBase;
            $i = 1;
            while (true) {
                $stmt = $pdo->prepare("SELECT id FROM public_news WHERE slug = ?");
                $stmt->execute([$slug]);
                if (!$stmt->fetchColumn()) break;
                $slug = $slugBase . '-' . $i++;
            }
            $publishedAt = $status === 'published' ? date('Y-m-d H:i:s') : null;
            $stmt = $pdo->prepare("
                INSERT INTO public_news
                (title, slug, excerpt, body, cover_image_url, author_id, status, published_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$title, $slug, $excerpt, $body, $cover, (int)$_SESSION['user_id'], $status, $publishedAt]);
        }
        header('Location: news.php');
        exit;
    }
    if ($action === 'delete') {
        $id = (int)($_POST['id'] ?? 0);
        if ($id) {
            $stmt = $pdo->prepare("DELETE FROM public_news WHERE id = ?");
            $stmt->execute([$id]);
        }
        header('Location: news.php');
        exit;
    }
}

$posts = $pdo->query("SELECT n.*, u.username FROM public_news n JOIN users u ON n.author_id = u.id ORDER BY created_at DESC")->fetchAll(PDO::FETCH_ASSOC);

include '../includes/header.php';
?>

<div class="admin-wrapper">
    <?php include 'includes/admin_nav.php'; ?>
    <main class="admin-content">
        <div class="dashboard-header">
            <div>
                <h1>News & Updates</h1>
                <p class="admin-subtitle">Publish platform updates to the public news feed.</p>
            </div>
        </div>

        <div class="chart-card">
            <div class="news-header">
                <div>
                    <h3>Create Post</h3>
                    <p class="admin-subtitle">Draft a newsroom update and publish when ready.</p>
                </div>
                <span class="status-pill status-muted">Newsroom</span>
            </div>
            <form method="POST" class="news-form" enctype="multipart/form-data">
                <input type="hidden" name="action" value="save">
                <div class="news-form-grid">
                    <div class="news-form-main">
                        <div class="form-group">
                            <label for="news-title">Title</label>
                            <input type="text" id="news-title" name="title" placeholder="New feature release: SocialArena Studios" required>
                        </div>
                        <div class="form-group">
                            <label for="news-excerpt">Excerpt</label>
                            <textarea id="news-excerpt" name="excerpt" rows="3" placeholder="A quick summary that will appear in the news feed."></textarea>
                        </div>
                        <div class="form-group">
                            <label for="news-body">Body</label>
                            <textarea id="news-body" name="body" rows="8" placeholder="Write the full update, include details, links, and next steps..." required></textarea>
                        </div>
                    </div>
                    <aside class="news-form-side">
                        <div class="form-card">
                            <h4>Publishing</h4>
                            <div class="form-group">
                                <label for="news-status">Status</label>
                                <select id="news-status" name="status">
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="news-cover">Cover Image URL</label>
                                <input type="text" id="news-cover" name="cover_image_url" placeholder="https://... (optional)">
                                <small class="form-hint">Used for the news hero and social previews.</small>
                            </div>
                            <div class="form-group">
                                <label for="news-cover-upload">Upload Cover Image</label>
                                <input type="file" id="news-cover-upload" name="cover_image" accept="image/*">
                                <small class="form-hint">JPG, PNG, GIF, or WebP.</small>
                            </div>
                            <div class="form-actions">
                                <button class="btn" type="submit">Save Post</button>
                                <button class="btn btn-secondary" type="reset">Reset</button>
                            </div>
                        </div>
                    </aside>
                </div>
            </form>
        </div>

        <div class="chart-card">
            <h3>Recent Posts</h3>
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Author</th>
                        <th>Created</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($posts as $post): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($post['title']); ?></td>
                            <td><?php echo htmlspecialchars($post['status']); ?></td>
                            <td><?php echo htmlspecialchars($post['username']); ?></td>
                            <td><?php echo date('M j, Y', strtotime($post['created_at'])); ?></td>
                            <td>
                                <form method="POST">
                                    <input type="hidden" name="action" value="delete">
                                    <input type="hidden" name="id" value="<?php echo (int)$post['id']; ?>">
                                    <button class="btn danger" type="submit">Delete</button>
                                </form>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </main>
</div>
