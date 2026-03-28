<?php
$session_started = session_status() === PHP_SESSION_ACTIVE;
if (!$session_started) {
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    if (PHP_VERSION_ID >= 70300 && !headers_sent()) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
    }

    $session_dir = __DIR__ . '/../sessions';
    if (!is_dir($session_dir)) {
        @mkdir($session_dir, 0777, true);
    }
    if (is_dir($session_dir) && is_writable($session_dir)) {
        session_save_path($session_dir);
    }

    ini_set('session.gc_maxlifetime', '86400');
    ini_set('session.cookie_lifetime', '0');

    ini_set('log_errors', '1');
    $log_dir = __DIR__ . '/../logs';
    if (!is_dir($log_dir)) {
        @mkdir($log_dir, 0777, true);
    }
    if (is_dir($log_dir) && is_writable($log_dir)) {
        ini_set('error_log', $log_dir . '/php_errors.log');
    }

    if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

}
?>
