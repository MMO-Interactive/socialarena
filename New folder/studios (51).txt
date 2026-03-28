<?php
require_once 'includes/db_connect.php';
require_once 'includes/paypal.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true) ?: [];
$headers = [];
foreach ($_SERVER as $key => $value) {
    if (str_starts_with($key, 'HTTP_PAYPAL_')) {
        $headerKey = strtolower(str_replace('HTTP_PAYPAL_', 'paypal-', $key));
        $headerKey = str_replace('_', '-', $headerKey);
        $headers[$headerKey] = $value;
    }
}

$verified = paypalVerifyWebhook($pdo, $headers, $payload);
if (!$verified) {
    http_response_code(400);
    echo 'Webhook verification failed';
    exit;
}

$eventId = $payload['id'] ?? null;
$eventType = $payload['event_type'] ?? 'unknown';

if ($eventId) {
    $eventStmt = $pdo->prepare("INSERT IGNORE INTO subscription_events (provider, event_type, event_id, payload) VALUES ('paypal', ?, ?, ?)");
    $eventStmt->execute([$eventType, $eventId, json_encode($payload)]);
}

$resource = $payload['resource'] ?? [];
$subscriptionId = $resource['id'] ?? null;
if ($subscriptionId) {
    $status = strtolower($resource['status'] ?? 'active');
    $periodEnd = null;
    if (!empty($resource['billing_info']['next_billing_time'])) {
        $periodEnd = date('Y-m-d H:i:s', strtotime($resource['billing_info']['next_billing_time']));
    }
    $update = $pdo->prepare("UPDATE user_subscriptions SET status = ?, current_period_end = ?, updated_at = NOW() WHERE provider_subscription_id = ?");
    $update->execute([$status, $periodEnd, $subscriptionId]);
}

http_response_code(200);
echo 'OK';
