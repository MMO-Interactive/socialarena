<?php
ob_start();
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


// Set default theme for non-logged in users
$theme = 'light';

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $username = $_POST['username'] ?? '';
        $email = $_POST['email'] ?? '';
        $password = $_POST['password'] ?? '';
        $confirm_password = $_POST['confirm_password'] ?? '';

        // Basic validation
        if (empty($username) || empty($email) || empty($password) || empty($confirm_password)) {
            $error = 'Please fill in all fields';
        } elseif ($password !== $confirm_password) {
            $error = 'Passwords do not match';
        } elseif (strlen($password) < 6) {
            $error = 'Password must be at least 6 characters long';
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $error = 'Please enter a valid email address';
        } else {
            // Check if username or email already exists
            $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
            $stmt->execute([$username, $email]);

            if ($stmt->rowCount() > 0) {
                $error = 'Username or email already exists';
            } else {
                $password_hash = password_hash($password, PASSWORD_DEFAULT);
                $stmt = $pdo->prepare("INSERT INTO users (username, email, password_hash, theme_preference) VALUES (?, ?, ?, 'light')");
                $stmt->execute([$username, $email, $password_hash]);

                // Auto-login after registration
                $_SESSION['user_id'] = $pdo->lastInsertId();
                $_SESSION['username'] = $username;
                $_SESSION['theme'] = 'light';

                header('Location: index.php');
                exit;
            }
        }
    } catch (Throwable $e) {
        $error = 'Registration failed. Please try again.';
        error_log('Registration error: ' . $e->getMessage());
    }
}

// Array of community benefits
$benefits = [
    [
        'icon' => 'fa-wand-magic-sparkles',
        'title' => 'AI-Powered Creativity',
        'description' => 'Access state-of-the-art AI models to generate unique and engaging stories'
    ],
    [
        'icon' => 'fa-palette',
        'title' => 'Visual Stories',
        'description' => 'Bring your stories to life with AI-generated artwork'
    ],
    [
        'icon' => 'fa-users',
        'title' => 'Join the Community',
        'description' => 'Connect with other writers and share your creative journey'
    ],
    [
        'icon' => 'fa-book-open',
        'title' => 'Multiple Genres',
        'description' => 'Explore fantasy, sci-fi, mystery, and more - or create your own genre blend'
    ]
];

// Writing tips for new users
$writingTips = [
    'Create compelling character arcs',
    'Build immersive worlds',
    'Design meaningful choices',
    'Balance action and reflection',
    'Use vivid descriptions'
];
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register - SocialArena.org</title>
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
            <a href="login.php" class="btn">Login</a>
        </nav>
    </header>

    <main class="auth-shell">
        <section class="auth-hero">
            <div class="eyebrow">Studio Onboarding</div>
            <h1>Build the studio your films deserve.</h1>
            <p>Organize episodic arcs, cast talent, and draft scripts with AI support that respects your canon.</p>
            <ul class="auth-side-list">
                <?php foreach ($writingTips as $tip): ?>
                    <li><?php echo htmlspecialchars($tip); ?></li>
                <?php endforeach; ?>
            </ul>
        </section>

        <section class="auth-card">
            <h2>Create your studio account</h2>
            <p>Get instant access to planning chat, screenplay tools, and project boards.</p>

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
                           value="<?php echo htmlspecialchars($_POST['username'] ?? ''); ?>"
                           placeholder="Choose a unique username">
                </div>

                <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" required autocomplete="email"
                           value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>"
                           placeholder="Enter your email address">
                </div>

                <div class="form-group">
                    <label for="password">Password</label>
                    <div class="password-input">
                        <input type="password" id="password" name="password" required autocomplete="new-password"
                               minlength="6"
                               placeholder="Create a secure password">
                        <i class="fas fa-eye password-toggle" onclick="togglePassword('password')"></i>
                    </div>
                    <small class="form-text">Must be at least 6 characters long</small>
                </div>

                <div class="form-group">
                    <label for="confirm_password">Confirm Password</label>
                    <div class="password-input">
                        <input type="password" id="confirm_password" name="confirm_password" required autocomplete="new-password"
                               placeholder="Confirm your password">
                        <i class="fas fa-eye password-toggle" onclick="togglePassword('confirm_password')"></i>
                    </div>
                </div>

                <button type="submit" class="btn">
                    <i class="fas fa-user-plus"></i> Create Account
                </button>
            </form>

            <div class="auth-links">
                <p>Already have an account? <a href="login.php">Sign in here</a></p>
            </div>
        </section>
    </main>

    <footer class="auth-footer">
        <div>SocialArena.org</div>
        <div>&copy; <?php echo date('Y'); ?> Studio Workspace</div>
    </footer>

    <script>
        function togglePassword(inputId) {
            const passwordInput = document.getElementById(inputId);
            const toggleIcon = passwordInput.nextElementSibling;
            
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

        document.querySelector('.auth-form').addEventListener('submit', function(e) {
            const password = document.getElementById('password').value;
            const confirm = document.getElementById('confirm_password').value;
            
            if (password !== confirm) {
                e.preventDefault();
                alert('Passwords do not match!');
            }
        });
    </script>
</body>
</html> 
