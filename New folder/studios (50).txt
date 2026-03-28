<?php
require_once 'includes/db_connect.php';
require_once 'includes/paypal.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

$subscriptionId = $_GET['subscription_id'] ?? ($_GET['ba_token'] ?? null);
$message = 'Subscription completed.';

if ($subscriptionId && isset($_SESSION['user_id'])) {
    $response = paypalApiRequest($pdo, 'GET', '/v1/billing/subscriptions/' . urlencode($subscriptionId));
    if ($response['success']) {
        $data = $response['data'];
        $status = strtolower($data['status'] ?? 'active');
        $periodEnd = null;
        if (!empty($data['billing_info']['next_billing_time'])) {
            $periodEnd = date('Y-m-d H:i:s', strtotime($data['billing_info']['next_billing_time']));
        }
        $update = $pdo->prepare("UPDATE user_subscriptions SET status = ?, current_period_end = ?, started_at = NOW() WHERE provider_subscription_id = ? AND user_id = ?");
        $update->execute([$status, $periodEnd, $subscriptionId, $_SESSION['user_id']]);
    } else {
        $message = 'Subscription approved but could not verify status yet.';
    }
} else {
    $message = 'Subscription approved. Please log in to view your status.';
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Subscription Status</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/public_header.php'; ?>
        <main class="main-content">
            <div class="card">
                <h2>Subscription Update</h2>
                <p><?php echo htmlspecialchars($message); ?></p>
                <a href="dashboard.php" class="btn">Go to Dashboard</a>
            </div>
        </main>
    </div>
</body>
</html>
