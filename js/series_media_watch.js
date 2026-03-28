(() => {
  const likeBtn = document.getElementById('like-btn');
  const commentForm = document.getElementById('comment-form');
  const commentList = document.getElementById('comment-list');

  if (likeBtn) {
    likeBtn.addEventListener('click', async () => {
      const mediaId = likeBtn.dataset.mediaId;
      const res = await fetch('includes/series_media_public_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_like', media_id: mediaId })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Unable to like');
        return;
      }
      likeBtn.dataset.liked = data.liked ? '1' : '0';
      likeBtn.textContent = `${data.liked ? 'Liked' : 'Like'} (${data.count})`;
    });
  }

  if (commentForm) {
    commentForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = document.getElementById('comment-text').value.trim();
      const mediaId = likeBtn.dataset.mediaId;
      if (!text) return;
      const res = await fetch('includes/series_media_public_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_comment', media_id: mediaId, comment: text })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Unable to comment');
        return;
      }
      const div = document.createElement('div');
      div.className = 'comment-item';
      div.innerHTML = `<div class="comment-avatar">${data.profile_photo ? `<img src="${data.profile_photo}" alt="">` : `<span>${data.username[0] || 'U'}</span>`}</div><div class="comment-body"><strong>${data.username}</strong><span>${data.comment}</span><div class="comment-meta">Just now</div><div class="comment-actions">Like ? Reply</div></div>`;
      commentList.prepend(div);
      document.getElementById('comment-text').value = '';
    });
  }
})();
