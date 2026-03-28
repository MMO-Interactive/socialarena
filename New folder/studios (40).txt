<?php
ob_start();
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


// Set default theme for non-logged in users
$theme = 'light';

$error = '';

// Array of writing tips and suggestions
$tips = [
    "Create unique character backstories",
    "Mix different genres in unexpected ways",
    "Use sensory details in descriptions",
    "Create moral dilemmas for characters",
    "Build tension through pacing",
    "Develop distinct character voices",
    "Plant subtle foreshadowing",
    "Create vivid world-building details",
    "Design meaningful character arcs",
    "Balance action and reflection"
];

// Get a random tip
$daily_tip = $tips[array_rand($tips)];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $username = $_POST['username'] ?? '';
        $password = $_POST['password'] ?? '';
        $remember = isset($_POST['remember_me']);

        if (empty($username) || empty($password)) {
            $error = 'Please fill in all fields';
        } else {
            $stmt = $pdo->prepare("SELECT id, username, password_hash, theme_preference FROM users WHERE username = ?");
            $stmt->execute([$username]);
            $user = $stmt->fetch();

            if ($user && password_verify($password, $user['password_hash'])) {
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['theme'] = $user['theme_preference'] ?? 'light';
                
                // Handle Remember Me
                if ($remember) {
                    $token = bin2hex(random_bytes(32));
                    setcookie('remember_token', $token, time() + (86400 * 30), '/'); // 30 days
                    
                    // Store token in database (ignore if column does not exist)
                    try {
                        $stmt = $pdo->prepare("UPDATE users SET remember_token = ? WHERE id = ?");
                        $stmt->execute([$token, $user['id']]);
                    } catch (PDOException $e) {
                        error_log('Remember token update failed: ' . $e->getMessage());
                    }
                }
                
                // Update last login time
                $stmt = $pdo->prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?");
                $stmt->execute([$user['id']]);

                header('Location: dashboard.php');
                exit;
            }

            // Add delay to prevent brute force attacks
            sleep(1);
            $error = 'Invalid username or password';
        }
    } catch (Throwable $e) {
        $error = 'Login failed. Please try again.';
        error_log('Login error: ' . $e->getMessage());
    }
}
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - SocialArena.org</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/auth.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=Playfair+Display:wght@500;700&display=swap">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body class="auth-page">
    <header class="auth-header">
        <div class="auth-logo">
            <span>SocialArena.org</span>
            <small>Series and Screenplay Workspace</small>
        </div>
        <nav class="auth-nav">
            <a href="index.php">Home</a>
            <a href="register.php" class="btn">Create Account</a>
        </nav>
    </header>

    <main class="auth-shell">
        <section class="auth-hero">
            <div class="eyebrow">Studio Access</div>
            <h1>Welcome back to your production suite.</h1>
            <p>Manage films, episodic series, codex lore, and on-set workflows from one secure workspace.</p>
            <div class="auth-badges">
                <div class="auth-badge">Daily focus: <?php echo htmlspecialchars($daily_tip); ?></div>
                <div class="auth-badge">AI scenes + screenplay drafting in one flow.</div>
                <div class="auth-badge">Projects, milestones, and shot lists stay aligned.</div>
            </div>
            <div class="auth-meta">
                <div class="auth-meta-item">
                    <span>Studio Mode</span>
                    <strong>Pre-production</strong>
                </div>
                <div class="auth-meta-item">
                    <span>Pipeline</span>
                    <strong>Plan → Write → Shoot</strong>
                </div>
                <div class="auth-meta-item">
                    <span>AI Stack</span>
                    <strong>Local Studio</strong>
                </div>
            </div>
        </section>

        <section class="auth-card">
            <h2>Sign in</h2>
            <p>Enter your studio credentials to continue.</p>

            <?php if ($error): ?>
                <div class="auth-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <?php echo htmlspecialchars($error); ?>
                </div>
            <?php endif; ?>

            <form method="POST" class="auth-form">
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" name="username" required autocomplete="username"
                           value="<?php echo htmlspecialchars($_POST['username'] ?? ''); ?>">
                </div>

                <div class="form-group">
                    <label for="password">Password</label>
                    <div class="password-input">
                        <input type="password" id="password" name="password" required autocomplete="current-password">
                        <i class="fas fa-eye password-toggle" onclick="togglePassword()"></i>
                    </div>
                </div>

                <div class="auth-actions">
                    <label class="checkbox-label">
                        <input type="checkbox" name="remember_me">
                        <span>Remember me</span>
                    </label>
                    <a href="forgot_password.php" class="text-link">Forgot Password?</a>
                </div>

                <button type="submit" class="btn">
                    <i class="fas fa-sign-in-alt"></i> Enter Studio
                </button>
            </form>

            <div class="auth-links">
                <p>No account yet? <a href="register.php">Create a studio account</a></p>
            </div>
        </section>
    </main>

    <footer class="auth-footer">
        <div>SocialArena.org</div>
        <div>&copy; <?php echo date('Y'); ?> Studio Workspace</div>
    </footer>

    <script>
    function togglePassword() {
        const passwordInput = document.getElementById('password');
        const toggleIcon = document.querySelector('.password-toggle');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleIcon.classList.remove('fa-eye');
            toggleIcon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            toggleIcon.classList.remove('fa-eye-slash');
            toggleIcon.classList.add('fa-eye');
        }
    }
    </script>
</body>
</html> 
