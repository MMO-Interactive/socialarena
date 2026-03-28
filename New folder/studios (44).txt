<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';

$page_title = 'Music Composer';
$additional_css = ['css/music_composer.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="composer-shell">
                <aside class="composer-panel">
                    <div class="composer-header">
                        <h1>Music Composer</h1>
                        <p>Draft music prompts tailored for AI sound generation. Export-ready for ComfyUI workflows.</p>
                    </div>

                    <div class="composer-mode">
                        <button class="btn secondary-btn active" data-mode="simple">Simple</button>
                        <button class="btn secondary-btn" data-mode="custom">Custom</button>
                    </div>

                    <div class="composer-section">
                        <label>Theme / Story Beat</label>
                        <textarea id="composer-theme" placeholder="Describe the scene, mood, or story beat..."></textarea>
                    </div>

                    <div class="composer-section">
                        <label>Lyrics (optional)</label>
                        <textarea id="composer-lyrics" placeholder="Leave blank for instrumental..."></textarea>
                    </div>

                    <div class="composer-section">
                        <label>Style Tags</label>
                        <input type="text" id="composer-style" placeholder="e.g. cinematic, synthwave, hopeful">
                    </div>

                    <div class="composer-grid">
                        <div>
                            <label>Tempo</label>
                            <select id="composer-tempo">
                                <option value="70">Slow (70 BPM)</option>
                                <option value="90">Medium (90 BPM)</option>
                                <option value="110" selected>Driving (110 BPM)</option>
                                <option value="130">Fast (130 BPM)</option>
                            </select>
                        </div>
                        <div>
                            <label>Key</label>
                            <select id="composer-key">
                                <option value="C Minor">C Minor</option>
                                <option value="D Minor">D Minor</option>
                                <option value="E Minor">E Minor</option>
                                <option value="G Major">G Major</option>
                                <option value="A Minor" selected>A Minor</option>
                            </select>
                        </div>
                    </div>

                    <div class="composer-grid">
                        <div>
                            <label>Length</label>
                            <select id="composer-length">
                                <option value="30">30 seconds</option>
                                <option value="60" selected>60 seconds</option>
                                <option value="90">90 seconds</option>
                                <option value="120">120 seconds</option>
                            </select>
                        </div>
                        <div>
                            <label>Vocal Mode</label>
                            <select id="composer-vocals">
                                <option value="instrumental" selected>Instrumental</option>
                                <option value="female">Female vocals</option>
                                <option value="male">Male vocals</option>
                                <option value="choir">Choir</option>
                            </select>
                        </div>
                    </div>

                    <div class="composer-section">
                        <label>Instrumentation</label>
                        <input type="text" id="composer-instruments" placeholder="e.g. strings, piano, analog synths">
                    </div>

                    <div class="composer-section">
                        <label>Reference Notes</label>
                        <textarea id="composer-notes" placeholder="Any extra direction: motif, intensity curve, transitions..."></textarea>
                    </div>

                    <div class="composer-actions">
                        <button class="btn primary-btn" id="composer-create">Create Draft</button>
                        <button class="btn secondary-btn" id="composer-reset">Reset</button>
                    </div>
                </aside>

                <section class="composer-workspace">
                    <div class="workspace-toolbar">
                        <div class="search-bar">
                            <input type="text" id="composer-search" placeholder="Search drafts...">
                        </div>
                        <div class="toolbar-actions">
                            <button class="btn secondary-btn" id="composer-export-json">Export JSON</button>
                            <button class="btn secondary-btn" id="composer-export-text">Export Prompt</button>
                        </div>
                    </div>

                    <div class="draft-list" id="draft-list">
                        <div class="draft-card placeholder">
                            <p>No drafts yet. Create a draft to start building your music plan.</p>
                        </div>
                    </div>
                </section>
            </div>

            <div class="composer-player">
                <div class="player-info">
                    <strong id="player-title">No track selected</strong>
                    <span id="player-meta">Draft preview</span>
                </div>
                <div class="player-controls">
                    <button class="btn secondary-btn" disabled>⏮</button>
                    <button class="btn primary-btn" disabled>▶</button>
                    <button class="btn secondary-btn" disabled>⏭</button>
                </div>
                <div class="player-progress">
                    <span>0:00</span>
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <span>0:00</span>
                </div>
            </div>
        </main>
    </div>
</div>

<script src="js/music_composer.js"></script>
