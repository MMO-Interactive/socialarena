const messagesEl = document.getElementById('planner-chat-messages');
const inputEl = document.getElementById('planner-chat-input');
const sendBtn = document.getElementById('planner-chat-send');

const context = window.plannerChatContext || {};
const storageKey = `planner_chat_${context.chatKey || context.storyId || 'story'}`;

let conversation = [];

function loadConversation() {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;
    try {
        conversation = JSON.parse(saved) || [];
    } catch (err) {
        conversation = [];
    }
}

function saveConversation() {
    localStorage.setItem(storageKey, JSON.stringify(conversation));
}

function addMessage(role, content) {
    conversation.push({ role, content });
    saveConversation();
    renderMessage(role, content);
}

function renderMessage(role, content) {
    const bubble = document.createElement('div');
    bubble.className = `planner-chat-bubble ${role}`;
    bubble.textContent = content;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderConversation() {
    messagesEl.innerHTML = '';
    conversation.forEach(message => renderMessage(message.role, message.content));
}

function buildContextString() {
    const lines = [];
    if (context.storyTitle) lines.push(`Title: ${context.storyTitle}`);
    if (context.genre) lines.push(`Genre: ${context.genre}`);
    if (context.setting) lines.push(`Setting: ${context.setting}`);
    if (context.mainCharacter) lines.push(`Main Character: ${context.mainCharacter}`);
    if (context.description) lines.push(`Description: ${context.description}`);
    if (context.seriesTitle) lines.push(`Series: ${context.seriesTitle}`);
    if (context.universeTitle) lines.push(`Universe: ${context.universeTitle}`);
    if (context.outline) lines.push(`Outline:\n${context.outline}`);
    return lines.join('\n');
}

async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    addMessage('user', text);
    inputEl.value = '';

    const payload = {
        story_id: context.storyId,
        season_id: context.seasonId,
        episode_id: context.episodeId,
        context: buildContextString(),
        messages: conversation
    };

    sendBtn.disabled = true;
    sendBtn.textContent = 'Thinking...';

    try {
        const response = await fetch('includes/planner_chat.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to get response');
        }
        addMessage('assistant', data.reply);
    } catch (err) {
        addMessage('assistant', 'I hit an error. Please try again or check the server log.');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
    }
}

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

loadConversation();
renderConversation();
