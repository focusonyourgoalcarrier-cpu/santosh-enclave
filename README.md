# Santosh Enclave

A responsive, single-page website for Santosh Enclave Housing Society in Williams Town, College Road, Deoghar, Jharkhand.

## View the site

Open `index.html` in a modern browser. The site uses plain HTML, CSS, and JavaScript; it has no build step or package installation.

## Resident service forms

The complaint, feedback, security, and maintenance payment information forms save submissions to the Supabase `public.resident_requests` table. Optional JPEG, PNG, and WebP images (up to 10 MB) are uploaded to the private `santosh-request-attachments` Storage bucket; their object path and original filename are recorded on the request row. Browser setup is in `supabase-config.js`; its publishable key is intended for public clients, and database access is limited by Row Level Security to inserts. No maintenance amount, payment schedule, or account details are assumed; the payment panel directs residents to management for current information.

The Supabase project is `Santosh Enclave Website` in the `ap-south-1` (Mumbai) region. The project owner should manage any ongoing billing and review submissions through the Supabase dashboard. The public form endpoint can receive spam; add CAPTCHA or a rate-limited server-side submission function before sharing the site widely.

The design uses Google Fonts and two Unsplash images loaded from their public image URLs. A network connection is needed for those visual assets; the rest of the page remains local.
