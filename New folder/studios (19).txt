<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';

// Set theme for page rendering
$theme = $_SESSION['theme'] ?? 'light';

// Get the mention token or entry ID from URL
$token = isset($_GET['token']) ? trim($_GET['token']) : '';
$entryId = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if (empty($token) && $entryId === 0) {
    die('No token or entry ID provided');
}

try {
    // Get the codex entry
    if (!empty($token)) {
        $stmt = $pdo->prepare("
            SELECT ce.*, u.title as universe_title, s.title as series_title 
            FROM codex_entries ce
            LEFT JOIN universes u ON ce.universe_id = u.id
            LEFT JOIN series s ON ce.series_id = s.id
            WHERE ce.mention_token = ?
        ");
        $stmt->execute([$token]);
    } else {
        $stmt = $pdo->prepare("
            SELECT ce.*, u.title as universe_title, s.title as series_title 
            FROM codex_entries ce
            LEFT JOIN universes u ON ce.universe_id = u.id
            LEFT JOIN series s ON ce.series_id = s.id
            WHERE ce.id = ?
        ");
        $stmt->execute([$entryId]);
    }
    $entry = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$entry) {
        die('Entry not found');
    }

    // Get related entries
    $related_entries = [];
    try {
        $stmt = $pdo->prepare("
            SELECT ce2.* 
            FROM codex_relationships cr
            JOIN codex_entries ce2 ON (cr.related_entry_id = ce2.id)
            WHERE cr.entry_id = ?
        ");
        $stmt->execute([$entry['id']]);
        $related_entries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $related_entries = [];
    }

    // Get tags
    $tags = [];
    try {
        $stmt = $pdo->prepare("
            SELECT tag_name
            FROM codex_tags
            WHERE entry_id = ?
            ORDER BY tag_name ASC
        ");
        $stmt->execute([$entry['id']]);
        $tags = $stmt->fetchAll(PDO::FETCH_COLUMN);
    } catch (Exception $e) {
        $tags = [];
    }

} catch (PDOException $e) {
    die('Database error: ' . $e->getMessage());
}
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Codex Entry: <?php echo htmlspecialchars($entry['title']); ?></title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/codex.css">
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>
        
        <div class="content-wrapper">
            <main class="codex-entry">
                <header class="entry-header">
                    <h1><?php echo htmlspecialchars($entry['title']); ?></h1>
                    <?php if ($entry['universe_title']): ?>
                        <div class="entry-universe">Universe: <?php echo htmlspecialchars($entry['universe_title']); ?></div>
                    <?php endif; ?>
                    <?php if ($entry['series_title']): ?>
                        <div class="entry-series">Series: <?php echo htmlspecialchars($entry['series_title']); ?></div>
                    <?php endif; ?>
                </header>

                <div class="entry-content">
                    <?php echo nl2br(htmlspecialchars($entry['content'])); ?>
                </div>

                <?php if (!empty($tags)): ?>
                <div class="related-entries">
                    <h2>Tags</h2>
                    <div class="related-grid">
                        <?php foreach ($tags as $tag): ?>
                            <div class="related-entry">
                                <h3><?php echo htmlspecialchars($tag); ?></h3>
                                <span class="entry-type">Tag</span>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
                <?php endif; ?>

                <?php if (!empty($related_entries)): ?>
                <div class="related-entries">
                    <h2>Related Entries</h2>
                    <div class="related-grid">
                        <?php foreach ($related_entries as $related): ?>
                            <a href="codex_entry.php?token=<?php echo urlencode($related['mention_token']); ?>" 
                               class="related-entry">
                                <h3><?php echo htmlspecialchars($related['title']); ?></h3>
                                <span class="entry-type"><?php echo htmlspecialchars($related['entry_type']); ?></span>
                            </a>
                        <?php endforeach; ?>
                    </div>
                </div>
                <?php endif; ?>
            </main>
        </div>
    </div>
</body>
</html> 
