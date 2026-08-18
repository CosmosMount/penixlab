import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { useOscilloscopeStore } from '../../store/useOscilloscopeStore';
import { LOCALES, LOCALE_META, type Locale } from '../../i18n/config';
import { getLocaleFromPath, switchLocale } from '../../i18n/path';
import { hasEditorCommand, runEditorCommand, subscribeEditorCommands, getEditorCommandsVersion, type EditorCommandId } from '../../lib/editorCommands';
import './EditorMenuBar.css';

type Item =
  | { kind: 'command'; id: EditorCommandId; label: string; shortcut?: string }
  | { kind: 'link'; href: string; label: string }
  | { kind: 'separator' };

const GITHUB_URL = 'https://github.com/CosmosMount/penixlab';

export const EditorMenuBar: React.FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState<'file' | 'edit' | 'view' | 'help' | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useSyncExternalStore(subscribeEditorCommands, getEditorCommandsVersion);

  const location = useLocation();
  const navigate = useNavigate();
  const currentLocale = getLocaleFromPath(location.pathname);
  const serialOpen = useSimulatorStore((s) => s.serialMonitorOpen);
  const toggleSerialMonitor = useSimulatorStore((s) => s.toggleSerialMonitor);
  const scopeOpen = useOscilloscopeStore((s) => s.open);
  const toggleOscilloscope = useOscilloscopeStore((s) => s.toggleOscilloscope);
  const undo = useSimulatorStore((s) => s.undo);
  const redo = useSimulatorStore((s) => s.redo);
  const history = useSimulatorStore((s) => s.history);
  const historyIndex = useSimulatorStore((s) => s.historyIndex);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const fileItems: Item[] = [
    { kind: 'command', id: 'project.new', label: t('editor.menu.newProject', 'New workspace') },
    { kind: 'command', id: 'file.new', label: t('editor.menu.newFile', 'New file') },
    { kind: 'separator' },
    { kind: 'command', id: 'project.open', label: t('editor.menu.open', 'Open project…') },
    { kind: 'command', id: 'project.save', label: t('editor.menu.save', 'Save workspace'), shortcut: 'Ctrl+S' },
    { kind: 'separator' },
    { kind: 'command', id: 'project.import', label: t('editor.toolbar.importLabel', 'Import project') },
    { kind: 'command', id: 'project.export', label: t('editor.toolbar.exportLabel', 'Export project (.zip)') },
    { kind: 'separator' },
    { kind: 'command', id: 'firmware.upload', label: t('editor.toolbar.uploadFirmwareLabel', 'Upload firmware') },
  ];

  const helpItems: Item[] = [
    { kind: 'link', href: '/docs/', label: 'Documentation' },
    { kind: 'link', href: '/examples', label: t('header.nav.examples', 'Examples') },
    { kind: 'link', href: GITHUB_URL, label: 'GitHub Repository' },
    { kind: 'separator' },
    { kind: 'link', href: '/', label: 'PenixLab Home' },
  ];

  const viewItems: Item[] = [
    { kind: 'command', id: 'sim.compile', label: t('editor.menu.compile', 'Compile'), shortcut: 'Ctrl+B' },
    { kind: 'command', id: 'sim.run', label: t('editor.menu.run', 'Run') },
    { kind: 'command', id: 'sim.stop', label: t('editor.toolbar.stop', 'Stop') },
    { kind: 'command', id: 'sim.resetBoard', label: t('editor.toolbar.reset', 'Reset') },
    { kind: 'separator' },
    { kind: 'command', id: 'view.toggleExplorer', label: t('editor.menu.toggleExplorer', 'File Explorer') },
    { kind: 'command', id: 'view.toggleConsole', label: t('editor.menu.toggleConsole', 'Output Console') },
    { kind: 'separator' },
    { kind: 'command', id: 'view.reset', label: t('editor.menu.centerView', 'Center canvas view') },
    { kind: 'command', id: 'view.zoomIn', label: t('editor.canvas.zoomIn', 'Zoom in') },
    { kind: 'command', id: 'view.zoomOut', label: t('editor.canvas.zoomOut', 'Zoom out') },
  ];

  const editItems: Item[] = [];

  const renderLink = (item: Extract<Item, { kind: 'link' }>) => (
    <a key={item.href} role="menuitem" className="emb-item" href={item.href} target={item.href.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer" onClick={() => setOpen(null)}>
      <span>{item.label}</span>
    </a>
  );

  const renderCommand = (item: Extract<Item, { kind: 'command' }>) => (
    <button key={item.id} role="menuitem" className="emb-item" disabled={!hasEditorCommand(item.id)} onClick={() => { setOpen(null); runEditorCommand(item.id); }}>
      <span>{item.label}</span>
      {item.shortcut && <span className="emb-shortcut">{item.shortcut}</span>}
    </button>
  );

  const menu = (which: 'file' | 'edit' | 'view' | 'help', label: string, items: Item[]) => (
    <div className="emb-root" key={which}>
      <button className={`emb-trigger${open === which ? ' emb-trigger-open' : ''}`} aria-haspopup="menu" aria-expanded={open === which} onClick={() => setOpen((cur) => (cur === which ? null : which))} onMouseEnter={() => setOpen((cur) => (cur && cur !== which ? which : cur))}>{label}</button>
      {open === which && (
        <div className="emb-menu" role="menu">
          {which === 'view' && (
            <>
              <button role="menuitemcheckbox" aria-checked={serialOpen} className="emb-item" onClick={() => { setOpen(null); toggleSerialMonitor(); }}>
                <span>{t('editor.canvas.toggleSerialMonitor', 'Serial Monitor')}</span><span className="emb-shortcut">{serialOpen ? '✓' : ''}</span>
              </button>
              <button role="menuitemcheckbox" aria-checked={scopeOpen} className="emb-item" onClick={() => { setOpen(null); toggleOscilloscope(); }}>
                <span>{t('editor.menu.toggleScope', 'Oscilloscope / Logic Analyzer')}</span><span className="emb-shortcut">{scopeOpen ? '✓' : ''}</span>
              </button>
              <div className="emb-separator" />
            </>
          )}
          {which === 'edit' && (
            <>
              <button role="menuitem" className="emb-item" disabled={historyIndex < 0} onClick={() => { setOpen(null); undo(); }}><span>{t('editor.menu.undo', 'Undo')}</span><span className="emb-shortcut">Ctrl+Z</span></button>
              <button role="menuitem" className="emb-item" disabled={historyIndex >= history.length - 1} onClick={() => { setOpen(null); redo(); }}><span>{t('editor.menu.redo', 'Redo')}</span><span className="emb-shortcut">Ctrl+Y</span></button>
              <div className="emb-separator" />
            </>
          )}
          {which === 'help' && (
            <>
              <div className="emb-section-label">Language</div>
              {LOCALES.map((loc) => <button key={loc} role="menuitemradio" aria-checked={currentLocale === loc} className="emb-item" onClick={() => { setOpen(null); if (loc !== currentLocale) navigate(switchLocale(location.pathname, loc as Locale) + location.search + location.hash); }}><span>{LOCALE_META[loc].nativeName}</span><span className="emb-shortcut">{currentLocale === loc ? '✓' : ''}</span></button>)}
              <div className="emb-separator" />
            </>
          )}
          {items.map((item, i) => item.kind === 'separator' ? <div key={`sep-${i}`} className="emb-separator" /> : item.kind === 'link' ? renderLink(item) : renderCommand(item))}
        </div>
      )}
    </div>
  );

  return <div className="editor-menubar" ref={rootRef}>{menu('file', t('editor.menu.file', 'File'), fileItems)}{menu('edit', t('editor.menu.edit', 'Edit'), editItems)}{menu('view', t('editor.menu.view', 'View'), viewItems)}{menu('help', t('editor.menu.help', 'Help'), helpItems)}</div>;
};
