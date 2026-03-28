function confirmDelete(type, id, title) {
    
    let message = `Are you sure you want to delete "${title}"?\n\n`;
    
    switch (type) {
        case 'universe':
            message += 'This will also delete all series and stories in this universe.';
            break;
        case 'series':
            message += 'This will also delete all stories in this series.';
            break;
        case 'story':
            message += 'This action cannot be undone.';
            break;
    }

    if (confirm(message)) {
        deleteContent(type, id);
    }
}

async function deleteContent(type, id) {
    try {
        
        const response = await fetch('includes/delete_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type, id })
        });


        const data = await response.json();
        
        if (data.success) {
            // Redirect based on content type
            switch (type) {
                case 'universe':
                case 'series':
                    window.location.href = 'writing_center.php';
                    break;
                case 'story':
                    // If we're in a series/universe, stay there, otherwise go to writing center
                    const currentUrl = window.location.href;
                    if (currentUrl.includes('series.php') || currentUrl.includes('universe.php')) {
                        location.reload();
                    } else {
                        window.location.href = 'writing_center.php';
                    }
                    break;
            }
        } else {
            throw new Error(data.error || 'Failed to delete content');
        }
    } catch (error) {
        console.error('Delete error:', error); // Debug log
        alert('Error: ' + error.message);
    }
} 
