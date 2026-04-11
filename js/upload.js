let selectedFiles = [];

document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const clearBtn = document.getElementById('clearBtn');
    
    if (uploadArea) {
        // Click to browse
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary-dark)';
            uploadArea.style.background = 'rgba(99, 102, 241, 0.05)';
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary-color)';
            uploadArea.style.background = 'var(--light-color)';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary-color)';
            uploadArea.style.background = 'var(--light-color)';
            
            const files = Array.from(e.dataTransfer.files);
            handleFiles(files);
        });
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            handleFiles(files);
        });
        
        // Browse button
        if (browseBtn) {
            browseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput.click();
            });
        }
        
        // Upload button
        if (uploadBtn) {
            uploadBtn.addEventListener('click', uploadPhotos);
        }
        
        // Clear button
        if (clearBtn) {
            clearBtn.addEventListener('click', clearAll);
        }
    }
});

function handleFiles(files) {
    // Filter images only
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        showMessage('Please select valid image files (JPG, PNG, WEBP)', 'error');
        return;
    }
    
    // Check file size (max 5MB)
    const validFiles = imageFiles.filter(file => file.size <= 5 * 1024 * 1024);
    
    if (validFiles.length !== imageFiles.length) {
        showMessage('Some files exceed the 5MB limit and were skipped', 'error');
    }
    
    if (validFiles.length === 0) {
        return;
    }
    
    selectedFiles.push(...validFiles);
    updatePreview();
}

function updatePreview() {
    const previewSection = document.getElementById('previewSection');
    const previewGrid = document.getElementById('previewGrid');
    
    if (selectedFiles.length > 0) {
        previewSection.style.display = 'block';
        
        previewGrid.innerHTML = selectedFiles.map((file, index) => `
            <div class="preview-item" data-index="${index}">
                <img src="${URL.createObjectURL(file)}" alt="Preview">
                <button class="remove-preview" onclick="removePreview(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    } else {
        previewSection.style.display = 'none';
        previewGrid.innerHTML = '';
    }
}

function removePreview(index) {
    selectedFiles.splice(index, 1);
    updatePreview();
    
    if (selectedFiles.length === 0) {
        const fileInput = document.getElementById('fileInput');
        fileInput.value = '';
    }
}

function clearAll() {
    selectedFiles = [];
    updatePreview();
    const fileInput = document.getElementById('fileInput');
    fileInput.value = '';
    showMessage('All files cleared', 'success');
}

function uploadPhotos() {
    if (selectedFiles.length === 0) {
        showMessage('Please select photos to upload', 'error');
        return;
    }
    
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';
    
    // Get existing uploaded photos
    const existingPhotos = JSON.parse(localStorage.getItem('galleryPhotos') || '[]');
    
    // Process each file
    const uploadPromises = selectedFiles.map((file, index) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const photoId = `uploaded_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
                const newPhoto = {
                    id: photoId,
                    src: e.target.result,
                    title: file.name,
                    type: 'uploaded',
                    date: new Date().toISOString(),
                    size: file.size
                };
                
                resolve(newPhoto);
            };
            
            reader.readAsDataURL(file);
        });
    });
    
    Promise.all(uploadPromises).then(newPhotos => {
        // Add new photos to existing ones
        const updatedPhotos = [...existingPhotos, ...newPhotos];
        
        // Save to localStorage
        localStorage.setItem('galleryPhotos', JSON.stringify(updatedPhotos));
        
        // Show success message
        showMessage(`Successfully uploaded ${newPhotos.length} photo(s)!`, 'success');
        
        // Clear preview
        clearAll();
        
        // Update stats if on home page
        if (typeof updateStats === 'function') {
            updateStats();
        }
        
        // Optional: Ask if user wants to go to gallery
        setTimeout(() => {
            if (confirm('Photos uploaded successfully! Would you like to view them in the gallery?')) {
                window.location.href = 'gallery.html';
            }
        }, 500);
    }).catch(error => {
        showMessage('Error uploading photos. Please try again.', 'error');
        console.error('Upload error:', error);
    }).finally(() => {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Photos';
    });
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('uploadMessage');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.className = `upload-message ${type}`;
        
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'upload-message';
        }, 5000);
    }
}