# Production-Grade Two-Factor Authentication (2FA) Demo

A secure, complete Two-Factor Authentication (2FA) reference implementation built with **Node.js**, **Express**, **MongoDB**, and **Speakeasy**. Demonstrates RFC 6238 Time-Based One-Time Password (TOTP) enrollment via QR code, AES-256-GCM encryption at rest, emergency recovery codes, session fixation mitigation, rate limiting, and CSRF protection.

---

## Table of Contents

- [Key Features](#key-features)
- [How 2FA (TOTP) Works](#how-2fa-totp-works)
- [Packages &amp; Technologies Used](#packages--technologies-used)
- [Project Architecture &amp; File Structure](#project-architecture--file-structure)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Installation &amp; Setup](#installation--setup)
- [Running the Application](#running-the-application)
- [Running Automated Tests](#running-automated-tests)
- [Application Routes](#application-routes)
- [Security Mechanisms &amp; OWASP Compliance](#security-mechanisms--owasp-compliance)
- [License](#license)

---

## Key Features

- **RFC 6238 TOTP Standard:** Fully compliant with standard authenticator apps including Google Authenticator, Microsoft Authenticator, Authy, and Apple Keychain.
- **In-Memory QR Code Enrollment:** Generates Base64 data URLs for seamless QR scanning without storing temporary files on disk.
- **AES-256-GCM Secret Encryption at Rest:** Shared TOTP secrets are encrypted with authenticated AES-256-GCM before writing to MongoDB. Database breaches or snapshots never reveal plaintext secrets.
- **Single-Use Emergency Recovery Codes:** Generates 10 human-readable backup codes (`XXXX-XXXX`) stored using `bcrypt` hashing. Supports resilient normalization (with/without hyphens, case-insensitive).
- **Session Fixation Defense:** Session IDs are regenerated via `req.session.regenerate()` both upon primary login and upon 2FA verification.
- **Flexible 2FA Disabling:** Allows disabling 2FA with either a 6-digit authenticator OTP or an unused emergency recovery code (essential if a user loses their phone).
- **Brute-Force Rate Limiting:** Throttles incorrect login and OTP verification attempts to prevent automated dictionary attacks.
- **CSRF &amp; Helmet Security Headers:** Comprehensive CSRF token validation and Content Security Policy (CSP) tailored for inline QR code rendering and Google Fonts.
- **Built-in Documentation Tab:** An interactive `/info` tab explaining the mathematical foundations of TOTP, packages used, and copyable implementation snippets.

---

## How 2FA (TOTP) Works

Time-Based One-Time Password (TOTP, RFC 6238) extends HMAC-Based One-Time Password (HOTP, RFC 4226) by substituting an incrementing counter with the **current Unix timestamp** divided into 30-second steps.

```
Counter (C) = ⌊ (Current Unix Timestamp - T0) / X ⌋
OTP = Truncate(HMAC-SHA1(Shared_Secret, Counter)) mod 10^6
```

Where:
- `T0 = 0` (Unix Epoch: January 1, 1970)
- `X = 30 seconds` (time-step interval)
- `Shared_Secret` = 20-byte Base32 string shared between the server and user's device

```
   User Registration & Enrollment
   ------------------------------
   1. User requests 2FA -> Server generates Base32 secret
   2. Server builds: otpauth://totp/AppName:email?secret=...&issuer=AppName
   3. QR code rendered on screen -> User scans with authenticator app
   4. User submits first 6-digit OTP -> Server verifies -> 2FA Enabled
   5. Server issues 10 bcrypt-hashed emergency recovery codes

   Subsequent Sign-In Flow
   -----------------------
   1. Primary Auth: Email + bcrypt Password
   2. If 2FA Enabled: Session flagged as pending 2FA -> Redirect to /2fa/verify
   3. User opens Google Authenticator -> Inputs current 6-digit code
   4. Server verifies token (allowing +/- 30s clock drift window)
   5. Session regenerated -> Full dashboard access granted
```

---

## Packages & Technologies Used

| Package | Version | Purpose & Usage in Project |
| :--- | :--- | :--- |
| **`speakeasy`** | `^2.0.0` | Generates 20-byte Base32 secrets, formats `otpauth://` URIs with issuer metadata, and verifies 6-digit TOTP tokens with drift windows. |
| **`qrcode`** | `^1.5.4` | Converts `otpauth://` URLs into Base64 PNG data URLs (`data:image/png;base64,...`) for inline rendering. |
| **`crypto`** | *Built-in* | Native Node.js module used for AES-256-GCM authenticated encryption at rest and secure CSRF token generation. |
| **`bcrypt`** | `^6.0.0` | Hashes user passwords (12 salt rounds) and emergency recovery codes (10 salt rounds). |
| **`express`** | `^5.3.0` | Core HTTP web framework and route middleware engine. |
| **`express-session`** | `^1.19.0` | Session middleware managing cookie-based user states (`httpOnly`, `sameSite: 'lax'`). |
| **`connect-mongo`** | `^6.0.0` | Persists user sessions in MongoDB with automatic TTL expiry. |
| **`express-rate-limit`** | `^8.7.4` | Enforces request rate limits on sensitive endpoints (`/auth/login`, `/2fa/verify-login`, `/2fa/verify-recovery`). |
| **`helmet`** | `^8.3.0` | Sets secure HTTP response headers and Content Security Policy (CSP). |
| **`mongoose`** | `^9.12.2` | MongoDB ODM providing schema validation, subdocuments, and pre-save hooks. |
| **`ejs`** | `^7.0.2` | Server-side templating engine for views and layout components. |
| **`dotenv`** | `^18.0.10` | Loads environment variables from `.env`. |

---

## Project Architecture & File Structure

```
2FA-Authentication/
├── config/
│   ├── db.js                     # MongoDB connection logic
│   └── session.js                # express-session configuration with connect-mongo
├── controllers/
│   ├── authController.js         # Register, Login, Logout handlers
│   ├── dashboardController.js    # Security Dashboard & stats
│   └── twoFactorController.js   # 2FA Setup, Verify, Disable, Recovery handlers
├── middleware/
│   ├── authMiddleware.js         # isAuthenticated, isPending2FA, isGuest guards
│   ├── csrfMiddleware.js         # Session-based CSRF protection
│   ├── flashMiddleware.js        # Session flash alerts (supports render & redirect)
│   └── rateLimiter.js            # express-rate-limit instances with safe redirects
├── models/
│   └── User.js                   # Mongoose schema, bcrypt hook, encrypted 2FA secret methods
├── public/
│   ├── css/
│   │   ├── dashboard.css         # Dashboard and metrics card styles
│   │   └── style.css             # Base styles, alerts, tabs, code blocks, modals
│   └── js/
│       ├── alerts.js             # Alert banner dismiss logic
│       ├── main.js               # Clipboard copying, modal controls, tab toggles
│       └── otp-input.js          # 6-box OTP input with auto-advance & paste handler
├── routes/
│   ├── authRoutes.js             # /auth routes
│   ├── dashboardRoutes.js        # /dashboard routes
│   ├── indexRoutes.js            # Home (/) and How 2FA Works (/info) routes
│   └── twoFactorRoutes.js        # /2fa routes
├── services/
│   ├── recoveryCodeService.js    # Recovery code generation, bcrypt hashing & consumption
│   └── twoFactorService.js       # Speakeasy secret & QR code generation, TOTP verification
├── test/
│   ├── appIntegration.test.js    # Full HTTP end-to-end integration test suite
│   ├── cryptoUtil.test.js        # AES-256-GCM unit tests
│   ├── index.test.js             # Test runner entry point
│   ├── recoveryCodeService.test.js # Recovery code generation & consumption tests
│   ├── twoFactorService.test.js  # Speakeasy TOTP & QR code tests
│   └── validationUtil.test.js    # Input validation & recovery code normalization tests
├── utils/
│   ├── cryptoUtil.js             # AES-256-GCM encrypt/decrypt helpers
│   └── validationUtil.js         # Email, password, OTP, and recovery code normalizers
├── views/
│   ├── 2fa/
│   │   ├── disable.ejs           # Disable 2FA with password + OTP or Recovery Code
│   │   ├── recovery-codes.ejs    # One-time recovery code display with copy/download
│   │   ├── setup.ejs             # QR code scanning & manual secret entry
│   │   └── verify.ejs            # Login 2FA challenge (OTP or Recovery Code tabs)
│   ├── auth/
│   │   ├── login.ejs             # Primary login form
│   │   └── register.ejs          # Registration form with live password meter
│   ├── dashboard/
│   │   └── index.ejs             # Security dashboard & recovery codes modal
│   ├── layouts/
│   │   ├── alerts.ejs            # Flash message container
│   │   ├── footer.ejs            # App footer & script imports
│   │   └── header.ejs            # Navigation bar & global layout head
│   ├── error.ejs                 # Error page (403, 404, 500)
│   ├── index.ejs                 # Landing page
│   └── info.ejs                  # How 2FA Works, Packages & Implementation Guide
├── .env.example                  # Template configuration file
├── package.json                  # Dependencies and scripts
└── server.js                     # Express app bootstrap & HTTP listener
```

---

## Prerequisites

- **Node.js:** v18.0.0 or higher (v20+ recommended)
- **MongoDB:** v5.0 or higher running locally or accessible via MongoDB Atlas
- **Mobile Authenticator:** Google Authenticator, Microsoft Authenticator, Authy, or 1Password

---

## Environment Configuration

Create a `.env` file in the root directory (based on `.env.example`):

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Connection URI (e.g. port 27017 or 27018)
MONGODB_URI=mongodb://127.0.0.1:27018/2fa_demo

# Session Secret (Replace with a random 64-char string)
SESSION_SECRET=e7b4c91a3f6289d045812cb5e9871024fa93bc71d4820153ef69b82147cad90e

# AES-256 Encryption Key for Secrets at Rest (at least 32 characters)
ENCRYPTION_KEY=94a7e30d1b582c4f70891234567890abcdef1234567890abcdef1234567890abcdef

# Application Name (Shown in Authenticator Apps)
APP_NAME=2FA Demo App
```

---

## Installation & Setup

1. **Clone the repository and enter the directory:**
   ```bash
   cd 2FA-Authentication
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Verify MongoDB is running:**
   ```bash
   mongosh --eval "db.adminCommand('ping')"
   ```

---

## Running the Application

### Production Mode:
```bash
npm start
```

### Development Mode (with automatic file reload):
```bash
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## Running Automated Tests

The project includes an end-to-end integration and unit test suite built with Node's native test runner (`node:test`):

```bash
npm test
```

All 30 unit and integration tests will run sequentially and verify:
- AES-256-GCM encryption, decryption, and tamper detection
- RFC 6238 token generation, clock drift windows, and QR data URL generation
- 10 recovery codes generation, bcrypt hashing, and single-use consumption
- User registration, login, 2FA setup, OTP verification, recovery code fallback, and 2FA disabling

---

## Application Routes

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | Landing page with architecture overview |
| `GET` | `/info` | Public | **How 2FA Works & Implementation Guide** |
| `GET` | `/auth/register` | Guest | User registration form with password strength meter |
| `POST` | `/auth/register` | Guest | Creates account with bcrypt-hashed password |
| `GET` | `/auth/login` | Guest | User sign-in page |
| `POST` | `/auth/login` | Guest | Validates credentials; redirects to 2FA challenge if active |
| `POST` | `/auth/logout` | Authenticated | Destroys session and clears session cookie |
| `GET` | `/dashboard` | Authenticated | Security dashboard with status and recovery code counts |
| `GET` | `/2fa/setup` | Authenticated | Generates Base32 secret and displays QR code |
| `POST` | `/2fa/verify-setup` | Authenticated | Verifies initial OTP, enables 2FA, and issues recovery codes |
| `GET` | `/2fa/recovery-codes` | Authenticated | Displays new recovery codes once upon generation |
| `POST` | `/2fa/confirm-recovery`| Authenticated | Acknowledges receipt of recovery codes |
| `GET` | `/2fa/verify` | Pending 2FA | 2FA challenge screen during login |
| `POST` | `/2fa/verify-login` | Pending 2FA | Validates 6-digit OTP code and promotes session |
| `POST` | `/2fa/verify-recovery`| Pending 2FA | Consumes an emergency recovery code for login |
| `GET` | `/2fa/disable` | Authenticated | Disable 2FA form |
| `POST` | `/2fa/disable` | Authenticated | Disables 2FA using password + OTP or Recovery Code |
| `POST` | `/2fa/recovery-codes` | Authenticated | Regenerates recovery codes (requires password + OTP) |

---

## Security Mechanisms & OWASP Compliance

1. **Authentication Tag Verification (AES-256-GCM):**
   Prevents chosen-ciphertext attacks by verifying an authenticated tag before decrypting secret keys.
2. **Session Fixation Prevention:**
   Calls `req.session.regenerate()` whenever authentication privilege changes (e.g., after password verification, and again after OTP verification).
3. **Open Redirect Mitigation:**
   All redirects derived from the HTTP `Referer` header validate origin to ensure users are never redirected to external malicious domains.
4. **Resilient Recovery Code Normalization:**
   Users can enter recovery codes with or without hyphens (`ABCD1234` or `ABCD-1234`) and in any letter case without failing authentication.
5. **Rate Limiting:**
   Applies distinct rate limiters across login attempts, OTP submissions, recovery code entries, and administrative regeneration requests.
6. **Strict CSP & Helmet:**
   Custom Content Security Policy prevents script injection while enabling inline Data URLs for QR codes and Google Fonts.

---

## License

ISC License. Open-source for educational and production reference use.
