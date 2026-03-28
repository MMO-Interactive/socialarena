<?php
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


$theme = 'light';
$query = trim($_GET['q'] ?? '');
$roleFilter = trim($_GET['role'] ?? '');
$requestTag = trim($_GET['request_tag'] ?? '');
$requestRole = trim($_GET['request_role'] ?? '');

$roleStmt = $pdo->query("SELECT name FROM talent_roles ORDER BY name ASC");
$roles = $roleStmt->fetchAll(PDO::FETCH_COLUMN);

$sql = "
    SELECT tp.*, GROUP_CONCAT(tr.name ORDER BY tr.name SEPARATOR ', ') AS roles
    FROM talent_profiles tp
    LEFT JOIN talent_profile_roles tpr ON tp.id = tpr.profile_id
    LEFT JOIN talent_roles tr ON tpr.role_id = tr.id
    WHERE tp.is_public = 1
";
$params = [];

if ($query !== '') {
    $sql .= " AND (tp.display_name LIKE ? OR tp.headline LIKE ? OR tp.bio LIKE ?)";
    $like = '%' . $query . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

if ($roleFilter !== '') {
    $sql .= " AND tp.id IN (
        SELECT tpr2.profile_id
        FROM talent_profile_roles tpr2
        JOIN talent_roles tr2 ON tpr2.role_id = tr2.id
        WHERE tr2.name = ?
    )";
    $params[] = $roleFilter;
}

$sql .= " GROUP BY tp.id ORDER BY tp.updated_at DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$profiles = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Talent Scout | SocialArena.org</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/talent.css">
    <link rel="stylesheet" href="css/public_header.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Archivo:wght@500;600;700&display=swap">
</head>
<body class="talent-page">
    <?php include 'includes/public_header.php'; ?>

    <main class="talent-main">
        <section class="talent-hero">
            <div>
                <h1>Talent Scout</h1>
                <p>Find voice performers, writers, prompt engineers, editors, and other AI film collaborators.</p>
            </div>
            <div class="talent-actions">
                <?php if (isset($_SESSION['user_id'])): ?>
                    <a href="talent_submit.php" class="btn">Submit your profile</a>
                <?php else: ?>
                    <a href="register.php" class="btn">Join to submit</a>
                <?php endif; ?>
            </div>
        </section>

        <section class="talent-filters">
            <form method="GET">
                <input type="text" name="q" placeholder="Search skills, roles, or names" value="<?php echo htmlspecialchars($query); ?>">
                <select name="role">
                    <option value="">All roles</option>
                    <?php foreach ($roles as $role): ?>
                        <option value="<?php echo htmlspecialchars($role); ?>" <?php echo $role === $roleFilter ? 'selected' : ''; ?>>
                            <?php echo htmlspecialchars($role); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
                <button class="btn" type="submit">Search</button>
            </form>
        </section>

        <section class="talent-grid">
            <?php if (empty($profiles)): ?>
                <div class="talent-empty">No talent profiles yet. Be the first to submit.</div>
            <?php else: ?>
                <?php foreach ($profiles as $profile): ?>
                    <a class="talent-card" href="talent_profile.php?id=<?php echo (int)$profile['id']; ?>">
                        <div class="talent-card-top">
                            <?php if (!empty($profile['avatar_url'])): ?>
                                <img src="<?php echo htmlspecialchars($profile['avatar_url']); ?>" alt="">
                            <?php else: ?>
                                <div class="talent-avatar"><?php echo strtoupper(substr($profile['display_name'], 0, 1)); ?></div>
                            <?php endif; ?>
                            <div>
                                <h3><?php echo htmlspecialchars($profile['display_name']); ?></h3>
                                <span><?php echo htmlspecialchars($profile['headline'] ?? ''); ?></span>
                            </div>
                        </div>
                        <div class="talent-meta">
                            <span class="pill"><?php echo htmlspecialchars($profile['availability'] ?? 'available'); ?></span>
                            <span class="roles"><?php echo htmlspecialchars($profile['roles'] ?? ''); ?></span>
                        </div>
                        <p><?php echo htmlspecialchars($profile['bio'] ?? ''); ?></p>
                    </a>
                <?php endforeach; ?>
            <?php endif; ?>
        </section>

        <?php
            $sqlRequests = "
                SELECT str.*, s.name AS studio_name
                FROM studio_talent_requests str
                JOIN studios s ON str.studio_id = s.id
                WHERE str.status = 'open'
            ";
            $reqParams = [];
            if ($requestRole !== '') {
                $sqlRequests .= " AND str.roles LIKE ?";
                $reqParams[] = '%' . $requestRole . '%';
            }
            if ($requestTag !== '') {
                $sqlRequests .= " AND str.tags LIKE ?";
                $reqParams[] = '%' . $requestTag . '%';
            }
            $sqlRequests .= " ORDER BY str.created_at DESC LIMIT 8";
            $stmt = $pdo->prepare($sqlRequests);
            $stmt->execute($reqParams);
            $openRequests = $stmt->fetchAll(PDO::FETCH_ASSOC);
        ?>

        <section class="talent-requests">
            <div class="row-header">
                <h2>Open Studio Requests</h2>
                <a href="index.php#studios" class="text-link">View studios</a>
            </div>
            <form method="GET" class="request-filters">
                <input type="hidden" name="q" value="<?php echo htmlspecialchars($query); ?>">
                <input type="hidden" name="role" value="<?php echo htmlspecialchars($roleFilter); ?>">
                <input type="text" name="request_role" placeholder="Filter by role" value="<?php echo htmlspecialchars($requestRole); ?>">
                <input type="text" name="request_tag" placeholder="Filter by tag" value="<?php echo htmlspecialchars($requestTag); ?>">
                <button class="btn" type="submit">Filter</button>
            </form>
            <div class="request-list">
                <?php if (empty($openRequests)): ?>
                    <div class="talent-empty">No open requests right now.</div>
                <?php else: ?>
                    <?php foreach ($openRequests as $request): ?>
                        <div class="request-item">
                            <strong><?php echo htmlspecialchars($request['title']); ?></strong>
                            <span><?php echo htmlspecialchars($request['studio_name']); ?></span>
                            <span><?php echo htmlspecialchars($request['roles'] ?? ''); ?></span>
                            <?php if (!empty($request['tags'])): ?>
                                <span><?php echo htmlspecialchars($request['tags']); ?></span>
                            <?php endif; ?>
                            <p><?php echo htmlspecialchars($request['description'] ?? ''); ?></p>
                            <?php if (isset($_SESSION['user_id'])): ?>
                                <form method="POST" action="includes/studio_talent_handlers.php" class="request-apply">
                                    <input type="hidden" name="action" value="apply">
                                    <input type="hidden" name="request_id" value="<?php echo (int)$request['id']; ?>">
                                    <textarea name="message" placeholder="Tell the studio why you're a good fit..."></textarea>
                                    <input type="text" name="portfolio_url" placeholder="Portfolio link (optional)">
                                    <button class="btn" type="submit">Apply</button>
                                </form>
                            <?php else: ?>
                                <a href="login.php" class="btn">Login to Apply</a>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </section>
    </main>
</body>
</html>

