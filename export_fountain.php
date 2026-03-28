<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$story_id = isset($_GET['story_id']) ? (int)$_GET['story_id'] : 0;
if ($story_id === 0) {
    header('Location: writing_center.php');
    exit;
}

$stmt = $pdo->prepare("SELECT id, title FROM stories WHERE id = ?");
$stmt->execute([$story_id]);
$story = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$story) {
    header('Location: writing_center.php');
    exit;
}
try {
    enforceStoryAccess($pdo, $story_id, (int)$_SESSION['user_id'], false);
} catch (Exception $e) {
    header('Location: writing_center.php');
    exit;
}

$stmt = $pdo->prepare("
    SELECT sc.id, sc.title, sc.scene_order, ch.chapter_order, a.act_order
    FROM story_scenes sc
    JOIN story_chapters ch ON sc.chapter_id = ch.id
    JOIN story_acts a ON ch.act_id = a.id
    WHERE a.story_id = ?
    ORDER BY a.act_order, ch.chapter_order, sc.scene_order
");
$stmt->execute([$story_id]);
$scenes = $stmt->fetchAll(PDO::FETCH_ASSOC);

$output = [];
$output[] = 'Title: ' . $story['title'];
$output[] = '';

foreach ($scenes as $scene) {
    $stmt = $pdo->prepare("
        SELECT block_type, content
        FROM screenplay_blocks
        WHERE scene_id = ?
        ORDER BY sort_order ASC, id ASC
    ");
    $stmt->execute([(int)$scene['id']]);
    $blocks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($blocks)) {
        $heading = 'INT. ' . strtoupper($scene['title'] ?: 'SCENE') . ' - DAY';
        $output[] = $heading;
        $output[] = '';
        continue;
    }

    foreach ($blocks as $block) {
        $content = trim($block['content'] ?? '');
        if ($content === '') {
            continue;
        }
        switch ($block['block_type']) {
            case 'scene_heading':
                $output[] = strtoupper($content);
                $output[] = '';
                break;
            case 'action':
                $output[] = $content;
                $output[] = '';
                break;
            case 'character':
                $output[] = strtoupper($content);
                break;
            case 'parenthetical':
                $output[] = '(' . $content . ')';
                break;
            case 'dialogue':
                $output[] = $content;
                $output[] = '';
                break;
            case 'transition':
                $transition = strtoupper($content);
                if (substr($transition, -3) !== 'TO:') {
                    $transition .= ' TO:';
                }
                $output[] = $transition;
                $output[] = '';
                break;
        }
    }
    $output[] = '';
}

$filename = preg_replace('/[^A-Za-z0-9_-]/', '_', $story['title']) . '.fountain';

header('Content-Type: text/plain');
header('Content-Disposition: attachment; filename="' . $filename . '"');
echo implode("\n", $output);
