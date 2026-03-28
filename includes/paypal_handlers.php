<?php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/paypal.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

if ($action === 'create_subscription') {
    $planId = (int)($input['plan_id'] ?? 0);
    $interval = $input['interval'] ?? 'month';
    if (!$planId || !in_array($interval, ['month', 'year'], true)) {
        echo json_encode(['success' => false, 'error' => 'Invalid plan']);
        exit;
    }

    $planStmt = $pdo->prepare("SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1");
    $planStmt->execute([$planId]);
    $plan = $planStmt->fetch(PDO::FETCH_ASSOC);
    if (!$plan) {
        echo json_encode(['success' => false, 'error' => 'Plan not found']);
        exit;
    }

    $paypalPlanId = $interval === 'year' ? $plan['paypal_plan_id_yearly'] : $plan['paypal_plan_id_monthly'];
    if (empty($paypalPlanId)) {
        echo json_encode(['success' => false, 'error' => 'PayPal plan ID not configured']);
        exit;
    }

    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $baseUrl = $scheme . '://' . $host;

    $payload = [
        'plan_id' => $paypalPlanId,
        'application_context' => [
            'return_url' => $baseUrl . '/paypal_return.php',
            'cancel_url' => $baseUrl . '/paypal_cancel.php',
            'user_action' => 'SUBSCRIBE_NOW'
        ],
        'custom_id' => (string)$_SESSION['user_id']
    ];

    $response = paypalApiRequest($pdo, 'POST', '/v1/billing/subscriptions', $payload);
    if (!$response['success']) {
        echo json_encode(['success' => false, 'error' => $response['error'] ?? 'PayPal error']);
        exit;
    }

    $subscription = $response['data'];
    $subscriptionId = $subscription['id'] ?? null;
    $approvalUrl = '';
    foreach ($subscription['links'] ?? [] as $link) {
        if (($link['rel'] ?? '') === 'approve') {
            $approvalUrl = $link['href'];
            break;
        }
    }

    if ($subscriptionId) {
    $insert = $pdo->prepare("INSERT INTO user_subscriptions (user_id, plan_id, provider, status, billing_interval, provider_subscription_id, started_at)
                                 VALUES (?, ?, 'paypal', 'created', ?, ?, NOW())
                                 ON DUPLICATE KEY UPDATE status = 'created', billing_interval = VALUES(billing_interval), provider_subscription_id = VALUES(provider_subscription_id), updated_at = NOW()");
        $insert->execute([$_SESSION['user_id'], $planId, $interval, $subscriptionId]);
    }

    echo json_encode(['success' => true, 'approval_url' => $approvalUrl, 'subscription_id' => $subscriptionId]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action']);
