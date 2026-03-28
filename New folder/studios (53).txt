<?php
require_once 'includes/db_connect.php';
require_once 'includes/StoryGenerator.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: generate_story.php');
    exit;
}

$storyType = $_POST['story_type'] ?? 'standalone';
$universeId = $_POST['universe_id'] ?? null;
$seriesId = $_POST['series_id'] ?? null;

$title = trim($_POST['title'] ?? '');
$genre = trim($_POST['genre'] ?? '');
$setting = trim($_POST['setting'] ?? '');
$mainCharacter = trim($_POST['main_character'] ?? '');
$premise = trim($_POST['story_premise'] ?? '');
$choiceComplexity = trim($_POST['choice_complexity'] ?? 'moderate');
$storyLength = trim($_POST['story_length'] ?? 'medium');

if ($universeId === 'new') {
    header('Location: create_universe.php');
    exit;
}

if ($seriesId === 'new') {
    header('Location: create_series.php');
    exit;
}

$universeId = !empty($universeId) ? (int)$universeId : null;
$seriesId = !empty($seriesId) ? (int)$seriesId : null;

if ($genre === '' || $setting === '' || $mainCharacter === '' || $premise === '') {
    header('Location: generate_story.php');
    exit;
}

$generator = new StoryGenerator($pdo);

try {
    $tone = $choiceComplexity;
    $storyId = $generator->createNewStory($premise, $genre, $setting, $mainCharacter, $tone);

    $stmt = $pdo->prepare("
        UPDATE stories
        SET universe_id = ?, series_id = ?, story_type = 'interactive', title = IF(?, ?, title)
        WHERE id = ?
    ");
    $stmt->execute([$universeId, $seriesId, $title !== '' ? 1 : 0, $title, $storyId]);

    header('Location: story.php?id=' . $storyId);
    exit;

} catch (Exception $e) {
    error_log('AI story generation failed: ' . $e->getMessage());
    $_SESSION['flash_error'] = 'AI story generation failed: ' . $e->getMessage();
    header('Location: generate_story.php');
    exit;
}
