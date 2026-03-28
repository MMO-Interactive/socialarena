<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$studios = getUserStudios($pdo, (int)$_SESSION['user_id']);
[$whereClause, $whereParams] = buildStudioVisibilityWhere('m', (int)$_SESSION['user_id'], 'music_library');
$stmt = $pdo->prepare("SELECT * FROM studio_music_library m WHERE {$whereClause} ORDER BY updated_at DESC");
$stmt->execute($whereParams);
$tracks = $stmt->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'Music Library';
$additional_css = ['css/music.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="music-header">
                <div>
                    <h1>Music Library</h1>
                    <p>Upload and organize music tracks with notes, tags, and metadata.</p>
                </div>
                <button class="btn primary-btn" id="add-track">Add Track</button>
            </div>

            <div class="music-grid">
                <?php if (empty($tracks)): ?>
                    <div class="empty-state">No music yet. Upload your first track.</div>
                <?php else: ?>
                    <?php foreach ($tracks as $track): ?>
                        <div class="music-card" data-track-id="<?php echo (int)$track['id']; ?>" data-studio-id="<?php echo (int)($track['studio_id'] ?? 0); ?>" data-visibility="<?php echo htmlspecialchars($track['visibility'] ?? 'private'); ?>">
                            <div class="music-cover">
                                <?php if (!empty($track['cover_image_url'])): ?>
                                    <img src="<?php echo htmlspecialchars($track['cover_image_url']); ?>" alt="<?php echo htmlspecialchars($track['title']); ?>">
                                <?php else: ?>
                                    <div class="cover-placeholder">Track</div>
                                <?php endif; ?>
                            </div>
                            <div class="music-info">
                                <h3><?php echo htmlspecialchars($track['title']); ?></h3>
                                <div class="music-meta">
                                    <?php if (!empty($track['artist'])): ?>
                                        <span><?php echo htmlspecialchars($track['artist']); ?></span>
                                    <?php endif; ?>
                                    <?php if (!empty($track['genre'])): ?>
                                        <span><?php echo htmlspecialchars($track['genre']); ?></span>
                                    <?php endif; ?>
                                    <?php if (!empty($track['mood'])): ?>
                                        <span><?php echo htmlspecialchars($track['mood']); ?></span>
                                    <?php endif; ?>
                                </div>
                                <p><?php echo htmlspecialchars($track['description'] ?? ''); ?></p>
                                <?php if (!empty($track['tags'])): ?>
                                    <div class="music-tags"><?php echo htmlspecialchars($track['tags']); ?></div>
                                <?php endif; ?>
                                <?php if (!empty($track['file_url'])): ?>
                                    <audio controls class="music-player">
                                        <source src="audio_stream.php?file=<?php echo urlencode($track['file_url']); ?>">
                                    </audio>
                                <?php endif; ?>
                            </div>
                            <div class="music-actions">
                                <a class="btn" href="music_profile.php?id=<?php echo (int)$track['id']; ?>">Profile</a>
                                <button class="btn" data-action="edit">Edit</button>
                                <button class="btn danger" data-action="delete">Delete</button>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </main>
    </div>
</div>

<div class="modal" id="track-modal" style="display:none;">
    <div class="modal-content">
        <h2 id="track-modal-title">Add Track</h2>
        <div class="form-group">
            <label>Title</label>
            <input type="text" id="track-title">
        </div>
        <div class="form-group">
            <label>Artist</label>
            <input type="text" id="track-artist">
        </div>
        <div class="form-group">
            <label>Genre</label>
            <input type="text" id="track-genre">
        </div>
        <div class="form-group">
            <label>BPM</label>
            <input type="text" id="track-bpm" placeholder="e.g. 120">
        </div>
        <div class="form-group">
            <label>Key</label>
            <input type="text" id="track-key" placeholder="e.g. C Minor">
        </div>
        <div class="form-group">
            <label>Mood</label>
            <input type="text" id="track-mood" placeholder="e.g. Suspenseful">
        </div>
        <div class="form-group">
            <label>Description</label>
            <textarea id="track-description" placeholder="Notes about how/where to use this track..."></textarea>
        </div>
        <div class="form-group">
            <label>Tags</label>
            <input type="text" id="track-tags" placeholder="e.g. chase, ambient, piano">
        </div>
        <div class="form-group">
            <label>Cover Image URL</label>
            <input type="text" id="track-cover" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>Upload Cover Image</label>
            <input type="file" id="track-cover-file" accept="image/*">
        </div>
        <div class="form-group">
            <label>Studio</label>
            <select id="track-studio">
                <option value="">Personal</option>
                <?php foreach ($studios as $studio): ?>
                    <option value="<?php echo (int)$studio['id']; ?>"><?php echo htmlspecialchars($studio['name']); ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="form-group">
            <label>Visibility</label>
            <select id="track-visibility">
                <option value="private">Private</option>
                <option value="studio">Studio</option>
                <option value="public">Public</option>
            </select>
        </div>
        <div class="form-group">
            <label>Upload Audio File</label>
            <input type="file" id="track-audio-file" accept="audio/*">
        </div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="track-cancel">Cancel</button>
            <button class="btn primary-btn" id="track-save">Save</button>
        </div>
    </div>
</div>

<script src="js/music.js"></script>
