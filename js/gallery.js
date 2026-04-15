let allPhotos = [];

// Load gallery on page load
document.addEventListener('DOMContentLoaded', () => {
    loadGallery();
});

async function loadGallery() {
    try {
        const res = await fetch('/api/photos');
        if (res.ok) {
            allPhotos = await res.json();
            displayGallery(allPhotos);
        } else {
            console.error('Failed to fetch photos');
        }
    } catch (err) {
        console.error('Error fetching photos:', err);
    }
}

function displayGallery(photos) {
    const galleryGrid = document.getElementById('galleryGrid');
    
    if (!galleryGrid) return;
    
    if (photos.length === 0) {
        galleryGrid.innerHTML = '<div class="loading">No photos found. Upload some photos to get started!</div>';
        return;
    }
    
    galleryGrid.innerHTML = photos.map(photo => `
        <div class="gallery-item" data-id="${photo.id}" data-username="${photo.username}">
            <img src="${photo.src}" alt="Gallery photo" loading="lazy">
            <div class="gallery-item-info">
                <p><strong>${photo.username}</strong></p>
            </div>
        </div>
    `).join('');

    const galleryItems = document.querySelectorAll('.gallery-item');

    galleryItems.forEach(item => {
        const img = item.querySelector('img');
        item.addEventListener('click', () => {
            const username = item.dataset.username || 'Unknown user';
            openLightbox(img.src, username);
        });
    });

    const closeBtn = document.querySelector('.close-lightbox');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeLightbox);
    }
}

function openLightbox(imageSrc, username) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxCaption = document.getElementById('lightboxCaption');
    
    lightboxImage.src = imageSrc;
    lightboxCaption.innerHTML = `
        <a href="profile.html" class="lightbox-user-link">${username}</a>
    `;
    lightbox.style.display = 'block';
}