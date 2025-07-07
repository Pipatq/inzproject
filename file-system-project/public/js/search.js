// public/js/search.js
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const gridContainer = document.querySelector('.fm-grid-container');

    if (!searchInput || !searchBtn || !gridContainer) return;

    const performSearch = async () => {
        const query = searchInput.value.trim();
        if (!query) return; // ไม่ต้องค้นหาถ้าช่องว่าง

        try {
            // เรียก API ค้นหา
            const response = await fetch(`/fs-api/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Search request failed');

            const results = await response.json();
            renderResults(results);

        } catch (error) {
            console.error('Search failed:', error);
            gridContainer.innerHTML = '<p class="empty-folder">Error during search.</p>';
        }
    };

    const renderResults = (objects) => {
        gridContainer.innerHTML = ''; // ล้างผลลัพธ์เก่า

        if (objects.length === 0) {
            gridContainer.innerHTML = '<p class="empty-folder">No results found.</p>';
            return;
        }

        objects.forEach(obj => {
            // สร้าง HTML สำหรับแต่ละ item (คล้ายกับใน EJS)
            const itemDiv = document.createElement('div');
            itemDiv.className = 'fm-item';

            let iconHtml = '';
            if (obj.is_folder) {
                iconHtml = `<a href="/files/${obj.id}"><i class="fas fa-folder"></i></a>`;
            } else if (obj.mimetype && obj.mimetype.startsWith('image/')) {
                iconHtml = `<img src="/preview/${obj.id}" alt="${obj.name}" class="thumbnail-preview">`;
            } else {
                iconHtml = '<i class="fas fa-file-alt"></i>';
            }

            // หมายเหตุ: โค้ดส่วนนี้เป็นการสร้าง HTML แบบง่ายๆ
            // สำหรับการใช้งานจริงอาจจะต้องทำให้ซับซ้อนกว่านี้เพื่อรองรับทุก Action
            itemDiv.innerHTML = `
                <div class="fm-item-icon">${iconHtml}</div>
                <div class="fm-item-name" title="${obj.name}">${obj.name}</div>
                <div class="fm-item-details">
                    <span>${new Date(obj.updated_at).toLocaleDateString()}</span>
                    ${!obj.is_folder ? `<span>${(obj.size_bytes / 1024).toFixed(1)} KB</span>` : ''}
                </div>
                <div class="fm-item-actions">
                    ${!obj.is_folder ? `<a href="/fs-api/download/${obj.id}" class="action-btn download" title="Download"><i class="fas fa-download"></i></a>` : ''}
                </div>
            `;
            gridContainer.appendChild(itemDiv);
        });
    };

    // สั่งให้ค้นหาเมื่อกดปุ่ม
    searchBtn.addEventListener('click', performSearch);

    // สั่งให้ค้นหาเมื่อกด Enter ในช่องค้นหา
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            performSearch();
        }
    });
});
