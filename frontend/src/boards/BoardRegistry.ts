import type {
  BoardProfile,
  BoardProfileIssue,
  BoardProfileId,
  BoardProtocolRole,
} from './types';

class BoardRegistryImpl {
  private readonly profiles = new Map<string, BoardProfile>();

  register(profile: BoardProfile): void {
    const issues = validateBoardProfile(profile);
    if (issues.length > 0) {
      throw new Error(issues.map((issue) => `${issue.boardId}: ${issue.message}`).join('; '));
    }
    this.profiles.set(profile.id, profile);
  }

  registerAll(profiles: BoardProfile[]): void {
    for (const profile of profiles) this.register(profile);
  }

  get(id: BoardProfileId | string): BoardProfile | undefined {
    return this.profiles.get(id);
  }

  list(): BoardProfile[] {
    return Array.from(this.profiles.values());
  }

  resolvePin(boardId: string, pinName: string): number | null {
    return this.profiles.get(boardId)?.resolvePin(pinName) ?? null;
  }

  getProtocolRole(boardId: string, pinName: string): BoardProtocolRole | undefined {
    const profile = this.profiles.get(boardId);
    if (!profile) return undefined;
    return profile.protocolRoles[pinName.trim().toUpperCase()];
  }
}

export const boardRegistry = new BoardRegistryImpl();

export function registerBoardProfile(profile: BoardProfile): void {
  boardRegistry.register(profile);
}

export function registerBoardProfiles(profiles: BoardProfile[]): void {
  boardRegistry.registerAll(profiles);
}

export function getBoardProfile(boardId: string): BoardProfile | undefined {
  return boardRegistry.get(boardId);
}

export function listBoardProfiles(): BoardProfile[] {
  return boardRegistry.list();
}

export function getBoardFqbn(boardId: string): string | null {
  return boardRegistry.get(boardId)?.fqbn ?? null;
}

export function resolveBoardPin(boardId: string, pinName: string): number | null {
  return boardRegistry.resolvePin(boardId, pinName);
}

export function resolveBoardProtocolRole(
  boardId: string,
  pinName: string,
): BoardProtocolRole | undefined {
  return boardRegistry.getProtocolRole(boardId, pinName);
}

export function validateBoardProfile(profile: BoardProfile): BoardProfileIssue[] {
  const issues: BoardProfileIssue[] = [];
  if (!profile.id.trim()) issues.push({ boardId: profile.id, message: 'id is empty' });
  if (!profile.displayName.trim()) {
    issues.push({ boardId: profile.id, message: 'displayName is empty' });
  }
  if (!profile.runtime.backend) {
    issues.push({ boardId: profile.id, message: 'runtime backend is missing' });
  }
  if (profile.capabilities.adcChannels < 0) {
    issues.push({ boardId: profile.id, message: 'adcChannels cannot be negative' });
  }
  const aliases = new Set<string>();
  for (const alias of profile.pinAliases) {
    const normalized = alias.trim().toUpperCase();
    if (!normalized) {
      issues.push({ boardId: profile.id, message: 'pinAliases contains an empty alias' });
    } else if (aliases.has(normalized)) {
      issues.push({ boardId: profile.id, message: `duplicate pin alias: ${alias}` });
    }
    aliases.add(normalized);
  }
  const adcChannels = new Set<number>();
  for (const adc of profile.adcPins) {
    if (adc.channel < 0 || adc.channel >= profile.capabilities.adcChannels) {
      issues.push({
        boardId: profile.id,
        message: `ADC channel out of range: ${adc.pinName}=${adc.channel}`,
      });
    }
    if (adcChannels.has(adc.channel)) {
      issues.push({ boardId: profile.id, message: `duplicate ADC channel: ${adc.channel}` });
    }
    adcChannels.add(adc.channel);
  }
  return issues;
}

export function validateRegisteredBoardProfiles(): BoardProfileIssue[] {
  return boardRegistry.list().flatMap(validateBoardProfile);
}
