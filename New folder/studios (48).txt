<?php
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

// Get theme preference
$theme = $_SESSION['theme'] ?? 'light';
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Keys Required - Choose Your Own Adventure</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <style>
        .api-notice {
            max-width: 800px;
            margin: 40px auto;
            padding: 40px;
            background: var(--card-bg);
            border-radius: 12px;
            box-shadow: 0 4px 15px var(--shadow);
            color: var(--text-primary);
            position: relative;
            overflow: hidden;
        }

        .api-notice::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 200px;
            height: 200px;
            background: var(--accent-color);
            opacity: 0.05;
            border-radius: 50%;
            transform: translate(30%, -30%);
        }

        .notice-icon {
            text-align: center;
            color: var(--accent-color);
            margin-bottom: 30px;
            transform: scale(1.2);
        }

        .notice-icon svg {
            filter: drop-shadow(0 2px 4px var(--shadow));
        }

        .api-notice h2 {
            text-align: center;
            color: var(--text-primary);
            margin-bottom: 30px;
            font-size: 2rem;
            font-weight: 600;
            position: relative;
            padding-bottom: 15px;
        }

        .api-notice h2::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 60px;
            height: 3px;
            background: var(--accent-color);
            border-radius: 2px;
        }

        .missing-keys {
            background: var(--bg-secondary);
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
            border-left: 4px solid var(--accent-color);
            position: relative;
        }

        .missing-keys h3 {
            color: var(--text-primary);
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .missing-keys h3::before {
            content: '!';
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            background: var(--accent-color);
            color: white;
            border-radius: 50%;
            font-size: 14px;
            font-weight: bold;
        }

        .missing-keys li {
            margin-bottom: 10px;
            padding-left: 30px;
            position: relative;
        }

        .missing-keys li::before {
            content: "✗";
            position: absolute;
            left: 0;
            color: var(--accent-color);
            font-weight: bold;
        }

        .key-instructions {
            background: var(--bg-secondary);
            padding: 25px;
            border-radius: 8px;
            margin: 30px 0;
            position: relative;
        }

        .key-instructions h3 {
            margin-bottom: 20px;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .key-instructions h3::before {
            content: '→';
            color: var(--accent-color);
            font-weight: bold;
        }

        .key-instructions ol {
            counter-reset: steps;
        }

        .key-instructions ol > li {
            counter-increment: steps;
            margin-bottom: 25px;
            padding-left: 45px;
            position: relative;
            color: var(--text-primary);
        }

        .key-instructions ol > li::before {
            content: counter(steps);
            position: absolute;
            left: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            background: var(--accent-color);
            color: white;
            border-radius: 50%;
            font-weight: bold;
        }

        .key-instructions ul {
            margin-top: 10px;
            margin-left: 20px;
        }

        .key-instructions ul li {
            margin-bottom: 8px;
            color: var(--text-secondary);
            position: relative;
            padding-left: 20px;
        }

        .key-instructions ul li::before {
            content: "•";
            position: absolute;
            left: 0;
            color: var(--accent-color);
        }

        .action-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 40px;
        }

        .action-buttons .btn {
            padding: 12px 25px;
            border-radius: 25px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: all 0.3s ease;
            min-width: 160px;
            text-align: center;
        }

        .btn-primary {
            background: var(--accent-color);
            color: white;
            box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
        }

        .btn-primary:hover {
            background: var(--accent-hover);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(52, 152, 219, 0.4);
        }

        .btn-secondary {
            background: var(--bg-secondary);
            color: var(--text-primary);
            border: 2px solid var(--border-color);
        }

        .btn-secondary:hover {
            background: var(--bg-primary);
            border-color: var(--accent-color);
        }

        .key-instructions a {
            color: var(--accent-color);
            text-decoration: none;
            position: relative;
            padding-bottom: 2px;
        }

        .key-instructions a::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 1px;
            background: var(--accent-color);
            transform: scaleX(0);
            transition: transform 0.3s ease;
        }

        .key-instructions a:hover::after {
            transform: scaleX(1);
        }

        @media (max-width: 768px) {
            .api-notice {
                margin: 20px;
                padding: 25px;
            }

            .action-buttons {
                flex-direction: column;
            }

            .action-buttons .btn {
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>

        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>

            <main class="main-content">
                <div class="api-notice">
                    <div class="notice-icon">
                        <svg viewBox="0 0 24 24" width="48" height="48">
                            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                        </svg>
                    </div>
                    
                    <h2>API Keys Required</h2>
                    
                    <div class="missing-keys">
                        <h3>Missing API Keys:</h3>
                        <ul>
                            <li>OpenRouter API Key</li>
                            <li>OpenAI API Key</li>
                        </ul>
                    </div>

                    <div class="key-instructions">
                        <h3>How to Get Your API Keys:</h3>
                        <ol>
                            <li>
                                OpenRouter API Key:
                                <ul>
                                    <li>Visit <a href="https://openrouter.ai/" target="_blank" style="color: var(--accent-color);">OpenRouter.ai</a></li>
                                    <li>Create an account and verify your email</li>
                                    <li>Navigate to the API section</li>
                                    <li>Generate a new API key</li>
                                </ul>
                            </li>
                            <li>
                                OpenAI API Key:
                                <ul>
                                    <li>Visit <a href="https://platform.openai.com/" target="_blank" style="color: var(--accent-color);">OpenAI Platform</a></li>
                                    <li>Sign up for an account</li>
                                    <li>Go to the API keys section</li>
                                    <li>Create a new secret key</li>
                                </ul>
                            </li>
                        </ol>
                    </div>

                    <div class="action-buttons">
                        <a href="manage_keys.php" class="btn btn-primary">Add API Keys</a>
                        <a href="dashboard.php" class="btn btn-secondary">Return to Dashboard</a>
                    </div>
                </div>
            </main>
        </div>

        <?php include 'includes/footer.php'; ?>
    </div>
</body>
</html> 