<?php
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


$theme = 'light';
$profile_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if (!$profile_id) {
    header('Location: talent_scout.php');
    exit;
}

$stmt = $pdo->prepare("
    SELECT tp.*, GROUP_CONCAT(tr.name ORDER BY tr.name SEPARATOR ', ') AS roles
    FROM talent_profiles tp
    LEFT JOIN talent_profile_roles tpr ON tp.id = tpr.profile_id
    LEFT JOIN talent_roles tr ON tpr.role_id = tr.id
    WHERE tp.id = ? AND tp.is_public = 1
    GROUP BY tp.id
");
$stmt->execute([$profile_id]);
$profile = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$profile) {
    header('Location: talent_scout.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM talent_portfolio_items WHERE profile_id = ? ORDER BY created_at DESC");
$stmt->execute([$profile_id]);
$portfolioItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

$showContact = !empty($_SESSION['user_id']);
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($profile['display_name']); ?> | Talent</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/talent.css">
    <link rel="stylesheet" href="css/public_header.css">
</head>
<body class="talent-page">
    <?php include 'includes/public_header.php'; ?>

    <main class="talent-main">
        <section class="talent-profile-hero">
            <div class="talent-banner">
                <?php if (!empty($profile['banner_url'])): ?>
                    <img src="<?php echo htmlspecialchars($profile['banner_url']); ?>" alt="">
                <?php else: ?>
                    <div class="talent-banner placeholder"></div>
                <?php endif; ?>
            </div>
            <div class="talent-profile-card">
                <div class="talent-profile-identity">
                    <?php if (!empty($profile['avatar_url'])): ?>
                        <img src="<?php echo htmlspecialchars($profile['avatar_url']); ?>" alt="">
                    <?php else: ?>
                        <div class="talent-avatar"><?php echo strtoupper(substr($profile['display_name'], 0, 1)); ?></div>
                    <?php endif; ?>
                    <div>
                        <h1><?php echo htmlspecialchars($profile['display_name']); ?></h1>
                        <span><?php echo htmlspecialchars($profile['headline'] ?? ''); ?></span>
                        <div class="talent-role-line"><?php echo htmlspecialchars($profile['roles'] ?? ''); ?></div>
                    </div>
                </div>
                <div class="talent-profile-meta">
                    <span class="pill"><?php echo htmlspecialchars($profile['availability'] ?? 'available'); ?></span>
                    <?php if (!empty($profile['location'])): ?>
                        <span><?php echo htmlspecialchars($profile['location']); ?></span>
                    <?php endif; ?>
                    <?php if (!empty($profile['website'])): ?>
                        <a href="<?php echo htmlspecialchars($profile['website']); ?>" target="_blank">Portfolio</a>
                    <?php endif; ?>
                </div>
            </div>
        </section>

        <section class="talent-profile-grid">
            <div class="talent-profile-section">
                <h3>About</h3>
                <p><?php echo nl2br(htmlspecialchars($profile['bio'] ?? '')); ?></p>
            </div>
            <div class="talent-profile-section">
                <h3>Contact</h3>
                <?php if ($showContact): ?>
                    <?php if (!empty($profile['contact_email'])): ?>
                        <p>Email: <?php echo htmlspecialchars($profile['contact_email']); ?></p>
                    <?php else: ?>
                        <p>No contact email listed.</p>
                    <?php endif; ?>
                <?php else: ?>
                    <p class="muted">Login to see contact details.</p>
                    <a class="btn" href="login.php">Login</a>
                <?php endif; ?>
            </div>
            <div class="talent-profile-section">
                <h3>Portfolio</h3>
                <?php if (empty($portfolioItems)): ?>
                    <p class="muted">No portfolio items yet.</p>
                <?php else: ?>
                    <div class="portfolio-list">
                        <?php foreach ($portfolioItems as $item): ?>
                            <div class="portfolio-item">
                                <div>
                                    <strong><?php echo htmlspecialchars($item['title']); ?></strong>
                                    <?php if (!empty($item['description'])): ?>
                                        <p><?php echo htmlspecialchars($item['description']); ?></p>
                                    <?php endif; ?>
                                    <?php if ($item['item_type'] === 'audio'): ?>
                                        <audio controls>
                                            <source src="talent_audio_stream.php?file=<?php echo urlencode($item['item_url']); ?>">
                                        </audio>
                                    <?php elseif ($item['item_type'] === 'image'): ?>
                                        <img class="portfolio-image" src="<?php echo htmlspecialchars($item['item_url']); ?>" alt="">
                                    <?php elseif ($item['item_type'] === 'file'): ?>
                                        <a href="talent_file_download.php?file=<?php echo urlencode($item['item_url']); ?>" target="_blank">
                                            Download <?php echo htmlspecialchars($item['file_name'] ?? 'file'); ?>
                                        </a>
                                    <?php else: ?>
                                        <a href="<?php echo htmlspecialchars($item['item_url']); ?>" target="_blank">Open link</a>
                                    <?php endif; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>
        </section>
    </main>
</body>
</html>

