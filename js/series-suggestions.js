async function getSeriesTitleSuggestions() {
    const button = event.currentTarget;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

    try {
        // Get selected universe if any
        const universeId = document.getElementById('universe_id')?.value;
        let universeContext = '';
        
        if (universeId) {
            const universeSelect = document.getElementById('universe_id');
            const universeTitle = universeSelect.options[universeSelect.selectedIndex].text;
            universeContext = `for the universe "${universeTitle}"`;
        }

        const response = await fetch('includes/get_series_suggestions.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'title',
                count: 5,
                universe_id: universeId,
                universe_context: universeContext
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

async function getSeriesDescriptionSuggestions() {
    const button = event.currentTarget;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

    try {
        const title = document.getElementById('title').value;
        const universeId = document.getElementById('universe_id')?.value;
        let universeContext = '';
        
        if (universeId) {
            const universeSelect = document.getElementById('universe_id');
            const universeTitle = universeSelect.options[universeSelect.selectedIndex].text;
            universeContext = `set in the universe "${universeTitle}"`;
        }

        const response = await fetch('includes/get_series_suggestions.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'description',
                title: title || 'the series',
                count: 3,
                universe_id: universeId,
                universe_context: universeContext
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
    
    const suggestionsList = document.createElement('div');
    suggestionsList.className = 'suggestions-list';
    
    suggestions.forEach(suggestion => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = suggestion;
        
        // Add hover effect class
        div.addEventListener('mouseover', () => div.classList.add('suggestion-hover'));
        div.addEventListener('mouseout', () => div.classList.remove('suggestion-hover'));
        
        // Add click handler
        div.addEventListener('click', () => {
            const input = document.getElementById(type);
            input.value = suggestion;
            input.focus();
            container.innerHTML = '';
        });
        
        suggestionsList.appendChild(div);
    });
    
    container.appendChild(suggestionsList);
} 