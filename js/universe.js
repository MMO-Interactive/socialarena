function editUniverse() {
    // Get universe ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const universeId = urlParams.get('id');
    
    if (!universeId) {
        console.error('No universe ID found');
        return;
    }
    
    // Redirect to edit universe page
    window.location.href = `edit_universe.php?id=${universeId}`;
}

function createSeries() {
    const urlParams = new URLSearchParams(window.location.search);
    const universeId = urlParams.get('id');
    
    if (!universeId) {
        console.error('No universe ID found');
        return;
    }
    
    window.location.href = `create_series.php?universe_id=${universeId}`;
}

function createStory() {
    const urlParams = new URLSearchParams(window.location.search);
    const universeId = urlParams.get('id');
    
    if (!universeId) {
        console.error('No universe ID found');
        return;
    }
    
    window.location.href = `create_story.php?universe_id=${universeId}`;
} 