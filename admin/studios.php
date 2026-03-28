<?php
require_once '../includes/db_connect.php';
require_once '../includes/auth.php';
require_once 'includes/admin_auth.php';

$page_title = "Admin Studios";
$additional_css = ['css/admin.css'];
$body_class = 'admin-page';

$stmt = $pdo->query("
    SELECT s.id, s.name, s.created_at, u.username AS owner_name,
           (SELECT COUNT(*) FROM studio_members m WHERE m.studio_id = s.id) AS member_count,
           (SELECT COUNT(*) FROM studio_followers f WHERE f.studio_id = s.id) AS follower_count
    FROM studios s
    JOIN users u ON s.owner_id = u.id
    ORDER BY s.created_at DESC
    LIMIT 200
");
$studios = $stmt->fetchAll(PDO::FETCH_ASSOC);

include '../includes/header.php';
?>

<div class="admin-wrapper">
    <?php include 'includes/admin_nav.php'; ?>
    <main class="admin-content">
        <div class="dashboard-header">
            <div>
                <h1>Studios</h1>
                <p class="admin-subtitle">Studios, members, and growth.</p>
            </div>
        </div>

        <div class="chart-card">
            <table>
                <thead>
                    <tr>
                        <th>Studio</th>
                        <th>Owner</th>
                        <th>Members</th>
                        <th>Followers</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($studios as $studio): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($studio['name']); ?></td>
                            <td><?php echo htmlspecialchars($studio['owner_name']); ?></td>
                            <td><?php echo (int)$studio['member_count']; ?></td>
                            <td><?php echo (int)$studio['follower_count']; ?></td>
                            <td><?php echo date('M j, Y', strtotime($studio['created_at'])); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </main>
</div>
