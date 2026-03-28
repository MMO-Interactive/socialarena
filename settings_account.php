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

    switch ($action) {
        case 'update_email':
            $new_email = $_POST['new_email'] ?? '';
            $password = $_POST['current_password'] ?? '';

            if (empty($new_email) || empty($password)) {
                $error = 'Please fill in all fields';
            } elseif (!filter_var($new_email, FILTER_VALIDATE_EMAIL)) {
                $error = 'Please enter a valid email address';
            } else {
                $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
                $stmt->execute([$_SESSION['user_id']]);
                $user_data = $stmt->fetch();

                if (password_verify($password, $user_data['password_hash'])) {
                    try {
                        $stmt = $pdo->prepare("UPDATE users SET email = ? WHERE id = ?");
                        $stmt->execute([$new_email, $_SESSION['user_id']]);
                        $success = 'Email updated successfully';
                        $user['email'] = $new_email;
                    } catch (PDOException $e) {
                        $error = 'Failed to update email. It might already be in use.';
                    }
                } else {
                    $error = 'Incorrect password';
                }
            }
            break;

        case 'change_password':
            $current_password = $_POST['current_password'] ?? '';
            $new_password = $_POST['new_password'] ?? '';
            $confirm_password = $_POST['confirm_password'] ?? '';

            if (empty($current_password) || empty($new_password) || empty($confirm_password)) {
                $error = 'Please fill in all password fields';
            } elseif ($new_password !== $confirm_password) {
                $error = 'New passwords do not match';
            } elseif (strlen($new_password) < 6) {
                $error = 'New password must be at least 6 characters long';
            } else {
                $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
                $stmt->execute([$_SESSION['user_id']]);
                $user_data = $stmt->fetch();

                if (password_verify($current_password, $user_data['password_hash'])) {
                    $new_password_hash = password_hash($new_password, PASSWORD_DEFAULT);
                    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
                    $stmt->execute([$new_password_hash, $_SESSION['user_id']]);
                    $success = 'Password changed successfully';
                } else {
                    $error = 'Current password is incorrect';
                }
            }
            break;
    }
}
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo htmlspecialchars($theme); ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Settings - Account</title>
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
                    <?php $settings_section = 'account'; include 'includes/settings_nav.php'; ?>

                    <section class="settings-content">
                        <div class="settings-header">
                            <h2>Account</h2>
                            <p>Manage your login, profile, and security settings.</p>
                        </div>

                        <?php if ($error): ?>
                            <div class="error-message"><?php echo htmlspecialchars($error); ?></div>
                        <?php endif; ?>
                        <?php if ($success): ?>
                            <div class="success-message"><?php echo htmlspecialchars($success); ?></div>
                        <?php endif; ?>

                        <div class="settings-grid">
                            <div class="settings-column">
                                <div class="settings-section">
                                    <h3>Account Information</h3>
                                    <p><strong>Username:</strong> <?php echo htmlspecialchars($user['username']); ?></p>
                                    <p><strong>Email:</strong> <?php echo htmlspecialchars($user['email']); ?></p>
                                    <p><strong>Member since:</strong> <?php echo date('F j, Y', strtotime($user['created_at'])); ?></p>
                                    <a href="edit_profile.php" class="btn">Edit Profile</a>
                                </div>
                            </div>

                            <div class="settings-column">
                                <div class="settings-section">
                                    <h3>Update Email</h3>
                                    <form method="POST" class="settings-form">
                                        <input type="hidden" name="action" value="update_email">
                                        <div class="form-group">
                                            <label for="new_email">New Email</label>
                                            <input type="email" id="new_email" name="new_email" required>
                                        </div>
                                        <div class="form-group">
                                            <label for="email_current_password">Current Password</label>
                                            <input type="password" id="email_current_password" name="current_password" required>
                                        </div>
                                        <button type="submit" class="btn">Update Email</button>
                                    </form>
                                </div>

                                <div class="settings-section">
                                    <h3>Change Password</h3>
                                    <form method="POST" class="settings-form">
                                        <input type="hidden" name="action" value="change_password">
                                        <div class="form-group">
                                            <label for="current_password">Current Password</label>
                                            <input type="password" id="current_password" name="current_password" required>
                                        </div>
                                        <div class="form-group">
                                            <label for="new_password">New Password</label>
                                            <input type="password" id="new_password" name="new_password" required minlength="6">
                                        </div>
                                        <div class="form-group">
                                            <label for="confirm_password">Confirm New Password</label>
                                            <input type="password" id="confirm_password" name="confirm_password" required>
                                        </div>
                                        <button type="submit" class="btn">Change Password</button>
                                    </form>
                                </div>
                            </div>
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
