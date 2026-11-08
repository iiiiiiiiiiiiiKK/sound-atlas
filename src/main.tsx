import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from '@/App';
import '@/index.css';
import { useUi } from '@/stores/uiStore';

// Apply the stored language/theme before the first paint to avoid a flash.
const { lang, theme } = useUi.getState();
document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.classList.toggle('light', theme === 'light');
void useUi.getState().hydrate();

const container = document.getElementById('root');
if (!container) throw new Error('Root container is missing');

createRoot(container).render(
  <StrictMode>
    {/* HashRouter keeps deep links working on GitHub Pages without server rewrites. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
