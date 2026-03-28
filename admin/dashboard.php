<?php
require_once '../includes/db_connect.php';
require_once '../includes/auth.php';
require_once 'includes/admin_auth.php'; // Updated path

// Set page title and CSS
$page_title = "Admin Dashboard";
$additional_css = ['css/admin.css', 'css/analytics.css'];
$body_class = 'admin-page';

// Get high-level statistics
$stats = [
    'total_users' => $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn(),
    'total_universes' => $pdo->query("SELECT COUNT(*) FROM universes")->fetchColumn(),
    'total_series' => $pdo->query("SELECT COUNT(*) FROM series")->fetchColumn(),
    'total_stories' => $pdo->query("SELECT COUNT(*) FROM stories")->fetchColumn(),
    'total_codex_entries' => $pdo->query("SELECT COUNT(*) FROM codex_entries")->fetchColumn(),
    'total_studios' => $pdo->query("SELECT COUNT(*) FROM studios")->fetchColumn(),
    'total_talent' => $pdo->query("SELECT COUNT(*) FROM talent_profiles")->fetchColumn(),
    'total_media' => $pdo->query("SELECT COUNT(*) FROM series_public_media")->fetchColumn() + $pdo->query("SELECT COUNT(*) FROM story_public_media")->fetchColumn()
];

// Get recent activity
$recent_activity = $pdo->query("
    SELECT 'story' as type, title, created_at, user_id 
    FROM stories 
    UNION ALL
    SELECT 'series' as type, title, created_at, user_id 
    FROM series
    UNION ALL
    SELECT 'universe' as type, title, created_at, user_id 
    FROM universes
    ORDER BY created_at DESC
    LIMIT 10
")->fetchAll();

include '../includes/header.php';
?>

<div class="admin-wrapper">
    <?php include 'includes/admin_nav.php'; ?>
    
    <main class="admin-content">
        <div class="dashboard-header">
            <div>
                <h1>Admin Command Center</h1>
                <p class="admin-subtitle">Platform health, content velocity, and studio growth overview.</p>
            </div>
            <div class="date-range-picker">
                <label>
                    <span>From</span>
                    <input type="date" id="start-date">
                </label>
                <label>
                    <span>To</span>
                    <input type="date" id="end-date">
                </label>
                <button onclick="updateAnalytics()" class="btn">Refresh</button>
            </div>
        </div>

        <!-- Stats Overview -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon users">
                    <i class="fas fa-users"></i>
                </div>
                <div class="stat-info">
                    <h3>Total Users</h3>
                    <div class="stat-value"><?php echo number_format($stats['total_users']); ?></div>
                    <div class="stat-change">Registered accounts</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon universes">
                    <i class="fas fa-globe"></i>
                </div>
                <div class="stat-info">
                    <h3>Active Universes</h3>
                    <div class="stat-value"><?php echo number_format($stats['total_universes']); ?></div>
                    <div class="stat-change">Worlds & lore hubs</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon studios">
                    <i class="fas fa-building"></i>
                </div>
                <div class="stat-info">
                    <h3>Studios</h3>
                    <div class="stat-value"><?php echo number_format($stats['total_studios']); ?></div>
                    <div class="stat-change">Active studio profiles</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon series">
                    <i class="fas fa-clapperboard"></i>
                </div>
                <div class="stat-info">
                    <h3>Total Series</h3>
                    <div class="stat-value"><?php echo number_format($stats['total_series']); ?></div>
                    <div class="stat-change">Series in pipeline</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon stories">
                    <i class="fas fa-film"></i>
                </div>
                <div class="stat-info">
                    <h3>Total Stories</h3>
                    <div class="stat-value"><?php echo number_format($stats['total_stories']); ?></div>
                    <div class="stat-change">Films & scripts</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon codex">
                    <i class="fas fa-scroll"></i>
                </div>
                <div class="stat-info">
                    <h3>Codex Entries</h3>
                    <div class="stat-value"><?php echo number_format($stats['total_codex_entries']); ?></div>
                    <div class="stat-change">Lore artifacts</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon talent">
                    <i class="fas fa-microphone"></i>
                </div>
                <div class="stat-info">
                    <h3>Talent Profiles</h3>
                    <div class="stat-value"><?php echo number_format($stats['total_talent']); ?></div>
                    <div class="stat-change">Casting directory</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon media">
                    <i class="fas fa-photo-video"></i>
                </div>
                <div class="stat-info">
                    <h3>Public Media</h3>
                    <div class="stat-value"><?php echo number_format($stats['total_media']); ?></div>
                    <div class="stat-change">Clips + trailers + screenshots</div>
                </div>
            </div>
        </div>

        <!-- Analytics Charts -->
        <div class="analytics-grid">
            <div class="chart-card full-width">
                <h3>User Activity Over Time</h3>
                <canvas id="userActivityChart"></canvas>
            </div>
            
            <div class="chart-card">
                <h3>Content Distribution</h3>
                <canvas id="contentDistributionChart"></canvas>
            </div>
            
            <div class="chart-card">
                <h3>Popular Genres</h3>
                <canvas id="genreDistributionChart"></canvas>
            </div>
        </div>

        <!-- Recent Activity -->
        <div class="activity-section">
            <h2>Recent Activity</h2>
            <div class="activity-list">
                <?php foreach ($recent_activity as $activity): ?>
                <div class="activity-item">
                    <div class="activity-icon <?php echo $activity['type']; ?>">
                        <i class="fas fa-<?php echo getActivityIcon($activity['type']); ?>"></i>
                    </div>
                    <div class="activity-details">
                        <div class="activity-title"><?php echo htmlspecialchars($activity['title']); ?></div>
                        <div class="activity-meta">
                            <span class="activity-type"><?php echo ucfirst($activity['type']); ?></span>
                            <span class="activity-time"><?php echo timeAgo($activity['created_at']); ?></span>
                        </div>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
    </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="js/admin/analytics.js"></script>

<?php
function getActivityIcon($type) {
    $icons = [
        'story' => 'book',
        'series' => 'books',
        'universe' => 'globe'
    ];
    return $icons[$type] ?? 'circle';
}

function timeAgo($datetime) {
    $time = strtotime($datetime);
    $diff = time() - $time;
    
    if ($diff < 60) {
        return 'just now';
    } elseif ($diff < 3600) {
        return floor($diff/60) . ' minutes ago';
    } elseif ($diff < 86400) {
        return floor($diff/3600) . ' hours ago';
    } else {
        return floor($diff/86400) . ' days ago';
    }
}
?> 
