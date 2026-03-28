<?php
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$theme = $_SESSION['theme'] ?? 'light';

$stmt = $pdo->prepare("
    SELECT u.id, u.username, u.profile_photo
    FROM user_follows f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = ?
    ORDER BY u.username
");
$stmt->execute([$_SESSION['user_id']]);
$following = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Following - Choose Your Own Adventure</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div class="page-wrapper">
        <header class="site-header">
            <h1>Choose Your Own Adventure</h1>
        </header>

        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>

            <main class="main-content">
                <h2>Following</h2>

                <?php if (empty($following)): ?>
                    <p>You are not following anyone yet.</p>
                <?php else: ?>
                    <div class="story-grid">
                        <?php foreach ($following as $user): ?>
                            <div class="story-card">
                                <div class="story-thumbnail">
                                    <img src="<?php echo htmlspecialchars($user['profile_photo'] ?? 'images/default-avatar.svg'); ?>" alt="Profile photo">
                                </div>
                                <div class="story-info">
                                    <h4><?php echo htmlspecialchars($user['username']); ?></h4>
                                    <div class="story-actions">
                                        <a href="profile.php?id=<?php echo $user['id']; ?>" class="btn">View Profile</a>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </main>
        </div>

        <?php include 'includes/footer.php'; ?>
    </div>
</body>
</html>
