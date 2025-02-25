document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('file-input');
    const convertButton = document.getElementById('convert-button');
    const downloadAllButton = document.getElementById('download-all-button');
    const output = document.getElementById('output');
    const maxResolutionSlider = document.getElementById('max-resolution');
    const maxResolutionValue = document.getElementById('max-resolution-value');
    const jpegQualitySlider = document.getElementById('jpeg-quality');
    const jpegQualityValue = document.getElementById('jpeg-quality-value');
    const sharpeningToggle = document.getElementById('sharpening-toggle');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const dropZone = document.getElementById('drop-zone');
    
    const convertedBlobUrls = [];
    const MIN_RESOLUTION = 800;
    let totalImages = 0;
    let processedImages = 0;
    
    // Set initial slider values
    if (maxResolutionValue) maxResolutionValue.textContent = maxResolutionSlider?.value || '3000';
    if (jpegQualityValue) jpegQualityValue.textContent = jpegQualitySlider?.value || '90';
    
    // Update slider value displays
    if (maxResolutionSlider) {
        maxResolutionSlider.addEventListener('input', function() {
            maxResolutionValue.textContent = this.value;
        });
    }
    
    if (jpegQualitySlider) {
        jpegQualitySlider.addEventListener('input', function() {
            jpegQualityValue.textContent = this.value;
        });
    }

    // Setup file input change listener - FIXED
    fileInput.addEventListener('change', function () {
        // Enable the convert button when files are selected
        convertButton.disabled = this.files.length === 0;
    });
    
    // Setup drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropZone.classList.add('highlight');
    }
    
    function unhighlight() {
        dropZone.classList.remove('highlight');
    }
    
    dropZone.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        // Update file input with dropped files
        if (files.length > 0) {
            fileInput.files = files;
            convertButton.disabled = false;
        }
    }

    // Convert button click handler
    convertButton.addEventListener('click', function () {
        output.innerHTML = '';
        convertedBlobUrls.length = 0; // Clear the array
        
        const files = fileInput.files;

        if (files.length === 0) {
            alert('Please select one or more images.');
            return;
        }
        
        // Setup progress bar
        totalImages = files.length;
        processedImages = 0;
        progressBar.style.width = '0%';
        progressText.textContent = `Processing 0/${totalImages} images`;
        progressContainer.style.display = 'block';
        
        // Get settings from UI
        const maxResolution = parseInt(maxResolutionSlider?.value || 3000);
        const jpegQuality = parseInt(jpegQualitySlider?.value || 90) / 100;
        const enableSharpening = sharpeningToggle?.checked || false;
        
        // Create a container for results
        const resultContainer = document.createElement('div');
        resultContainer.classList.add('result-container');
        output.appendChild(resultContainer);
        
        // Process images sequentially
        processImagesSequentially(Array.from(files), 0, maxResolution, jpegQuality, enableSharpening, resultContainer);
    });

    // Process images one at a time
    function processImagesSequentially(files, index, maxResolution, jpegQuality, enableSharpening, resultContainer) {
        if (index >= files.length) {
            // All files processed
            progressContainer.style.display = 'none';
            if (files.length > 0) {
                downloadAllButton.disabled = false;
                downloadAllButton.classList.add('enabled-button');
            }
            return;
        }
        
        // Show processing message
        progressText.textContent = `Processing ${index + 1}/${totalImages} images`;
        
        // Process the current image
        processImage(files[index], maxResolution, jpegQuality, enableSharpening).then(result => {
            const { file, blobUrl } = result;
            
            // Create and append result element
            const downloadLink = createDownloadLink(blobUrl, file.name);
            const img = createImageElement(blobUrl);
            
            const resultElement = document.createElement('div');
            resultElement.classList.add('result');
            resultElement.appendChild(img);
            const lineBreak = document.createElement('br');
            resultElement.appendChild(lineBreak);
            resultElement.appendChild(downloadLink);
            resultContainer.appendChild(resultElement);
            
            convertedBlobUrls.push(blobUrl);
            
            // Update progress
            processedImages++;
            const progress = (processedImages / totalImages) * 100;
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `Processing ${processedImages}/${totalImages} images`;
            
            // Process next image after a short delay to allow UI to update
            setTimeout(() => {
                processImagesSequentially(files, index + 1, maxResolution, jpegQuality, enableSharpening, resultContainer);
            }, 50);
        }).catch(error => {
            console.error('Error processing image:', error);
            // Continue with next image
            processImagesSequentially(files, index + 1, maxResolution, jpegQuality, enableSharpening, resultContainer);
        });
    }

    // FIXED image processing function
    function processImage(file, maxResolution, jpegQuality, enableSharpening) {
        return new Promise((resolve, reject) => {
            // Create an image from the file
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            
            img.onload = function() {
                // Calculate dimensions while maintaining aspect ratio
                let newWidth = img.width;
                let newHeight = img.height;
                
                // Calculate if we need to upscale
                const needsUpscaling = img.width < MIN_RESOLUTION && img.height < MIN_RESOLUTION;
                
                // Handle minimum resolution (800px)
                if (needsUpscaling) {
                    const aspectRatio = img.width / img.height;
                    
                    if (img.width < img.height) {
                        newWidth = MIN_RESOLUTION;
                        newHeight = newWidth / aspectRatio;
                    } else {
                        newHeight = MIN_RESOLUTION;
                        newWidth = newHeight * aspectRatio;
                    }
                    
                    console.log(`Upscaling image from ${img.width}x${img.height} to ${newWidth}x${newHeight}`);
                }
                
                // Apply maximum resolution limit if needed
                if (newWidth > maxResolution || newHeight > maxResolution) {
                    const aspectRatio = newWidth / newHeight;
                    if (newWidth > newHeight) {
                        newWidth = maxResolution;
                        newHeight = newWidth / aspectRatio;
                    } else {
                        newHeight = maxResolution;
                        newWidth = newHeight * aspectRatio;
                    }
                }
                
                // Round dimensions to integers
                newWidth = Math.round(newWidth);
                newHeight = Math.round(newHeight);
                
                // Create canvas and context
                const canvas = document.createElement('canvas');
                canvas.width = newWidth;
                canvas.height = newHeight;
                const ctx = canvas.getContext('2d');
                
                // Set high quality rendering
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, newWidth, newHeight);
                
                // Apply sharpening if enabled and image was upscaled
                if (enableSharpening && needsUpscaling) {
                    applySharpening(ctx, newWidth, newHeight);
                }
                
                // Convert to blob and resolve
                canvas.toBlob(
                    blob => {
                        const blobUrl = URL.createObjectURL(blob);
                        URL.revokeObjectURL(objectUrl); // Clean up original object URL
                        resolve({ file, blobUrl });
                    },
                    'image/jpeg',
                    jpegQuality
                );
            };
            
            img.onerror = function() {
                URL.revokeObjectURL(objectUrl);
                reject('Failed to load image');
            };
            
            img.src = objectUrl;
        });
    }
    
    // Apply sharpening to canvas context
    function applySharpening(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const buffer = new Uint8ClampedArray(data.length);
        buffer.set(data);
        
        const sharpenAmount = 0.3;
        
        // Apply sharpening kernel
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let c = 0; c < 3; c++) {
                    const i = (y * width + x) * 4 + c;
                    
                    // Apply sharpening kernel
                    const centerValue = buffer[i] * (1 + 4 * sharpenAmount);
                    const neighborValues = (
                        buffer[i - width * 4] + 
                        buffer[i - 4] + 
                        buffer[i + 4] + 
                        buffer[i + width * 4]
                    ) * sharpenAmount;
                    
                    data[i] = Math.min(255, Math.max(0, centerValue - neighborValues));
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    // Download all button handler
    downloadAllButton.addEventListener('click', function () {
        if (convertedBlobUrls.length === 0) {
            alert('No images to download.');
            return;
        }

        if (convertedBlobUrls.length === 1) {
            // Download single image
            const link = document.createElement('a');
            link.href = convertedBlobUrls[0];
            link.download = 'converted_image.jpeg';
            link.click();
        } else {
            // Check if JSZip is available
            if (typeof JSZip === 'undefined') {
                alert('JSZip library not loaded. Cannot create zip file.');
                return;
            }
            
            // Show progress for zip creation
            progressContainer.style.display = 'block';
            progressBar.style.width = '0%';
            progressText.textContent = 'Creating zip file...';
            
            const zip = new JSZip();
            
            // Fetch all blob URLs and add to zip
            const promises = convertedBlobUrls.map((url, i) => 
                fetch(url)
                    .then(response => response.blob())
                    .then(blob => {
                        zip.file(`image_${i + 1}.jpeg`, blob);
                        
                        // Update progress
                        const progress = ((i + 1) / convertedBlobUrls.length) * 100;
                        progressBar.style.width = `${progress}%`;
                        progressText.textContent = `Processing ${i + 1}/${convertedBlobUrls.length} for zip`;
                    })
            );
            
            Promise.all(promises)
                .then(() => {
                    progressText.textContent = 'Generating zip file...';
                    return zip.generateAsync({ type: 'blob' });
                })
                .then(content => {
                    progressContainer.style.display = 'none';
                    const zipUrl = URL.createObjectURL(content);
                    const link = document.createElement('a');
                    link.href = zipUrl;
                    link.download = 'converted_images.zip';
                    link.click();
                    
                    // Clean up
                    setTimeout(() => {
                        URL.revokeObjectURL(zipUrl);
                    }, 100);
                })
                .catch(error => {
                    console.error('Error creating zip:', error);
                    progressContainer.style.display = 'none';
                    alert('Error creating zip file.');
                });
        }
    });

    // Helper functions
    function createDownloadLink(blobUrl, filename) {
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = filename.replace(/\.\w+$/, '.jpeg');
        downloadLink.className = 'download-link';
        downloadLink.textContent = `Download ${filename.replace(/\.\w+$/, '.jpeg')}`;
        return downloadLink;
    }

    function createImageElement(blobUrl) {
        const img = new Image();
        img.src = blobUrl;
        img.className = 'preview-image';
        return img;
    }
});
