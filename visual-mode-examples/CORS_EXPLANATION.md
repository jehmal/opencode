# Understanding CORS and DGMO Visual Mode

## What is CORS?

CORS (Cross-Origin Resource Sharing) is a browser security feature that restricts web pages from
making requests to a different domain than the one serving the web page. This prevents malicious
websites from accessing your data on other sites.

## Why Does This Affect DGMO Visual Mode?

When you open an HTML file directly in your browser (using the `file://` protocol), the browser
considers it to have a "null" origin. This triggers strict CORS policies that block loading external
scripts like the Stagewise toolbar from `https://unpkg.com`.

### The Error You See

```
Access to script at 'https://unpkg.com/@stagewise/toolbar@0.4.9/dist/index.js'
from origin 'null' has been blocked by CORS policy
```

## Solutions Overview

### 1. **Use an HTTP Server** (Recommended)

- **Why it works**: Gives your page a proper origin (e.g., `http://localhost:8000`)
- **Best for**: Development and testing
- **Example**: `python -m http.server 8000`

### 2. **Download Toolbar Locally**

- **Why it works**: No cross-origin request needed
- **Best for**: Offline development or strict environments
- **Example**: Save toolbar files in your project

### 3. **Use DGMO Visual Server**

- **Why it works**: Built-in server handles CORS automatically
- **Best for**: Seamless DGMO integration
- **Example**: `dgmo visual serve`

## Detailed Solutions

### Solution 1: HTTP Server Methods

#### Python (Most Common)

```bash
cd your-project-directory
python -m http.server 8000
# Open: http://localhost:8000
```

#### Node.js

```bash
npx http-server -p 8000
# or
npx serve
```

#### PHP

```bash
php -S localhost:8000
```

#### Ruby

```bash
ruby -run -e httpd . -p 8000
```

### Solution 2: Local Toolbar Installation

1. **Manual Download**

```bash
mkdir -p vendor/stagewise
curl -o vendor/stagewise/toolbar.js https://unpkg.com/@stagewise/toolbar@0.4.9/dist/index.js
curl -o vendor/stagewise/toolbar.css https://unpkg.com/@stagewise/toolbar@0.4.9/dist/style.css
```

2. **Update HTML**

```html
<script type="module" src="vendor/stagewise/toolbar.js"></script>
<link rel="stylesheet" href="vendor/stagewise/toolbar.css" />
```

3. **Using NPM/Yarn**

```bash
npm install @stagewise/toolbar
# or
yarn add @stagewise/toolbar
```

### Solution 3: DGMO Visual Server

The easiest solution - DGMO handles everything:

```bash
# Start DGMO with visual mode
dgmo run --visual "help me with this UI"

# Or use the dedicated visual server
dgmo visual serve --port 3000
```

## Framework-Specific Setup

### React

```jsx
// Install
npm install @stagewise/toolbar

// In your App.jsx
import '@stagewise/toolbar';
import '@stagewise/toolbar/style.css';

function App() {
  return (
    <>
      <YourComponents />
      <stagewise-toolbar framework="react" />
    </>
  );
}
```

### Vue

```vue
<!-- Install -->
npm install @stagewise/toolbar

<!-- In your main component -->
<template>
  <div id="app">
    <router-view />
    <stagewise-toolbar framework="vue" />
  </div>
</template>

<script>
import '@stagewise/toolbar';
import '@stagewise/toolbar/style.css';
</script>
```

### Angular

```typescript
// Install
npm install @stagewise/toolbar

// In app.component.ts
import '@stagewise/toolbar';
import '@stagewise/toolbar/style.css';

// In app.component.html
<stagewise-toolbar framework="angular"></stagewise-toolbar>
```

### Next.js

```jsx
// In _app.js or _app.tsx
import '@stagewise/toolbar';
import '@stagewise/toolbar/style.css';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      {process.env.NODE_ENV === 'development' && <stagewise-toolbar framework="react" />}
    </>
  );
}
```

## Browser-Specific Notes

### Chrome/Edge

- Strictest CORS enforcement
- No built-in way to disable for file:// URLs
- Must use one of the solutions above

### Firefox

- Similar restrictions to Chrome
- Developer Edition has some relaxed policies
- Still recommend using proper solutions

### Safari

- Very strict with local files
- May have additional restrictions
- HTTP server strongly recommended

## Development Best Practices

1. **Use a Development Server**

   - Most build tools include one (Vite, Webpack, Parcel)
   - Handles CORS and hot reload

2. **Environment-Specific Loading**

   ```javascript
   if (process.env.NODE_ENV === 'development') {
     // Load Stagewise toolbar
   }
   ```

3. **Git Ignore Patterns**

   ```gitignore
   # If downloading locally
   vendor/stagewise/
   ```

4. **CI/CD Considerations**
   - Don't include visual mode in production builds
   - Use environment variables to control loading

## Troubleshooting Checklist

- [ ] Is DGMO running with `--visual` flag?
- [ ] Are you accessing via HTTP (not file://)?
- [ ] Is port 5746 available for WebSocket?
- [ ] Check browser console for specific errors
- [ ] Try a different browser to isolate issues
- [ ] Ensure no firewall blocking WebSocket
- [ ] Verify Stagewise toolbar version compatibility

## Security Considerations

1. **Why CORS Exists**

   - Prevents malicious scripts from accessing your data
   - Protects against cross-site scripting (XSS)
   - Essential browser security feature

2. **Safe Development Practices**

   - Only disable CORS for local development
   - Never disable in production
   - Use HTTPS in production environments

3. **Local Server Security**
   - Only bind to localhost (127.0.0.1)
   - Don't expose development servers to network
   - Use authentication if needed

## Quick Reference

| Method        | Command                 | Pros                  | Cons              |
| ------------- | ----------------------- | --------------------- | ----------------- |
| Python Server | `python -m http.server` | Built-in, simple      | Need Python       |
| DGMO Server   | `dgmo visual serve`     | Integrated, automatic | Need DGMO running |
| Local Files   | Download toolbar        | Works offline         | Manual setup      |
| NPM Package   | `npm install`           | Version control       | Build step needed |

## Getting Help

If you're still experiencing issues:

1. Check DGMO output for error messages
2. Look at browser DevTools Console
3. Verify network requests in DevTools Network tab
4. Try the examples in `visual-mode-examples/`
5. Report issues at https://github.com/sst/dgmo/issues

Remember: CORS is a feature, not a bug. It's protecting you, and these solutions work with that
protection rather than against it.
