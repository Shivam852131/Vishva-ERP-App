const express = require('express');
const { requireRole, collegeIdOrThrow } = require('../auth');
const { sendError } = require('../utils');
const { uploadImage, deleteFile } = require('../cloudinary');

const router = express.Router();

router.post('/upload/image', requireRole('student', 'faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const { image, folder } = req.body;
    if (!image) return sendError(res, 'image (base64) is required.', 400);

    const cid = collegeIdOrThrow(req);
    const folderName = folder || (cid ? `vishva-erp/${cid}` : 'vishva-erp');

    const result = await uploadImage(image, folderName);
    res.json({ ok: true, url: result.url, public_id: result.public_id });
  } catch (e) {
    sendError(res, e.message || 'Upload failed.', 500);
  }
});

router.post('/upload/delete', requireRole('student', 'faculty', 'college_admin', 'super_admin'), async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return sendError(res, 'public_id is required.', 400);

    await deleteFile(public_id);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, e.message || 'Delete failed.', 500);
  }
});

module.exports = router;
