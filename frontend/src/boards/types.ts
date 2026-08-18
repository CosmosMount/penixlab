import type { BoardKind } from '../types/board';

export type BoardRuntimeBackend =
  | 'avr8js'
  | 'rp2040js'
  | 'esp32-qemu'
  | 'stm32-qemu'
  | 'pi-qemu'
  | 'custom';

export type BoardSupportLevel =
  | 'topology'
  | 'compile'
  | 'digital'
  | 'mixed-signal'
  | 'full';

export type BoardProtocolRoleKind =
  | 'uart-tx'
  | 'uart-rx'
  | 'i2c-sda'
  | 'i2c-scl'
  | 'spi-mosi'
  | 'spi-miso'
  | 'spi-sck'
  | 'spi-cs';

export interface BoardProtocolRole {
  kind: BoardProtocolRoleKind;
  bus: number;
}

export interface BoardAdcPin {
  pinName: string;
  channel: number;
}

export interface BoardPowerProfile {
  logicVoltage: number;
  groundPins: string[];
  supplyPins: string[];
  auxiliaryRails?: Array<{ voltage: number; pins: string[] }>;
}

export interface BoardRuntimeProfile {
  backend: BoardRuntimeBackend;
  machine?: string;
  artifact: 'hex' | 'bin' | 'elf' | 'linux-image' | 'none';
  family?: string;
}

export interface BoardCapabilities {
  support: BoardSupportLevel;
  languages: Array<'arduino' | 'micropython' | 'espidf' | 'python'>;
  adcChannels: number;
  pwm: boolean;
  protocols: Array<'uart' | 'i2c' | 'spi'>;
  electricalSimulation: boolean;
}

export interface BoardProfile {
  id: string;
  displayName: string;
  description?: string;
  /** Optional canvas renderer registered by the UI layer. */
  rendererId?: string;
  fqbn: string | null;
  runtime: BoardRuntimeProfile;
  power: BoardPowerProfile;
  capabilities: BoardCapabilities;
  adcPins: BoardAdcPin[];
  protocolRoles: Record<string, BoardProtocolRole>;
  /** Resolve a board element/silkscreen alias to the runtime pin number. */
  resolvePin(pinName: string): number | null;
  /** Sample aliases used by contract tests and import adapters. */
  pinAliases: string[];
}

export interface BoardProfileIssue {
  boardId: string;
  message: string;
}

export type BoardProfileId = BoardKind | (string & {});
