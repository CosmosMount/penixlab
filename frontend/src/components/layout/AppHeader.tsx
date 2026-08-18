import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../../store/useProjectStore';
import { ShareModal } from './ShareModal';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLocalizedHref } from '../../i18n/useLocalizedNavigate';
import { trackVisitGitHub } from '../../utils/analytics';
import type { AutoSaveState } from '../../hooks/useAutoSaveProject';
import './LanguageSwitcher.css';

const GITHUB_URL = 'https://github.com/CosmosMount/penixlab';

interface AppHeaderProps {
  autoSave?: AutoSaveState;
  editorMenu?: React.ReactNode;
  editorToolbar?: React.ReactNode;
}

const SAVE_STATUS_COPY: Record<AutoSaveState['status'], { label: string; color: string }> = {
  idle: { label: 'Saved', color: '#7d8590' },
  dirty: { label: 'Unsaved changes', color: '#f0883e' },
  saving: { label: 'Saving…', color: '#3fb950' },
  saved: { label: 'Saved', color: '#3fb950' },
  error: { label: 'Save failed', color: '#f85149' },
};

const AutoSaveIndicator: React.FC<{ state: AutoSaveState }> = ({ state }) => {
  const meta = SAVE_STATUS_COPY[state.status];
  const tip =
    state.status === 'error' && state.errorMessage
      ? `Auto-save failed: ${state.errorMessage}`
      : state.lastSavedAt
        ? `Last saved ${new Date(state.lastSavedAt).toLocaleTimeString()}`
        : 'Auto-save ready';
  return (
    <div title={tip} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 12, color: meta.color, userSelect: 'none' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, opacity: state.status === 'saving' ? 0.7 : 1, animation: state.status === 'saving' ? 'app-pulse 1s ease-in-out infinite' : 'none' }} />
      <span>{meta.label}</span>
    </div>
  );
};

export const AppHeader: React.FC<AppHeaderProps> = ({ autoSave, editorMenu, editorToolbar }) => {
  const location = useLocation();
  const currentProject = useProjectStore((s) => s.currentProject);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const { t } = useTranslation();
  const localize = useLocalizedHref();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (import.meta.env.VITE_DESKTOP) return null;

  const isActive = (path: string) => (location.pathname === localize(path) ? ' header-nav-link-active' : '');

  return (
    <header className={"app-header" + (editorToolbar ? ' app-header--with-toolbar' : '')}>
      <div className="header-content">
        <div className="header-left">
          <div className="header-brand">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0071e3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="5" width="14" height="14" rx="2" />
              <rect x="9" y="9" width="6" height="6" />
              <path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4" />
            </svg>
            <Link to={localize('/')} style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="header-title">PenixLab</span>
            </Link>
          </div>

          {editorMenu}
          {!editorMenu && (
            <nav className={'header-nav-links' + (menuOpen ? ' header-nav-open' : '')}>
              <Link to={localize('/examples')} className={'header-nav-link' + isActive('/examples')}>{t('header.nav.examples', 'Examples')}</Link>
              <Link to={localize('/editor')} className={'header-nav-link' + isActive('/editor')}>{t('header.nav.editor', 'Editor')}</Link>
              <a href="/docs/" className="header-nav-link">Documentation</a>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="header-nav-link" onClick={trackVisitGitHub}>GitHub</a>
            </nav>
          )}
        </div>

        {editorToolbar && (
          <>
            {autoSave && currentProject && <AutoSaveIndicator state={autoSave} />}
            <div className="header-editor-toolbar">{editorToolbar}</div>
          </>
        )}

        {!editorToolbar && (
          <div className="header-right">
            <LanguageSwitcher />
            {autoSave && currentProject && <AutoSaveIndicator state={autoSave} />}
            {currentProject && location.pathname === localize('/editor') && (
              <button onClick={() => setShowShareModal(true)} style={{ background: 'transparent', border: '1px solid #555', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: '#ccc', fontSize: 13 }} title={t('header.shareProject', 'Share project')}>
                Share
              </button>
            )}
            {!editorMenu && (
              <button className="header-hamburger" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
                <span /><span /><span />
              </button>
            )}
          </div>
        )}
      </div>
      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} />}
    </header>
  );
};
