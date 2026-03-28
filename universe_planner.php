<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$theme = $_SESSION['theme'] ?? 'light';
$universe_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
?>
<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Universe Planner - Choose Your Own Adventure</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>

        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>

            <main class="main-content">
                <h1>Universe Planner</h1>
                <p>Universe planning tools are not available yet.</p>
                <?php if ($universe_id): ?>
                    <a href="universe.php?id=<?php echo $universe_id; ?>" class="btn">Back to Universe</a>
                <?php else: ?>
                    <a href="writing_center.php" class="btn">Back to Writing Center</a>
                <?php endif; ?>
            </main>
        </div>

        <?php include 'includes/footer.php'; ?>
    </div>
</body>
</html>
