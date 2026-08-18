import { describe, expect, it } from 'vitest';
import {
  getBoardProfile,
  listBoardProfiles,
  validateRegisteredBoardProfiles,
} from '../boards';
import { BOARD_KIND_LABELS, type BoardKind } from '../types/board';
import { getBoardPinGroup } from '../simulation/spice/boardPinGroups';

describe('Board Profile contract', () => {
  it('registers every static BoardKind exactly once', () => {
    const profiles = listBoardProfiles();
    const kinds = Object.keys(BOARD_KIND_LABELS) as BoardKind[];
    expect(profiles.map((profile) => profile.id).sort()).toEqual([...kinds].sort());
  });

  it('has no profile validation errors', () => {
    expect(validateRegisteredBoardProfiles()).toEqual([]);
  });

  it('keeps runtime, toolchain and capability metadata present', () => {
    for (const kind of Object.keys(BOARD_KIND_LABELS) as BoardKind[]) {
      const profile = getBoardProfile(kind);
      expect(profile, `${kind} profile`).toBeDefined();
      expect(profile?.displayName).toBeTruthy();
      expect(profile?.runtime.backend).toBeTruthy();
      expect(profile?.capabilities.languages.length).toBeGreaterThan(0);
      expect(profile?.power.logicVoltage).toBeGreaterThan(0);
    }
  });

  it('resolves a canvas renderer for every static visual board', () => {
    for (const kind of Object.keys(BOARD_KIND_LABELS) as BoardKind[]) {
      const profile = getBoardProfile(kind);
      expect(profile?.rendererId, `${kind} renderer id`).toBeTruthy();
    }
  });

  it('does not invent a default profile for an unknown board', () => {
    expect(getBoardProfile('unknown-board')).toBeUndefined();
    expect(getBoardPinGroup('unknown-board')).toBeUndefined();
  });
});
