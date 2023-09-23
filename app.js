document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('file-input');
    const convertButton = document.getElementById('convert-button');
    const downloadAllButton = document.getElementById('download-all-button');
    const output = document.getElementById('output');
    const convertedBlobUrls = [];

    fileInput.addEventListener('change', function () {
        // Enable the convert button when files are selected
        convertButton.disabled = false;
    });

    convertButton.addEventListener('click', function () {
        output.innerHTML = '';
        convertedBlobUrls.length = 0; // Clear the array

        const files = fileInput.files;

        if (files.length === 0) {
            alert('Please select one or more images.');
            return;
        }

        const promises = Array.from(files).map(async (file) => {
            const blobUrl = await convertToJPEG(file);
            return { file, blobUrl };
        });

        Promise.all(promises).then((convertedImages) => {
            const resultContainer = document.createElement('div');
            resultContainer.classList.add('result-container');
            convertedImages.forEach((item, index) => {
                const { file, blobUrl } = item;

                const downloadLink = createDownloadLink(blobUrl, file.name);
                const img = createImageElement(blobUrl);

                const resultElement = document.createElement('div');
                resultElement.classList.add('result');
                resultElement.appendChild(img);
                const lineBreak = document.createElement('br');
                resultElement.appendChild(lineBreak);
                resultElement.appendChild(downloadLink);
                output.appendChild(resultElement);

                convertedBlobUrls.push(blobUrl);
            });

            output.appendChild(resultContainer);
            
            if (convertedImages.length > 0) {
                downloadAllButton.disabled = false;
                downloadAllButton.classList.add('enabled-button'); // Add a CSS class for styling
            }
        });
    });

    downloadAllButton.addEventListener('click', function () {
        if (convertedBlobUrls.length === 0) {
            alert('No images to download.');
            return;
        }

        if(convertedBlobUrls.length === 1){
            downloadLink(convertedBlobUrls[0], 'converted_image.jpeg');
        }else{
            const zip = new JSZip();

            const promises = convertedBlobUrls.map(async (blobUrl, index) => {
                const response = await fetch(blobUrl);
                const blob = await response.blob();
    
                // Create a unique filename for each image
                const filename = `image_${index + 1}.jpeg`;
    
                // Add the image to the zip archive
                zip.file(filename, blob);
    
                return filename;
            });
    
            Promise.all(promises).then(() => {
                // Generate and trigger the download of the zip archive
                zip.generateAsync({ type: 'blob' }).then(function (content) {
                    const zipBlobUrl = URL.createObjectURL(content);
                    downloadLink(zipBlobUrl, 'converted_images.zip');
                });
            });
        }
    });

    async function convertToJPEG(file) {
        return new Promise(async (resolve) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);

            img.onload = function () {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                // Convert the image to JPEG format with quality 0.8 (adjust as needed)
                const convertedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
                resolve(convertedDataUrl);
            };
        });
    }

    function createDownloadLink(blobUrl, filename) {
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = filename.replace(/\.\w+$/, '.jpeg'); // Change the file extension to .jpeg
        downloadLink.textContent = `Download ${filename.replace(/\.\w+$/, '.jpeg')}`;
        return downloadLink;
    }

    function createImageElement(blobUrl) {
        const img = new Image();
        img.src = blobUrl;
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
