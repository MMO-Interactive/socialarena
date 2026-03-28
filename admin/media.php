<?php
require_once '../includes/db_connect.php';
require_once '../includes/auth.php';
require_once 'includes/admin_auth.php';

$page_title = "Admin Media";
$additional_css = ['css/admin.css'];
$body_class = 'admin-page';

$seriesMedia = $pdo->query("
    SELECT spm.id, spm.title, spm.media_type, spm.created_at, s.title AS series_title
    FROM series_public_media spm
    JOIN series s ON spm.series_id = s.id
    ORDER BY spm.created_at DESC
    LIMIT 150
")->fetchAll(PDO::FETCH_ASSOC);

$storyMedia = $pdo->query("
    SELECT spm.id, spm.title, spm.media_type, spm.created_at, st.title AS story_title
    FROM story_public_media spm
    JOIN stories st ON spm.story_id = st.id
    ORDER BY spm.created_at DESC
    LIMIT 150
")->fetchAll(PDO::FETCH_ASSOC);

include '../includes/header.php';
?>

<div class="admin-wrapper">
    <?php include 'includes/admin_nav.php'; ?>
    <main class="admin-content">
        <div class="dashboard-header">
            <div>
                <h1>Public Media</h1>
                <p class="admin-subtitle">Trailers, clips, and screenshots across the site.</p>
            </div>
        </div>

        <div class="chart-card">
            <h3>Series Media</h3>
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Series</th>
                        <th>Type</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($seriesMedia as $media): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($media['title']); ?></td>
                            <td><?php echo htmlspecialchars($media['series_title']); ?></td>
                            <td><?php echo htmlspecialchars($media['media_type']); ?></td>
                            <td><?php echo date('M j, Y', strtotime($media['created_at'])); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <div class="chart-card">
            <h3>Film Media</h3>
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Film</th>
                        <th>Type</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($storyMedia as $media): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($media['title']); ?></td>
                            <td><?php echo htmlspecialchars($media['story_title']); ?></td>
                            <td><?php echo htmlspecialchars($media['media_type']); ?></td>
                            <td><?php echo date('M j, Y', strtotime($media['created_at'])); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </main>
</div>
