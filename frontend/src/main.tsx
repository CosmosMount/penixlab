import { createRoot } from 'react-dom/client';
import { loader } from '@monaco-editor/react';
import './index.css';
import './i18n';
import './components/velxio-components/IC74HC595';
import './components/velxio-components/LogicGateElements';
import './components/velxio-components/TransistorElements';
import './components/velxio-components/OpAmpElements';
import './components/velxio-components/PowerElements';
import './components/velxio-components/DiodeElements';
import './components/velxio-components/RelayElements';
import './components/velxio-components/LogicICElements';
import './components/velxio-components/MotorDriverElements';
import './components/velxio-components/FlipFlopElements';
import './components/velxio-components/RaspberryPi3Element';
import './components/velxio-components/Bmp280Element';
import './components/velxio-components/Ds3231Element';
import './components/velxio-components/GpsNeo6mElement';
import './components/velxio-components/EPaperElement';
import App from './App.tsx';

// Monaco is served from the local static assets so the editor remains usable offline.
const monacoVsPath = `${import.meta.env.BASE_URL}monaco/vs`;
loader.config({ paths: { vs: monacoVsPath } });

createRoot(document.getElementById('root')!).render(<App />);

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById('penixlab-splash');
    if (!splash) return;
    splash.style.transition = 'opacity 250ms ease-out';
    splash.style.opacity = '0';
    splash.style.pointerEvents = 'none';
    window.setTimeout(() => splash.remove(), 320);
  });
});

if (import.meta.env.DEV) {
  Promise.all([
    import('./store/useSimulatorStore'),
    import('./store/useEditorStore'),
    import('./store/useElectricalStore'),
  ]).then(([sim, ed, el]) => {
    (window as unknown as Record<string, unknown>).__penixlabStores = {
      useSimulatorStore: sim.useSimulatorStore,
      useEditorStore: ed.useEditorStore,
      useElectricalStore: el.useElectricalStore,
      getBoardSimulator: sim.getBoardSimulator,
    };
  });
}
