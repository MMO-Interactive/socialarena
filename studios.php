<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';

$stmt = $pdo->prepare("
    SELECT s.*, sm.role,
           (SELECT COUNT(*) FROM studio_members m WHERE m.studio_id = s.id) AS member_count
    FROM studios s
    JOIN studio_members sm ON sm.studio_id = s.id
    WHERE sm.user_id = ?
    ORDER BY s.updated_at DESC
");
$stmt->execute([$_SESSION['user_id']]);
$studios = $stmt->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'Studios';
$additional_css = ['css/studios.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="studios-header">
                <div>
                    <h1>Studios</h1>
                    <p>Manage studios, members, and production access in one place.</p>
                </div>
                <button class="btn primary-btn" id="create-studio">Create Studio</button>
            </div>

            <div class="studios-grid">
                <?php if (empty($studios)): ?>
                    <div class="empty-state">No studios yet. Create your first studio.</div>
                <?php else: ?>
                    <?php foreach ($studios as $studio): ?>
                        <div class="studio-card">
                            <div class="studio-banner">
                                <?php if (!empty($studio['banner_url'])): ?>
                                    <img src="<?php echo htmlspecialchars($studio['banner_url']); ?>" alt="">
                                <?php endif; ?>
                            </div>
                            <div class="studio-card-body">
                                <div class="studio-card-header">
                                    <?php if (!empty($studio['logo_url'])): ?>
                                        <img class="studio-logo" src="<?php echo htmlspecialchars($studio['logo_url']); ?>" alt="">
                                    <?php else: ?>
                                        <div class="studio-logo placeholder"><?php echo strtoupper(substr($studio['name'], 0, 1)); ?></div>
                                    <?php endif; ?>
                                    <div>
                                        <h3><?php echo htmlspecialchars($studio['name']); ?></h3>
                                        <div class="studio-meta">
                                            <span><?php echo (int)$studio['member_count']; ?> members</span>
                                            <span><?php echo htmlspecialchars(ucfirst($studio['role'])); ?></span>
                                        </div>
                                    </div>
                                </div>
                                <p><?php echo htmlspecialchars($studio['description'] ?? ''); ?></p>
                                <div class="studio-actions">
                                    <a class="btn" href="studio_profile.php?id=<?php echo (int)$studio['id']; ?>">Open</a>
                                    <a class="btn secondary-btn" href="studio_public.php?id=<?php echo (int)$studio['id']; ?>">Public Page</a>
                                    <?php if ($studio['role'] === 'owner'): ?>
                                        <a class="btn" href="studio_permissions.php?id=<?php echo (int)$studio['id']; ?>">Permissions</a>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </main>
    </div>
</div>

<div class="modal" id="studio-modal" style="display:none;">
    <div class="modal-content">
        <h2>Create Studio</h2>
        <div class="form-group">
            <label>Name</label>
            <input type="text" id="studio-name">
        </div>
        <div class="form-group">
            <label>Description</label>
            <textarea id="studio-description" placeholder="Studio focus, vision, or notes..."></textarea>
        </div>
        <div class="form-group">
            <label>Logo URL</label>
            <input type="text" id="studio-logo">
        </div>
        <div class="form-group">
            <label>Banner URL</label>
            <input type="text" id="studio-banner">
        </div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="studio-cancel">Cancel</button>
            <button class="btn primary-btn" id="studio-save">Save</button>
        </div>
    </div>
</div>

<script src="js/studios.js"></script>
