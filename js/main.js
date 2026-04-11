// Navigation functionality
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        
        // Change hamburger icon
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

// Close menu when clicking a link (mobile)
const links = document.querySelectorAll('.nav-links a');
links.forEach(link => {
    link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            navLinks.classList.remove('active');
            const icon = hamburger.querySelector('i');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
});

// Update stats on home page
if (document.querySelector('.stats')) {
    updateStats();
}

function updateStats() {
    const photos = getAllPhotos();
    const photoCountElem = document.getElementById('photoCount');
    if (photoCountElem) {
        photoCountElem.textContent = photos.length;
    }
}

// Helper functions for localStorage
function getAllPhotos() {
    const storedPhotos = localStorage.getItem('galleryPhotos');
    const uploadedPhotos = storedPhotos ? JSON.parse(storedPhotos) : [];
    
    // Get initial photos
    const initialPhotos = getInitialPhotos();
    
    return [...initialPhotos, ...uploadedPhotos];
}

function getInitialPhotos() {
    // This will be populated with your 10 initial photos
    const initialPhotos = [];
    
    // Add your 10 photos here
    for (let i = 1; i <= 10; i++) {
        initialPhotos.push({
            id: `initial_${i}`,
            src: `images/gallery/photo${i}.jpg`,
            title: `Sample Photo ${i}`,
            type: 'initial',
            date: new Date().toISOString()
        });
    }
    
    return initialPhotos;
}

function saveUploadedPhotos(photos) {
    localStorage.setItem('galleryPhotos', JSON.stringify(photos));
}

// Close lightbox when clicking outside
document.addEventListener('click', function(e) {
    const lightbox = document.getElementById('lightbox');
    if (lightbox && e.target === lightbox) {
        lightbox.style.display = 'none';
    }
});

// Handle escape key to close lightbox
document.addEventListener('keydown', function(e) {
    const lightbox = document.getElementById('lightbox');
    if (lightbox && e.key === 'Escape' && lightbox.style.display === 'block') {
        lightbox.style.display = 'none';
    }
});