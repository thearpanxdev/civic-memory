import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';

/**
 * Upload Middleware & File Signature Verification
 *
 * Rules:
 * 1. Multer memory storage holds incoming files in memory during validation.
 * 2. Magic byte file signature verification prevents extension spoofing for images and video recordings.
 * 3. Verified files are written with cryptographically random UUID filenames.
 * 4. Stored exclusively in protected storage outside publicly accessible web roots.
 * 5. Automatic cleanup on transaction rollback or rejection.
 */

// Configure Multer with strict in-memory storage and limits
const storage = multer.memoryStorage();

const maxUploadFilesTotal = (config.maxUploadFiles || 5) + 2; // Allow up to 5 photos + 2 videos
const maxFileSizeBytes = config.maxVideoSizeBytes || (25 * 1024 * 1024); // 25 MB max per file

const upload = multer({
  storage,
  limits: {
    fileSize: maxFileSizeBytes,
    files: maxUploadFilesTotal,
  },
});

/**
 * Multer error-handling wrapper for multiple evidence image/video uploads
 */
export function uploadEvidenceMiddleware(req, res, next) {
  const uploadHandler = upload.array('images', maxUploadFilesTotal);

  uploadHandler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const mb = (maxFileSizeBytes / (1024 * 1024)).toFixed(0);
        return res.status(400).json({
          error: `File size exceeds the allowed limit of ${mb}MB.`,
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          error: `Maximum ${maxUploadFilesTotal} evidence files can be attached per submission.`,
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          error: `Unexpected field in upload. Evidence photos and videos must be uploaded under the 'images' field.`,
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
 * Calculates SHA-256 hash of a file buffer for immutable data integrity auditing.
 *
 * @param {Buffer} buffer
 * @returns {string} Hex-encoded SHA-256 hash
 */
export function calculateSha256(buffer) {
  if (!buffer) return '';
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Inspects buffer magic bytes (file signatures) to verify genuine image and video content.
 * Does NOT trust client-supplied extensions or Content-Type headers.
 *
 * Supported:
 * - JPEG: FF D8 FF
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - WebP: RIFF (4 bytes) ... WEBP (bytes 8-11)
 * - WebM: 1A 45 DF A3 (EBML ID)
 * - MP4:  'ftyp' box identifier at bytes 4-7
 *
 * @param {Buffer} buffer 
 * @returns {{ mediaType: 'IMAGE'|'VIDEO', mimeType: string, extension: string }|null}
 */
export function verifyMediaSignature(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { mediaType: 'IMAGE', mimeType: 'image/jpeg', extension: '.jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return { mediaType: 'IMAGE', mimeType: 'image/png', extension: '.png' };
  }

  // WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { mediaType: 'IMAGE', mimeType: 'image/webp', extension: '.webp' };
  }

  // WebM: 1A 45 DF A3
  if (
    buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3
  ) {
    return { mediaType: 'VIDEO', mimeType: 'video/webm', extension: '.webm' };
  }

  // MP4: 'ftyp' at bytes 4-7
  if (
    buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70
  ) {
    return { mediaType: 'VIDEO', mimeType: 'video/mp4', extension: '.mp4' };
  }

  return null;
}

/**
 * Backward-compatible helper for image-only validation.
 *
 * @param {Buffer} buffer
 * @returns {string|null} Detected image MIME type or null
 */
export function verifyImageSignature(buffer) {
  const verified = verifyMediaSignature(buffer);
  return verified && verified.mediaType === 'IMAGE' ? verified.mimeType : null;
}

const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/webm': '.webm',
  'video/mp4': '.mp4',
};

/**
 * Persists a verified in-memory media buffer to protected disk storage with a random UUID.
 * Computes SHA-256 server-side content hash.
 *
 * @param {Buffer} buffer
 * @param {string} detectedMime
 * @param {string} [extension]
 * @returns {Promise<{ fileName: string, filePath: string, mimeType: string, fileSize: number, sha256: string }>}
 */
export async function saveVerifiedMediaToDisk(buffer, detectedMime, extension) {
  const ext = extension || MIME_EXTENSION_MAP[detectedMime] || '.bin';
  const safeFileName = `${uuidv4()}${ext}`;
  const targetPath = path.join(config.protectedUploadDir, safeFileName);

  await fs.promises.writeFile(targetPath, buffer);
  const sha256 = calculateSha256(buffer);

  return {
    fileName: safeFileName,
    filePath: targetPath,
    mimeType: detectedMime,
    fileSize: buffer.length,
    sha256,
  };
}

/**
 * Backward-compatible wrapper for images.
 */
export async function saveVerifiedImageToDisk(buffer, detectedMime) {
  return saveVerifiedMediaToDisk(buffer, detectedMime, MIME_EXTENSION_MAP[detectedMime] || '.jpg');
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
