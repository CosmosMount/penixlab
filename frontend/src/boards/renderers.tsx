import React from 'react';
import { ArduinoUno } from '../components/velxio-components/ArduinoUno';
import { ArduinoNano } from '../components/velxio-components/ArduinoNano';
import { ArduinoMega } from '../components/velxio-components/ArduinoMega';
import { RaspberryPi3 } from '../components/velxio-components/RaspberryPi3';
import { RaspberryPi4 } from '../components/velxio-components/RaspberryPi4';
import { RaspberryPi5 } from '../components/velxio-components/RaspberryPi5';
import { Esp32 } from '../components/velxio-components/Esp32';
import { Attiny85 } from '../components/velxio-components/Attiny85';
import { PiPicoW } from '../components/velxio-components/PiPicoW';
import {
  Stm32BluePill,
  Stm32BlackPill,
  Stm32BluePillF103CB,
  Stm32BlackPillF401,
  Stm32F4Discovery,
  Stm32OlimexH405,
  Stm32NetduinoPlus2,
  Stm32Netduino2,
} from '../components/velxio-components/Stm32BluePill';
import type { BoardKind } from '../types/board';

export interface BoardRendererContext {
  id: string;
  x: number;
  y: number;
  running: boolean;
  led13?: boolean;
  boardKind: BoardKind | string;
}

export type BoardRenderer = (context: BoardRendererContext) => React.ReactNode;

const renderer = (Component: React.ComponentType<any>): BoardRenderer => ({ id, x, y, led13 }) => (
  <Component id={id} x={x} y={y} led13={led13} />
);

const renderers: Record<string, BoardRenderer> = {
  arduinoUno: renderer(ArduinoUno),
  arduinoNano: renderer(ArduinoNano),
  arduinoMega: renderer(ArduinoMega),
  piPico: renderer(PiPicoW),
  raspberryPi3: renderer(RaspberryPi3),
  raspberryPi4: renderer(RaspberryPi4),
  raspberryPi5: renderer(RaspberryPi5),
  stm32BluePill: renderer(Stm32BluePill),
  stm32BlackPill: renderer(Stm32BlackPill),
  stm32BluePillF103cb: renderer(Stm32BluePillF103CB),
  stm32BlackPillF401: renderer(Stm32BlackPillF401),
  stm32F4Discovery: renderer(Stm32F4Discovery),
  stm32OlimexH405: renderer(Stm32OlimexH405),
  stm32NetduinoPlus2: renderer(Stm32NetduinoPlus2),
  stm32Netduino2: renderer(Stm32Netduino2),
  attiny85: ({ id, x, y, led13 }) => <Attiny85 id={id} x={x} y={y} led1={led13} />,
  esp32: ({ id, x, y, boardKind }) => <Esp32 id={id} x={x} y={y} boardKind={boardKind as BoardKind} />,
};

export function getBoardRenderer(rendererId: string | undefined): BoardRenderer | undefined {
  return rendererId ? renderers[rendererId] : undefined;
}
