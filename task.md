## Printing System Bug Fix Request

Please investigate and fix the printing functionality across the application.

### Issue Summary

The printed text content is positioned correctly and the printer successfully prints the document. However, there is a critical issue with the printing layout.

Currently, when the user clicks the **Print** button:

* The patient/prescription text data prints correctly.
* The system is also attempting to print the image:

`/public/drhawar.jpg`

This image should **NOT** be included in the print output.

---

## Current Problem

### Scenario 1: A4 Paper

When an A4 paper is loaded into the printer:

* The text prints correctly.
* The image (`drhawar.jpg`) is also printed.
* This is unnecessary and wastes paper space.

### Scenario 2: A5 Paper (Actual Clinic Paper)

When the clinic's physical A5 paper is used:

* The text layout is correct.
* The printer attempts to print both the text and the image.
* The image causes the print layout to overflow, misalign, or completely break.
* The final printed result becomes unusable.

---

## Required Fix

The print output should contain:

✅ Patient information

✅ Prescription data

✅ Notes

✅ Diagnosis

✅ Any required text content

---

The print output should NOT contain:

❌ `/public/drhawar.jpg`

❌ Any background images

❌ Any decorative images

❌ Any unnecessary branding images that affect printing

---

## Technical Investigation Required

Please inspect:

* Print styles (`@media print`)
* Print templates/components
* Hidden print containers
* PDF generation logic (if applicable)
* Any image elements being injected into the print view
* Any CSS background-image rules
* Any print-specific layouts

Determine why `drhawar.jpg` is being included in the print output and remove it completely from the print rendering process.

---

## Expected Behavior

When the user clicks **Print**:

1. Generate a clean print layout.
2. Include only the necessary text content.
3. Automatically fit within the selected paper size.
4. Work correctly on both:

   * A5 paper
   * A4 paper
5. No image, logo, watermark, or background should be printed unless explicitly required.

---

## Printing Requirements

### A5 Support (Highest Priority)

The clinic primarily uses physical A5 paper.

Requirements:

* Content must fit properly on A5.
* No overflow.
* No clipping.
* No extra blank pages.
* Proper margins.
* Consistent alignment.

### A4 Compatibility

If an A4 printer is used:

* Print the same text-only layout.
* Scale gracefully.
* Do not add images or backgrounds.

---

## Goal

The final print output should be a clean, professional, text-only medical document that prints reliably on both A5 and A4 paper sizes, with no dependency on `drhawar.jpg` or any other image assets.
