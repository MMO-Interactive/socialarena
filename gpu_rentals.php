<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$page_title = 'GPU Rentals';
$additional_css = ['css/gpu_rentals.css'];
include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="gpu-header">
                <div>
                    <h1>GPU Rentals</h1>
                    <p class="muted">Start a GPU session for image, video, or audio generation.</p>
                </div>
                <div class="gpu-actions"></div>
            </div>

            <section class="gpu-section">
                <div class="section-header gpu-deploy-header">
                    <div>
                        <h2>Live RunPod Pods</h2>
                        <p>Actual running pods fetched from RunPod.</p>
                    </div>
                    <button class="btn secondary-btn" id="refresh-live-pods">Refresh Pods</button>
                </div>
                <div class="gpu-sessions" id="gpu-live-pods"></div>
            </section>

            <section class="gpu-section">
                <div class="section-header">
                    <h2>Saved Pod Templates</h2>
                    <p>Quick access to templates you’ve saved.</p>
                </div>
                <div class="gpu-grid" id="gpu-templates"></div>
            </section>

            <section class="gpu-section">
                <div class="section-header gpu-deploy-header">
                    <div>
                        <h2>Deploy a Pod</h2>
                        <p>Filter GPUs and deploy using a template.</p>
                    </div>
                    <button class="btn secondary-btn" id="refresh-catalog">Refresh Catalog</button>
                </div>
                <div class="gpu-template-bar">
                    <div>
                        <div class="gpu-template-label">Pod template</div>
                        <div class="gpu-template-value" id="selected-template-label">No template selected</div>
                    </div>
                    <div class="gpu-template-actions">
                        <button class="btn secondary-btn" id="change-template">Change Template</button>
                        <button class="btn" id="create-template">Add Template</button>
                    </div>
                </div>
                <div class="gpu-deploy-config">
                    <label>
                        Pod name
                        <input type="text" id="pod-name" placeholder="my-pod">
                    </label>
                    <div class="gpu-count">
                        <div class="gpu-count-label">GPU count</div>
                        <div class="gpu-count-buttons" id="gpu-count">
                            <button class="btn secondary-btn active" data-count="1">1</button>
                            <button class="btn secondary-btn" data-count="2">2</button>
                            <button class="btn secondary-btn" data-count="3">3</button>
                            <button class="btn secondary-btn" data-count="4">4</button>
                        </div>
                    </div>
                    <label>
                        Cloud type
                        <select id="cloud-type">
                            <option value="secure">Secure cloud</option>
                            <option value="community">Community cloud</option>
                        </select>
                    </label>
                    <div class="pricing-grid" id="pricing-grid">
                        <button class="pricing-card active" data-pricing="on_demand">
                            <span class="pricing-title">On-Demand</span>
                            <span class="pricing-sub">Non-interruptible</span>
                            <span class="pricing-rate" data-role="rate">$0.00/hr</span>
                        </button>
                        <button class="pricing-card" data-pricing="spot">
                            <span class="pricing-title">Spot</span>
                            <span class="pricing-sub">Interruptible</span>
                            <span class="pricing-rate" data-role="rate">$0.00/hr</span>
                        </button>
                        <button class="pricing-card disabled" data-pricing="savings_3mo" disabled>
                            <span class="pricing-title">3 Month Savings</span>
                            <span class="pricing-sub">Coming soon</span>
                            <span class="pricing-rate">$0.00/hr</span>
                        </button>
                        <button class="pricing-card disabled" data-pricing="savings_6mo" disabled>
                            <span class="pricing-title">6 Month Savings</span>
                            <span class="pricing-sub">Coming soon</span>
                            <span class="pricing-rate">$0.00/hr</span>
                        </button>
                        <button class="pricing-card disabled" data-pricing="savings_1yr" disabled>
                            <span class="pricing-title">1 Year Savings</span>
                            <span class="pricing-sub">Coming soon</span>
                            <span class="pricing-rate">$0.00/hr</span>
                        </button>
                    </div>
                </div>
                <div class="gpu-deploy-filters">
                    <label>
                        Search
                        <input type="text" id="gpu-search" placeholder="Search GPUs">
                    </label>
                    <label>
                        VRAM (GB)
                        <input type="range" id="gpu-vram" min="8" max="192" value="8">
                        <span id="gpu-vram-value">Any</span>
                    </label>
                    <div class="gpu-filter-buttons" id="gpu-filters">
                        <button class="btn secondary-btn active" data-filter="all">All</button>
                        <button class="btn secondary-btn" data-filter="nvidia-latest">NVIDIA latest</button>
                        <button class="btn secondary-btn" data-filter="nvidia-prev">NVIDIA previous</button>
                        <button class="btn secondary-btn" data-filter="amd">AMD</button>
                        <button class="btn secondary-btn" data-filter="other">Other</button>
                    </div>
                </div>
                <div class="gpu-grid" id="gpu-deploy-grid"></div>
            </section>
        </main>
    </div>
</div>

<div class="modal-backdrop" id="template-picker-modal">
    <div class="modal-card modal-wide">
        <div class="modal-header">
            <h3>Explore Pod Templates</h3>
            <button class="modal-close" id="template-picker-close">×</button>
        </div>
        <div class="modal-body">
            <div class="template-search">
                <input type="text" id="template-search" placeholder="Search templates">
            </div>
            <div class="template-filters" id="template-filters">
                <button class="btn secondary-btn active" data-filter="all">All</button>
                <button class="btn secondary-btn" data-filter="official">Official</button>
                <button class="btn secondary-btn" data-filter="verified">Verified</button>
                <button class="btn secondary-btn" data-filter="community">Community</button>
                <button class="btn secondary-btn" data-filter="saved">Saved</button>
            </div>
            <div class="template-list" id="template-list"></div>
        </div>
    </div>
</div>

<div class="modal-backdrop" id="template-modal">
    <div class="modal-card">
        <div class="modal-header">
            <h3>Create Template</h3>
            <button class="modal-close" id="template-close">×</button>
        </div>
        <div class="modal-body">
            <label>
                Template Name
                <input type="text" id="template-name" placeholder="Standard 4090">
            </label>
            <label>
                RunPod Template ID
                <input type="text" id="template-id" placeholder="runpod-template-id">
            </label>
            <label>
                Hourly Rate (USD)
                <input type="number" id="template-rate" min="0" step="0.01" value="0">
            </label>
        </div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="template-cancel">Cancel</button>
            <button class="btn" id="template-save">Save Template</button>
        </div>
    </div>
</div>

<script src="js/gpu_rentals.js"></script>
</body>
</html>
