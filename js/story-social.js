function toggleFollow(authorId, button) {
    fetch('includes/toggle_follow.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ author_id: authorId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (data.isFollowing) {
                button.classList.add('following');
            } else {
                button.classList.remove('following');
            }
            button.innerHTML = data.isFollowing ? 
                '<i class="fas fa-user-check"></i> Following' : 
                '<i class="fas fa-user-plus"></i> Follow';
        }
    });
}

function toggleBookmark(storyId, button) {
    fetch('includes/toggle_bookmark.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ story_id: storyId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            button.classList.toggle('bookmarked-btn');
            button.innerHTML = data.isBookmarked ? 
                '<i class="fas fa-bookmark"></i> Bookmarked' : 
                '<i class="far fa-bookmark"></i> Bookmark';
        }
    });
}

function shareStory(platform) {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title);
    
    let shareUrl;
    switch(platform) {
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
            break;
        case 'whatsapp':
            shareUrl = `https://wa.me/?text=${title}%20${url}`;
            break;
    }
    
    if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=600,height=400');
    }
}

function copyLink() {
    navigator.clipboard.writeText(window.location.href)
        .then(() => {
            alert('Link copied to clipboard!');
        });
} 
