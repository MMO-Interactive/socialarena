<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/runpod.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$page_title = 'RunPod Analytics';
$additional_css = ['css/runpod_analytics.css'];

$pods = [];
$error = '';
$lastUpdated = date('M j, Y g:i A');

try {
    $pods = runpodListPods();
    foreach ($pods as &$pod) {
        if (!empty($pod['id'])) {
            $metrics = runpodGetPodMetrics($pod['id']);
            if (is_array($metrics)) {
                $pod['metrics'] = $metrics;
            }
        }
    }
    unset($pod);
} catch (Throwable $e) {
    $error = $e->getMessage();
}

$totalPods = count($pods);
$runningPods = 0;
$totalCost = 0.0;
$gpuUtilSum = 0.0;
$gpuUtilCount = 0;
$cpuUtilSum = 0.0;
$cpuUtilCount = 0;
$memPctSum = 0.0;
$memPctCount = 0;
$diskPctSum = 0.0;
$diskPctCount = 0;

foreach ($pods as $pod) {
    if (($pod['status'] ?? '') === 'running') {
        $runningPods++;
    }
    if (isset($pod['costPerHr'])) {
        $totalCost += (float)$pod['costPerHr'];
    }
    $gpuUtil = $pod['utilization']['gpu'] ?? null;
    if ($gpuUtil !== null) {
        $gpuUtilSum += (float)$gpuUtil;
        $gpuUtilCount++;
    }
    $cpuUtil = $pod['utilization']['cpu'] ?? null;
    if ($cpuUtil !== null) {
        $cpuUtilSum += (float)$cpuUtil;
        $cpuUtilCount++;
    }
    $memPct = $pod['memory']['percent'] ?? null;
    if ($memPct !== null) {
        $memPctSum += (float)$memPct;
        $memPctCount++;
    }
    $diskPct = $pod['disk']['percent'] ?? null;
    if ($diskPct !== null) {
        $diskPctSum += (float)$diskPct;
        $diskPctCount++;
    }
}

$avgGpuUtil = $gpuUtilCount ? $gpuUtilSum / $gpuUtilCount : null;
$avgCpuUtil = $cpuUtilCount ? $cpuUtilSum / $cpuUtilCount : null;
$avgMemPct = $memPctCount ? $memPctSum / $memPctCount : null;
$avgDiskPct = $diskPctCount ? $diskPctSum / $diskPctCount : null;

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="analytics-header">
                <div>
                    <h1>RunPod Analytics</h1>
                    <p class="muted">Live overview of your active GPU pods and usage.</p>
                </div>
                <div class="analytics-actions">
                    <span class="muted">Updated <?php echo htmlspecialchars($lastUpdated); ?></span>
                    <a class="btn secondary-btn" href="runpod_analytics.php">Refresh</a>
                </div>
            </div>

            <?php if ($error): ?>
                <div class="error-message"><?php echo htmlspecialchars($error); ?></div>
            <?php endif; ?>

            <section class="analytics-grid">
                <div class="analytics-card">
                    <h3>Total Pods</h3>
                    <div class="analytics-value"><?php echo $totalPods; ?></div>
                    <p class="muted"><?php echo $runningPods; ?> running</p>
                </div>
                <div class="analytics-card">
                    <h3>Spend Rate</h3>
                    <div class="analytics-value">$<?php echo number_format($totalCost, 2); ?>/hr</div>
                    <p class="muted">Estimated from active pods</p>
                </div>
                <div class="analytics-card">
                    <h3>Avg GPU Utilization</h3>
                    <div class="analytics-value"><?php echo $avgGpuUtil !== null ? number_format($avgGpuUtil, 1) . '%' : '—'; ?></div>
                    <p class="muted">Across reported pods</p>
                </div>
                <div class="analytics-card">
                    <h3>Avg CPU Utilization</h3>
                    <div class="analytics-value"><?php echo $avgCpuUtil !== null ? number_format($avgCpuUtil, 1) . '%' : '—'; ?></div>
                    <p class="muted">Across reported pods</p>
                </div>
                <div class="analytics-card">
                    <h3>Avg Memory</h3>
                    <div class="analytics-value"><?php echo $avgMemPct !== null ? number_format($avgMemPct, 1) . '%' : '—'; ?></div>
                    <p class="muted">RAM usage percent</p>
                </div>
                <div class="analytics-card">
                    <h3>Avg Disk</h3>
                    <div class="analytics-value"><?php echo $avgDiskPct !== null ? number_format($avgDiskPct, 1) . '%' : '—'; ?></div>
                    <p class="muted">Disk usage percent</p>
                </div>
            </section>

            <section class="analytics-section">
                <div class="section-header">
                    <h2>Live Pods</h2>
                    <p>Current pods with utilization and access details.</p>
                </div>
                <?php if (!$pods): ?>
                    <div class="empty-state">No pods found.</div>
                <?php else: ?>
                    <div class="analytics-table">
                        <div class="analytics-row analytics-head">
                            <span>Name</span>
                            <span>Status</span>
                            <span>GPU</span>
                            <span>Uptime</span>
                            <span>Utilization</span>
                            <span>Memory</span>
                            <span>Disk</span>
                            <span>Cost/hr</span>
                            <span>Access</span>
                        </div>
                        <?php foreach ($pods as $pod): ?>
                            <?php
                                $createdAt = $pod['createdAt'] ?? null;
                                $uptime = '—';
                                if ($createdAt) {
                                    $start = strtotime($createdAt);
                                    if ($start) {
                                        $diff = time() - $start;
                                        $hours = floor($diff / 3600);
                                        $minutes = floor(($diff % 3600) / 60);
                                        $uptime = sprintf('%dh %dm', $hours, $minutes);
                                    }
                                }
                                $gpuLabel = trim(($pod['gpuTypeId'] ?? '') . ' x' . ($pod['gpuCount'] ?? 1));
                                $utilGpu = $pod['utilization']['gpu'] ?? null;
                                $utilCpu = $pod['utilization']['cpu'] ?? null;
                                $memUsed = $pod['memory']['used'] ?? null;
                                $memTotal = $pod['memory']['total'] ?? null;
                                $memPct = $pod['memory']['percent'] ?? null;
                                $diskUsed = $pod['disk']['used'] ?? null;
                                $diskTotal = $pod['disk']['total'] ?? null;
                                $diskPct = $pod['disk']['percent'] ?? null;
                                $accessUrl = '';
                                if (!empty($pod['publicIp']) && !empty($pod['publicPort'])) {
                                    $accessUrl = 'http://' . $pod['publicIp'] . ':' . $pod['publicPort'];
                                }
                            ?>
                            <div class="analytics-row">
                                <span class="cell-title">
                                    <?php echo htmlspecialchars($pod['name'] ?: 'Unnamed pod'); ?>
                                    <small><?php echo htmlspecialchars($pod['id'] ?? ''); ?></small>
                                </span>
                                <span class="status-pill status-<?php echo htmlspecialchars($pod['status'] ?? 'unknown'); ?>">
                                    <?php echo htmlspecialchars($pod['status'] ?? 'unknown'); ?>
                                </span>
                                <span><?php echo htmlspecialchars($gpuLabel); ?></span>
                                <span><?php echo htmlspecialchars($uptime); ?></span>
                                <span><?php echo $utilGpu !== null ? number_format($utilGpu, 1) . '% GPU' : '—'; ?><?php echo $utilCpu !== null ? ' / ' . number_format($utilCpu, 1) . '% CPU' : ''; ?></span>
                                <span><?php echo $memPct !== null ? number_format($memPct, 1) . '% ' : '— '; ?><?php echo ($memUsed !== null && $memTotal !== null) ? '(' . $memUsed . '/' . $memTotal . ' GB)' : ''; ?></span>
                                <span><?php echo $diskPct !== null ? number_format($diskPct, 1) . '% ' : '— '; ?><?php echo ($diskUsed !== null && $diskTotal !== null) ? '(' . $diskUsed . '/' . $diskTotal . ' GB)' : ''; ?></span>
                                <span><?php echo isset($pod['costPerHr']) ? '$' . number_format((float)$pod['costPerHr'], 2) : '—'; ?></span>
                                <span>
                                    <?php if ($accessUrl): ?>
                                        <a class="link-btn" href="<?php echo htmlspecialchars($accessUrl); ?>" target="_blank" rel="noopener">Open</a>
                                    <?php else: ?>
                                        —
                                    <?php endif; ?>
                                </span>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </section>
        </main>
    </div>
</div>

</body>
</html>
