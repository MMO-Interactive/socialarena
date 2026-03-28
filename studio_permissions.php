<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';

$studio_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if (!$studio_id) {
    header('Location: studios.php');
    exit;
}

$stmt = $pdo->prepare("
    SELECT s.*, sm.role
    FROM studios s
    JOIN studio_members sm ON sm.studio_id = s.id
    WHERE s.id = ? AND sm.user_id = ?
");
$stmt->execute([$studio_id, $_SESSION['user_id']]);
$studio = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$studio || $studio['role'] !== 'owner') {
    header('Location: studios.php');
    exit;
}

$page_title = 'Studio Permissions - ' . htmlspecialchars($studio['name']);
$additional_css = ['css/studio_permissions.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="permissions-header">
                <div>
                    <h1>Permissions</h1>
                    <p>Grant or revoke access to studio areas.</p>
                </div>
                <a class="btn" href="studio_profile.php?id=<?php echo (int)$studio_id; ?>">Back to Studio</a>
            </div>

            <div class="permissions-grid" id="permissions-grid" data-studio-id="<?php echo (int)$studio_id; ?>">
                <div class="empty-state">Loading permissions...</div>
            </div>
        </main>
    </div>
</div>

<script src="js/studio_permissions.js"></script>
