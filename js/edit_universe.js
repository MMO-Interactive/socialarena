document.addEventListener('DOMContentLoaded', function() {
    // Handle calendar type changes
    const calendarType = document.getElementById('calendar-type');
    if (calendarType) {
        calendarType.addEventListener('change', function() {
            // Hide all calendar settings
            document.querySelectorAll('.calendar-settings').forEach(el => {
                el.style.display = 'none';
            });
            
            // Show selected calendar settings
            const selectedSettings = document.getElementById(`${this.value}-settings`);
            if (selectedSettings) {
                selectedSettings.style.display = 'block';
            }
        });
    }

    // Handle dynamic lists (eras, divisions, ages, moons)
    document.querySelectorAll('.add-item').forEach(button => {
        button.addEventListener('click', function() {
            const targetList = document.getElementById(this.dataset.target);
            if (!targetList) return;

            const newItem = document.createElement('div');
            newItem.className = 'list-item';

            switch(this.dataset.target) {
                case 'era-list':
                    newItem.innerHTML = `
                        <input type="text" name="eras[]" placeholder="Era Code (e.g., BE)">
                        <input type="text" name="era_names[]" placeholder="Era Name (e.g., Before Event)">
                        <button type="button" class="remove-item">×</button>
                    `;
                    break;
                    
                case 'division-list':
                    newItem.innerHTML = `
                        <input type="text" name="divisions[]" placeholder="Division (e.g., Early, Mid, Late)">
                        <button type="button" class="remove-item">×</button>
                    `;
                    break;
                    
                case 'age-list':
                    newItem.innerHTML = `
                        <input type="text" name="custom_divisions[]" placeholder="Age Name (e.g., First Age)">
                        <button type="button" class="remove-item">×</button>
                    `;
                    break;
                    
                case 'moon-list':
                    newItem.innerHTML = `
                        <input type="text" name="custom_months[]" placeholder="Moon Cycle Name">
                        <button type="button" class="remove-item">×</button>
                    `;
                    break;
            }

            targetList.appendChild(newItem);
            newItem.querySelector('input').focus();
        });
    });

    // Handle remove item buttons (using event delegation)
    document.addEventListener('click', function(e) {
        if (e.target.matches('.remove-item')) {
            e.target.closest('.list-item').remove();
        }
    });

    // Handle form submission
    document.getElementById('edit-universe-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        
        // Add the date format data
        const dateFormat = {
            calendar_type: formData.get('calendar_type'),
            eras: [],
            era_names: [],
            divisions: [],
            custom_months: [],
            custom_divisions: []
        };

        // Collect arrays of values
        formData.getAll('eras').forEach((era, i) => {
            if (era.trim()) {
                dateFormat.eras.push(era);
                dateFormat.era_names.push(formData.getAll('era_names')[i] || era);
            }
        });

        formData.getAll('divisions').forEach(division => {
            if (division.trim()) dateFormat.divisions.push(division);
        });

        formData.getAll('custom_months').forEach(month => {
            if (month.trim()) dateFormat.custom_months.push(month);
        });

        formData.getAll('custom_divisions').forEach(age => {
            if (age.trim()) dateFormat.custom_divisions.push(age);
        });

        // Create multipart form data
        const data = new FormData();
        data.append('action', 'update_universe');
        data.append('universe_id', new URLSearchParams(window.location.search).get('id'));
        data.append('title', formData.get('title'));
        data.append('description', formData.get('description'));
        data.append('date_format', JSON.stringify(dateFormat));
        data.append('date_description', formData.get('date_description'));
        
        // Add cover image if one was selected
        const coverImage = formData.get('cover_image');
        if (coverImage && coverImage.size > 0) {
            data.append('cover_image', coverImage);
        }

        try {
            const response = await fetch('includes/universe_handlers.php', {
                method: 'POST',
                body: data // Send as FormData instead of JSON
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.success) {
                window.location.href = `universe.php?id=${result.universe_id}`;
            } else {
                throw new Error(result.error || 'Failed to update universe');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error updating universe: ' + error.message);
        }
    });
}); 