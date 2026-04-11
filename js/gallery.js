let currentFilter = 'all';
let allPhotos = [];

// Load gallery on page load
document.addEventListener('DOMContentLoaded', () => {
    loadGallery();
    setupFilters();
});

function loadGallery() {
    allPhotos = getAllPhotos();
    displayGallery(allPhotos);
}

function displayGallery(photos) {
    const galleryGrid = document.getElementById('galleryGrid');
    
    if (!galleryGrid) return;
    
    if (photos.length === 0) {
        galleryGrid.innerHTML = '<div class="loading">No photos found. Upload some photos to get started!</div>';
        return;
    }
    
    galleryGrid.innerHTML = photos.map(photo => `
        <div class="gallery-item" data-id="${photo.id}" data-type="${photo.type}">
            <img src="${photo.src}" alt="${photo.title}" loading="lazy">
            <div class="gallery-item-info">
                <h4>${photo.title}</h4>
                ${photo.type === 'uploaded' ? '<button class="delete-btn" onclick="deletePhoto(\'' + photo.id + '\')"><i class="fas fa-trash"></i></button>' : ''}
            </div>
        </div>
    `).join('');
    
    // Add click event listeners to gallery items
    document.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-btn')) {
                const img = item.querySelector('img');
                const title = item.querySelector('h4').textContent;
                openLightbox(img.src, title);
            }
        });
    });
}

function setupFilters() {
    const filterBtns = document.querySelectorAll('.btn-filter');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active class
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Apply filter
            currentFilter = btn.dataset.filter;
            applyFilter();
        });
    });
}

function applyFilter() {
    let filteredPhotos = allPhotos;
    
    if (currentFilter === 'initial') {
        filteredPhotos = allPhotos.filter(photo => photo.type === 'initial');
    } else if (currentFilter === 'uploaded') {
        filteredPhotos = allPhotos.filter(photo => photo.type === 'uploaded');
    }
    
    displayGallery(filteredPhotos);
}

function openLightbox(imageSrc, caption) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxCaption = document.getElementById('lightboxCaption');
    
    lightboxImage.src = imageSrc;
    lightboxCaption.textContent = caption;
    lightbox.style.display = 'block';
}

function deletePhoto(photoId) {
    if (confirm('Are you sure you want to delete this photo?')) {
        // Get uploaded photos from localStorage
        const uploadedPhotos = JSON.parse(localStorage.getItem('galleryPhotos') || '[]');
        
        // Filter out the deleted photo
        const updatedPhotos = uploadedPhotos.filter(photo => photo.id !== photoId);
        
        // Save back to localStorage
        localStorage.setItem('galleryPhotos', JSON.stringify(updatedPhotos));
        
        // Reload gallery
        loadGallery();
        
        // Update stats if on home page
        if (typeof updateStats === 'function') {
            updateStats();
        }
    }
}

// Listen for storage events to update gallery when photos are uploaded from another tab
window.addEventListener('storage', (e) => {
    if (e.key === 'galleryPhotos') {
        loadGallery();
    }
});