import type { JobContext } from '../handler-registry';
import sharp from 'sharp';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export async function resizeImageHandler(
  payload: Record<string, unknown>,
  ctx: JobContext
): Promise<unknown> {
  const url = payload.url as string;
  const width = payload.width as number;
  const height = payload.height as number;

  ctx.log.info(`Downloading image from ${url}`);
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const inputBuffer = Buffer.from(response.data);
  const originalSizeBytes = inputBuffer.length;

  ctx.log.info(`Resizing to ${width}x${height}`);
  const resizedBuffer = await sharp(inputBuffer).resize(width, height).toBuffer();

  const outputPath = path.join('/tmp', `${ctx.jobId}.jpg`);
  fs.writeFileSync(outputPath, resizedBuffer);

  ctx.log.info(`Saved resized image to ${outputPath}`);

  return {
    outputPath,
    originalSizeBytes,
    newSizeBytes: resizedBuffer.length,
  };
}