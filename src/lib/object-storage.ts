import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const config = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET_NAME,
};

export const isR2Configured = Object.values(config).every(Boolean);

let client: S3Client | null = null;
function r2() {
  if (!isR2Configured) {
    throw new Error("Cloudflare R2 is not configured");
  }
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId!,
      secretAccessKey: config.secretAccessKey!,
    },
  });
  return client;
}

function bucket() {
  return config.bucket!;
}

export function attachmentObjectKey(userId: string, noteId: string) {
  return `users/${userId}/notes/${noteId}/${crypto.randomUUID()}`;
}

export async function putObject(key: string, data: Buffer, mime: string) {
  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: data,
      ContentType: mime,
    }),
  );
}

export function presignedPutUrl(key: string, mime: string) {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: mime,
    }),
    { expiresIn: 15 * 60 },
  );
}

export async function getObject(key: string) {
  const result = await r2().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  if (!result.Body) throw new Error("R2 returned an empty object");
  return Buffer.from(await result.Body.transformToByteArray());
}

export async function deleteObject(key: string) {
  await r2().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
  );
}

export async function deleteObjects(keys: Array<string | null>) {
  await Promise.all(
    keys
      .filter((key): key is string => Boolean(key))
      .map((key) => deleteObject(key).catch(console.error)),
  );
}
