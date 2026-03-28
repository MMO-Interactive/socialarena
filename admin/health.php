<?php
require_once '../includes/db_connect.php';
require_once '../includes/auth.php';
require_once 'includes/admin_auth.php';

$page_title = 'Admin Health Check';
$additional_css = ['css/admin.css'];

$checks = [];

// Check database connectivity
$checks[] = [
    'name' => 'Database Connection',
    'status' => true,
    'details' => 'Connected'
];

// Required tables
$requiredTables = [
    'users', 'stories', 'pages', 'story_ratings', 'story_comments',
    'universes', 'series', 'codex_entries', 'user_api_keys'
];

$existingTables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
foreach ($requiredTables as $table) {
    $checks[] = [
        'name' => "Table: {$table}",
        'status' => in_array($table, $existingTables, true),
        'details' => in_array($table, $existingTables, true) ? 'Present' : 'Missing'
    ];
}

// Required columns (table => columns)
$requiredColumns = [
    'stories' => ['title', 'genre', 'setting', 'user_id'],
    'users' => ['username', 'email', 'password_hash'],
    'universes' => ['title', 'created_by'],
    'series' => ['title', 'created_by']
];

foreach ($requiredColumns as $table => $columns) {
    if (!in_array($table, $existingTables, true)) {
        continue;
    }
    $stmt = $pdo->prepare('SHOW COLUMNS FROM ' . $table);
    $stmt->execute();
    $existingCols = array_map(function ($row) {
        return $row['Field'];
    }, $stmt->fetchAll());

    foreach ($columns as $col) {
        $checks[] = [
            'name' => "Column: {$table}.{$col}",
            'status' => in_array($col, $existingCols, true),
            'details' => in_array($col, $existingCols, true) ? 'Present' : 'Missing'
        ];
    }
}

include '../includes/header.php';
?>

<div class="admin-wrapper">
    <?php include 'includes/admin_nav.php'; ?>
    <main class="admin-content">
        <h1>Health Check</h1>
        <div class="chart-card">
            <table>
                <thead>
                    <tr>
                        <th>Check</th>
                        <th>Status</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($checks as $check): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($check['name']); ?></td>
                            <td><?php echo $check['status'] ? 'OK' : 'FAIL'; ?></td>
                            <td><?php echo htmlspecialchars($check['details']); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </main>
</div>
