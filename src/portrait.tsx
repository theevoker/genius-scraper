import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Dedicated entry point for portrait.html, forcing portrait mode layout
createRoot(document.getElementById('root')!).render(<App forceView="portrait" />);
