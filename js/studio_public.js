(() => {
  const followBtn = document.getElementById('follow-btn');
  if (followBtn) {
    followBtn.addEventListener('click', async () => {
      const studioId = followBtn.dataset.studioId;
      try {
        const res = await fetch('includes/studio_public_handlers.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'follow_toggle', studio_id: studioId })
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || 'Unable to update follow status');
          return;
        }
        followBtn.dataset.followed = data.followed ? '1' : '0';
        followBtn.textContent = data.followed ? 'Following' : 'Follow';
        followBtn.classList.toggle('is-following', data.followed);
      } catch (err) {
        alert('Unable to reach server.');
      }
    });
  }

  const postModal = document.getElementById('post-modal');
  const newPostBtn = document.getElementById('new-post');
  const postCancel = document.getElementById('post-cancel');
  const postSave = document.getElementById('post-save');

  const openModal = () => {
    if (!postModal) return;
    postModal.style.display = 'flex';
  };
  const closeModal = () => {
    if (!postModal) return;
    postModal.style.display = 'none';
  };

  if (newPostBtn) newPostBtn.addEventListener('click', openModal);
  if (postCancel) postCancel.addEventListener('click', closeModal);

  if (postSave) {
    postSave.addEventListener('click', async () => {
      const studioId = postSave.dataset.studioId;
      const title = document.getElementById('post-title')?.value.trim();
      const body = document.getElementById('post-body')?.value.trim();
      const imageUrl = document.getElementById('post-image')?.value.trim();
      try {
        const res = await fetch('includes/studio_public_handlers.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_post',
            studio_id: studioId,
            title,
            body,
            image_url: imageUrl
          })
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || 'Unable to create post');
          return;
        }
        closeModal();
        location.reload();
      } catch (err) {
        alert('Unable to reach server.');
      }
    });
  }

  document.querySelectorAll('.comment-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = form.querySelector('input');
      const comment = input.value.trim();
      if (!comment) return;
      const postId = form.dataset.postId;
      try {
        const res = await fetch('includes/studio_public_handlers.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add_comment', post_id: postId, comment })
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || 'Unable to post comment');
          return;
        }
        let list = form.closest('.feed-item')?.querySelector('.comment-list');
        if (!list) {
          list = document.createElement('div');
          list.className = 'comment-list';
          form.insertAdjacentElement('beforebegin', list);
        }
        const item = document.createElement('div');
        item.className = 'comment-item';
        item.innerHTML = `<strong>You</strong><span>${comment.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
        list.appendChild(item);
        input.value = '';
      } catch (err) {
        alert('Unable to reach server.');
      }
    });
  });
})();
