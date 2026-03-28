<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Subscription Cancelled</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/public_header.php'; ?>
        <main class="main-content">
            <div class="card">
                <h2>Subscription Cancelled</h2>
                <p>Your PayPal subscription was cancelled. You can try again anytime.</p>
                <a href="subscribe.php" class="btn">View Plans</a>
            </div>
        </main>
    </div>
</body>
</html>
