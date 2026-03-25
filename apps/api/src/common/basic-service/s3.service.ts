import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

export interface PresignedUploadUrl {
  signedUrl: string;
  key: string;
  publicUrl: string;
}

@Injectable()
export class S3Service {
  private readonly bucket = process.env.S3_BUCKET_NAME!;
  private readonly region = process.env.AWS_REGION!;

  private s3 = new S3Client({
    region: this.region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  /*  업로드 (Buffer)                                         */

  async uploadBuffer(buffer: Buffer, ext: string) {
    const cleanExt = this.normalizeExt(ext);
    const key = `uploads/${crypto.randomBytes(16).toString('hex')}.${cleanExt}`;

    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: this.guessContentType(cleanExt),
    });

    try {
      await this.s3.send(cmd);
      return {
        key,
        publicUrl: this.toPublicUrl(key),
      };
    } catch (e) {
      throw new InternalServerErrorException('S3 업로드 오류', { cause: e });
    }
  }

  //  Presigned URL

  async getPresignedUploadUrl(ext: string): Promise<PresignedUploadUrl> {
    const cleanExt = this.normalizeExt(ext);
    if (!['jpg', 'jpeg', 'png', 'webp', 'mp3'].includes(cleanExt)) {
      throw new Error(`지원하지 않는 확장자: ${ext}`);
    }

    const key = `uploads/${crypto.randomBytes(16).toString('hex')}.${cleanExt}`;
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: this.guessContentType(cleanExt),
    });

    try {
      const signedUrl = await getSignedUrl(this.s3, cmd, { expiresIn: 300 });
      return {
        signedUrl,
        key,
        publicUrl: this.toPublicUrl(key),
      };
    } catch (e) {
      throw new InternalServerErrorException('Presigned URL 생성 실패', {
        cause: e,
      });
    }
  }

  //  단건 삭제
  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (e) {
      throw new InternalServerErrorException('S3 삭제 오류', { cause: e });
    }
  }

  //  객체 존재 여부 확인 (404 → 오류)
  async getObjectMeta(key: string) {
    return this.s3.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  // ------------------ helpers -----------------------------
  private normalizeExt(ext: string) {
    return ext.startsWith('.') ? ext.slice(1).toLowerCase() : ext.toLowerCase();
  }

  private toPublicUrl(key: string) {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private guessContentType(ext: string): string {
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      mp3: 'audio/mpeg',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}
