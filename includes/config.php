<?php
require_once 'KeyManager.php';

$keyManager = new KeyManager($pdo);

function appEnv(string $key, string $default = ''): string {
    $value = getenv($key);
    if ($value === false) {
        return $default;
    }
    $value = trim((string) $value);
    return $value === '' ? $default : $value;
}

function getOpenAIKey() {
    global $keyManager;
    return $keyManager->getKey('openai');
}

define('USE_LMSTUDIO', filter_var(appEnv('USE_LMSTUDIO', 'true'), FILTER_VALIDATE_BOOLEAN));
define('LMSTUDIO_API_URL', appEnv('LMSTUDIO_API_URL', 'http://127.0.0.1:1234/v1/chat/completions'));
define('LMSTUDIO_MODEL', appEnv('LMSTUDIO_MODEL', 'lm DarkIdol-Llama-3.1-8B-Instruct-1.2-Uncensored.Q4_0.gguf'));
define('COMFYUI_BASE_URL', appEnv('COMFYUI_BASE_URL', ''));
define('APP_ENV', appEnv('APP_ENV', 'local'));
define('CRON_TOKEN', appEnv('CRON_TOKEN', 'change-this-token'));
define('RUNPOD_API_KEY', appEnv('RUNPOD_API_KEY', ''));

if (APP_ENV === 'production') {
    error_reporting(E_ALL);
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    ini_set('error_log', __DIR__ . '/../logs/php_errors.log');
}

// Session hardening (only before session starts)
if (session_status() !== PHP_SESSION_ACTIVE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.cookie_samesite', 'Lax');
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        ini_set('session.cookie_secure', 1);
    }
}

// Security headers for browser requests
if (PHP_SAPI !== 'cli' && !headers_sent()) {
    header('X-Frame-Options: SAMEORIGIN');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
}
?>
