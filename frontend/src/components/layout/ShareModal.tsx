import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../../store/useProjectStore';
import { updateProject, type ProjectVisibility } from '../../services/projectService';

interface ShareModalProps {
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const currentProject = useProjectStore((s) => s.currentProject);
  const setVisibility = useProjectStore((s) => s.setVisibility);
  const [copied, setCopied] = useState(false);
  const [savingTo, setSavingTo] = useState<ProjectVisibility | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialVisibility: ProjectVisibility = currentProject?.visibility ?? (currentProject?.isPublic ? 'public' : 'private');
  const [active, setActive] = useState<ProjectVisibility>(initialVisibility);

  useEffect(() => setActive(initialVisibility), [initialVisibility]);
  if (!currentProject) return null;

  const shareUrl = `${window.location.origin}/project/${currentProject.id}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePick = async (next: ProjectVisibility) => {
    if (next === active || savingTo) return;
    setError(null);
    setSavingTo(next);
    try {
      await updateProject(currentProject.id, { visibility: next, is_public: next === 'public' });
      setActive(next);
      setVisibility(next === 'public');
    } catch {
      setError(t('editor.share.updateFailed', 'Unable to update visibility.'));
    } finally {
      setSavingTo(null);
    }
  };

  const options: Array<{ value: ProjectVisibility; label: string; hint: string }> = [
    { value: 'public', label: t('editor.share.visibility.publicLabel'), hint: t('editor.share.visibility.publicHint') },
    { value: 'unlisted', label: t('editor.share.visibility.unlistedLabel'), hint: t('editor.share.visibility.unlistedHint') },
    { value: 'private', label: t('editor.share.visibility.privateLabel'), hint: t('editor.share.visibility.privateHint') },
  ];

  return createPortal(
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{t('editor.share.title', 'Share project')}</h2>
        <div style={styles.visibilityList}>
          {options.map((option) => {
            const isActive = active === option.value;
            const isSaving = savingTo === option.value;
            return (
              <button key={option.value} onClick={() => handlePick(option.value)} disabled={isSaving} style={{ ...styles.visibilityOption, borderColor: isActive ? '#0e639c' : '#333', background: isActive ? 'rgba(14,99,156,0.12)' : '#1e1e1e', opacity: isSaving ? 0.6 : 1, cursor: isSaving ? 'wait' : 'pointer' }}>
                <div style={styles.optionHead}>
                  <span style={styles.optionLabel}>{option.label}</span>
                  {isActive && <span style={styles.check}>✓</span>}
                </div>
                <div style={styles.optionHint}>{option.hint}</div>
              </button>
            );
          })}
        </div>
        {error && <div style={styles.warning}>{error}</div>}
        <div style={styles.linkRow}>
          <input type="text" value={shareUrl} readOnly style={styles.linkInput} onClick={(e) => (e.target as HTMLInputElement).select()} />
          <button onClick={handleCopy} style={styles.copyBtn}>{copied ? '✓' : t('editor.share.copy', 'Copy')}</button>
        </div>
        {active === 'private' && <div style={styles.warning}>{t('editor.share.privateWarning')}</div>}
        <div style={styles.actions}><button onClick={onClose} style={styles.closeBtn}>{t('editor.share.close', 'Close')}</button></div>
      </div>
    </div>,
    document.body,
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#252526', border: '1px solid #3c3c3c', borderRadius: 8, padding: '1.75rem', width: 460, display: 'flex', flexDirection: 'column', gap: 16 },
  title: { color: '#ccc', margin: 0, fontSize: 18, fontWeight: 600 },
  visibilityList: { display: 'flex', flexDirection: 'column', gap: 6 },
  visibilityOption: { textAlign: 'left', padding: '10px 12px', borderRadius: 6, border: '1px solid #333', color: '#ccc', display: 'flex', flexDirection: 'column', gap: 2, transition: 'all .12s ease' },
  optionHead: { display: 'flex', alignItems: 'center', gap: 8 },
  optionLabel: { fontWeight: 600, fontSize: 13, color: '#eee' },
  optionHint: { fontSize: 11, color: '#888', lineHeight: 1.4 },
  check: { color: '#4ade80', fontWeight: 700 },
  linkRow: { display: 'flex', gap: 6 },
  linkInput: { flex: 1, background: '#1e1e1e', border: '1px solid #444', borderRadius: 4, padding: '8px 10px', color: '#4fc3f7', fontSize: 13, fontFamily: 'monospace', outline: 'none' },
  copyBtn: { background: '#0e639c', border: 'none', borderRadius: 4, color: '#fff', padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  warning: { background: '#3d2e00', border: '1px solid #f59e0b44', borderRadius: 4, color: '#f59e0b', padding: '8px 12px', fontSize: 12 },
  actions: { display: 'flex', justifyContent: 'flex-end' },
  closeBtn: { background: 'transparent', border: '1px solid #555', borderRadius: 4, color: '#ccc', padding: '8px 16px', fontSize: 13, cursor: 'pointer' },
};
