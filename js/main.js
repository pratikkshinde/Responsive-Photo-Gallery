// Navigation functionality
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const icon = hamburger.querySelector('i');
        if (navLinks.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
}

// Handle global Auth Nav State
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('ag_token');
    const profileLinks = document.querySelectorAll('a[href="profile.html"], a[href="auth.html"]');
    
    profileLinks.forEach(link => {
        if(!token) {
            link.href = 'auth.html';
            link.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        } else {
            link.href = 'profile.html';
            link.innerHTML = '<i class="fas fa-user-circle"></i> Profile';
        }
    });

    if (document.querySelector('.stats')) {
        updateStats();
    }
    if (document.querySelector('.hero')) {
        updateHeroImages();
    }
});

// Update stats on home page fetching from backend
async function updateStats() {
    try {
        const res = await fetch('/api/photos');
        if(res.ok) {
            const data = await res.json();
            const photoCountElem = document.getElementById('photoCount');
            if (photoCountElem) {
                photoCountElem.textContent = data.length;
            }
        }
    } catch(err) {
        console.error("Failed to update stats", err);
    }
}

// Replace the last three hero images with the most recent uploaded photos
async function updateHeroImages() {
    try {
        const res = await fetch('/api/photos');
        if (!res.ok) {
            throw new Error('Failed to fetch hero photos');
        }

        const photos = await res.json();
        if (!Array.isArray(photos) || photos.length === 0) {
            return;
        }

        const heroImageIds = ['heroImage2', 'heroImage3', 'heroImage4'];
        heroImageIds.forEach((id, index) => {
            const img = document.getElementById(id);
            const photo = photos[index];
            if (img && photo) {
                img.src = photo.src;
                img.alt = photo.title ? `${photo.title} uploaded recently` : `Recently uploaded photo ${index + 1}`;
            }
        });
    } catch (err) {
        console.error('Could not load hero photos', err);
    }
}

// Global Lightbox close handlers (used by gallery.js)
function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.style.animation = 'fadeIn 0.3s ease reverse forwards';
        setTimeout(() => {
            lightbox.style.display = 'none';
            lightbox.style.animation = '';
        }, 300);
    }
}

document.addEventListener('click', function(e) {
    const lightbox = document.getElementById('lightbox');
    if (lightbox && e.target === lightbox) {
        closeLightbox();
    }
});

document.addEventListener('keydown', function(e) {
    const lightbox = document.getElementById('lightbox');
    if (lightbox && e.key === 'Escape' && lightbox.style.display === 'block') {
        closeLightbox();
    }
});