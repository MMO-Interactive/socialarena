function updateSeriesList() {
    const universeId = document.getElementById('universe_id').value;
    const seriesSelect = document.getElementById('series_id');
    const options = seriesSelect.options;

    // Reset to first option
    seriesSelect.selectedIndex = 0;

    // Show/hide options based on universe selection
    for (let i = 1; i < options.length; i++) {
        const option = options[i];
        const seriesUniverseId = option.getAttribute('data-universe');
        
        if (!universeId) {
            // Show only standalone series (null universe_id)
            option.style.display = seriesUniverseId === 'null' ? '' : 'none';
        } else {
            // Show only series from selected universe
            option.style.display = seriesUniverseId === universeId ? '' : 'none';
        }
    }
}

// Call on page load
document.addEventListener('DOMContentLoaded', updateSeriesList);

async function getStoryTitleSuggestions() {
    const button = event.currentTarget;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

    try {
        // Get context from universe and series if selected
        const universeSelect = document.getElementById('universe_id');
        const seriesSelect = document.getElementById('series_id');
        const genre = document.getElementById('genre').value;
        
        let context = {
            type: 'title',
            count: 5,
            genre: genre
        };

        // Add universe context if selected
        if (universeSelect && universeSelect.value) {
            context.universe_id = universeSelect.value;
            context.universe_title = universeSelect.options[universeSelect.selectedIndex].text;
        }

        // Add series context if selected
        if (seriesSelect && seriesSelect.value && seriesSelect.style.display !== 'none') {
            context.series_id = seriesSelect.value;
            context.series_title = seriesSelect.options[seriesSelect.selectedIndex].text;
        }

        const response = await fetch('includes/get_story_suggestions.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(context)
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

async function getStoryDescriptionSuggestions() {
    const button = event.currentTarget;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

    try {
        const title = document.getElementById('title').value;
        const genre = document.getElementById('genre').value;
        const universeSelect = document.getElementById('universe_id');
        const seriesSelect = document.getElementById('series_id');

        let context = {
            type: 'description',
            count: 3,
            title: title || 'the story',
            genre: genre
        };

        // Add universe context if selected
        if (universeSelect && universeSelect.value) {
            context.universe_id = universeSelect.value;
            context.universe_title = universeSelect.options[universeSelect.selectedIndex].text;
        }

        // Add series context if selected
        if (seriesSelect && seriesSelect.value && seriesSelect.style.display !== 'none') {
            context.series_id = seriesSelect.value;
            context.series_title = seriesSelect.options[seriesSelect.selectedIndex].text;
        }

        const response = await fetch('includes/get_story_suggestions.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(context)
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