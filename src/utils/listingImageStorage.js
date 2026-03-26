const UPLOAD_MAX_ATTEMPTS = 2;
const NORMALIZED_IMAGE_WIDTH = 900;
const NORMALIZED_IMAGE_HEIGHT = 1300;
const NORMALIZED_IMAGE_QUALITY = 0.9;
export const MAX_LISTING_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';
const uploadFolder = import.meta.env.VITE_CLOUDINARY_UPLOAD_FOLDER || 'vidyashare/listings';

const uploadEndpoint = cloudName
  ? `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
  : '';

export const normalizeImageForListing = (sourceFile) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = NORMALIZED_IMAGE_WIDTH;
        canvas.height = NORMALIZED_IMAGE_HEIGHT;

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas is not available for image processing.'));
          return;
        }

        context.fillStyle = '#08111a';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const backgroundScale = Math.max(canvas.width / image.width, canvas.height / image.height);
        const backgroundWidth = image.width * backgroundScale;
        const backgroundHeight = image.height * backgroundScale;
        const backgroundX = (canvas.width - backgroundWidth) / 2;
        const backgroundY = (canvas.height - backgroundHeight) / 2;

        context.save();
        context.filter = 'blur(26px) brightness(0.55)';
        context.drawImage(image, backgroundX, backgroundY, backgroundWidth, backgroundHeight);
        context.restore();

        context.fillStyle = 'rgba(8, 17, 26, 0.34)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const padding = 48;
        const contentWidth = canvas.width - padding * 2;
        const contentHeight = canvas.height - padding * 2;
        const scale = Math.min(contentWidth / image.width, contentHeight / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const drawX = (canvas.width - drawWidth) / 2;
        const drawY = (canvas.height - drawHeight) / 2;

        context.save();
        context.shadowColor = 'rgba(0, 0, 0, 0.28)';
        context.shadowBlur = 36;
        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        context.restore();

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Image normalization failed.'));
              return;
            }

            resolve(
              new File([blob], `${sourceFile.name.replace(/\.[^.]+$/, '') || 'listing-photo'}.jpg`, {
                type: 'image/jpeg',
              })
            );
          },
          'image/jpeg',
          NORMALIZED_IMAGE_QUALITY
        );
      };

      image.onerror = () => reject(new Error('Selected image could not be loaded.'));
      image.src = reader.result;
    };

    reader.onerror = () => reject(new Error('Selected image could not be read.'));
    reader.readAsDataURL(sourceFile);
  });

const uploadPreparedFile = ({ preparedFile, ownerId, listingId, imageLabel, onProgress }) =>
  new Promise((resolve, reject) => {
    if (!uploadEndpoint || !uploadPreset) {
      reject(new Error('Cloudinary image upload is not configured.'));
      return;
    }

    const formData = new FormData();
    formData.append('file', preparedFile);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', `${uploadFolder}/${ownerId}/${listingId}`);
    formData.append('tags', 'vidyashare,listing');
    formData.append('context', `ownerUid=${ownerId}|listingId=${listingId}|imageLabel=${imageLabel || 'listing-photo'}`);

    const request = new XMLHttpRequest();
    request.open('POST', uploadEndpoint);
    request.responseType = 'json';

    request.upload.addEventListener('progress', (event) => {
      if (typeof onProgress !== 'function' || !event.lengthComputable || !event.total) return;
      onProgress(event.loaded / event.total);
    });

    request.addEventListener('error', () => {
      reject(new Error('Cloudinary upload failed.'));
    });

    request.addEventListener('abort', () => {
      reject(new Error('Cloudinary upload was cancelled.'));
    });

    request.addEventListener('load', () => {
      const response = request.response || {};
      if (request.status < 200 || request.status >= 300 || !response.secure_url || !response.public_id) {
        const apiMessage = response?.error?.message || 'Cloudinary upload failed.';
        reject(new Error(apiMessage));
        return;
      }

      resolve({
        downloadUrl: response.secure_url,
        storagePath: response.public_id,
      });
    });

    request.send(formData);
  });

export const uploadListingImage = async ({ sourceFile, ownerId, listingId, imageLabel, onProgress }) => {
  let lastError = null;

  for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt += 1) {
    try {
      const preparedFile = await normalizeImageForListing(sourceFile);
      return await uploadPreparedFile({
        preparedFile,
        ownerId,
        listingId,
        imageLabel: `${imageLabel || 'listing-photo'}-a${attempt}`,
        onProgress,
      });
    } catch (error) {
      lastError = error;
      if (attempt >= UPLOAD_MAX_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Image upload failed.');
};

export const deleteListingImage = async () => false;
