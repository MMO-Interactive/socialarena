<?php
require_once '../includes/db_connect.php';
require_once '../includes/auth.php';
require_once 'includes/admin_auth.php';

$page_title = "Admin Content";
$additional_css = ['css/admin.css'];
$body_class = 'admin-page';

$stories = $pdo->query("
    SELECT s.id, s.title, s.status, s.created_at, u.username
    FROM stories s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC
    LIMIT 100
")->fetchAll(PDO::FETCH_ASSOC);

$series = $pdo->query("
    SELECT s.id, s.title, s.status, s.created_at, u.username
    FROM series s
    JOIN users u ON s.created_by = u.id
    ORDER BY s.created_at DESC
    LIMIT 100
")->fetchAll(PDO::FETCH_ASSOC);

include '../includes/header.php';
?>

<div class="admin-wrapper">
    <?php include 'includes/admin_nav.php'; ?>
    <main class="admin-content">
        <div class="dashboard-header">
            <div>
                <h1>Content Overview</h1>
                <p class="admin-subtitle">Recent stories and series across the platform.</p>
            </div>
        </div>

        <div class="chart-card">
            <h3>Latest Stories</h3>
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Creator</th>
                        <th>Status</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($stories as $story): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($story['title']); ?></td>
                            <td><?php echo htmlspecialchars($story['username']); ?></td>
                            <td><?php echo htmlspecialchars($story['status']); ?></td>
                            <td><?php echo date('M j, Y', strtotime($story['created_at'])); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <div class="chart-card">
            <h3>Latest Series</h3>
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Creator</th>
                        <th>Status</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($series as $item): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($item['title']); ?></td>
                            <td><?php echo htmlspecialchars($item['username']); ?></td>
                            <td><?php echo htmlspecialchars($item['status']); ?></td>
                            <td><?php echo date('M j, Y', strtotime($item['created_at'])); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </main>
</div>
