import type { JobContext } from '../handler-registry';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export async function downloadFileHandler(
  payload: Record<string, unknown>,
  ctx: JobContext
): Promise<unknown> {
  const url = payload.url as string;

  ctx.log.info(`Downloading file from ${url}`);

  const response = await axios.get(url, { responseType: 'stream' });
  const filePath = path.join('/tmp', `${ctx.jobId}-download`);
  const writer = fs.createWriteStream(filePath);

  response.data.pipe(writer);

  await new Promise<void>((resolve, reject) => {
    writer.on('finish', () => resolve());
    writer.on('error', reject);
  });

  const stats = fs.statSync(filePath);

  ctx.log.info(`File downloaded to ${filePath}`);

  return {
    filePath,
    sizeBytes: stats.size,
  };
}