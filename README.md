# OnyxStream — Modern IPTV Player (Xtream Codes API & M3U)

A complete, high-performance, dark-themed IPTV Player client built with **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, **HLS.js**, and **Capacitor**. Designed for Desktop, TV browsers, and sideloaded Android TV / Fire TV devices.

---

## Table of Contents

1. [Features](#features)
2. [Project Structure](#project-structure)
3. [Installation & Dependencies](#installation--dependencies)
4. [Running the Application](#running-the-application)
5. [Xtream Codes API Integration](#xtream-codes-api-integration)
6. [Video Player & Stream URL Architecture](#video-player--stream-url-architecture)
7. [Building the Android TV APK for Downloader](#building-the-android-tv-apk-for-downloader)
8. [Installing on TV via Downloader App](#installing-on-tv-via-downloader-app)
9. [Multiple Accounts & Security](#multiple-accounts--security)
10. [Error Handling & Edge Cases](#error-handling--edge-cases)

---

## Features

- **Xtream Codes API & M3U Playlists**: Seamlessly connect using standard Xtream credentials (`Server URL`, `Username`, `Password`) or import direct `.m3u` / `.m3u8` playlist URLs.
- **Multiple Saved Profiles**: Store unlimited IPTV servers with encrypted local storage (AES-256 via CryptoJS). Switch, edit, or delete profiles in seconds.
- **Live TV Grid with EPG**: View channel logos, categories, live status indicators, and current/next program guides.
- **VOD (Movies) & TV Series**: Browse posters, movie details, ratings, genres, release dates, directors, cast lists, and season/episode selectors.
- **Built-in HLS Player**:
  - HLS.js adaptive bitrate streaming with native Safari HLS fallback
  - Automatic stream reconnect with exponential backoff
  - Audio and subtitle track selection
  - Picture-in-Picture (PiP) support
  - Fullscreen and keyboard shortcuts (`Space` = Play/Pause, `F` = Fullscreen, `M` = Mute, `Arrows` = Seek & Volume)
- **Continue Watching & Recently Watched**: Remembers your playback position across sessions.
- **Global Instant Search**: Debounced, unified search across Live TV, Movies, and TV Series.
- **TV Remote Navigation**: D-pad navigation glow and focus-visible enhancements tailored for smart TV remotes.
- **Account Dashboard in Settings**: Displays subscription status, expiration date, active/max connections, server timezone, and protocols.

---

## Project Structure

```text
onyxstream/
├── .github/
│   └── workflows/
│       └── build-apk.yml          # Automated CI/CD pipeline to generate TV APK
├── android/                       # Capacitor Native Android project
│   ├── app/
│   │   └── src/main/
│   │       └── AndroidManifest.xml # Configured with LEANBACK_LAUNCHER & cleartext HTTP
│   └── gradlew / gradlew.bat
├── public/
│   └── favicon.svg                # Vector app logo
├── src/
│   ├── api/
│   │   ├── xtream.ts              # Xtream Codes API client (categories, streams, EPG)
│   │   └── m3u-parser.ts          # Robust #EXTINF parser for M3U/M3U8 playlists
│   ├── components/
│   │   ├── accounts/              # LoginForm, M3UImport, AccountManager, ProfileCard
│   │   ├── cards/                 # ChannelCard, MovieCard, SeriesCard, EpisodeCard
│   │   ├── layout/                # AppLayout, Sidebar, Header
│   │   ├── player/                # VideoPlayer (HLS.js), PlayerControls
│   │   └── ui/                    # SearchBar, CategoryFilter, FavoriteButton, Modal, Spinner
│   ├── hooks/
│   │   ├── useDebounce.ts         # Search debounce
│   │   ├── useVideoPlayer.ts      # Video player initialization & auto-reconnect
│   │   └── useXtreamAPI.ts        # Memoized API instance
│   ├── pages/
│   │   ├── DashboardPage.tsx      # Continue Watching, Recently Watched, Highlights
│   │   ├── LiveTVPage.tsx         # Live channel grid with category filters
│   │   ├── MoviesPage.tsx         # VOD catalog with detail modal
│   │   ├── SeriesPage.tsx         # TV Series catalog
│   │   ├── SeriesDetailPage.tsx   # Seasons and episodes browser
│   │   ├── FavoritesPage.tsx      # Saved favorites by category
│   │   ├── SearchPage.tsx         # Global search
│   │   ├── PlayerPage.tsx         # Fullscreen video playback view
│   │   ├── SettingsPage.tsx       # Account & server details + profile manager
│   │   └── LoginPage.tsx          # Xtream & M3U login tabs
│   ├── store/
│   │   ├── useAuthStore.ts        # Session, credentials, profiles (Zustand + Persist)
│   │   ├── useFavoritesStore.ts   # Favorites per account (Zustand + Persist)
│   │   ├── useHistoryStore.ts     # Watch history & progress tracking
│   │   └── usePlayerStore.ts      # Real-time player state
│   ├── types/
│   │   └── index.ts               # Complete TypeScript interfaces
│   ├── utils/
│   │   ├── crypto.ts              # AES encryption for saved credentials
│   │   ├── format.ts              # Timestamps, dates, and durations
│   │   └── url.ts                 # Stream URL and API URL builders
│   ├── App.tsx                    # React Router configuration
│   ├── index.css                  # Tailwind styles + TV focus highlights
│   └── main.tsx                   # React root entry
├── capacitor.config.ts            # Capacitor configuration (cleartext enabled)
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── build-apk.ps1                  # Local one-click APK build script
```

---

## Installation & Dependencies

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Install Dependencies
```bash
cd onyxstream
npm install
```

Core libraries used:
- `react`, `react-dom` (v18.3.1)
- `react-router-dom` (v6.26.0)
- `zustand` (v4.5.4) — Fast, lightweight state management
- `axios` (v1.7.3) — HTTP client with timeout handling
- `hls.js` (v1.5.13) — Live & VOD HLS streaming
- `crypto-js` (v4.2.0) — AES encryption for saved server profiles
- `lucide-react` (v0.424.0) — Modern SVG icons
- `@capacitor/core` & `@capacitor/android` (v6.x) — Native Android container

---

## Running the Application

### 1. Development Mode (Local Web)
```bash
npm run dev
```
The app will start at `http://localhost:3000`.

### 2. Testing on TV via Local Network (No APK Needed)
Vite is pre-configured with `host: true`.
When running `npm run dev`, Vite displays your Network URL:
```text
  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.1.150:3000/
```
Open your Smart TV browser (Amazon Silk, JioPages, or Chrome) and navigate to that `http://192.168.x.x:3000` address to use OnyxStream immediately!

### 3. Production Build
```bash
npm run build
```
Generates the optimized static distribution in the `dist/` folder.

---

## Xtream Codes API Integration

### Where Credentials Are Typed
On the **Login Screen** (`/login`), the user enters:
- **Server URL**: e.g., `http://my-iptv-server.com:8080` (or `https://...`)
- **Username**: `your_username`
- **Password**: `your_password`

### How the API Authenticates & Retrieves Data
1. **Authentication Endpoint**:
   ```http
   GET http://SERVER_URL/player_api.php?username=USERNAME&password=PASSWORD
   ```
   Validates the user. Returns `user_info` (`auth: 1`, `status: "Active"`, `exp_date`, `max_connections`) and `server_info` (`timezone`, `protocol`, `port`).

2. **Content Endpoints Queried**:
   - `action=get_live_categories` — Retrieves list of Live TV categories
   - `action=get_live_streams&category_id=ID` — Retrieves live channels in category
   - `action=get_vod_categories` — Retrieves VOD movie categories
   - `action=get_vod_streams&category_id=ID` — Retrieves movie listings
   - `action=get_vod_info&vod_id=ID` — Retrieves plot, cast, director, TMDB metadata
   - `action=get_series_categories` — Retrieves TV series categories
   - `action=get_series&category_id=ID` — Retrieves series titles
   - `action=get_series_info&series_id=ID` — Retrieves seasons and episode listings
   - `action=get_short_epg&stream_id=ID` — Retrieves Electronic Program Guide listings

---

## Video Player & Stream URL Architecture

The player automatically generates the correct stream URL based on content type:

| Type | URL Construction Pattern | Example |
| :--- | :--- | :--- |
| **Live TV** | `http://SERVER/live/USERNAME/PASSWORD/STREAM_ID.m3u8` | `http://iptv.com:8080/live/user/pass/1234.m3u8` |
| **VOD (Movie)** | `http://SERVER/movie/USERNAME/PASSWORD/STREAM_ID.EXT` | `http://iptv.com:8080/movie/user/pass/5678.mp4` |
| **TV Series** | `http://SERVER/series/USERNAME/PASSWORD/EPISODE_ID.EXT` | `http://iptv.com:8080/series/user/pass/9012.mkv` |
| **M3U Import** | Direct URL parsed from `#EXTINF` line in playlist | `http://source.net/stream.m3u8` |

### Playback Engine (`src/hooks/useVideoPlayer.ts`):
- Checks if the stream is `.m3u8` or an HLS endpoint.
- If HLS and supported: spawns an `Hls` engine instance with recovery handlers:
  - `NETWORK_ERROR`: automatically calls `hls.startLoad()`
  - `MEDIA_ERROR`: automatically calls `hls.recoverMediaError()`
  - Fatal crash: triggers exponential backoff reconnects (up to 5 attempts)
- If direct MP4/MKV: attaches directly to the HTML5 video element with full seek bar controls.

---

## Building the Android TV APK for Downloader

The project includes native Android configuration specifically tuned for Android TV and Fire TV:
1. `android:usesCleartextTraffic="true"` enabled so plain HTTP IPTV servers load without security blocks.
2. `<category android:name="android.intent.category.LEANBACK_LAUNCHER" />` included so the app shows up on Android TV home screens.
3. `touchscreen` set to `required="false"` for full remote control compatibility.

### Method A: Automated via GitHub Actions (Recommended — No Android Studio Needed)
1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of OnyxStream"
   git remote add origin https://github.com/your-username/onyxstream.git
   git push -u origin main
   ```
2. In your GitHub repository, click the **Actions** tab.
3. The workflow **"Build OnyxStream Android APK"** will run automatically.
4. Once completed (approx. 2 minutes), go to **Releases** or the workflow summary to download `app-debug.apk`.

### Method B: Local Build with Android Studio / Gradle
1. Open Android Studio and select **Open existing project** -> browse to `onyxstream/android`.
2. Wait for Gradle sync to complete.
3. Go to **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
4. Android Studio will generate the APK at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

---

## Installing on TV via Downloader App

1. **Get the Direct APK Link**:
   - If using GitHub Releases: Right-click the uploaded `.apk` file and click **Copy Link Address**.
   - Optional: Shorten the link using a URL shortener (e.g. [tinyurl.com](https://tinyurl.com)) to make typing with your TV remote faster.
2. **On your Fire TV / Android TV**:
   - Open the **Downloader** app (available free in the Amazon Appstore / Google Play Store).
   - Enter your direct APK URL (or shortened code) in the Downloader URL box.
   - Click **Go**. Downloader will fetch the APK and prompt you to **Install**.
   - Click **Install** and then **Open**.
3. **Enjoy OnyxStream**: Enter your Xtream server or M3U link and enjoy your streaming service on your TV!

---

## Deploying to Render (Cloud Web Hosting)

You can host OnyxStream on **Render** completely free as a **Web Service** or **Static Site**.

### Why Web Service is Recommended for IPTV:
Most IPTV servers run on plain HTTP (e.g. `http://domain.com:8080`). When a site is hosted on HTTPS (like `https://onyxstream.onrender.com`), browsers block HTTP requests as **Mixed Content**.
OnyxStream includes a custom Node.js Express server (`server.js`) with an automated `/proxy` route that relays requests, completely eliminating Mixed Content & CORS restrictions!

### Step-by-Step Render Deployment:

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Deploy OnyxStream"
   git remote add origin https://github.com/your-username/onyxstream.git
   git push -u origin main
   ```

2. **Deploy on Render**:
   - Go to [dashboard.render.com](https://dashboard.render.com) and log in.
   - Click **New +** > **Web Service**.
   - Connect your GitHub repository.
   - Fill in the settings:
     - **Name**: `onyxstream` (or your choice)
     - **Region**: Closest to you (e.g., Oregon, Ohio, Frankfurt)
     - **Branch**: `main`
     - **Runtime**: `Node`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Plan**: `Free`
   - Click **Deploy Web Service**.

3. **Open Your App**:
   - Within 2 minutes, Render will provide a live URL like `https://onyxstream.onrender.com`.
   - You can access this URL from your computer, phone, tablet, or smart TV browser!
   - You can also type this URL directly into the browser inside the **Downloader** app on your TV!

---

## Multiple Accounts & Security

- Passwords are **never stored in plain text**. OnyxStream encrypts credentials using AES-256 before saving to the browser or device storage (`localStorage`).
- You can add, edit, delete, and switch between multiple provider profiles on the **Settings** or **Login** page.
- No telemetry, third-party analytics, or credentials leave the app. Requests go strictly between your device and your configured IPTV server.

---

## Error Handling & Edge Cases

| Scenario | Handled By |
| :--- | :--- |
| **Invalid Server URL / Port** | Displays descriptive error without crashing UI |
| **Invalid Username / Password** | Alerts user that authentication failed |
| **Expired Subscription** | Warns user of subscription status |
| **Temporary Stream Dropout** | Player automatically retries connection with backoff |
| **Missing Poster / Channel Icon** | Clean CSS fallback badge / gradient placeholder |
| **Empty Category / No Results** | Helpful empty-state screens with return actions |

---

*OnyxStream is an independent, open-source player client. It does not provide, host, or bundle any content, streams, or playlists. Users must supply their own legally obtained service credentials.*
