<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

$theme = $_SESSION['theme'] ?? 'light';
?>
<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forgot Password - Choose Your Own Adventure</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="page-wrapper">
        <header class="site-header">
            <h1>Choose Your Own Adventure</h1>
        </header>

        <div class="content-wrapper">
            <nav class="side-nav">
                <div class="nav-section">
                    <h3>Navigation</h3>
                    <ul class="nav-list">
                        <li><a href="index.php">Home</a></li>
                        <li><a href="login.php">Login</a></li>
                        <li><a href="register.php">Register</a></li>
                    </ul>
                </div>
            </nav>

            <main class="main-content">
                <h2>Forgot Password</h2>
                <p>Password recovery is not automated yet. Please contact the site administrator to reset your password.</p>
                <a href="login.php" class="btn">Return to Login</a>
            </main>
        </div>

        <footer class="site-footer">
            <p>&copy; <?php echo date('Y'); ?> Choose Your Own Adventure - AI Story Generator</p>
        </footer>
    </div>
</body>
</html>
