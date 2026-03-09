import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { BRAND_NAME } from './lib/brand'

// Suppress noisy development warnings
if (import.meta.env.DEV) {
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.warn = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    // Suppress specific warnings
    if (
      message.includes('React DevTools') ||
      message.includes('use-controllable-state') ||
      message.includes('changing from uncontrolled to controlled') ||
      message.includes('width(0) and height(0) of chart')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    // Suppress specific errors that are actually warnings
    if (
      message.includes('use-controllable-state') ||
      message.includes('changing from uncontrolled to controlled')
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

document.title = `${BRAND_NAME} | Cloud`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
