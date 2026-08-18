import {
  BOARD_KIND_FQBN,
  BOARD_KIND_LABELS,
  BOARD_SUPPORTS_ESPIDF,
  BOARD_SUPPORTS_MICROPYTHON,
  type BoardKind,
} from '../types/board';
import type {
  BoardAdcPin,
  BoardCapabilities,
  BoardPowerProfile,
  BoardProfile,
  BoardProtocolRole,
  BoardRuntimeProfile,
} from './types';
import { registerBoardProfiles } from './BoardRegistry';

const PI_PHYSICAL_TO_BCM: Record<number, number> = {
  3: 2, 5: 3, 7: 4, 8: 14, 10: 15, 11: 17, 12: 18, 13: 27, 15: 22,
  16: 23, 18: 24, 19: 10, 21: 9, 22: 25, 23: 11, 24: 8, 26: 7,
  29: 5, 31: 6, 32: 12, 33: 13, 35: 19, 36: 16, 37: 26, 38: 20,
  40: 21,
};

const PI_PHYSICAL_POWER_PINS = new Set([1, 2, 4, 6, 9, 14, 17, 20, 25, 27, 28, 30, 34, 39]);

const ESP32_PIN_ALIASES: Record<string, number> = {
  TX: 1, RX: 3, VP: 36, VN: 39,
};

const XIAO_S3_PINS: Record<string, number> = {
  D0: 1, D1: 2, D2: 3, D3: 4, D4: 5, D5: 6, D6: 43, D7: 44,
  D8: 7, D9: 8, D10: 9,
};

const NANO_ESP32_PINS: Record<string, number> = {
  D0: 44, D1: 43, D2: 5, D3: 6, D4: 7, D5: 8, D6: 9, D7: 10,
  D8: 17, D9: 18, D10: 21, D11: 38, D12: 47, D13: 48,
  A0: 1, A1: 2, A2: 3, A3: 4, A4: 11, A5: 12, A6: 13, A7: 14,
};

const XIAO_C3_PINS: Record<string, number> = {
  D0: 2, D1: 3, D2: 4, D3: 5, D4: 6, D5: 7, D6: 21, D7: 20,
  D8: 8, D9: 9, D10: 10,
};

function upper(pinName: string): string {
  return pinName.trim().toUpperCase();
}

function isPowerPin(pinName: string): boolean {
  const pin = upper(pinName);
  return /^(GND|VCC|VIN|IOREF|AREF|RESET|NRST|RST|3\.3V|3V3|5V|VBUS|VSYS|VBAT|VB|BAT)/.test(pin);
}

function resolveAvr(pinName: string, maxDigital: number, analogBase: number, analogCount: number): number | null {
  const pin = upper(pinName);
  if (isPowerPin(pin)) return -1;
  const bare = /^D?(\d+)$/.exec(pin);
  if (bare) {
    const n = Number(bare[1]);
    return n >= 0 && n <= maxDigital ? n : null;
  }
  const analog = /^A(\d+)$/.exec(pin);
  if (analog) {
    const n = Number(analog[1]);
    return n >= 0 && n < analogCount ? analogBase + n : null;
  }
  return null;
}

function resolveRp2040(pinName: string): number | null {
  const pin = upper(pinName);
  if (isPowerPin(pin)) return -1;
  const match = /^(?:GP|GPIO)?(\d+)$/.exec(pin);
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 0 && n <= 29 ? n : null;
}

function resolvePi(pinName: string): number | null {
  const pin = upper(pinName);
  if (isPowerPin(pin)) return -1;
  const bcm = /^(?:GPIO|BCM)(\d+)$/.exec(pin);
  if (bcm) return Number(bcm[1]);
  const physical = /^\d+$/.test(pin) ? Number(pin) : -1;
  if (PI_PHYSICAL_POWER_PINS.has(physical)) return -1;
  return physical >= 1 && physical <= 40 ? PI_PHYSICAL_TO_BCM[physical] ?? null : null;
}

function resolveEsp32(pinName: string): number | null {
  const pin = upper(pinName);
  if (isPowerPin(pin)) return -1;
  const bare = /^(?:GPIO|D)?(\d+)$/.exec(pin);
  if (bare) {
    const n = Number(bare[1]);
    return n >= 0 && n <= 39 ? n : null;
  }
  return ESP32_PIN_ALIASES[pin] ?? null;
}

function resolveStm32(pinName: string): number | null {
  const pin = upper(pinName);
  if (isPowerPin(pin)) return -1;
  const match = /^P([A-G])(\d{1,2})$/.exec(pin);
  if (!match) return null;
  const port = match[1].charCodeAt(0) - 'A'.charCodeAt(0);
  const number = Number(match[2]);
  return number >= 0 && number <= 15 ? port * 16 + number : null;
}

function resolveBoardPin(kind: string, pinName: string): number | null {
  const pin = upper(pinName);
  if (kind === 'arduino-uno' || kind === 'arduino-nano') return resolveAvr(pin, 13, 14, 8);
  if (kind === 'arduino-mega') return resolveAvr(pin, 53, 54, 16);
  if (kind === 'attiny85') {
    if (pin === 'GND' || pin === 'VCC') return -1;
    const match = /^(?:PB)?(\d+)$/.exec(pin);
    if (!match) return null;
    const n = Number(match[1]);
    return n >= 0 && n <= 5 ? n : null;
  }
  if (kind === 'raspberry-pi-pico' || kind === 'pi-pico-w') return resolveRp2040(pin);
  if (kind.startsWith('raspberry-pi-')) return resolvePi(pin);
  if (kind === 'xiao-esp32-s3') return isPowerPin(pin) ? -1 : XIAO_S3_PINS[pin] ?? resolveEsp32(pin);
  if (kind === 'arduino-nano-esp32') return isPowerPin(pin) ? -1 : NANO_ESP32_PINS[pin] ?? resolveEsp32(pin);
  if (kind === 'xiao-esp32-c3') return isPowerPin(pin) ? -1 : XIAO_C3_PINS[pin] ?? resolveEsp32(pin);
  if (kind.startsWith('esp32') || kind === 'wemos-lolin32-lite' || kind === 'aitewinrobot-esp32c3-supermini') {
    return resolveEsp32(pin);
  }
  if (kind.startsWith('stm32-')) return resolveStm32(pin);
  return null;
}

const PROTOCOLS: Record<string, BoardProtocolRole> = {
  TX: { kind: 'uart-tx', bus: 0 }, RX: { kind: 'uart-rx', bus: 0 },
  TX0: { kind: 'uart-tx', bus: 0 }, RX0: { kind: 'uart-rx', bus: 0 },
  SDA: { kind: 'i2c-sda', bus: 0 }, SCL: { kind: 'i2c-scl', bus: 0 },
};

function protocolRoles(kind: string): Record<string, BoardProtocolRole> {
  const result: Record<string, BoardProtocolRole> = { ...PROTOCOLS };
  if (kind === 'arduino-uno' || kind === 'arduino-nano') {
    return { TX: { kind: 'uart-tx', bus: 0 }, RX: { kind: 'uart-rx', bus: 0 }, SDA: { kind: 'i2c-sda', bus: 0 }, SCL: { kind: 'i2c-scl', bus: 0 }, '18': { kind: 'i2c-sda', bus: 0 }, '19': { kind: 'i2c-scl', bus: 0 } };
  }
  if (kind === 'arduino-mega') {
    return {
      TX1: { kind: 'uart-tx', bus: 1 }, RX1: { kind: 'uart-rx', bus: 1 },
      TX2: { kind: 'uart-tx', bus: 2 }, RX2: { kind: 'uart-rx', bus: 2 },
      TX3: { kind: 'uart-tx', bus: 3 }, RX3: { kind: 'uart-rx', bus: 3 },
      SDA: { kind: 'i2c-sda', bus: 0 }, SCL: { kind: 'i2c-scl', bus: 0 },
    };
  }
  if (kind === 'raspberry-pi-pico' || kind === 'pi-pico-w') {
    return { ...result, '4': { kind: 'i2c-sda', bus: 0 }, '5': { kind: 'i2c-scl', bus: 0 } };
  }
  if (kind.startsWith('raspberry-pi-')) {
    return { '8': { kind: 'uart-tx', bus: 0 }, '10': { kind: 'uart-rx', bus: 0 }, '3': { kind: 'i2c-sda', bus: 1 }, '5': { kind: 'i2c-scl', bus: 1 } };
  }
  if (kind.startsWith('stm32-')) {
    return { PA9: { kind: 'uart-tx', bus: 0 }, PA10: { kind: 'uart-rx', bus: 0 }, PA2: { kind: 'uart-tx', bus: 1 }, PA3: { kind: 'uart-rx', bus: 1 } };
  }
  if (kind.startsWith('esp32-c3') || kind === 'xiao-esp32-c3' || kind === 'aitewinrobot-esp32c3-supermini') {
    return { TX: { kind: 'uart-tx', bus: 0 }, RX: { kind: 'uart-rx', bus: 0 }, SDA: { kind: 'i2c-sda', bus: 0 }, SCL: { kind: 'i2c-scl', bus: 0 } };
  }
  if (kind.startsWith('esp32') || kind === 'wemos-lolin32-lite' || kind === 'xiao-esp32-s3' || kind === 'arduino-nano-esp32') {
    return { TX0: { kind: 'uart-tx', bus: 0 }, RX0: { kind: 'uart-rx', bus: 0 }, TX2: { kind: 'uart-tx', bus: 2 }, RX2: { kind: 'uart-rx', bus: 2 }, SDA: { kind: 'i2c-sda', bus: 0 }, SCL: { kind: 'i2c-scl', bus: 0 } };
  }
  return result;
}

function power(kind: string): BoardPowerProfile {
  if (kind === 'arduino-uno' || kind === 'arduino-mega') return { logicVoltage: 5, groundPins: ['GND', 'GND.1', 'GND.2', 'GND.3'], supplyPins: ['5V', 'VCC', 'AREF'], auxiliaryRails: [{ voltage: 3.3, pins: ['3.3V'] }] };
  if (kind === 'arduino-nano') return { logicVoltage: 5, groundPins: ['GND', 'GND.1', 'GND.2'], supplyPins: ['5V', 'VCC', 'AREF'], auxiliaryRails: [{ voltage: 3.3, pins: ['3V3'] }] };
  if (kind === 'raspberry-pi-pico' || kind === 'pi-pico-w') return { logicVoltage: 3.3, groundPins: ['GND', 'GND.1', 'GND.2', 'GND.3'], supplyPins: ['3V3'], auxiliaryRails: [{ voltage: 5, pins: ['VBUS', 'VSYS'] }] };
  if (kind.startsWith('raspberry-pi-')) return { logicVoltage: 3.3, groundPins: ['GND'], supplyPins: ['3V3'], auxiliaryRails: [{ voltage: 5, pins: ['5V'] }] };
  if (kind === 'attiny85') return { logicVoltage: 5, groundPins: ['GND'], supplyPins: ['VCC'] };
  if (kind.startsWith('stm32-')) return { logicVoltage: 3.3, groundPins: ['GND', 'GND.1', 'GND.2'], supplyPins: ['3V3', '3V3.1', 'VBAT'], auxiliaryRails: [{ voltage: 5, pins: ['5V', 'VB'] }] };
  return { logicVoltage: 3.3, groundPins: ['GND'], supplyPins: ['3V3'], auxiliaryRails: [{ voltage: 5, pins: ['VIN', '5V'] }] };
}

function adcPins(kind: string): BoardAdcPin[] {
  if (kind === 'arduino-uno') return Array.from({ length: 6 }, (_, channel) => ({ pinName: `A${channel}`, channel }));
  if (kind === 'arduino-nano') return Array.from({ length: 8 }, (_, channel) => ({ pinName: `A${channel}`, channel }));
  if (kind === 'arduino-mega') return Array.from({ length: 16 }, (_, channel) => ({ pinName: `A${channel}`, channel }));
  if (kind === 'attiny85') return ['PB5', 'PB2', 'PB4', 'PB3'].map((pinName, channel) => ({ pinName, channel }));
  if (kind === 'raspberry-pi-pico' || kind === 'pi-pico-w') return [26, 27, 28, 29].map((gpio, channel) => ({ pinName: `GP${gpio}`, channel }));
  if (kind === 'arduino-nano-esp32') return Array.from({ length: 8 }, (_, channel) => ({ pinName: `A${channel}`, channel }));
  if (kind === 'xiao-esp32-c3') return Array.from({ length: 4 }, (_, channel) => ({ pinName: `D${channel}`, channel }));
  if (kind.startsWith('esp32-c3') || kind === 'aitewinrobot-esp32c3-supermini') return Array.from({ length: 6 }, (_, channel) => ({ pinName: String(channel), channel }));
  if (kind.startsWith('esp32-s3') || kind === 'xiao-esp32-s3') return Array.from({ length: 10 }, (_, channel) => ({ pinName: String(channel + 1), channel }));
  if (kind.startsWith('esp32') || kind === 'wemos-lolin32-lite') return Array.from({ length: 8 }, (_, channel) => ({ pinName: String(channel + 32), channel }));
  return [];
}

function runtime(kind: string): BoardRuntimeProfile {
  if (kind === 'arduino-uno' || kind === 'arduino-nano' || kind === 'arduino-mega' || kind === 'attiny85') return { backend: 'avr8js', artifact: 'hex', family: 'avr8' };
  if (kind === 'raspberry-pi-pico' || kind === 'pi-pico-w') return { backend: 'rp2040js', artifact: 'bin', family: 'rp2040' };
  if (kind.startsWith('raspberry-pi-')) return { backend: 'pi-qemu', artifact: 'linux-image', family: 'linux-arm' };
  if (kind.startsWith('stm32-')) return { backend: 'stm32-qemu', artifact: 'elf', family: 'stm32' };
  if (kind.startsWith('esp32') || kind === 'wemos-lolin32-lite' || kind === 'xiao-esp32-s3' || kind === 'arduino-nano-esp32' || kind === 'xiao-esp32-c3' || kind === 'aitewinrobot-esp32c3-supermini') return { backend: 'esp32-qemu', artifact: 'bin', family: kind.includes('c3') ? 'esp32-c3' : kind.includes('s3') || kind.includes('nano-esp32') ? 'esp32-s3' : 'esp32' };
  return { backend: 'custom', artifact: 'none' };
}

function capabilities(kind: BoardKind): BoardCapabilities {
  const adc = adcPins(kind).reduce((max, pin) => Math.max(max, pin.channel + 1), 0);
  const languages: BoardCapabilities['languages'] = ['arduino'];
  if (BOARD_SUPPORTS_MICROPYTHON.has(kind)) languages.push('micropython');
  if (BOARD_SUPPORTS_ESPIDF.has(kind)) languages.push('espidf');
  const piLinux = kind.startsWith('raspberry-pi-') && kind !== 'raspberry-pi-pico';
  if (piLinux) languages.push('python');
  return { support: piLinux || kind.startsWith('stm32-') ? 'digital' : 'full', languages, adcChannels: adc, pwm: true, protocols: ['uart', 'i2c', 'spi'], electricalSimulation: true };
}

function aliases(kind: string): string[] {
  const common = ['GND', 'VCC', '3V3', '5V', 'TX', 'RX', 'SDA', 'SCL'];
  if (kind === 'raspberry-pi-pico' || kind === 'pi-pico-w') return Array.from(new Set([...common, ...Array.from({ length: 30 }, (_, i) => `GP${i}`)]));
  if (kind.startsWith('raspberry-pi-')) return Array.from(new Set([...common, ...Array.from({ length: 40 }, (_, i) => String(i + 1))]));
  if (kind.startsWith('stm32-')) return Array.from(new Set([...common, 'PA0', 'PA2', 'PA3', 'PA9', 'PA10', 'PC13']));
  return Array.from(new Set([...common, ...Array.from({ length: 16 }, (_, i) => String(i)), ...adcPins(kind).map((pin) => pin.pinName)]));
}

function rendererId(kind: BoardKind): string | undefined {
  const ids: Partial<Record<BoardKind, string>> = {
    'arduino-uno': 'arduinoUno',
    'arduino-nano': 'arduinoNano',
    'arduino-mega': 'arduinoMega',
    'raspberry-pi-pico': 'piPico',
    'pi-pico-w': 'piPico',
    'raspberry-pi-zero': 'raspberryPi3',
    'raspberry-pi-1': 'raspberryPi3',
    'raspberry-pi-2': 'raspberryPi3',
    'raspberry-pi-3': 'raspberryPi3',
    'raspberry-pi-4': 'raspberryPi4',
    'raspberry-pi-5': 'raspberryPi5',
    esp32: 'esp32',
    'esp32-devkit-c-v4': 'esp32',
    'esp32-cam': 'esp32',
    'wemos-lolin32-lite': 'esp32',
    'esp32-s3': 'esp32',
    'xiao-esp32-s3': 'esp32',
    'arduino-nano-esp32': 'esp32',
    'esp32-c3': 'esp32',
    'xiao-esp32-c3': 'esp32',
    'aitewinrobot-esp32c3-supermini': 'esp32',
    'stm32-bluepill': 'stm32BluePill',
    'stm32-blackpill': 'stm32BlackPill',
    'stm32-bluepill-f103cb': 'stm32BluePillF103cb',
    'stm32-blackpill-f401': 'stm32BlackPillF401',
    'stm32-f4-discovery': 'stm32F4Discovery',
    'stm32-olimex-h405': 'stm32OlimexH405',
    'stm32-netduino-plus2': 'stm32NetduinoPlus2',
    'stm32-netduino2': 'stm32Netduino2',
    attiny85: 'attiny85',
  };
  return ids[kind];
}

const BOARD_DESCRIPTIONS: Record<BoardKind, string> = {
  'arduino-uno': '8-bit AVR, 32KB flash, 14 digital I/O',
  'arduino-nano': 'Compact 8-bit AVR, same as Uno',
  'arduino-mega': '8-bit AVR, 256KB flash, 54 digital I/O',
  'raspberry-pi-pico': 'RP2040 dual-core Cortex-M0+',
  'pi-pico-w': 'RP2040 + WiFi/BT, same emulator as Pico',
  'raspberry-pi-zero': 'ARM Cortex-A7, 1 core / 512 MB, Linux/Python (QEMU)',
  'raspberry-pi-1': 'Pi 1 B+, ARM Cortex-A7 profile, Linux/Python (QEMU)',
  'raspberry-pi-2': 'Pi 2B, ARM Cortex-A7 quad-core, Linux/Python (QEMU)',
  'raspberry-pi-3': 'ARM64 Cortex-A53 quad-core, Linux/Python (QEMU)',
  'raspberry-pi-4': 'ARM64 Cortex-A72 quad-core, Linux/Python (QEMU)',
  'raspberry-pi-5': 'ARM64 Cortex-A76 quad-core + RP1 I/O, Linux/Python (QEMU)',
  esp32: 'Xtensa LX6 dual-core, WiFi+BT, 38 GPIO (QEMU)',
  'esp32-devkit-c-v4': 'ESP32 DevKit C V4, official Espressif (QEMU)',
  'esp32-cam': 'ESP32 + 2MP camera, microSD (QEMU)',
  'wemos-lolin32-lite': 'Compact ESP32, LiPo battery support (QEMU)',
  'esp32-s3': 'Xtensa LX7 dual-core, WiFi+BT, AI accel (QEMU)',
  'xiao-esp32-s3': 'Seeed XIAO tiny form, 8MB flash+PSRAM (QEMU)',
  'arduino-nano-esp32': 'Nano form-factor, ESP32-S3, RGB LED (QEMU)',
  'esp32-c3': 'RISC-V single-core, WiFi+BLE, 22 GPIO (QEMU)',
  'xiao-esp32-c3': 'Seeed XIAO ESP32-C3 mini board (QEMU)',
  'aitewinrobot-esp32c3-supermini': 'ESP32-C3 SuperMini (QEMU)',
  'stm32-bluepill': 'STM32F103C8 Cortex-M3, 64KB flash, 37 GPIO (QEMU)',
  'stm32-blackpill': 'STM32F411CE Cortex-M4, 512KB flash, 50 GPIO (QEMU)',
  'stm32-bluepill-f103cb': 'STM32F103CB Cortex-M3, 128KB flash, 37 GPIO (QEMU)',
  'stm32-blackpill-f401': 'STM32F401CE Cortex-M4, 512KB flash, 50 GPIO (QEMU)',
  'stm32-f4-discovery': 'STM32F407VG Cortex-M4, 1MB flash, 4 onboard LEDs (QEMU)',
  'stm32-olimex-h405': 'Olimex STM32-H405, F405RG Cortex-M4, 1MB flash (QEMU)',
  'stm32-netduino-plus2': 'Netduino Plus 2, STM32F405 Cortex-M4 (QEMU)',
  'stm32-netduino2': 'Netduino 2, STM32F205 Cortex-M3 (QEMU, serial)',
  attiny85: '8-bit AVR, 8KB flash, 6 GPIO (browser)',
};

export const STATIC_BOARD_PROFILES: BoardProfile[] = (Object.keys(BOARD_KIND_LABELS) as BoardKind[]).map((kind) => ({
  id: kind,
  displayName: BOARD_KIND_LABELS[kind],
  description: BOARD_DESCRIPTIONS[kind],
  rendererId: rendererId(kind),
  fqbn: BOARD_KIND_FQBN[kind],
  runtime: runtime(kind),
  power: power(kind),
  capabilities: capabilities(kind),
  adcPins: adcPins(kind),
  protocolRoles: protocolRoles(kind),
  pinAliases: aliases(kind),
  resolvePin: (pinName: string) => resolveBoardPin(kind, pinName),
}));

// Static profiles are registered at module load. Dynamic overlays can add more
// profiles later through registerBoardProfile without changing this module.
registerBoardProfiles(STATIC_BOARD_PROFILES);
