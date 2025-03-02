import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadNID(filePath: string) {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'NIDs',
      public_id: `NID_${Date.now()}`,
    });
    return JSON.stringify(result.secure_url);
  } catch (error) {
    console.error('Error uploading NID:', error);
    throw new Error('Failed to upload NID');
  }
}