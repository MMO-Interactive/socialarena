<?php
require_once 'includes/db_connect.php';
require_once 'includes/KeyManager.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$keyManager = new KeyManager($pdo);
$error = '';
$success = '';

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $key_type = $_POST['key_type'] ?? '';
    $key_value = $_POST['key_value'] ?? '';

    if (empty($key_type) || empty($key_value)) {
        $error = 'Please fill in all fields';
    } else {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO user_api_keys (user_id, key_type, key_value) 
                VALUES (?, ?, ?) 
                ON DUPLICATE KEY UPDATE key_value = ?
            ");
            $encrypted_key = $keyManager->encryptKey($key_value);
            $stmt->execute([$_SESSION['user_id'], $key_type, $encrypted_key, $encrypted_key]);
            $success = 'API key saved successfully';
        } catch (Exception $e) {
            $error = 'Failed to save API key';
        }
    }
}

// Get user's current keys
$stmt = $pdo->prepare("SELECT key_type FROM user_api_keys WHERE user_id = ?");
$stmt->execute([$_SESSION['user_id']]);
$existing_keys = $stmt->fetchAll(PDO::FETCH_COLUMN);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manage API Keys</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="page-wrapper">
        <header class="site-header">
            <h1>Choose Your Own Adventure</h1>
        </header>

        <div class="content-wrapper">
            <nav class="side-nav">
                <div class="nav-section">
                    <h3>Navigation</h3>
                    <ul class="nav-list">
                        <li><a href="dashboard.php">Dashboard</a></li>
                        <li><a href="manage_keys.php" class="active">Manage API Keys</a></li>
                        <li class="nav-divider"></li>
                        <li><a href="logout.php">Logout</a></li>
                    </ul>
                </div>
            </nav>

            <main class="main-content">
                <div class="auth-container">
                    <h2>Manage Your API Keys</h2>
                    
                    <?php if ($error): ?>
                        <div class="error-message"><?php echo htmlspecialchars($error); ?></div>
                    <?php endif; ?>
                    
                    <?php if ($success): ?>
                        <div class="success-message"><?php echo htmlspecialchars($success); ?></div>
                    <?php endif; ?>

                    <div class="key-info">
                        <p>To use this service, you need to provide your own API keys:</p>
                        <ul>
                            <li>OpenRouter API key for story generation</li>
                            <li>OpenAI API key for image generation</li>
                        </ul>
                        <p>Get your keys from:</p>
                        <ul>
                            <li><a href="https://openrouter.ai/keys" target="_blank">OpenRouter</a></li>
                            <li><a href="https://platform.openai.com/api-keys" target="_blank">OpenAI</a></li>
                        </ul>
                    </div>

                    <form method="POST" class="auth-form">
                        <div class="form-group">
                            <label for="key_type">API Service:</label>
                            <select id="key_type" name="key_type" required>
                                <option value="">Select API Service</option>
                                <option value="openrouter">OpenRouter</option>
                                <option value="openai">OpenAI</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="key_value">API Key:</label>
                            <input type="password" id="key_value" name="key_value" required>
                        </div>

                        <button type="submit" class="btn">Save API Key</button>
                    </form>

                    <div class="current-keys">
                        <h3>Current API Keys</h3>
                        <ul>
                            <li>OpenRouter: <?php echo in_array('openrouter', $existing_keys) ? 'Set' : 'Not Set'; ?></li>
                            <li>OpenAI: <?php echo in_array('openai', $existing_keys) ? 'Set' : 'Not Set'; ?></li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>

        <footer class="site-footer">
            <p>&copy; <?php echo date('Y'); ?> Choose Your Own Adventure - AI Story Generator</p>
        </footer>
    </div>
</body>
</html> 
