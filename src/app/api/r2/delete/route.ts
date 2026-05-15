import { NextRequest, NextResponse } from 'next/server';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET     = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

// DELETE /api/r2/delete
// Body JSON: { imageUrl, visitId, investigationId }
export async function DELETE(req: NextRequest) {
  try {
    const { imageUrl, visitId, investigationId } = await req.json();
    if (!imageUrl || !visitId || !investigationId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Derive the R2 key from the public URL
    const key = imageUrl.replace(`${PUBLIC_URL}/`, '');

    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[R2 Delete Error]', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
