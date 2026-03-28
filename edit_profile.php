<?php
ob_start();
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$error = '';
$success = '';

// Get user information
$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch();

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $bio = $_POST['bio'] ?? '';
        $location = $_POST['location'] ?? '';
        $website = $_POST['website'] ?? '';
        
        // Handle profile photo upload
        if (isset($_FILES['profile_photo']) && $_FILES['profile_photo']['error'] === UPLOAD_ERR_OK) {
            $allowed = ['jpg', 'jpeg', 'png', 'gif'];
            $filename = $_FILES['profile_photo']['name'];
            $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            
            if (!in_array($ext, $allowed, true)) {
                $error = 'Invalid file type. Please upload a JPG, PNG, or GIF file.';
            } else {
                $newFilename = 'profile_' . $_SESSION['user_id'] . '_' . time() . '.' . $ext;
                $uploadPath = 'uploads/profiles/' . $newFilename;
                
                if (!is_dir('uploads/profiles')) {
                    mkdir('uploads/profiles', 0777, true);
                }
                
                if (move_uploaded_file($_FILES['profile_photo']['tmp_name'], $uploadPath)) {
                    // Delete old profile photo if exists
                    if ($user['profile_photo'] && file_exists($user['profile_photo'])) {
                        unlink($user['profile_photo']);
                    }
                    $user['profile_photo'] = $uploadPath;
                }
            }
        }
        
        // Handle header image upload
        if (isset($_FILES['profile_header']) && $_FILES['profile_header']['error'] === UPLOAD_ERR_OK) {
            $allowed = ['jpg', 'jpeg', 'png', 'gif'];
            $filename = $_FILES['profile_header']['name'];
            $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            
            if (!in_array($ext, $allowed, true)) {
                $error = 'Invalid file type. Please upload a JPG, PNG, or GIF file.';
            } else {
                $newFilename = 'header_' . $_SESSION['user_id'] . '_' . time() . '.' . $ext;
                $uploadPath = 'uploads/headers/' . $newFilename;
                
                if (!is_dir('uploads/headers')) {
                    mkdir('uploads/headers', 0777, true);
                }
                
                if (move_uploaded_file($_FILES['profile_header']['tmp_name'], $uploadPath)) {
                    // Delete old header image if exists
                    if ($user['profile_header'] && file_exists($user['profile_header'])) {
                        unlink($user['profile_header']);
                    }
                    $user['profile_header'] = $uploadPath;
                }
            }
        }
        
        if (empty($error)) {
            $stmt = $pdo->prepare("
                UPDATE users 
                SET bio = ?, location = ?, website = ?, 
                    profile_photo = ?, profile_header = ?
                WHERE id = ?
            ");
            $stmt->execute([
                $bio, 
                $location, 
                $website, 
                $user['profile_photo'],
                $user['profile_header'],
                $_SESSION['user_id']
            ]);
            $success = 'Profile updated successfully';
        }
    } catch (Throwable $e) {
        $error = 'Failed to update profile';
        error_log('Edit profile error: ' . $e->getMessage());
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edit Profile</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="page-wrapper">
        <header class="site-header">
            <h1>Choose Your Own Adventure</h1>
        </header>

        <div class="content-wrapper">
            <nav class="side-nav">
                <div class="nav-section">
                    <h3>Navigation</h3>
                    <ul class="nav-list">
                        <li><a href="dashboard.php">Dashboard</a></li>
                        <li><a href="manage_keys.php">Manage API Keys</a></li>
                        <li><a href="settings_account.php">Settings</a></li>
                        <li class="nav-divider"></li>
                        <li><a href="logout.php">Logout</a></li>
                    </ul>
                </div>
            </nav>

            <main class="main-content">
                <div class="profile-edit-container">
                    <h2>Edit Profile</h2>
                    
                    <?php if ($error): ?>
                        <div class="error-message"><?php echo htmlspecialchars($error); ?></div>
                    <?php endif; ?>
                    
                    <?php if ($success): ?>
                        <div class="success-message"><?php echo htmlspecialchars($success); ?></div>
                    <?php endif; ?>

                    <form method="POST" enctype="multipart/form-data" class="profile-edit-form">
                        <div class="form-group">
                            <label>Current Profile Photo</label>
                            <div class="current-photo">
                                <img src="<?php echo htmlspecialchars($user['profile_photo'] ?? 'images/default-avatar.svg'); ?>" 
                                     alt="Current profile photo">
                            </div>
                            <label for="profile_photo">Upload New Profile Photo:</label>
                            <input type="file" id="profile_photo" name="profile_photo" accept="image/*">
                            <small>Recommended size: 200x200 pixels</small>
                        </div>

                        <div class="form-group">
                            <label>Current Header Image</label>
                            <div class="current-header">
                                <img src="<?php echo htmlspecialchars($user['profile_header'] ?? 'images/default-header.svg'); ?>" 
                                     alt="Current header image">
                            </div>
                            <label for="profile_header">Upload New Header Image:</label>
                            <input type="file" id="profile_header" name="profile_header" accept="image/*">
                            <small>Recommended size: 1500x500 pixels</small>
                        </div>

                        <div class="form-group">
                            <label for="bio">Bio:</label>
                            <textarea id="bio" name="bio" rows="4"><?php echo htmlspecialchars($user['bio'] ?? ''); ?></textarea>
                        </div>

                        <div class="form-group">
                            <label for="location">Location:</label>
                            <input type="text" id="location" name="location" 
                                   value="<?php echo htmlspecialchars($user['location'] ?? ''); ?>">
                        </div>

                        <div class="form-group">
                            <label for="website">Website:</label>
                            <input type="url" id="website" name="website" 
                                   value="<?php echo htmlspecialchars($user['website'] ?? ''); ?>"
                                   placeholder="https://">
                        </div>

                        <div class="form-actions">
                            <button type="submit" class="btn">Save Changes</button>
                            <a href="profile.php" class="btn btn-secondary">Cancel</a>
                        </div>
                    </form>
                </div>
            </main>
        </div>

        <footer class="site-footer">
            <p>&copy; <?php echo date('Y'); ?> Choose Your Own Adventure - AI Story Generator</p>
        </footer>
    </div>

    <script>
        // Preview uploaded images
        function previewImage(input, previewClass) {
            const preview = input.parentElement.querySelector('img');
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.src = e.target.result;
                }
                reader.readAsDataURL(input.files[0]);
            }
        }

        document.getElementById('profile_photo').addEventListener('change', function() {
            previewImage(this, '.current-photo img');
        });

        document.getElementById('profile_header').addEventListener('change', function() {
            previewImage(this, '.current-header img');
        });
    </script>
</body>
</html> 
