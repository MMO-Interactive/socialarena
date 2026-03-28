<?php
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$plansStmt = $pdo->query("SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order ASC");
$plans = $plansStmt->fetchAll(PDO::FETCH_ASSOC);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Subscriptions - SocialArena.org</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/public_header.css">
    <link rel="stylesheet" href="css/subscriptions.css">
</head>
<body>
    <?php include 'includes/public_header.php'; ?>
    <main class="main-content">
        <section class="subscription-hero">
            <h1>Studio Subscriptions</h1>
            <p>Unlock the full SocialArena.org studio stack with flexible monthly or yearly plans.</p>
        </section>

        <section class="subscription-grid">
            <?php foreach ($plans as $plan): ?>
                <article class="subscription-card">
                    <h2><?php echo htmlspecialchars($plan['name']); ?></h2>
                    <p class="sub-desc"><?php echo htmlspecialchars($plan['description'] ?? ''); ?></p>
                    <div class="sub-pricing">
                        <div>
                            <span class="price">$<?php echo number_format((float)$plan['price_monthly'], 2); ?></span>
                            <span class="interval">/ month</span>
                        </div>
                        <div class="price-alt">$<?php echo number_format((float)$plan['price_yearly'], 2); ?> / year</div>
                    </div>
                    <?php
                    $features = [];
                    if (!empty($plan['features'])) {
                        $decoded = json_decode($plan['features'], true);
                        if (is_array($decoded)) {
                            $features = $decoded;
                        }
                    }
                    ?>
                    <?php if ($features): ?>
                        <ul class="sub-features">
                            <?php foreach ($features as $feature): ?>
                                <li><?php echo htmlspecialchars($feature); ?></li>
                            <?php endforeach; ?>
                        </ul>
                    <?php endif; ?>
                    <div class="sub-actions">
                        <button class="btn" data-plan="<?php echo (int)$plan['id']; ?>" data-interval="month">Subscribe Monthly</button>
                        <button class="btn btn-secondary" data-plan="<?php echo (int)$plan['id']; ?>" data-interval="year">Subscribe Yearly</button>
                    </div>
                </article>
            <?php endforeach; ?>
        </section>
    </main>

    <script>
        document.querySelectorAll('[data-plan]').forEach(button => {
            button.addEventListener('click', async () => {
                const planId = button.getAttribute('data-plan');
                const interval = button.getAttribute('data-interval');
                button.disabled = true;
                try {
                    const response = await fetch('includes/paypal_handlers.php', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'create_subscription', plan_id: planId, interval })
                    });
                    const data = await response.json();
                    if (!data.success) {
                        alert(data.error || 'Unable to start subscription.');
                        return;
                    }
                    if (data.approval_url) {
                        window.location.href = data.approval_url;
                    } else {
                        alert('PayPal approval link missing.');
                    }
                } catch (err) {
                    alert('Subscription request failed.');
                } finally {
                    button.disabled = false;
                }
            });
        });
    </script>
</body>
</html>
