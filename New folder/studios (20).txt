<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';

$universe_id = isset($_GET['universe_id']) ? (int)$_GET['universe_id'] : 0;
$series_id = isset($_GET['series_id']) ? (int)$_GET['series_id'] : 0;
$story_id = isset($_GET['story_id']) ? (int)$_GET['story_id'] : 0;

$context_label = 'Universe';
$context_title = '';
$universe = null;
$series = null;
$story = null;

if ($story_id > 0) {
    $stmt = $pdo->prepare("
        SELECT s.*, ser.title as series_title, ser.universe_id as series_universe_id, u.title as universe_title
        FROM stories s
        LEFT JOIN series ser ON s.series_id = ser.id
        LEFT JOIN universes u ON ser.universe_id = u.id OR s.universe_id = u.id
        WHERE s.id = ?
    ");
    $stmt->execute([$story_id]);
    $story = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$story) {
        die('Story not found');
    }
    $series_id = (int)($story['series_id'] ?? 0);
    $universe_id = (int)($story['universe_id'] ?? $story['series_universe_id'] ?? 0);
    $context_label = 'Story';
    $context_title = $story['title'];
} elseif ($series_id > 0) {
    $stmt = $pdo->prepare("
        SELECT s.*, u.title as universe_title
        FROM series s
        LEFT JOIN universes u ON s.universe_id = u.id
        WHERE s.id = ?
    ");
    $stmt->execute([$series_id]);
    $series = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$series) {
        die('Series not found');
    }
    $universe_id = (int)($series['universe_id'] ?? 0);
    $context_label = 'Series';
    $context_title = $series['title'];
} else {
    $stmt = $pdo->prepare("SELECT * FROM universes WHERE id = ?");
    $stmt->execute([$universe_id]);
    $universe = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$universe) {
        die('Universe not found');
    }
    $context_title = $universe['title'];
}

if ($universe === null && $universe_id > 0) {
    $stmt = $pdo->prepare("SELECT * FROM universes WHERE id = ?");
    $stmt->execute([$universe_id]);
    $universe = $stmt->fetch(PDO::FETCH_ASSOC);
}

$page_title = "Create New Codex Entry - " . htmlspecialchars($context_title);
$additional_css = ['css/codex.css', 'css/create_codex.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        
        <main class="main-content">
            <div class="codex-form-container">
                <h1>Create New Codex Entry</h1>
                <h2><?php echo htmlspecialchars($context_label . ': ' . $context_title); ?></h2>

                <form id="new-codex-form" action="includes/codex_handlers.php" method="POST">
                    <input type="hidden" name="action" value="create_entry">
                    <input type="hidden" name="universe_id" value="<?php echo $universe_id; ?>">
                    <input type="hidden" name="series_id" value="<?php echo $series_id; ?>">
                    <input type="hidden" name="story_id" value="<?php echo $story_id; ?>">
                    <input type="hidden" name="visibility_level" value="<?php echo htmlspecialchars(strtolower($context_label)); ?>">
                    
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" name="title" required>
                    </div>

                    <div class="form-group">
                        <label>Entry Type</label>
                        <select name="entry_type" required>
                            <option value="character">Character</option>
                            <option value="location">Location</option>
                            <option value="item">Item</option>
                            <option value="concept">Concept</option>
                            <option value="event">Event</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="content" required></textarea>
                    </div>

                    <div class="form-group">
                        <label>AI Context</label>
                        <textarea name="ai_context" placeholder="Add specific details for AI to use when generating content..."></textarea>
                    </div>

                    <div class="form-group">
                        <label>Tags (comma separated)</label>
                        <input type="text" name="tags" placeholder="e.g. hero, ancient, artifact">
                    </div>

                    <div class="form-group">
                        <label>Related Entries (mention tokens, comma separated)</label>
                        <input type="text" name="related_tokens" placeholder="e.g. @Sword, @ElderTree">
                    </div>

                    <div class="form-group">
                        <label>First Appearance Date</label>
                        <?php
                        // Get universe date format
                        $dateFormatRaw = ($universe && isset($universe['date_format'])) ? $universe['date_format'] : '';
                        $dateFormat = json_decode($dateFormatRaw, true) ?? [
                            'eras' => ['BE', 'AE'],
                            'era_names' => ['Before Event', 'After Event'],
                            'divisions' => ['Early', 'Mid', 'Late'],
                            'calendar_type' => 'standard'
                        ];
                        ?>
                        <div class="universe-date-inputs">
                            <?php if ($dateFormat['calendar_type'] === 'standard'): ?>
                                <div class="date-group">
                                    <label>Era</label>
                                    <select name="era" required>
                                        <?php foreach ($dateFormat['eras'] as $i => $era): ?>
                                            <option value="<?php echo $era; ?>" title="<?php echo $dateFormat['era_names'][$i]; ?>">
                                                <?php echo $era; ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>
                                <div class="date-group">
                                    <label>Year</label>
                                    <input type="number" name="year" required min="0">
                                </div>
                                <div class="date-group">
                                    <label>Division</label>
                                    <select name="division">
                                        <?php foreach ($dateFormat['divisions'] as $division): ?>
                                            <option value="<?php echo $division; ?>"><?php echo $division; ?></option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>
                            <?php elseif ($dateFormat['calendar_type'] === 'age'): ?>
                                <div class="date-group">
                                    <label>Age</label>
                                    <select name="age" required>
                                        <?php foreach ($dateFormat['custom_divisions'] as $age): ?>
                                            <option value="<?php echo $age; ?>"><?php echo $age; ?></option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>
                                <div class="date-group">
                                    <label>Year Within Age</label>
                                    <input type="number" name="year" required min="0">
                                </div>
                            <?php elseif ($dateFormat['calendar_type'] === 'lunar'): ?>
                                <div class="date-group">
                                    <label>Moon Cycle</label>
                                    <select name="moon" required>
                                        <?php foreach ($dateFormat['custom_months'] as $moon): ?>
                                            <option value="<?php echo $moon; ?>"><?php echo $moon; ?></option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>
                                <div class="date-group">
                                    <label>Cycle Year</label>
                                    <input type="number" name="year" required min="0">
                                </div>
                            <?php endif; ?>
                        </div>
                        <div class="helper-text">
                            <?php
                            $dateDescription = ($universe && isset($universe['date_description']))
                                ? $universe['date_description']
                                : 'Use the universe calendar to place this entry.';
                            echo htmlspecialchars($dateDescription);
                            ?>
                        </div>
                    </div>

                    <div class="form-actions">
                        <?php if ($story_id > 0): ?>
                            <a href="story_codex.php?story_id=<?php echo $story_id; ?>" class="btn cancel">Cancel</a>
                        <?php elseif ($series_id > 0): ?>
                            <a href="series_codex.php?series_id=<?php echo $series_id; ?>" class="btn cancel">Cancel</a>
                        <?php else: ?>
                            <a href="universe_codex.php?universe_id=<?php echo $universe_id; ?>" class="btn cancel">Cancel</a>
                        <?php endif; ?>
                        <button type="submit" class="btn submit">Create Entry</button>
                    </div>
                </form>
            </div>
        </main>
    </div>
</div>

<script>
document.getElementById('new-codex-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    
    // Create the data object with all required fields
    const era = formData.get('era') || '';
    const year = formData.get('year') || '';
    const season = formData.get('division') || formData.get('season') || formData.get('age') || formData.get('moon') || '';
    const firstAppearance = [year, season, era].filter(Boolean).join(' ');

    const data = {
        action: formData.get('action'),
        title: formData.get('title'),
        entry_type: formData.get('entry_type'),
        content: formData.get('content'),
        ai_context: formData.get('ai_context'),
        tags: formData.get('tags'),
        related_tokens: formData.get('related_tokens'),
        first_appearance_date: firstAppearance,
        visibility_level: formData.get('visibility_level'),
        is_universe_level: formData.get('visibility_level') === 'universe',
        mention_token: '@' + formData.get('title').replace(/\s+/g, ''),
        universe_id: <?php echo $universe_id; ?>,
        series_id: <?php echo $series_id; ?>,
        story_id: <?php echo $story_id; ?>,
        era: era,
        year: year,
        season: season
    };
    
    fetch('includes/codex_handlers.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            <?php if ($story_id > 0): ?>
            window.location.href = `story_codex.php?story_id=${<?php echo $story_id; ?>}`;
            <?php elseif ($series_id > 0): ?>
            window.location.href = `series_codex.php?series_id=${<?php echo $series_id; ?>}`;
            <?php else: ?>
            window.location.href = `universe_codex.php?universe_id=${<?php echo $universe_id; ?>}`;
            <?php endif; ?>
        } else {
            alert(data.error || 'Error creating entry');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error creating entry');
    });
});
</script> 
