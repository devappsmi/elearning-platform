import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/** Wrapper S3-compatible tipis (MinIO lokal via docker-compose, LocalStack
 * untuk verifikasi, atau S3 sungguhan di produksi -- semuanya bicara API S3
 * yang sama). Konstruktor menerima NILAI MENTAH (bukan ConfigService NestJS)
 * -- alasan sama seperti AzureTtsClient, lihat komentar di sana. */
export class ObjectStorageService {
  private readonly client: S3Client;
  private readonly publicBaseUrl: string;

  constructor(
    private readonly endpoint: string,
    region: string,
    private readonly bucket: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      // WAJIB untuk MinIO/LocalStack -- virtual-hosted-style (bucket.endpoint)
      // tidak resolve terhadap server S3-compatible lokal, cuma S3 asli.
      forcePathStyle: true,
    });
    this.publicBaseUrl = `${endpoint.replace(/\/$/, "")}/${bucket}`;
  }

  /** Bucket diasumsikan public-read (konten pelajaran, bukan data pribadi --
   * lihat docs/PLAN.md) supaya URL-nya bisa langsung di-cache CDN (NFR:
   * "audio TTS streaming cepat, cache CDN") tanpa presigned-URL yang expire
   * dan tidak CDN-cacheable. Bucket + policy public-read perlu disiapkan di
   * infra (docker-compose/terraform/dst.), bukan tanggung jawab kode ini. */
  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return `${this.publicBaseUrl}/${key}`;
  }
}
