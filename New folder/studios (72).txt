<?php
require_once 'includes/db_connect.php';
require_once 'includes/config.php';
require_once 'includes/StoryGenerator.php';
require_once 'includes/studio_access.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$story_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$page_id = isset($_GET['page']) ? (int)$_GET['page'] : 0;

// Get story info to check if it's AI-generated
$stmt = $pdo->prepare("SELECT is_ai_generated, genre, setting, main_character, created_by, studio_id, visibility FROM stories WHERE id = ?");
$stmt->execute([$story_id]);
$story = $stmt->fetch();

if (!$story) {
    header('Location: stories.php');
    exit;
}
try {
    enforceStoryAccess($pdo, $story_id, (int)$_SESSION['user_id'], false);
} catch (Exception $e) {
    header('Location: stories.php');
    exit;
}

if ($story['is_ai_generated'] && (!defined('USE_LMSTUDIO') || !USE_LMSTUDIO)) {
    // Check for required API keys
    $stmt = $pdo->prepare("SELECT key_type FROM user_api_keys WHERE user_id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $existing_keys = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (!in_array('openrouter', $existing_keys) || !in_array('openai', $existing_keys)) {
        header("Location: no_api_keys.php?story=" . $story_id);
        exit;
    }
}

// Define available models and their censorship status
$models = [
    (defined('LMSTUDIO_MODEL') ? LMSTUDIO_MODEL : 'local-model') => ['name' => 'LM Studio', 'censored' => false]
];

if ($page_id === 0) {
    // Get the first page of the story
    $stmt = $pdo->prepare("SELECT * FROM pages WHERE story_id = ? ORDER BY id ASC LIMIT 1");
    $stmt->execute([$story_id]);
} else {
    // Get the current page
    $stmt = $pdo->prepare("SELECT * FROM pages WHERE id = ? AND story_id = ?");
    $stmt->execute([$page_id, $story_id]);
}

$page = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$page) {
    header('Location: stories.php');
    exit;
}

$metadata = [
    'genre' => $story['genre'],
    'setting' => $story['setting'],
    'main_character' => $story['main_character']
];

// Load codex mention tokens for auto-linking
$mention_tokens = [];
try {
    $stmt = $pdo->prepare("
        SELECT mention_token
        FROM codex_entries
        WHERE mention_token IS NOT NULL AND mention_token <> ''
    ");
    $stmt->execute();
    $mention_tokens = $stmt->fetchAll(PDO::FETCH_COLUMN);
} catch (Exception $e) {
    $mention_tokens = [];
}

function renderStoryContent($content, $mentionTokens) {
    if (empty($mentionTokens)) {
        return nl2br(htmlspecialchars($content));
    }
    $tokenSet = array_flip($mentionTokens);
    $parts = preg_split('/(@[A-Za-z0-9_]+)/', $content, -1, PREG_SPLIT_DELIM_CAPTURE);
    $out = '';
    foreach ($parts as $part) {
        if (isset($tokenSet[$part])) {
            $out .= '<a href="codex_entry.php?token=' . urlencode($part) . '" class="mention-link">' . htmlspecialchars($part) . '</a>';
        } else {
            $out .= htmlspecialchars($part);
        }
    }
    return nl2br($out);
}

// Update story progress for the current user
$currentPageId = $page_id !== 0 ? $page_id : $page['id'];
$stmt = $pdo->prepare("
    INSERT INTO story_progress (user_id, story_id, current_page_id)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE current_page_id = VALUES(current_page_id), last_updated = CURRENT_TIMESTAMP
");
$stmt->execute([$_SESSION['user_id'], $story_id, $currentPageId]);

// Generate suggestions
$generator = new StoryGenerator($pdo);
$suggestions = $generator->generateSuggestions($page['content']);

// Handle user response submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['user_response'])) {
    $nextPage = $generator->generateNextPage($page['content'], $_POST['user_response'], $_POST['model']);
    
    // Insert the new page
    $stmt = $pdo->prepare("INSERT INTO pages (story_id, content, image_url) VALUES (?, ?, ?)");
    $stmt->execute([$story_id, $nextPage['content'], $nextPage['image_url']]);
    $newPageId = $pdo->lastInsertId();
    
    // Redirect to the new page
    header("Location: story.php?id=" . $story_id . "&page=" . $newPageId);
    exit;
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Story Page</title>
    <link rel="stylesheet" href="css/style.css">
    <style>
        .model-select {
            margin: 15px 0;
            width: 100%;
        }
        .model-select select {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
            background-color: white;
        }
        .censorship-status {
            font-size: 0.9em;
            margin-top: 5px;
            color: #666;
        }
        .censored {
            color: #dc3545;
        }
        .uncensored {
            color: #28a745;
        }
    </style>
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
                        <li><a href="dashboard.php">Dashboard</a></li>
                        <li><a href="generate_story.php">Create New Story</a></li>
                        <li><a href="manage_keys.php">Manage API Keys</a></li>
                        <li><a href="settings_account.php">Settings</a></li>
                        <li class="nav-divider"></li>
                        <li><a href="logout.php">Logout</a></li>
                    </ul>
                </div>
                
                <div class="nav-section">
                    <h3>Recent Stories</h3>
                    <ul class="nav-list">
                        <?php
                        [$recentWhere, $recentParams] = buildStudioVisibilityWhere('s', (int)$_SESSION['user_id'], 'stories');
                        $recentStmt = $pdo->prepare("SELECT s.id, s.title FROM stories s WHERE {$recentWhere} ORDER BY s.created_at DESC LIMIT 5");
                        $recentStmt->execute($recentParams);
                        $recentStories = $recentStmt;
                        while ($story = $recentStories->fetch()) {
                            echo '<li><a href="story.php?id=' . $story['id'] . '">' . 
                                 htmlspecialchars($story['title']) . '</a></li>';
                        }
                        ?>
                    </ul>
                </div>
                
                <div class="nav-section">
                    <h3>Story Info</h3>
                    <?php if ($page): ?>
                    <ul class="nav-list">
                        <li>Genre: <?php echo htmlspecialchars($metadata['genre'] ?? 'Unknown'); ?></li>
                        <li>Setting: <?php echo htmlspecialchars($metadata['setting'] ?? 'Unknown'); ?></li>
                        <li>Character: <?php echo htmlspecialchars($metadata['main_character'] ?? 'Unknown'); ?></li>
                        <li><a href="story_codex.php?story_id=<?php echo $story_id; ?>">Story Codex</a></li>
                    </ul>
                    <?php endif; ?>
                </div>
            </nav>

            <main class="main-content">
                <div class="story-content">
                    <div id="story-text">
                        <?php echo renderStoryContent($page['content'], $mention_tokens); ?>
                    </div>
                    
                    <?php if (!empty($page['image_url'])): ?>
                    <div class="story-image">
                        <img src="<?php echo htmlspecialchars($page['image_url']); ?>" 
                             alt="Story scene visualization" 
                             loading="lazy">
                    </div>
                    <?php endif; ?>
                    
                    <div class="suggestions">
                        <h3>Some ideas of what you could do:</h3>
                        <ul>
                            <?php foreach ($suggestions as $suggestion): ?>
                                <li onclick="fillSuggestion(this.textContent)">
                                    <?php echo htmlspecialchars($suggestion); ?>
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    </div>
                    
                    <form method="POST" class="response-form">
                        <div class="form-group">
                            <label for="user_response">What would you like to do?</label>
                            <textarea id="user_response" name="user_response" required 
                                      placeholder="Type your action here..."></textarea>
                        </div>
                        
                        <div class="model-select">
                            <label for="model">Select AI Model:</label>
                            <select id="model" name="model" required onchange="updateCensorshipStatus()">
                                <?php foreach ($models as $id => $info): ?>
                                    <option value="<?php echo htmlspecialchars($id); ?>" 
                                            data-censored="<?php echo $info['censored'] ? 'true' : 'false'; ?>">
                                        <?php echo htmlspecialchars($info['name']); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                            <div id="censorship-status" class="censorship-status"></div>
                        </div>

                        <button type="submit" class="btn action-btn">Continue Story</button>
                    </form>
                </div>
            </main>
        </div>

        <footer class="site-footer">
            <p>&copy; <?php echo date('Y'); ?> Choose Your Own Adventure - AI Story Generator</p>
        </footer>
    </div>

    <script>
        function fillSuggestion(text) {
            const cleanText = text.trim().replace(/\s+/g, ' ');
            document.getElementById('user_response').value = cleanText;
            document.getElementById('user_response').focus();
        }

        function updateCensorshipStatus() {
            const select = document.getElementById('model');
            const option = select.options[select.selectedIndex];
            const isCensored = option.getAttribute('data-censored') === 'true';
            const statusDiv = document.getElementById('censorship-status');
            
            statusDiv.textContent = isCensored ? 
                'This model is censored and may limit certain content' : 
                'This model is uncensored';
            statusDiv.className = 'censorship-status ' + (isCensored ? 'censored' : 'uncensored');
        }

        // Initialize censorship status on page load
        document.addEventListener('DOMContentLoaded', updateCensorshipStatus);
    </script>
</body>
</html> 
