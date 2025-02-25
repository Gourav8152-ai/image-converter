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
    
    const convertedBlobUrls = [];
    const MIN_RESOLUTION = 800; // Fixed minimum resolution
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

    // Setup file input change listener
    fileInput.addEventListener('change', function () {
        // Enable the convert button when files are selected
        convertButton.disabled = false;
    });
    
    // Setup drag and drop
    const dropZone = document.getElementById('drop-zone') || document.body;
    
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
        fileInput.files = files;
        convertButton.disabled = false;
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
        
        // Process the current image using a web worker if available
        processImageWithWorker(files[index], maxResolution, jpegQuality, enableSharpening).then(result => {
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

    // Process image with web worker if available
    function processImageWithWorker(file, maxResolution, jpegQuality, enableSharpening) {
        return new Promise((resolve, reject) => {
            // Check if Web Workers are supported
            if (window.Worker) {
                try {
                    // Create a worker from a blob URL
                    const workerCode = `
                        self.onmessage = function(e) {
                            const { file, maxResolution, jpegQuality, enableSharpening } = e.data;
                            
                            // Create an image from the file
                            const img = new Image();
                            img.src = URL.createObjectURL(file);
                            
                            img.onload = function() {
                                // Calculate dimensions while maintaining aspect ratio
                                let newWidth = img.width;
                                let newHeight = img.height;
                                const minDimension = 800;
                                
                                // Check if image is smaller than the minimum resolution
                                if (img.width < minDimension || img.height < minDimension) {
                                    // Calculate new dimensions while maintaining aspect ratio
                                    const aspectRatio = img.width / img.height;
                                    
                                    if (img.width < img.height) {
                                        // Portrait or square image
                                        newWidth = minDimension;
                                        newHeight = newWidth / aspectRatio;
                                    } else {
                                        // Landscape image
                                        newHeight = minDimension;
                                        newWidth = newHeight * aspectRatio;
                                    }
                                    
                                    // Make sure both dimensions are at least 800px
                                    if (newWidth < minDimension) {
                                        newWidth = minDimension;
                                        newHeight = newWidth / aspectRatio;
                                    }
                                    if (newHeight < minDimension) {
                                        newHeight = minDimension;
                                        newWidth = newHeight * aspectRatio;
                                    }
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
                                
                                // Create off-screen canvas
                                const canvas = new OffscreenCanvas(newWidth, newHeight);
                                const ctx = canvas.getContext('2d');
                                
                                // Use Lanczos-like approach by doing the resize in steps for better quality
                                if (img.width < newWidth && Math.max(img.width, img.height) < minDimension) {
                                    // Upscaling a low-res image using stepped approach
                                    const steps = 3; // Number of steps for gradual upscaling
                                    const tempCanvas = new OffscreenCanvas(1, 1);
                                    const tempCtx = tempCanvas.getContext('2d');
                                    
                                    // Start with original dimensions
                                    let stepWidth = img.width;
                                    let stepHeight = img.height;
                                    
                                    // Calculate dimensions for each step
                                    for (let i = 0; i < steps; i++) {
                                        const progress = (i + 1) / steps;
                                        const targetStepWidth = img.width + (newWidth - img.width) * progress;
                                        const targetStepHeight = img.height + (newHeight - img.height) * progress;
                                        
                                        // Create temp canvas for this step
                                        tempCanvas.width = targetStepWidth;
                                        tempCanvas.height = targetStepHeight;
                                        
                                        // Draw image with high quality smoothing
                                        tempCtx.imageSmoothingEnabled = true;
                                        tempCtx.imageSmoothingQuality = 'high';
                                        
                                        if (i === 0) {
                                            // First iteration uses the original image
                                            tempCtx.drawImage(img, 0, 0, targetStepWidth, targetStepHeight);
                                        } else {
                                            // Subsequent iterations use the previous canvas
                                            tempCtx.drawImage(tempCanvas, 0, 0, stepWidth, stepHeight, 0, 0, targetStepWidth, targetStepHeight);
                                        }
                                        
                                        // Update dimensions for next step
                                        stepWidth = targetStepWidth;
                                        stepHeight = targetStepHeight;
                                    }
                                    
                                    // Final draw to the output canvas
                                    ctx.drawImage(tempCanvas, 0, 0);
                                } else {
                                    // For images that don't need gradual upscaling
                                    ctx.imageSmoothingEnabled = true;
                                    ctx.imageSmoothingQuality = 'high';
                                    ctx.drawImage(img, 0, 0, newWidth, newHeight);
                                }
                                
                                // Apply sharpening if enabled
                                if (enableSharpening && img.width < newWidth && Math.max(img.width, img.height) < minDimension) {
                                    // Get image data for pixel manipulation
                                    const imageData = ctx.getImageData(0, 0, newWidth, newHeight);
                                    const data = imageData.data;
                                    const sharpenAmount = 0.3; // Adjust as needed
                                    
                                    // Simple sharpening kernel
                                    const buffer = new Uint8ClampedArray(data.length);
                                    buffer.set(data);
                                    
                                    const w = newWidth;
                                    const h = newHeight;
                                    
                                    // Apply sharpening convolution
                                    for (let y = 1; y < h - 1; y++) {
                                        for (let x = 1; x < w - 1; x++) {
                                            for (let c = 0; c < 3; c++) {
                                                const i = (y * w + x) * 4 + c;
                                                // Apply a simple sharpening kernel
                                                const centerValue = buffer[i] * (1 + 4 * sharpenAmount);
                                                const neighborValues = (
                                                    buffer[i - w * 4] + 
                                                    buffer[i - 4] + 
                                                    buffer[i + 4] + 
                                                    buffer[i + w * 4]
                                                ) * sharpenAmount;
                                                
                                                data[i] = Math.min(255, Math.max(0, centerValue - neighborValues));
                                            }
                                        }
                                    }
                                    
                                    ctx.putImageData(imageData, 0, 0);
                                }
                                
                                // Convert to JPEG
                                canvas.convertToBlob({ type: 'image/jpeg', quality: jpegQuality })
                                    .then(blob => {
                                        const blobUrl = URL.createObjectURL(blob);
                                        self.postMessage({ blobUrl, dimensions: { width: newWidth, height: newHeight } });
                                    });
                            };
                            
                            img.onerror = function() {
                                self.postMessage({ error: 'Failed to load image' });
                            };
                        };
                    `;
                    
                    const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
                    const workerUrl = URL.createObjectURL(workerBlob);
                    const worker = new Worker(workerUrl);
                    
                    worker.onmessage = function(e) {
                        if (e.data.error) {
                            reject(e.data.error);
                        } else {
                            resolve({
                                file: file,
                                blobUrl: e.data.blobUrl,
                                dimensions: e.data.dimensions
                            });
                        }
                        
                        // Clean up
                        worker.terminate();
                        URL.revokeObjectURL(workerUrl);
                    };
                    
                    worker.onerror = function(error) {
                        reject(error);
                        worker.terminate();
                        URL.revokeObjectURL(workerUrl);
                    };
                    
                    // Start processing
                    worker.postMessage({
                        file: file,
                        maxResolution: maxResolution,
                        jpegQuality: jpegQuality,
                        enableSharpening: enableSharpening
                    });
                    
                } catch (err) {
                    // Fall back to main thread processing if worker setup fails
                    console.log("Worker setup failed, falling back to main thread:", err);
                    convertToJPEG(file, maxResolution, jpegQuality, enableSharpening)
                        .then(result => resolve({ file, blobUrl: result.blobUrl }))
                        .catch(reject);
                }
            } else {
                // Web Workers not supported, process on main thread
                convertToJPEG(file, maxResolution, jpegQuality, enableSharpening)
                    .then(result => resolve({ file, blobUrl: result.blobUrl }))
                    .catch(reject);
            }
        });
    }

    // Fallback function for main thread processing
    async function convertToJPEG(file, maxResolution, jpegQuality, enableSharpening) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);

            img.onload = function () {
                // Calculate dimensions while maintaining aspect ratio
                let newWidth = img.width;
                let newHeight = img.height;
                const minDimension = MIN_RESOLUTION;
                
                // Handle minimum resolution
                if (img.width < minDimension || img.height < minDimension) {
                    const aspectRatio = img.width / img.height;
                    
                    if (img.width < img.height) {
                        newWidth = minDimension;
                        newHeight = newWidth / aspectRatio;
                    } else {
                        newHeight = minDimension;
                        newWidth = newHeight * aspectRatio;
                    }
                    
                    if (newWidth < minDimension) {
                        newWidth = minDimension;
                        newHeight = newWidth / aspectRatio;
                    }
                    if (newHeight < minDimension) {
                        newHeight = minDimension;
                        newWidth = newHeight * aspectRatio;
                    }
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
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = newWidth;
                canvas.height = newHeight;
                
                // Lanczos-like approach for upscaling low-res images
                if (img.width < newWidth && Math.max(img.width, img.height) < minDimension) {
                    // Upscaling a low-res image using stepped approach
                    const steps = 3; // Number of steps for gradual upscaling
                    const tempCanvas = document.createElement('canvas');
                    const tempCtx = tempCanvas.getContext('2d');
                    
                    // Start with original dimensions
                    let stepWidth = img.width;
                    let stepHeight = img.height;
                    
                    // Gradually upscale
                    for (let i = 0; i < steps; i++) {
                        const progress = (i + 1) / steps;
                        const targetStepWidth = Math.round(img.width + (newWidth - img.width) * progress);
                        const targetStepHeight = Math.round(img.height + (newHeight - img.height) * progress);
                        
                        tempCanvas.width = targetStepWidth;
                        tempCanvas.height = targetStepHeight;
                        
                        tempCtx.imageSmoothingEnabled = true;
                        tempCtx.imageSmoothingQuality = 'high';
                        
                        if (i === 0) {
                            tempCtx.drawImage(img, 0, 0, targetStepWidth, targetStepHeight);
                        } else {
                            tempCtx.drawImage(tempCanvas, 0, 0, stepWidth, stepHeight, 0, 0, targetStepWidth, targetStepHeight);
                        }
                        
                        stepWidth = targetStepWidth;
                        stepHeight = targetStepHeight;
                    }
                    
                    // Final draw
                    ctx.drawImage(tempCanvas, 0, 0);
                } else {
                    // Normal scaling for images that don't need special handling
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, newWidth, newHeight);
                }
                
                // Apply sharpening if enabled and image was upscaled
                if (enableSharpening && img.width < newWidth && Math.max(img.width, img.height) < minDimension) {
                    // Get image data for pixel manipulation
                    const imageData = ctx.getImageData(0, 0, newWidth, newHeight);
                    const data = imageData.data;
                    const sharpenAmount = 0.3; // Adjust as needed
                    
                    // Create a copy of the data for our calculations
                    const buffer = new Uint8ClampedArray(data.length);
                    buffer.set(data);
                    
                    const w = newWidth;
                    const h = newHeight;
                    
                    // Apply sharpening convolution
                    for (let y = 1; y < h - 1; y++) {
                        for (let x = 1; x < w - 1; x++) {
                            for (let c = 0; c < 3; c++) {
                                const i = (y * w + x) * 4 + c;
                                
                                // Apply a simple sharpening kernel
                                const centerValue = buffer[i] * (1 + 4 * sharpenAmount);
                                const neighborValues = (
                                    buffer[i - w * 4] + 
                                    buffer[i - 4] + 
                                    buffer[i + 4] + 
                                    buffer[i + w * 4]
                                ) * sharpenAmount;
                                
                                data[i] = Math.min(255, Math.max(0, centerValue - neighborValues));
                            }
                        }
                    }
                    
                    ctx.putImageData(imageData, 0, 0);
                }

                // Convert to JPEG format
                const convertedDataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
                resolve({ blobUrl: convertedDataUrl, dimensions: { width: newWidth, height: newHeight } });
            };
            
            img.onerror = function() {
                reject('Failed to load image');
            };
        });
    }

    // Download all button handler
    downloadAllButton.addEventListener('click', function () {
        if (convertedBlobUrls.length === 0) {
            alert('No images to download.');
            return;
        }

        if (convertedBlobUrls.length === 1) {
            downloadLink(convertedBlobUrls[0], 'converted_image.jpeg');
        } else {
            // Show progress for zip creation
            progressContainer.style.display = 'block';
            progressBar.style.width = '0%';
            progressText.textContent = 'Creating zip file...';
            
            const zip = new JSZip();

            // Process in batches to avoid freezing UI
            const batchSize = 5;
            let processed = 0;
            
            function processBatch(startIdx) {
                const endIdx = Math.min(startIdx + batchSize, convertedBlobUrls.length);
                const promises = [];
                
                for (let i = startIdx; i < endIdx; i++) {
                    promises.push(
                        fetch(convertedBlobUrls[i])
                            .then(response => response.blob())
                            .then(blob => {
                                const filename = `image_${i + 1}.jpeg`;
                                zip.file(filename, blob);
                                return filename;
                            })
                    );
                }
                
                Promise.all(promises).then(() => {
                    processed += promises.length;
                    
                    // Update progress
                    const progress = (processed / convertedBlobUrls.length) * 100;
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `Processing ${processed}/${convertedBlobUrls.length} for zip`;
                    
                    if (endIdx < convertedBlobUrls.length) {
                        // Process next batch
                        setTimeout(() => {
                            processBatch(endIdx);
                        }, 100);
                    } else {
                        // All batches processed, generate zip
                        progressText.textContent = 'Generating zip file...';
                        
                        zip.generateAsync({ type: 'blob' }).then(function (content) {
                            progressContainer.style.display = 'none';
                            const zipBlobUrl = URL.createObjectURL(content);
                            downloadLink(zipBlobUrl, 'converted_images.zip');
                        });
                    }
                });
            }
            
            // Start processing first batch
            processBatch(0);
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

    function downloadLink(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
});
