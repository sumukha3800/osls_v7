import crypto from 'node:crypto';
import fs from 'node:fs';

// Resolves with the base64 encoded SHA-256 hash of the file
export default async (filePath: string) => {
  const fileHash = crypto.createHash('sha256');
  fileHash.setEncoding('base64');

  return new Promise<string>((resolve, reject) => {
    const readStream = fs.createReadStream(filePath);
    readStream
      .on('data', (chunk) => {
        fileHash.write(chunk);
      })
      .on('close', () => {
        fileHash.end();
        resolve(fileHash.read());
      })
      .on('error', (error) => {
        const errorMessage = error && error.message ? error.message : String(error);

        reject(
          new Error(`Could not calculate hash for "${filePath}": ${errorMessage}`, {
            cause: error,
          })
        );
      });
  });
};
