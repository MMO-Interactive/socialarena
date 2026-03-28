<?php
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


$theme = 'light';

if (isset($_SESSION['user_id'])) {
    header('Location: dashboard.php');
    exit;
}

$stmt = $pdo->query("SELECT s.*, u.username as author FROM stories s 
                     LEFT JOIN users u ON s.user_id = u.id 
                     ORDER BY s.created_at DESC LIMIT 5");
$latest_stories = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->query("SELECT username, created_at FROM users ORDER BY created_at DESC LIMIT 5");
$latest_users = $stmt->fetchAll(PDO::FETCH_ASSOC);

$film_count = (int)$pdo->query("SELECT COUNT(*) FROM stories WHERE series_id IS NULL")->fetchColumn();
$series_count = (int)$pdo->query("SELECT COUNT(*) FROM series")->fetchColumn();
$actor_count = (int)$pdo->query("SELECT COUNT(*) FROM virtual_actors")->fetchColumn();
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join SocialArena.org</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/home.css">
    <link rel="stylesheet" href="css/public_header.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=Playfair+Display:wght@500;700&display=swap">
</head>
<body>
    <div class="home-page">
        <?php include 'includes/public_header.php'; ?>

        <section class="hero">
            <div class="hero-copy">
                <div class="eyebrow">For everyday creators</div>
                <h1>Stop juggling tools. Build, generate, and publish in one creative system.</h1>
                <p>SocialArena.org ties your ideas directly to generation so you can finish stories faster, ship consistently, and keep everything organized in one place.</p>
                <div class="hero-actions">
                    <a href="register.php" class="btn">Create Your Studio</a>
                    <a href="login.php" class="btn btn-secondary">Log In</a>
                </div>
                <div class="hero-highlights">
                    <div class="highlight">Turn messy ideas into finished episodes</div>
                    <div class="highlight">Generate directly from your idea boards</div>
                    <div class="highlight">Publish films, series, and studio pages</div>
                </div>
                <div class="hero-stats">
                    <div class="stat">
                        <span class="stat-number"><?php echo $film_count; ?></span>
                        <span class="stat-label">Films in the vault</span>
                    </div>
                    <div class="stat">
                        <span class="stat-number"><?php echo $series_count; ?></span>
                        <span class="stat-label">Series in development</span>
                    </div>
                    <div class="stat">
                        <span class="stat-number"><?php echo $actor_count; ?></span>
                        <span class="stat-label">Virtual cast profiles</span>
                    </div>
                </div>
            </div>
            <div class="hero-panel">
                <div class="panel-card">
                    <div class="panel-title">Your AI Story Pipeline</div>
                    <ul>
                        <li>Node-based idea boards tied to generation</li>
                        <li>Keep canon consistent across episodes</li>
                        <li>Draft, generate, and publish without tool sprawl</li>
                    </ul>
                    <div class="panel-foot">
                        <span>Latest project in motion</span>
                        <strong><?php echo htmlspecialchars($latest_stories[0]['title'] ?? 'Your next film'); ?></strong>
                    </div>
                </div>
                <div class="panel-card panel-card-alt">
                    <div class="panel-title">Creator Workflow</div>
                    <div class="pulse-grid">
                        <div>
                            <span class="pulse-label">Phase</span>
                            <strong>Concept to Publish</strong>
                        </div>
                        <div>
                            <span class="pulse-label">Workflow</span>
                            <strong>Plan ? Generate ? Publish</strong>
                        </div>
                        <div>
                            <span class="pulse-label">Creator Mode</span>
                            <strong>Solo or Studio</strong>
                        </div>
                    </div>
                    <a href="register.php" class="btn btn-secondary">Start creating</a>
                </div>
            </div>
        </section>

        <section class="pipeline">
            <div class="section-header">
                <h2>The Outcomes Creators Care About</h2>
                <p>Finish more episodes, stay consistent, and ship without chaos.</p>
            </div>
            <div class="pipeline-grid">
                <div class="pipeline-card">
                    <h3>Finish More Stories</h3>
                    <p>Turn loose ideas into structured scenes and clips you can actually ship.</p>
                </div>
                <div class="pipeline-card">
                    <h3>Generate in Context</h3>
                    <p>Your nodes connect directly to generation — no copy/paste across tools.</p>
                </div>
                <div class="pipeline-card">
                    <h3>Publish with Confidence</h3>
                    <p>Public pages for your films, series, and studio — ready to share.</p>
                </div>
                <div class="pipeline-card">
                    <h3>Scale When Ready</h3>
                    <p>Add production ops, budgets, and timelines when your studio grows.</p>
                </div>
            </div>
        </section>

        <section class="toolkit">
            <div class="section-header">
                <h2>Your Competitive Edge</h2>
                <a href="register.php" class="btn btn-secondary">Open your workspace</a>
            </div>
            <div class="tool-grid">
                <div class="tool-card">
                    <h3>Connected Idea Boards</h3>
                    <p>Nodes that actually drive generation — not just notes in a box.</p>
                </div>
                <div class="tool-card">
                    <h3>Creator‑Ready Publishing</h3>
                    <p>Series pages, clips, and studio profiles built for sharing.</p>
                </div>
                <div class="tool-card">
                    <h3>Keep Canon Clean</h3>
                    <p>Characters, locations, wardrobe, and props stay linked across projects.</p>
                </div>
                <div class="tool-card">
                    <h3>Everything in One Place</h3>
                    <p>No more jumping between Notion, Docs, Discord, and scattered folders.</p>
                </div>
            </div>
        </section>

        <section class="latest-wrap">
            <div class="latest-stories">
                <div class="section-header">
                    <h2>Latest Films</h2>
                    <a href="login.php" class="btn btn-secondary">Sign in to view</a>
                </div>
                <div class="story-grid">
                    <?php foreach($latest_stories as $story): ?>
                        <article class="story-tile">
                            <div class="story-thumb">
                                <img src="<?php echo htmlspecialchars($story['thumbnail_url'] ?? 'images/default-story.svg'); ?>"
                                     alt="<?php echo htmlspecialchars($story['title']); ?> thumbnail"
                                     loading="lazy">
                            </div>
                            <div class="story-body">
                                <h3><?php echo htmlspecialchars($story['title']); ?></h3>
                                <div class="story-meta">
                                    <span>By <?php echo htmlspecialchars($story['author'] ?? 'Unknown'); ?></span>
                                    <span><?php echo htmlspecialchars($story['genre']); ?></span>
                                </div>
                                <p><?php echo htmlspecialchars($story['description']); ?></p>
                                <a href="login.php" class="text-link">Login to view</a>
                            </div>
                        </article>
                    <?php endforeach; ?>
                </div>
            </div>

            <aside class="latest-users">
                <h3>Newest Creators</h3>
                <ul>
                    <?php foreach ($latest_users as $user): ?>
                        <li>
                            <span><?php echo htmlspecialchars($user['username']); ?></span>
                            <small><?php echo date('M d', strtotime($user['created_at'])); ?></small>
                        </li>
                    <?php endforeach; ?>
                </ul>
            </aside>
        </section>

        <footer class="home-footer">
            <div>SocialArena.org</div>
            <div>&copy; <?php echo date('Y'); ?> SocialArena Workspace</div>
        </footer>
    </div>
</body>
</html>

