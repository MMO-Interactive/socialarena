<?php
require_once 'includes/db_connect.php';
require_once 'includes/config.php';
require_once 'includes/studio_access.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

if (!defined('USE_LMSTUDIO') || !USE_LMSTUDIO) {
    // Check for required API keys
    $keyManager = new KeyManager($pdo);
    $openRouterKey = $keyManager->getKey('openrouter');
    $openAIKey = $keyManager->getKey('openai');

    if (!$openRouterKey || !$openAIKey) {
        header('Location: no_api_keys.php');
        exit;
    }
}

$theme = $_SESSION['theme'] ?? 'light';
$flash_error = $_SESSION['flash_error'] ?? '';
if ($flash_error) {
    unset($_SESSION['flash_error']);
}

// Get user's universes
[$universeWhere, $universeParams] = buildStudioVisibilityWhere('u', (int)$_SESSION['user_id'], 'universes');
$stmt = $pdo->prepare("SELECT u.id, u.title FROM universes u WHERE {$universeWhere}");
$stmt->execute($universeParams);
$universes = $stmt->fetchAll();

// Get user's series
[$seriesWhere, $seriesParams] = buildStudioVisibilityWhere('s', (int)$_SESSION['user_id'], 'series');
$stmt = $pdo->prepare("SELECT s.id, s.title FROM series s WHERE {$seriesWhere}");
$stmt->execute($seriesParams);
$series = $stmt->fetchAll();
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generate Story - Choose Your Own Adventure</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <style>
        .story-form {
            background: var(--card-bg);
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 5px var(--shadow);
            max-width: 800px;
            margin: 20px auto;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: var(--text-primary);
            font-weight: 500;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background: var(--input-bg);
            color: var(--input-text);
            font-size: 16px;
            transition: border-color 0.3s ease;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--accent-color);
            box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
        }

        .form-group textarea {
            min-height: 100px;
            resize: vertical;
        }

        .form-group select {
            cursor: pointer;
        }

        .form-group select option {
            background: var(--input-bg);
            color: var(--input-text);
        }

        .action-btn {
            background: var(--accent-color);
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 500;
            width: 100%;
            transition: background-color 0.3s ease, transform 0.2s ease;
        }

        .action-btn:hover {
            background: var(--accent-hover);
            transform: translateY(-2px);
        }

        /* Dark theme specific adjustments */
        [data-theme="dark"] .story-form {
            border: 1px solid var(--border-color);
        }

        [data-theme="dark"] .form-group input,
        [data-theme="dark"] .form-group select,
        [data-theme="dark"] .form-group textarea {
            background: var(--bg-secondary);
            border-color: var(--border-color);
        }

        [data-theme="dark"] .form-group input:focus,
        [data-theme="dark"] .form-group select:focus,
        [data-theme="dark"] .form-group textarea:focus {
            border-color: var(--accent-color);
        }

        /* Section Headers */
        .form-section {
            border-bottom: 1px solid var(--border-color);
            margin-bottom: 25px;
            padding-bottom: 10px;
        }

        .form-section h3 {
            color: var(--text-primary);
            font-size: 1.2em;
            margin-bottom: 15px;
        }

        /* Helper Text */
        .helper-text {
            font-size: 0.9em;
            color: var(--text-secondary);
            margin-top: 5px;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .story-form {
                padding: 20px;
                margin: 10px;
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
                <h2>Create New Story</h2>

                <?php if (!empty($flash_error)): ?>
                    <div class="error-message"><?php echo htmlspecialchars($flash_error); ?></div>
                <?php endif; ?>
                
                <form id="storyForm" class="story-form" method="POST" action="process_story.php">
                    <!-- Story Type Selection -->
                    <div class="form-group">
                        <label for="story_type">Story Type:</label>
                        <select name="story_type" id="story_type" required onchange="toggleStoryOptions()">
                            <option value="standalone">Film</option>
                            <option value="series_entry">Part of a Series</option>
                            <option value="universe_entry">Part of a Universe</option>
                        </select>
                    </div>

                    <!-- Universe Selection (initially hidden) -->
                    <div class="form-group" id="universeGroup" style="display: none;">
                        <label for="universe_id">Select Universe:</label>
                        <select name="universe_id" id="universe_id">
                            <option value="">Select a Universe</option>
                            <?php foreach ($universes as $universe): ?>
                                <option value="<?php echo $universe['id']; ?>">
                                    <?php echo htmlspecialchars($universe['title']); ?>
                                </option>
                            <?php endforeach; ?>
                            <option value="new">Create New Universe</option>
                        </select>
                    </div>

                    <!-- Series Selection (initially hidden) -->
                    <div class="form-group" id="seriesGroup" style="display: none;">
                        <label for="series_id">Select Series:</label>
                        <select name="series_id" id="series_id">
                            <option value="">Select a Series</option>
                            <?php foreach ($series as $s): ?>
                                <option value="<?php echo $s['id']; ?>">
                                    <?php echo htmlspecialchars($s['title']); ?>
                                </option>
                            <?php endforeach; ?>
                            <option value="new">Create New Series</option>
                        </select>
                    </div>

                    <!-- Story Details -->
                    <div class="form-group">
                        <label for="title">Story Title:</label>
                        <input type="text" id="title" name="title" required>
                    </div>

                    <div class="form-group">
                        <label for="genre">Genre:</label>
                        <select id="genre" name="genre" required>
                            <option value="Fantasy">Fantasy</option>
                            <option value="Science Fiction">Science Fiction</option>
                            <option value="Mystery">Mystery</option>
                            <option value="Horror">Horror</option>
                            <option value="Adventure">Adventure</option>
                            <option value="Romance">Romance</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="setting">Setting:</label>
                        <input type="text" id="setting" name="setting" required>
                    </div>

                    <div class="form-group">
                        <label for="main_character">Main Character Description:</label>
                        <textarea id="main_character" name="main_character" required></textarea>
                    </div>

                    <div class="form-group">
                        <label for="story_premise">Story Premise:</label>
                        <textarea id="story_premise" name="story_premise" required></textarea>
                    </div>

                    <div class="form-group">
                        <label for="choice_complexity">Choice Complexity:</label>
                        <select id="choice_complexity" name="choice_complexity">
                            <option value="simple">Simple (2-3 choices per scene)</option>
                            <option value="moderate">Moderate (3-4 choices per scene)</option>
                            <option value="complex">Complex (4-5 choices per scene)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="story_length">Story Length:</label>
                        <select id="story_length" name="story_length">
                            <option value="short">Short (5-7 scenes)</option>
                            <option value="medium">Medium (8-12 scenes)</option>
                            <option value="long">Long (13-20 scenes)</option>
                        </select>
                    </div>

                    <button type="submit" class="btn action-btn">Generate Story</button>
                </form>
            </main>
        </div>
        
        <?php include 'includes/footer.php'; ?>
    </div>

    <script>
    function toggleStoryOptions() {
        const storyType = document.getElementById('story_type').value;
        const universeGroup = document.getElementById('universeGroup');
        const seriesGroup = document.getElementById('seriesGroup');

        // Reset displays
        universeGroup.style.display = 'none';
        seriesGroup.style.display = 'none';

        // Show relevant options based on story type
        if (storyType === 'universe_entry') {
            universeGroup.style.display = 'block';
            seriesGroup.style.display = 'block';
        } else if (storyType === 'series_entry') {
            seriesGroup.style.display = 'block';
        }
    }

    // Handle universe/series selection changes
    document.getElementById('universe_id').addEventListener('change', function() {
        if (this.value === 'new') {
            // Redirect to universe creation or show modal
            if (confirm('Create a new universe?')) {
                window.location.href = 'create_universe.php';
            } else {
                this.value = '';
            }
        }
    });

    document.getElementById('series_id').addEventListener('change', function() {
        if (this.value === 'new') {
            // Redirect to series creation or show modal
            if (confirm('Create a new series?')) {
                window.location.href = 'create_series.php';
            } else {
                this.value = '';
            }
        }
    });
    </script>
</body>
</html> 
