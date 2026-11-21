import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';

/**
 * Upload Middleware & File Signature Verification
 * 
 * Rules:
 * 1. Multer memory storage holds incoming files in memory during validation.
 * 2. Magic byte file signature verification prevents extension spoofing.
 * 3. Verified files are written with cryptographically random UUID filenames.
 * 4. Stored exclusively in protected storage outside publicly accessible web roots.
 * 5. Automatic cleanup on transaction rollback or rejection.
 */

// Configure Multer with strict in-memory storage and limits
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxUploadSizeBytes, // Default 5 MB
    files: config.maxUploadFiles,        // Default 5 files
  },
});

/**
 * Multer error-handling wrapper for multiple evidence image uploads
 */
export function uploadEvidenceMiddleware(req, res, next) {
  const uploadHandler = upload.array('images', config.maxUploadFiles);

  uploadHandler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const mb = (config.maxUploadSizeBytes / (1024 * 1024)).toFixed(0);
        return res.status(400).json({
          error: `File size exceeds the allowed limit of ${mb}MB per image.`,
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          error: `Maximum ${config.maxUploadFiles} images can be attached per complaint.`,
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          error: `Unexpected field in upload. Evidence photos must be uploaded under the 'images' field.`,
        });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: `File upload failed: ${err.message}` });
    }
    next();
  });
}

/**
 * Inspects buffer magic bytes (file signatures) to verify genuine image content.
 * Does NOT trust client-supplied extensions or Content-Type headers.
 * 
 * Supported:
 * - JPEG: FF D8 FF
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - WebP: RIFF (4 bytes) ... WEBP (bytes 8-11)
 * 
 * @param {Buffer} buffer 
 * @returns {string|null} Detected MIME type or null if invalid
 */
export function verifyImageSignature(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return 'image/png';
  }

  // WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * Persists a verified in-memory image buffer to protected disk storage with a random UUID.
 * 
 * @param {Buffer} buffer
 * @param {string} detectedMime
 * @returns {{ fileName: string, filePath: string, mimeType: string, fileSize: number }}
 */
export async function saveVerifiedImageToDisk(buffer, detectedMime) {
  const extension = MIME_EXTENSION_MAP[detectedMime] || '.jpg';
  const safeFileName = `${uuidv4()}${extension}`;
  const targetPath = path.join(config.protectedUploadDir, safeFileName);

  await fs.promises.writeFile(targetPath, buffer);

  return {
    fileName: safeFileName,
    filePath: targetPath,
    mimeType: detectedMime,
    fileSize: buffer.length,
  };
}

/**
 * Unlinks an array of file paths from disk (used on database failure / rollback)
 * 
 * @param {string[]} filePaths 
 */
export function cleanupFiles(filePaths) {
  if (!Array.isArray(filePaths)) return;
  for (const fp of filePaths) {
    try {
      if (fp && fs.existsSync(fp)) {
        fs.unlinkSync(fp);
      }
    } catch (err) {
      console.error(`[Upload Cleanup] Failed to unlink file ${fp}:`, err);
    }
  }
}
