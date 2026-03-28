<?php
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$theme = $_SESSION['theme'] ?? 'dark';
$error = '';
$success = '';

$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if ($action === 'update_theme') {
        $theme = $_POST['theme'] ?? 'dark';
        if (in_array($theme, ['light', 'dark'], true)) {
            try {
                $stmt = $pdo->prepare("UPDATE users SET theme_preference = ? WHERE id = ?");
                $stmt->execute([$theme, $_SESSION['user_id']]);
                $_SESSION['theme'] = $theme;
                $success = 'Theme updated successfully';
                $user['theme_preference'] = $theme;
            } catch (PDOException $e) {
                $error = 'Failed to update theme';
            }
        }
    }
}

if (!isset($user['theme_preference'])) {
    $user['theme_preference'] = 'dark';
}
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo htmlspecialchars($theme); ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Settings - Appearance</title>
    <link rel="stylesheet" href="css/themes/<?php echo htmlspecialchars($theme); ?>.css">
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="page-wrapper">
        <header class="site-header">
            <h1>SocialArena.org</h1>
        </header>

        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>

            <main class="main-content">
                <div class="settings-shell">
                    <?php $settings_section = 'appearance'; include 'includes/settings_nav.php'; ?>

                    <section class="settings-content">
                        <div class="settings-header">
                            <h2>Appearance</h2>
                            <p>Customize the look and feel of your workspace.</p>
                        </div>

                        <?php if ($error): ?>
                            <div class="error-message"><?php echo htmlspecialchars($error); ?></div>
                        <?php endif; ?>
                        <?php if ($success): ?>
                            <div class="success-message"><?php echo htmlspecialchars($success); ?></div>
                        <?php endif; ?>

                        <div class="settings-section">
                            <h3>Theme</h3>
                            <form method="POST" class="settings-form">
                                <input type="hidden" name="action" value="update_theme">
                                <div class="form-group">
                                    <label for="theme">Interface Theme</label>
                                    <select id="theme" name="theme" onchange="this.form.submit()">
                                        <option value="light" <?php echo $user['theme_preference'] === 'light' ? 'selected' : ''; ?>>Light</option>
                                        <option value="dark" <?php echo $user['theme_preference'] === 'dark' ? 'selected' : ''; ?>>Dark</option>
                                    </select>
                                </div>
                            </form>
                        </div>
                    </section>
                </div>
            </main>
        </div>

        <footer class="site-footer">
            <p>&copy; <?php echo date('Y'); ?> SocialArena.org - AI Film Studio</p>
        </footer>
    </div>
</body>
</html>
