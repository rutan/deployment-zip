import { extname, sep } from 'node:path';
import { join as joinPosix, sep as sepPosix } from 'node:path/posix';
import { S3Client } from '@aws-sdk/client-s3';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Upload } from '@aws-sdk/lib-storage';
import { consola } from 'consola';
import mime from 'mime';
import type { Config } from '../config.js';
import { eachDeployFiles } from './common.js';

function getProvider(config: Config) {
  if (config.s3.accessKeyId && config.s3.secretAccessKey) {
    return {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
    };
  }

  return defaultProvider();
}

export async function deployS3(inputDir: string, config: Config) {
  if (!config.s3.bucket) throw 's3.bucket is required';

  const deployTarget = config.s3.keyPrefix ? `${config.s3.bucket}/${config.s3.keyPrefix}` : config.s3.bucket;
  consola.start(`Deploying ${inputDir} to ${deployTarget}`);

  const s3Client = new S3Client({
    region: config.s3.region ?? process.env.AWS_REGION,
    credentials: getProvider(config),
    endpoint: config.s3.endpoint ?? process.env.AWS_S3_ENDPOINT,
  });

  await eachDeployFiles(
    {
      mode: 's3',
      inputDir,
      config,
    },
    async ({ file, inputStream, relativePath }) => {
      const extName = extname(file);
      const mimeType = mime.getType(extName);
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: config.s3.bucket,
          Key: joinPosix(config.s3.keyPrefix ?? '', relativePath.split(sep).join(sepPosix)),
          Body: inputStream,
          ContentType: mimeType ?? 'application/octet-stream',
        },
      });

      upload.on('httpUploadProgress', (progress) => {
        if (!progress.loaded || !progress.total) return;
        const rate = Math.floor((100 * progress.loaded) / progress.total);
        consola.log(` Uploading... ${rate}%`);
      });

      await upload.done();
    },
  );

  consola.success(`Uploaded to ${deployTarget}`);
}
