/**
 * ============================================================================
 * FILE: src/main.tsx
 * DESCRIPTION:
 * Application DOM entry point. Mounts the root React application (`<App />`)
 * into `#root` and loads global Tailwind v4 styles.
 * ============================================================================
 */

import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Mount the root React component into the DOM container
createRoot(document.getElementById('root')!).render(<App />);
