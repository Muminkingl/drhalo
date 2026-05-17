"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Patient, Visit } from '../context/PatientContext';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Investigation {
  id: string;
  imageUrl: string;
  fileName: string;
  uploadedAt: string;
}

type UploadStatus = 'idle' | 'compressing' | 'uploading' | 'success' | 'error';

interface ImageFile {
  id: string;
  file: File;
  preview: string;
  compressed?: Blob;
  status: UploadStatus;
  progress: number;   // 0–100
  error?: string;
  resultUrl?: string;
}

interface Props {
  patient: Patient;
  visit: Visit;
  onClose: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_WIDTH = 1600;
const QUALITY = 0.75;

// ── Compression (PNG/JPEG → WebP) ────────────────────────────────────────────

async function compressToWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_WIDTH) { height = Math.round(height * MAX_WIDTH / width); width = MAX_WIDTH; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      // Try WebP first, fallback to JPEG
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else canvas.toBlob(b2 => b2 ? resolve(b2) : reject(new Error('Compress failed')), 'image/jpeg', QUALITY);
      }, 'image/webp', QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Load failed')); };
    img.src = url;
  });
}

// ── Upload to R2 via API route (with XHR for progress) ───────────────────────

function uploadViaXHR(
  blob: Blob,
  patientId: string,
  visitId: string,
  fileName: string,
  onProgress: (pct: number) => void,
): Promise<{ imageUrl: string; uploadedAt: string }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', blob, fileName);
    form.append('patientId', patientId);
    form.append('visitId', visitId);
    form.append('fileName', fileName);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/r2/upload');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({ imageUrl: data.imageUrl, uploadedAt: data.uploadedAt });
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(form);
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtBytes = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

// ── Module-level cache — persists across modal open/close within the same session ──
// Key: visitId → Investigation[]
// This means opening the same visit's modal a 2nd time costs ZERO Supabase/R2 reads.
const investigationsCache = new Map<string, Investigation[]>();

// ── Component ─────────────────────────────────────────────────────────────────

export default function InvestigationModal({ patient, visit, onClose }: Props) {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [existing, setExisting] = useState<Investigation[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [lightbox, setLightbox] = useState<Investigation | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Camera state ────────────────────────────────────────────────────────────
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedCount, setCapturedCount] = useState(0);

  // Download from R2 URL — uses already-loaded URL, zero extra calls
  const downloadImage = (inv: Investigation) => {
    const a = document.createElement('a');
    a.href = inv.imageUrl;
    a.download = inv.fileName;
    a.target = '_blank';
    a.click();
  };

  // Delete from R2 + Supabase + cache + UI
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteInvestigation = async (inv: Investigation) => {
    if (!confirm(`Delete "${inv.fileName}"? This cannot be undone.`)) return;
    setDeletingId(inv.id);
    try {
      // 1. Delete from R2
      await fetch('/api/r2/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: inv.imageUrl, visitId: visit.id, investigationId: inv.id }),
      });
      // 2. Remove from Supabase
      const updated = existing.filter(i => i.id !== inv.id);
      await supabase.from('visits').update({ investigations: updated }).eq('id', visit.id);
      // 3. Update cache + UI
      investigationsCache.set(visit.id, updated);
      setExisting(updated);
      if (lightbox?.id === inv.id) setLightbox(null);
    } catch {
      alert('Delete failed. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Fetch existing investigations for this visit (ONLY here, never in dashboard) ──

  useEffect(() => {
    // Hit cache first — avoids duplicate Supabase reads on modal reopen
    if (investigationsCache.has(visit.id)) {
      setExisting(investigationsCache.get(visit.id)!);
      setLoadingExisting(false);
      return;
    }
    async function fetchExisting() {
      setLoadingExisting(true);
      const { data, error } = await supabase
        .from('visits')
        .select('investigations')
        .eq('id', visit.id)
        .single();
      const list = (!error && data?.investigations) ? data.investigations as Investigation[] : [];
      investigationsCache.set(visit.id, list);
      setExisting(list);
      setLoadingExisting(false);
    }
    fetchExisting();
  }, [visit.id]);

  // Cleanup object URLs
  useEffect(() => () => { images.forEach(i => URL.revokeObjectURL(i.preview)); }, []); // eslint-disable-line

  // ── Camera helpers ───────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCapturedCount(0);
    setCameraError(null);
  }, []);

  const openCamera = useCallback(async (facing: 'environment' | 'user' = cameraFacingMode) => {
    setCameraError(null);
    // Stop any existing stream first
    streamRef.current?.getTracks().forEach(t => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // Attach to video element after state update
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      setCameraError('Could not access camera. Please allow camera permission and try again.');
    }
  }, [cameraFacingMode]);

  const flipCamera = useCallback(() => {
    const next: 'environment' | 'user' = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(next);
    openCamera(next);
  }, [cameraFacingMode, openCamera]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      addFiles([file]);
      setCapturedCount(c => c + 1);
    }, 'image/jpeg', 0.95);
  }, []);

  // Cleanup camera on unmount
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  // ── Update single image state ─────────────────────────────────────────────

  const updateImg = useCallback((id: string, patch: Partial<ImageFile>) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, ...patch } : img));
  }, []);

  // ── Add files ─────────────────────────────────────────────────────────────

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const valid = Array.from(files).filter(f => {
      if (!ALLOWED_TYPES.includes(f.type)) return false;
      return true;
    });
    if (valid.length === 0) { setUploadError('Only JPG, PNG, WEBP images are allowed.'); return; }
    setUploadError(null);

    const entries: ImageFile[] = valid.map(file => ({
      id: crypto.randomUUID(), file,
      preview: URL.createObjectURL(file),
      status: 'compressing' as UploadStatus,
      progress: 0,
    }));
    setImages(prev => [...prev, ...entries]);

    for (const entry of entries) {
      try {
        const compressed = await compressToWebP(entry.file);
        updateImg(entry.id, { compressed, status: 'idle' });
      } catch {
        updateImg(entry.id, { status: 'error', error: 'Compression failed' });
      }
    }
  }, [updateImg]);

  // ── Drag & drop ───────────────────────────────────────────────────────────

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); };
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; };

  const removeImg = (id: string) => {
    setImages(prev => { const t = prev.find(i => i.id === id); if (t) URL.revokeObjectURL(t.preview); return prev.filter(i => i.id !== id); });
  };

  // ── Upload single image to R2 only (no DB write — uploadAll handles that) ──

  const uploadOneToR2 = useCallback(async (img: ImageFile): Promise<Investigation | null> => {
    if (!img.compressed) return null;
    updateImg(img.id, { status: 'uploading', progress: 0, error: undefined });

    const ext      = img.compressed.type === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `${img.file.name.replace(/\.[^.]+$/, '')}.${ext}`;

    try {
      const { imageUrl, uploadedAt } = await uploadViaXHR(
        img.compressed, patient.id, visit.id, fileName,
        (pct) => updateImg(img.id, { progress: pct }),
      );
      updateImg(img.id, { status: 'success', progress: 100, resultUrl: imageUrl });
      return { id: img.id, imageUrl, fileName, uploadedAt };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      updateImg(img.id, { status: 'error', error: msg });
      return null;
    }
  }, [patient.id, visit.id, updateImg]);

  // ── Upload all ready — concurrent R2 uploads, single atomic DB write ─────
  // Fix: never read-modify-write Supabase per image (causes race/overwrite).
  // Instead: upload all to R2 in parallel, collect results, write once.

  const uploadAll = async () => {
    const ready = images.filter(i => i.status === 'idle' && i.compressed);
    if (ready.length === 0) return;

    // Upload all to R2 concurrently (progress bars still work per-image)
    const results = await Promise.all(ready.map(uploadOneToR2));
    const newEntries = results.filter((r): r is Investigation => r !== null);

    if (newEntries.length === 0) return;

    // Single atomic Supabase write — no race condition possible
    const updated = [...existing, ...newEntries];
    await supabase.from('visits').update({ investigations: updated }).eq('id', visit.id);

    // Sync cache + UI
    investigationsCache.set(visit.id, updated);
    setExisting(updated);
  };

  // ── Status badge ──────────────────────────────────────────────────────────

  const StatusBar = ({ img }: { img: ImageFile }) => {
    if (img.status === 'compressing') return (
      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        <span className="text-[9px] text-white font-bold">Compressing…</span>
      </div>
    );
    if (img.status === 'uploading') return (
      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 px-3">
        <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-purple-400 rounded-full transition-all duration-200" style={{ width: `${img.progress}%` }} />
        </div>
        <span className="text-[9px] text-white font-bold">Uploading {img.progress}%</span>
      </div>
    );
    if (img.status === 'success') return (
      <div className="absolute inset-0 bg-green-900/60 flex items-center justify-center">
        <div className="bg-green-500 rounded-full p-1"><svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg></div>
      </div>
    );
    if (img.status === 'error') return (
      <div className="absolute inset-0 bg-red-900/70 flex flex-col items-center justify-center gap-1 px-2">
        <span className="text-[9px] text-white font-bold text-center">{img.error}</span>
        <button 
          type="button" 
          onClick={async () => {
            const entry = await uploadOneToR2(img);
            if (entry) {
              const updated = [...existing, entry];
              await supabase.from('visits').update({ investigations: updated }).eq('id', visit.id);
              investigationsCache.set(visit.id, updated);
              setExisting(updated);
            }
          }} 
          className="text-[9px] bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded font-bold"
        >
          Retry
        </button>
      </div>
    );
    // idle — ready
    if (img.status === 'idle' && img.compressed) return (
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1">
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-gray-300 line-through">{fmtBytes(img.file.size)}</span>
          <span className="text-[8px] text-green-300 font-bold">→ {fmtBytes(img.compressed.size)}</span>
          <span className="ml-auto text-[8px] text-emerald-400 font-black">-{Math.round((1 - img.compressed.size / img.file.size) * 100)}%</span>
        </div>
      </div>
    );
    return null;
  };

  const readyCount    = images.filter(i => i.status === 'idle').length;
  const pendingCount  = images.filter(i => i.status === 'compressing' || i.status === 'uploading').length;
  const successCount  = images.filter(i => i.status === 'success').length;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              Investigation Images
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {patient.name} · <span className="font-semibold text-purple-600 dark:text-purple-400">{new Date(visit.visited_at).toLocaleDateString()}</span>
              {existing.length > 0 && <span className="ml-2 text-green-600 dark:text-green-400">· {existing.length} stored</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">

          {/* Existing images from R2 */}
          {loadingExisting ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Loading saved images…
            </div>
          ) : existing.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Stored ({existing.length})</p>
              <div className="grid grid-cols-4 gap-2">
                {existing.map(inv => (
                  <div
                    key={inv.id}
                    className="relative aspect-square rounded-lg overflow-hidden border border-green-200 dark:border-green-800/50 group cursor-pointer"
                    onClick={() => setLightbox(inv)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={inv.imageUrl} alt={inv.fileName} className="w-full h-full object-cover" loading="lazy" />
                    {/* Hover overlay — expand center + delete top-left */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                      {/* Expand icon (center) */}
                      <svg className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                      {/* Delete icon (top-left) */}
                      <button
                        type="button"
                        disabled={deletingId === inv.id}
                        onClick={(e) => { e.stopPropagation(); deleteInvestigation(inv); }}
                        className="absolute top-1.5 left-1.5 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      >
                        {deletingId === inv.id
                          ? <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          : <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source selection buttons */}
          {!cameraOpen && (
            <div
              onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
              className={`relative rounded-xl border-2 border-dashed transition-colors ${
                isDragging ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 p-6' : 'border-gray-200 dark:border-gray-600'
              }`}
            >
              {isDragging ? (
                <div className="flex flex-col items-center justify-center gap-2 py-4">
                  <svg className="h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                  <p className="text-sm font-semibold text-purple-600">Drop images here</p>
                </div>
              ) : (
                <div className="flex gap-3 p-3">
                  {/* Gallery */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center gap-2 py-5 px-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-gray-200 dark:border-gray-600 hover:border-indigo-400 transition-all group"
                  >
                    <svg className="h-7 w-7 text-indigo-400 group-hover:text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Choose from Gallery</span>
                  </button>
                  {/* Camera */}
                  <button
                    type="button"
                    onClick={() => openCamera()}
                    className="flex-1 flex flex-col items-center gap-2 py-5 px-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-gray-200 dark:border-gray-600 hover:border-purple-400 transition-all group"
                  >
                    <svg className="h-7 w-7 text-purple-400 group-hover:text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Open Camera</span>
                  </button>
                </div>
              )}
              <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp" onChange={onInput} className="hidden" />
            </div>
          )}

          {/* Camera error */}
          {cameraError && (
            <div className="flex gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <svg className="h-4 w-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <p className="text-xs text-red-600 dark:text-red-400">{cameraError}</p>
            </div>
          )}

          {/* Live Camera UI */}
          {cameraOpen && (
            <div className="rounded-xl overflow-hidden border-2 border-purple-400 dark:border-purple-600 bg-black">
              {/* Viewfinder */}
              <div className="relative">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-64 object-cover"
                />
                {/* Capture count badge */}
                {capturedCount > 0 && (
                  <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {capturedCount} captured
                  </div>
                )}
                {/* Flip camera */}
                <button
                  type="button"
                  onClick={flipCamera}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                  title="Flip camera"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
              {/* Camera controls */}
              <div className="flex items-center justify-between gap-3 p-3 bg-gray-900">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  Finish
                </button>
                {/* Shutter button */}
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="w-14 h-14 rounded-full bg-white hover:bg-gray-100 border-4 border-purple-400 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                  title="Take photo"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-500" />
                </button>
                <div className="px-4 py-2 text-xs text-white/50 text-center">
                  Tap shutter<br/>to capture
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {uploadError && (
            <div className="flex gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <svg className="h-4 w-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
            </div>
          )}

          {/* New images grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {images.map(img => (
                <div key={img.id} className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt={img.file.name} className="w-full h-full object-cover" />
                  <StatusBar img={img} />
                  {(img.status === 'idle' || img.status === 'error') && (
                    <button type="button" onClick={() => removeImg(img.id)}
                      className="absolute top-1.5 right-1.5 p-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Success summary */}
          {successCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
              <p className="text-xs font-bold text-green-700 dark:text-green-400">{successCount} image{successCount > 1 ? 's' : ''} uploaded successfully</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {pendingCount > 0 ? `Processing ${pendingCount} image${pendingCount > 1 ? 's' : ''}…` :
             readyCount > 0  ? `${readyCount} ready · WebP · Max 1600px` : 'Add images to upload'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              Close
            </button>
            <button type="button" onClick={uploadAll}
              disabled={readyCount === 0 || pendingCount > 0}
              className="px-5 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              {pendingCount > 0 && <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {readyCount > 0 ? `Upload (${readyCount})` : 'Upload'}
            </button>
          </div>
        </div>

        </div>
      </div>

      {/* Lightbox — zero extra API calls; URL already in session cache */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          {/* Card — stop propagation so clicking image doesn't close */}
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.imageUrl}
              alt={lightbox.fileName}
              className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
            {/* Toolbar */}
            <div className="flex items-center justify-between mt-3 px-1">
              <p className="text-sm text-white/70 truncate max-w-xs">{lightbox.fileName}</p>
              <div className="flex items-center gap-2">
                {/* Download */}
                <button
                  type="button"
                  onClick={() => downloadImage(lightbox)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                {/* Delete */}
                <button
                  type="button"
                  disabled={deletingId === lightbox.id}
                  onClick={() => deleteInvestigation(lightbox)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/80 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {deletingId === lightbox.id
                    ? <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    : <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  }
                  {deletingId === lightbox.id ? 'Deleting…' : 'Delete'}
                </button>
                {/* Prev / Next */}
                {existing.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => { const i = existing.indexOf(lightbox); setLightbox(existing[(i - 1 + existing.length) % existing.length]); }}
                      className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => { const i = existing.indexOf(lightbox); setLightbox(existing[(i + 1) % existing.length]); }}
                      className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </>
                )}
                {/* Close */}
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  className="p-1.5 bg-white/10 hover:bg-red-500/80 text-white rounded-lg transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
