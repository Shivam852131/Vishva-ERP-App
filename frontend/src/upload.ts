import { api } from './api';

export async function uploadImage(base64: string, folder?: string): Promise<{ url: string; public_id: string }> {
  return api('/upload/image', {
    method: 'POST',
    body: JSON.stringify({ image: base64, folder }),
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  return api('/upload/delete', {
    method: 'POST',
    body: JSON.stringify({ public_id: publicId }),
  });
}
