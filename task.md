# Cloudflare R2 Integration Requirements

R2 is now activated and ready.

---

# Important Architecture Rules

## NEVER Load Investigation Images in `/dashboard/patients`

When doctor opens:

* `/dashboard/patients`

DO NOT:

* fetch investigation images
* preload image URLs
* render hidden images

Only load:

* patient metadata
* visits metadata

This avoids unnecessary:

* Class B operations
* bandwidth usage
* slow dashboard rendering

---

# Correct Investigation Loading Flow

Images should load ONLY when:

Doctor clicks:

* `Investigation`

Then:

1. Open modal/drawer
2. Fetch investigation images ONLY for selected visit
3. Display images dynamically

This is required.

---

# R2 Upload System Requirements

## Upload Flow

1. Doctor selects images
2. Images compressed client-side
3. Upload begins to R2
4. Show upload status/progress
5. Save returned image URL into visit investigation array

---

# Upload Status UI

Doctor must clearly see upload state.

## States

### Preparing

* `Compressing image...`

### Uploading

* Progress bar
* Percentage

Example:

* `Uploading 45%`

### Success

* `Upload completed`

### Failed

* `Upload failed`
* Retry button

---

# Multi Upload Requirements

Support:

* Multiple image uploads

Each image should have:

* own progress state
* own success/failure state

---

# Investigation Data Structure

Per visit:

```ts
investigations: [
  {
    id,
    imageUrl,
    uploadedAt,
    fileName
  }
]
```

---

# Recommended R2 Structure

Bucket folders:

```bash
patients/
  patient-{id}/
    visit-{id}/
      image-1.webp
      image-2.webp
```

Example:

```bash
patients/patient-12/visit-4/scan-1.webp
```

This keeps files organized per:

* patient
* visit

---

# Security Requirement

Investigation uploads are:

* Admin/Doctor only

Reception:

* cannot upload
* cannot access investigation images

---

# Important Optimization

Before upload:

* compress images
* convert to WebP if possible

Target:

* `200KB - 600KB` per image average

This keeps:

* storage usage low
* uploads fast
* operations efficient

---

# Final Important Rule

## `/dashboard/patients`

NO image fetching.

## Investigation modal

ONLY fetch:

* selected visit images

This is the correct scalable R2 architecture.
