import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// ── R2 client (server-side only — credentials never exposed to browser) ──────

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

// ── POST /api/r2/upload ──────────────────────────────────────────────────────
// Body: multipart/form-data with fields:
//   file       — the compressed image blob
//   patientId  — UUID
//   visitId    — UUID
//   fileName   — original file name (for display)

export async function POST(req: NextRequest) {
  try {
    const formData  = await req.formData();
    const file      = formData.get('file') as File | null;
    const patientId = formData.get('patientId') as string | null;
    const visitId   = formData.get('visitId')   as string | null;
    const fileName  = formData.get('fileName')  as string | null;

    if (!file || !patientId || !visitId || !fileName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build R2 key: patients/patient-{id}/visit-{id}/{timestamp}-{safeName}
    const safeName  = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key       = `patients/patient-${patientId}/visit-${visitId}/${Date.now()}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);

    await r2.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: file.type,
      // Cache aggressively — medical images don't change
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    const imageUrl = `${PUBLIC_URL}/${key}`;

    return NextResponse.json({
      success:  true,
      imageUrl,
      key,
      fileName,
      uploadedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[R2 Upload Error]', err);
    return NextResponse.json(
      { error: 'Upload failed. Check server logs.' },
      { status: 500 }
    );
  }
}
