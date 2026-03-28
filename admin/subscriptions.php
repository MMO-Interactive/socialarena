<?php
require_once '../includes/db_connect.php';
require_once '../includes/auth.php';
require_once 'includes/admin_auth.php';

$page_title = "Admin Subscriptions";
$additional_css = ['css/admin.css'];
$body_class = 'admin-page';

$success = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if ($action === 'save_paypal') {
        $mode = $_POST['mode'] ?? 'sandbox';
        $clientId = trim($_POST['client_id'] ?? '');
        $clientSecret = trim($_POST['client_secret'] ?? '');
        $webhookId = trim($_POST['webhook_id'] ?? '');
        $enabled = isset($_POST['is_enabled']) ? 1 : 0;
        if ($clientId === '' || $clientSecret === '') {
            $error = 'Client ID and Secret are required.';
        } else {
            $existing = $pdo->query("SELECT id FROM paypal_settings ORDER BY id DESC LIMIT 1")->fetchColumn();
            if ($existing) {
                $stmt = $pdo->prepare("UPDATE paypal_settings SET mode = ?, client_id = ?, client_secret = ?, webhook_id = ?, is_enabled = ? WHERE id = ?");
                $stmt->execute([$mode, $clientId, $clientSecret, $webhookId !== '' ? $webhookId : null, $enabled, $existing]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO paypal_settings (mode, client_id, client_secret, webhook_id, is_enabled)
                                       VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$mode, $clientId, $clientSecret, $webhookId !== '' ? $webhookId : null, $enabled]);
            }
            $success = 'PayPal settings saved.';
        }
    }

    if ($action === 'save_plans') {
        foreach ($_POST['plan'] ?? [] as $planId => $planData) {
            $monthly = trim($planData['paypal_plan_id_monthly'] ?? '');
            $yearly = trim($planData['paypal_plan_id_yearly'] ?? '');
            $active = isset($planData['is_active']) ? 1 : 0;
            $stmt = $pdo->prepare("UPDATE subscription_plans SET paypal_plan_id_monthly = ?, paypal_plan_id_yearly = ?, is_active = ? WHERE id = ?");
            $stmt->execute([$monthly !== '' ? $monthly : null, $yearly !== '' ? $yearly : null, $active, $planId]);
        }
        $success = 'Plans updated.';
    }
}

$settings = $pdo->query("SELECT * FROM paypal_settings ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
$plans = $pdo->query("SELECT * FROM subscription_plans ORDER BY sort_order ASC")->fetchAll(PDO::FETCH_ASSOC);

include '../includes/header.php';
?>

<div class="admin-wrapper">
    <?php include 'includes/admin_nav.php'; ?>
    <main class="admin-content">
        <div class="dashboard-header">
            <div>
                <h1>Subscriptions</h1>
                <p class="admin-subtitle">Manage PayPal credentials and plan mappings.</p>
            </div>
        </div>

        <?php if ($error): ?>
            <div class="error-message"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        <?php if ($success): ?>
            <div class="success-message"><?php echo htmlspecialchars($success); ?></div>
        <?php endif; ?>

        <section class="admin-card">
            <h2>PayPal Settings</h2>
            <form method="POST">
                <input type="hidden" name="action" value="save_paypal">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Mode</label>
                        <select name="mode">
                            <option value="sandbox" <?php echo ($settings['mode'] ?? 'sandbox') === 'sandbox' ? 'selected' : ''; ?>>Sandbox</option>
                            <option value="live" <?php echo ($settings['mode'] ?? 'sandbox') === 'live' ? 'selected' : ''; ?>>Live</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Client ID</label>
                        <input type="text" name="client_id" value="<?php echo htmlspecialchars($settings['client_id'] ?? ''); ?>">
                    </div>
                    <div class="form-group">
                        <label>Client Secret</label>
                        <input type="text" name="client_secret" value="<?php echo htmlspecialchars($settings['client_secret'] ?? ''); ?>">
                    </div>
                    <div class="form-group">
                        <label>Webhook ID</label>
                        <input type="text" name="webhook_id" value="<?php echo htmlspecialchars($settings['webhook_id'] ?? ''); ?>">
                    </div>
                    <div class="form-group checkbox-group">
                        <label>
                            <input type="checkbox" name="is_enabled" <?php echo !empty($settings['is_enabled']) ? 'checked' : ''; ?>>
                            Enable PayPal
                        </label>
                    </div>
                </div>
                <button class="btn" type="submit">Save PayPal Settings</button>
            </form>
        </section>

        <section class="admin-card">
            <h2>Subscription Plans</h2>
            <form method="POST">
                <input type="hidden" name="action" value="save_plans">
                <div class="admin-plan-grid">
                    <?php foreach ($plans as $plan): ?>
                        <div class="plan-card">
                            <h3><?php echo htmlspecialchars($plan['name']); ?></h3>
                            <p><?php echo htmlspecialchars($plan['description'] ?? ''); ?></p>
                            <div class="form-group">
                                <label>PayPal Plan ID (Monthly)</label>
                                <input type="text" name="plan[<?php echo (int)$plan['id']; ?>][paypal_plan_id_monthly]" value="<?php echo htmlspecialchars($plan['paypal_plan_id_monthly'] ?? ''); ?>">
                            </div>
                            <div class="form-group">
                                <label>PayPal Plan ID (Yearly)</label>
                                <input type="text" name="plan[<?php echo (int)$plan['id']; ?>][paypal_plan_id_yearly]" value="<?php echo htmlspecialchars($plan['paypal_plan_id_yearly'] ?? ''); ?>">
                            </div>
                            <div class="form-group checkbox-group">
                                <label>
                                    <input type="checkbox" name="plan[<?php echo (int)$plan['id']; ?>][is_active]" <?php echo !empty($plan['is_active']) ? 'checked' : ''; ?>>
                                    Active
                                </label>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
                <button class="btn" type="submit">Save Plans</button>
            </form>
        </section>
    </main>
</div>
