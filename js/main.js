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
        if (!token) {
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

    if (document.getElementById('archCarousel')) {
        initArchCarousel();
    }

    initGlobalSearch();
});

// Global Search
function initGlobalSearch() {
    const searchInputs = document.querySelectorAll('.global-search');

    searchInputs.forEach(input => {
        let debounceTimer;
        const dropdown = input.nextElementSibling;

        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();

            if (query.length < 1) {
                dropdown.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(async () => {
                try {
                    const res = await fetch(`/api/users/search?q=${query}`);
                    if (!res.ok) throw new Error('Search failed');

                    const users = await res.json();
                    if (users.length > 0) {
                        dropdown.innerHTML = users.map(u => `
                            <a href="profile.html?username=${u.username}">
                                <img src="${u.profile_picture_url || 'https://via.placeholder.com/40'}" alt="${u.username}">
                                @${u.username}
                            </a>
                        `).join('');
                        dropdown.style.display = 'flex';
                    } else {
                        dropdown.innerHTML = '<div style="padding:10px 15px; color:rgba(255,255,255,0.5); font-size:0.9rem;">No users found.</div>';
                        dropdown.style.display = 'flex';
                    }
                } catch (err) {
                    console.error('User search error:', err);
                }
            }, 300); // 300ms debounce
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });
}

// Update stats on home page fetching from backend
async function updateStats() {
    try {
        const res = await fetch('/api/photos');
        if (res.ok) {
            const data = await res.json();
            const photoCountElem = document.getElementById('photoCount');
            if (photoCountElem) {
                photoCountElem.textContent = data.length;
            }
        }
    } catch (err) {
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

// Arch Carousel Initialization and Rotation Logic
let archOffsetDegree = 0;
async function initArchCarousel() {
    const archContainer = document.getElementById('archCarousel');
    if (!archContainer) return;

    try {
        const res = await fetch('/api/photos');
        if (!res.ok) throw new Error('Failed to fetch arch photos');
        const photos = await res.json();

        // Take up to 11 chronological photos for a wide smooth arc
        const archPhotos = photos.slice(0, 11);
        archContainer.innerHTML = '';

        // 15 degrees separation creates a tight dense arched fan similar to the Gather reference
        const spacing = 15;
        const startAngle = -Math.floor(archPhotos.length / 2) * spacing;

        let archNodes = [];

        archPhotos.forEach((photo, index) => {
            const angle = startAngle + (index * spacing);
            const div = document.createElement('div');
            div.className = 'arch-item';
            div.dataset.angle = angle; // Store raw angle

            const img = document.createElement('img');
            img.src = photo.src;
            img.alt = photo.title || `Gallery Upload ${index}`;
            img.onerror = () => { img.src = 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=300&auto=format&fit=crop'; };

            div.appendChild(img);
            archContainer.appendChild(div);
            archNodes.push(div);

            // Add Lightbox interaction for active/popped-up image and auto-scroll for inactive
            div.addEventListener('click', () => {
                const absoluteAngle = Math.round(parseFloat(div.dataset.angle) + archOffsetDegree);

                if (absoluteAngle === 0) {
                    // It's the center image -> Open Lightbox
                    const lightbox = document.getElementById('lightbox');
                    const lightboxImg = document.getElementById('lightbox-img');
                    const lightboxCaption = document.getElementById('lightbox-caption');

                    if (lightbox && lightboxImg) {
                        lightboxImg.src = photo.src;
                        const uploader = photo.username || 'Community Member';
                        lightboxCaption.innerHTML = `<h3 style="margin-bottom: 5px;"><a href="profile.html?username=${uploader}" class="lightbox-user-link">@${uploader}</a></h3><p style="opacity: 0.8; font-size: 0.9rem;">${photo.title || 'Untitled Memory'}</p>`;
                        lightbox.style.display = 'flex';
                    }
                } else {
                    // Clicked an inactive image -> Rotate carousel to center it
                    archOffsetDegree -= absoluteAngle;
                    archContainer.style.transform = `rotate(${archOffsetDegree}deg)`;
                    updateActiveItem();
                }
            });
        });

        // Function to resolve scale and opacity based on proximity to center (0 degrees absolute)
        const updateActiveItem = () => {
            archNodes.forEach((node) => {
                const baseAngle = parseFloat(node.dataset.angle);
                const absoluteAngle = baseAngle + archOffsetDegree;

                // If it's exactly at 0 degree top-center
                const isCenter = absoluteAngle === 0;

                const scale = isCenter ? 1.2 : 1;
                const opacity = isCenter ? 1 : 0.5;

                // Only rotate the parent node safely along the arc
                node.style.zIndex = isCenter ? 10 : 1;
                node.style.opacity = opacity;
                node.style.transform = `rotate(${baseAngle}deg)`;

                // Style the img dynamically to expand uncropped natively when active
                const imgWrap = node.querySelector('img');
                if (imgWrap) {
                    if (isCenter) {
                        imgWrap.style.transform = `scale(${scale}) translateY(-120px)`; // Pop completely out of the arc!
                        imgWrap.style.boxShadow = '0 15px 50px rgba(0,0,0,0.8)';
                        imgWrap.style.border = '3px solid rgba(255, 255, 255, 0.3)';
                        imgWrap.style.backdropFilter = 'blur(15px)';
                        imgWrap.style.objectFit = 'contain';
                        imgWrap.style.height = 'auto';
                        imgWrap.style.width = 'auto';
                        imgWrap.style.maxHeight = '350px';
                        imgWrap.style.maxWidth = '350px';
                        imgWrap.style.backgroundColor = 'rgba(0,0,0,0.5)'; // Letterbox backup
                    } else {
                        imgWrap.style.transform = `scale(${scale}) translateY(0)`; // Reset translation
                        imgWrap.style.boxShadow = '0 10px 25px rgba(0,0,0,0.4)';
                        imgWrap.style.border = '1px solid var(--glass-border)';
                        imgWrap.style.backdropFilter = 'none';
                        imgWrap.style.objectFit = 'cover';
                        imgWrap.style.height = '100%';
                        imgWrap.style.width = '100%';
                        imgWrap.style.maxHeight = 'none';
                        imgWrap.style.maxWidth = 'none';
                        imgWrap.style.backgroundColor = 'transparent';
                    }
                }
            });
        };

        // Initialize first active item
        updateActiveItem();

        // Rotation Logic
        const prevBtn = document.getElementById('archPrev');
        const nextBtn = document.getElementById('archNext');

        // Disable rotation if it goes beyond the span of items
        const maxOffset = Math.abs(startAngle);

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (archOffsetDegree >= maxOffset) return; // limit bounds
                archOffsetDegree += spacing;
                archContainer.style.transform = `rotate(${archOffsetDegree}deg)`;
                updateActiveItem();
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (archOffsetDegree <= -maxOffset) return; // limit bounds
                archOffsetDegree -= spacing;
                archContainer.style.transform = `rotate(${archOffsetDegree}deg)`;
                updateActiveItem();
            });
        }

    } catch (err) {
        console.error("Arch Carousel Error", err);
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

document.addEventListener('click', function (e) {
    const lightbox = document.getElementById('lightbox');
    if (lightbox && e.target === lightbox) {
        closeLightbox();
    }
});

document.addEventListener('keydown', function (e) {
    const lightbox = document.getElementById('lightbox');
    if (lightbox && e.key === 'Escape' && lightbox.style.display === 'block') {
        closeLightbox();
    }
});