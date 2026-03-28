<?php
require_once '../includes/db_connect.php';
require_once '../includes/auth.php';
require_once 'includes/admin_auth.php';

$page_title = "Admin Talent";
$additional_css = ['css/admin.css'];
$body_class = 'admin-page';

$stmt = $pdo->query("
    SELECT tp.id, tp.display_name, tp.availability, tp.created_at, u.username,
           GROUP_CONCAT(tr.name ORDER BY tr.name SEPARATOR ', ') AS roles
    FROM talent_profiles tp
    JOIN users u ON tp.user_id = u.id
    LEFT JOIN talent_profile_roles tpr ON tp.id = tpr.profile_id
    LEFT JOIN talent_roles tr ON tpr.role_id = tr.id
    GROUP BY tp.id
    ORDER BY tp.created_at DESC
    LIMIT 200
");
$profiles = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->query("
    SELECT str.id, str.title, str.status, str.created_at, s.name AS studio_name
    FROM studio_talent_requests str
    JOIN studios s ON str.studio_id = s.id
    ORDER BY str.created_at DESC
    LIMIT 100
");
$requests = $stmt->fetchAll(PDO::FETCH_ASSOC);

include '../includes/header.php';
?>

<div class="admin-wrapper">
    <?php include 'includes/admin_nav.php'; ?>
    <main class="admin-content">
        <div class="dashboard-header">
            <div>
                <h1>Talent Directory</h1>
                <p class="admin-subtitle">Casting profiles and open studio requests.</p>
            </div>
        </div>

        <div class="chart-card">
            <h3>Talent Profiles</h3>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>User</th>
                        <th>Roles</th>
                        <th>Availability</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($profiles as $profile): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($profile['display_name']); ?></td>
                            <td><?php echo htmlspecialchars($profile['username']); ?></td>
                            <td><?php echo htmlspecialchars($profile['roles'] ?? ''); ?></td>
                            <td><?php echo htmlspecialchars($profile['availability']); ?></td>
                            <td><?php echo date('M j, Y', strtotime($profile['created_at'])); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <div class="chart-card">
            <h3>Studio Talent Requests</h3>
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Studio</th>
                        <th>Status</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($requests as $request): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($request['title']); ?></td>
                            <td><?php echo htmlspecialchars($request['studio_name']); ?></td>
                            <td><?php echo htmlspecialchars($request['status']); ?></td>
                            <td><?php echo date('M j, Y', strtotime($request['created_at'])); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </main>
</div>
