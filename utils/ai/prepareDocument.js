const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const mammoth = require('mammoth');

const IMAGE_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

async function docxImages(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const files = zip.file(/^word\/media\//i) || [];
  const images = [];

  for (const file of files) {
    if (images.length >= 6) break;
    const ext = path.extname(file.name).toLowerCase();
    const mediaType = IMAGE_EXT[ext];
    if (!mediaType) continue;
    const data = await file.async('nodebuffer');
    if (!data.length || data.length > 4 * 1024 * 1024) continue;
    images.push({ type: 'image', mediaType, base64: data.toString('base64') });
  }

  const skipped = Math.max(0, files.length - images.length);
  return { images, skipped };
}

async function prepareDocument(filePath, mime, originalName) {
  if (!fs.existsSync(filePath)) {
    return { error: 'The CV file is missing on disk.' };
  }

  const stat = fs.statSync(filePath);
  if (stat.size > 12 * 1024 * 1024) {
    return { error: 'This file is over 12 MB and was not sent to the model.' };
  }

  const ext = path.extname(originalName || filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (ext === '.pdf' || mime === 'application/pdf') {
    return {
      parts: [{ type: 'pdf', mediaType: 'application/pdf', base64: buffer.toString('base64') }],
      note: ''
    };
  }

  if (ext === '.docx' || String(mime).includes('wordprocessingml')) {
    const extracted = await mammoth.extractRawText({ buffer });
    const { images, skipped } = await docxImages(buffer);
    const notes = [];
    if (skipped) notes.push(`${skipped} embedded image(s) were skipped.`);
    if (!extracted.value || extracted.value.trim().length < 40) {
      notes.push('The Word file had very little readable text. Embedded scans may be incomplete.');
    }
    return {
      parts: [
        { type: 'text', text: extracted.value.slice(0, 80000) },
        ...images
      ],
      note: notes.join(' ')
    };
  }

  if (ext === '.doc' || mime === 'application/msword') {
    const WordExtractor = require('word-extractor');
    const doc = await new WordExtractor().extract(filePath);
    const text = doc.getBody() || '';
    return {
      parts: [{ type: 'text', text: text.slice(0, 80000) }],
      note: 'Legacy .doc files do not include image OCR. Scanned pages inside this file may be missing.'
    };
  }

  return { error: 'Only PDF, DOC, and DOCX applications can be screened.' };
}

module.exports = { prepareDocument };
