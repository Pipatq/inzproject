console.log("🚀 File System frontend script loaded!");

// You can add interactive JavaScript here in the future.
// For example, fetching data from your API and displaying it on the page.
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page is fully loaded. Ready to add interactivity!');
});
document.addEventListener('DOMContentLoaded', () => {
    // --- Delete Confirmation Logic ---
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            const objectId = this.dataset.id;
            
            Swal.fire({
                title: 'Are you sure?',
                text: "This item will be moved to the trash.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, move it to trash!'
            }).then((result) => {
                if (result.isConfirmed) {
                    // Create a form and submit it
                    const form = document.createElement('form');
                    form.method = 'POST';
                    form.action = `/fs-api/delete/${objectId}`;
                    document.body.appendChild(form);
                    form.submit();
                }
            });
        });
    });

    // --- Permanent Delete Confirmation (in trash.ejs) ---
    document.querySelectorAll('.delete-form').forEach(form => {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            Swal.fire({
                title: 'Delete Permanently?',
                text: "You won't be able to revert this!",
                icon: 'error',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete it!'
            }).then((result) => {
                if (result.isConfirmed) {
                    form.submit();
                }
            });
        });
    });
    
    // --- Empty Trash Confirmation ---
    const emptyTrashForm = document.getElementById('empty-trash-form');
    if(emptyTrashForm) {
        emptyTrashForm.addEventListener('submit', function(event) {
            event.preventDefault();
            Swal.fire({
                title: 'Empty the entire trash?',
                text: "All items will be permanently deleted.",
                icon: 'error',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, empty it!'
            }).then((result) => {
                if (result.isConfirmed) {
                    emptyTrashForm.submit();
                }
            });
        });
    }

    // --- Rename Logic ---
    document.querySelectorAll('.rename-btn').forEach(button => {
        button.addEventListener('click', function() {
            const nameContainer = this.parentElement;
            const currentName = nameContainer.dataset.name;
            const objectId = nameContainer.dataset.id;
            const span = nameContainer.querySelector('span');

            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.classList.add('rename-input');

            nameContainer.replaceChild(input, span);
            input.focus();
            input.select();

            const saveRename = async () => {
                const newName = input.value;
                if (newName && newName !== currentName) {
                    try {
                        const response = await fetch(`/fs-api/rename/${objectId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ newName: newName })
                        });
                        if (response.ok) {
                            // Just reload the page to see the change
                            window.location.reload();
                        } else {
                           throw new Error('Rename failed');
                        }
                    } catch (error) {
                        console.error(error);
                        nameContainer.replaceChild(span, input); // Revert on error
                    }
                } else {
                    nameContainer.replaceChild(span, input); // Revert if no change
                }
            };

            input.addEventListener('blur', saveRename);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    saveRename();
                } else if (e.key === 'Escape') {
                    nameContainer.replaceChild(span, input);
                }
            });
        });
    });
});
