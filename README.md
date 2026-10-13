# Moses Alabi Website — HTML, CSS & JavaScript conversion

## Contents
- `index.html` and the other page HTML files: static versions of the original public pages.
- `static/css/style.css` and `static/js/main.js`: original styles and client-side interactions.
- `portfolio/*.html`: individual project case studies.
- `data/content.json`: original structured website content.
- `admin.html`: local JSON editing/import/export helper.

## Run locally
From this directory, run `python -m http.server 8000` and open `http://localhost:8000/`. A local server is recommended because browsers restrict `fetch()` when opening HTML directly as `file://`.

## Important functional difference
The original project uses Flask on the server for secure admin authentication, server-side content writes, image uploads/deletion, audit logs, sessions, and form handling. Those server-side capabilities cannot be preserved securely by HTML/CSS/JavaScript alone. This conversion preserves the public pages, content, navigation, responsive menu, background carousel, timezone clocks, external booking/email links, and front-end behavior. `admin.html` is a browser-local JSON editor, not a secure replacement for the original Flask admin and it does not automatically rebuild or publish HTML pages. To retain secure multi-user administration and server persistence, a backend/API is required.

All original public page content and the original CSS/JavaScript assets are included. The source archive provided by you should be retained as a backup for the original Flask functionality.
