<?php
$settings_section = $settings_section ?? 'account';
?>
<nav class="settings-nav">
    <h3>Settings</h3>
    <ul>
        <li><a href="settings_account.php" class="<?php echo $settings_section === 'account' ? 'active' : ''; ?>">Account</a></li>
        <li><a href="settings_appearance.php" class="<?php echo $settings_section === 'appearance' ? 'active' : ''; ?>">Appearance</a></li>
        <li><a href="settings_integrations.php" class="<?php echo $settings_section === 'integrations' ? 'active' : ''; ?>">Integrations</a></li>
    </ul>
</nav>
