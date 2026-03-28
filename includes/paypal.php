<?php
require_once __DIR__ . '/db_connect.php';

function paypalGetSettings(PDO $pdo): ?array {
    $stmt = $pdo->query("SELECT * FROM paypal_settings ORDER BY id DESC LIMIT 1");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || empty($row['client_id']) || empty($row['client_secret'])) {
        return null;
    }
    return $row;
}

function paypalBaseUrl(array $settings): string {
    return $settings['mode'] === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
}

function paypalGetAccessToken(PDO $pdo): ?string {
    $settings = paypalGetSettings($pdo);
    if (!$settings || empty($settings['is_enabled'])) {
        return null;
    }
    $url = paypalBaseUrl($settings) . '/v1/oauth2/token';
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, $settings['client_id'] . ':' . $settings['client_secret']);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, 'grant_type=client_credentials');
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);
    $response = curl_exec($ch);
    if ($response === false) {
        curl_close($ch);
        return null;
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($status >= 400) {
        return null;
    }
    $data = json_decode($response, true);
    return $data['access_token'] ?? null;
}

function paypalApiRequest(PDO $pdo, string $method, string $path, array $payload = null): array {
    $settings = paypalGetSettings($pdo);
    if (!$settings) {
        return ['success' => false, 'error' => 'PayPal settings not configured'];
    }
    $token = paypalGetAccessToken($pdo);
    if (!$token) {
        return ['success' => false, 'error' => 'PayPal authentication failed'];
    }
    $url = paypalBaseUrl($settings) . $path;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $token,
        'Accept: application/json'
    ];
    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $response = curl_exec($ch);
    if ($response === false) {
        $error = curl_error($ch);
        curl_close($ch);
        return ['success' => false, 'error' => $error];
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode($response, true);
    if ($status >= 400) {
        return ['success' => false, 'status' => $status, 'error' => $data ?: $response];
    }
    return ['success' => true, 'data' => $data];
}

function paypalVerifyWebhook(PDO $pdo, array $headers, array $body): bool {
    $settings = paypalGetSettings($pdo);
    if (!$settings || empty($settings['webhook_id'])) {
        return false;
    }
    $payload = [
        'auth_algo' => $headers['paypal-auth-algo'] ?? '',
        'cert_url' => $headers['paypal-cert-url'] ?? '',
        'transmission_id' => $headers['paypal-transmission-id'] ?? '',
        'transmission_sig' => $headers['paypal-transmission-sig'] ?? '',
        'transmission_time' => $headers['paypal-transmission-time'] ?? '',
        'webhook_id' => $settings['webhook_id'],
        'webhook_event' => $body
    ];
    $response = paypalApiRequest($pdo, 'POST', '/v1/notifications/verify-webhook-signature', $payload);
    if (!$response['success']) {
        return false;
    }
    return ($response['data']['verification_status'] ?? '') === 'SUCCESS';
}
