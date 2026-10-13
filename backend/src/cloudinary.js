const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadImage(base64, folder = 'vishva-erp') {
  const result = await cloudinary.uploader.upload(
    `data:image/jpeg;base64,${base64}`,
    { folder, resource_type: 'image', quality: 'auto' }
  );
  return { url: result.secure_url, public_id: result.public_id };
}

async function uploadFile(fileBuffer, fileName, folder = 'vishva-erp') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto', public_id: fileName },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(fileBuffer);
  });
}

async function deleteFile(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

module.exports = { cloudinary, uploadImage, uploadFile, deleteFile };
