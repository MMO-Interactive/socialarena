async function getUniverseTitleSuggestions() {
    const button = event.target;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

    try {
        const response = await fetch('includes/get_universe_suggestions.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'title',
                count: 5
            })
        });

        const data = await response.json();
        
        if (data.success) {
            displaySuggestions('title-suggestions', data.suggestions, 'title');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        alert('Failed to get suggestions: ' + error.message);
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-robot"></i> Get Title Ideas';
    }
}

async function getUniverseDescriptionSuggestions() {
    const button = event.target;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

    try {
        const response = await fetch('includes/get_universe_suggestions.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'description',
                title: document.getElementById('title').value,
                count: 3
            })
        });

        const data = await response.json();
        
        if (data.success) {
            displaySuggestions('description-suggestions', data.suggestions, 'description');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        alert('Failed to get suggestions: ' + error.message);
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-robot"></i> Get Description Ideas';
    }
}

function displaySuggestions(containerId, suggestions, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    suggestions.forEach(suggestion => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = suggestion;
        div.onclick = () => {
            document.getElementById(type).value = suggestion;
            container.innerHTML = '';
        };
        container.appendChild(div);
    });
} 
