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

$defaults = [
    'image' => ['base_url' => '', 'api_key' => '', 'is_enabled' => 1],
    'audio' => ['base_url' => '', 'api_key' => '', 'is_enabled' => 0],
    'video' => ['base_url' => '', 'api_key' => '', 'is_enabled' => 0],
];

$connections = $defaults;
$stmt = $pdo->prepare("SELECT connection_type, base_url, api_key, is_enabled FROM user_comfy_connections WHERE user_id = ?");
$stmt->execute([$_SESSION['user_id']]);
foreach ($stmt->fetchAll() as $row) {
    $connections[$row['connection_type']] = [
        'base_url' => $row['base_url'],
        'api_key' => $row['api_key'] ?? '',
        'is_enabled' => (int)$row['is_enabled'],
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if ($action === 'save_connections') {
        $payload = $_POST['comfy'] ?? [];
        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("
                INSERT INTO user_comfy_connections (user_id, connection_type, base_url, api_key, is_enabled)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE base_url = VALUES(base_url), api_key = VALUES(api_key), is_enabled = VALUES(is_enabled)
            ");
            foreach (['image', 'audio', 'video'] as $type) {
                $base = trim($payload[$type]['base_url'] ?? '');
                $api_key = trim($payload[$type]['api_key'] ?? '');
                $enabled = isset($payload[$type]['is_enabled']) ? 1 : 0;
                if ($base === '') {
                    continue;
                }
                $stmt->execute([$_SESSION['user_id'], $type, $base, $api_key !== '' ? $api_key : null, $enabled]);
            }
            $pdo->commit();
            $success = 'Connection settings saved.';
        } catch (PDOException $e) {
            $pdo->rollBack();
            $error = 'Failed to save connection settings.';
        }
    }
}
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo htmlspecialchars($theme); ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Settings - Integrations</title>
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
                    <?php $settings_section = 'integrations'; include 'includes/settings_nav.php'; ?>

                    <section class="settings-content">
                        <div class="settings-header">
                            <h2>Integrations</h2>
                            <p>Configure your ComfyUI connections for image, audio, and video generation.</p>
                        </div>

                        <?php if ($error): ?>
                            <div class="error-message"><?php echo htmlspecialchars($error); ?></div>
                        <?php endif; ?>
                        <?php if ($success): ?>
                            <div class="success-message"><?php echo htmlspecialchars($success); ?></div>
                        <?php endif; ?>

                        <form method="POST" class="settings-form">
                            <input type="hidden" name="action" value="save_connections">

                            <div class="settings-section">
                                <div class="settings-section-header">
                                    <h3>ComfyUI - Image</h3>
                                    <button class="btn btn-secondary btn-small" type="button" data-test-type="image">Test Connection</button>
                                    <span class="status-pill status-muted" id="status-image">Not tested</span>
                                </div>
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label for="image_base">Base URL</label>
                                        <input type="text" id="image_base" name="comfy[image][base_url]" value="<?php echo htmlspecialchars($connections['image']['base_url']); ?>" placeholder="https://your-comfyui-host">
                                    </div>
                                    <div class="form-group">
                                        <label for="image_key">API Key (optional)</label>
                                        <input type="text" id="image_key" name="comfy[image][api_key]" value="<?php echo htmlspecialchars($connections['image']['api_key']); ?>">
                                    </div>
                                    <div class="form-group checkbox-group">
                                        <label>
                                            <input type="checkbox" name="comfy[image][is_enabled]" <?php echo $connections['image']['is_enabled'] ? 'checked' : ''; ?>>
                                            Enable image connection
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div class="settings-section">
                                <div class="settings-section-header">
                                    <h3>ComfyUI - Audio</h3>
                                    <button class="btn btn-secondary btn-small" type="button" data-test-type="audio">Test Connection</button>
                                    <span class="status-pill status-muted" id="status-audio">Not tested</span>
                                </div>
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label for="audio_base">Base URL</label>
                                        <input type="text" id="audio_base" name="comfy[audio][base_url]" value="<?php echo htmlspecialchars($connections['audio']['base_url']); ?>" placeholder="https://your-comfyui-host">
                                    </div>
                                    <div class="form-group">
                                        <label for="audio_key">API Key (optional)</label>
                                        <input type="text" id="audio_key" name="comfy[audio][api_key]" value="<?php echo htmlspecialchars($connections['audio']['api_key']); ?>">
                                    </div>
                                    <div class="form-group checkbox-group">
                                        <label>
                                            <input type="checkbox" name="comfy[audio][is_enabled]" <?php echo $connections['audio']['is_enabled'] ? 'checked' : ''; ?>>
                                            Enable audio connection
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div class="settings-section">
                                <div class="settings-section-header">
                                    <h3>ComfyUI - Video</h3>
                                    <button class="btn btn-secondary btn-small" type="button" data-test-type="video">Test Connection</button>
                                    <span class="status-pill status-muted" id="status-video">Not tested</span>
                                </div>
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label for="video_base">Base URL</label>
                                        <input type="text" id="video_base" name="comfy[video][base_url]" value="<?php echo htmlspecialchars($connections['video']['base_url']); ?>" placeholder="https://your-comfyui-host">
                                    </div>
                                    <div class="form-group">
                                        <label for="video_key">API Key (optional)</label>
                                        <input type="text" id="video_key" name="comfy[video][api_key]" value="<?php echo htmlspecialchars($connections['video']['api_key']); ?>">
                                    </div>
                                    <div class="form-group checkbox-group">
                                        <label>
                                            <input type="checkbox" name="comfy[video][is_enabled]" <?php echo $connections['video']['is_enabled'] ? 'checked' : ''; ?>>
                                            Enable video connection
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div class="settings-actions">
                                <button type="submit" class="btn">Save Settings</button>
                            </div>
                        </form>
                    </section>
                </div>
            </main>
        </div>

        <footer class="site-footer">
            <p>&copy; <?php echo date('Y'); ?> SocialArena.org - AI Film Studio</p>
        </footer>
    </div>

    <script>
        document.querySelectorAll('[data-test-type]').forEach((button) => {
            button.addEventListener('click', async () => {
                const type = button.getAttribute('data-test-type');
                const statusEl = document.getElementById(`status-${type}`);
                statusEl.textContent = 'Checking...';
                statusEl.className = 'status-pill status-muted';
                try {
                    const response = await fetch(`includes/comfyui_handlers.php?action=status&type=${type}`);
                    const data = await response.json();
                    if (data.success) {
                        statusEl.textContent = 'Connected';
                        statusEl.className = 'status-pill status-good';
                    } else {
                        statusEl.textContent = 'Offline';
                        if (data.error || data.url) {
                            const details = [];
                            if (data.url) details.push(`URL: ${data.url}`);
                            if (data.error) details.push(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
                            statusEl.setAttribute('title', details.join(' | '));
                        }
                        statusEl.className = 'status-pill status-bad';
                    }
                } catch (err) {
                    statusEl.textContent = 'Offline';
                    statusEl.setAttribute('title', err.message || 'Connection failed');
                    statusEl.className = 'status-pill status-bad';
                }
            });
        });
    </script>
</body>
</html>
