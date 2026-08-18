/**
 * Component Picker Modal
 *
 * Modal interface for searching and selecting components from the wokwi-elements library.
 * Features:
 * - Search bar with real-time filtering
 * - Category tabs for filtering
 * - Grid layout with component thumbnails
 * - Click to select and add component
 */

import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getBoardProfile, listBoardProfiles } from '../boards';
import { ComponentRegistry } from '../services/ComponentRegistry';
import type { ComponentMetadata, ComponentCategory } from '../types/component-metadata';
import { ComponentInfoPanel, HOVER_DELAY, type HoverTarget, type PanelData } from './ComponentInfoPanel';

// Grace period after the pointer leaves a card before the datasheet popover
// hides — long enough to cross the gap onto the (interactive) panel. Must be
// comfortably larger than HOVER_DELAY so re-entering a card cancels the hide
// before it fires.
const HIDE_DELAY = 220;

/** Hover controls handed to each card so it can drive the shared popover. */
interface CardHoverApi {
  show: (t: HoverTarget) => void;
  cancelHide: () => void;
  scheduleHide: () => void;
  /** Current show generation — an armed show is void once this changes. */
  showGen: () => number;
}
import type { BoardKind } from '../types/board';
import { BOARD_KIND_LABELS } from '../types/board';
import { getProBoard } from '../lib/proBoardRegistry';
import raspberryPi3Svg from '../assets/Raspberry_Pi_3_illustration.svg';
import raspberryPi4Png from '../assets/raspberry-pi-4-board.png';
import raspberryPi5Png from '../assets/raspberry-pi-5-board.png';
import { Attiny85 } from './velxio-components/Attiny85';
import './velxio-components/Esp32Element'; // registers velxio-esp32
import './velxio-components/PiPicoWElement'; // registers velxio-pi-pico-w
import './velxio-components/Stm32BluePillElement'; // registers velxio-stm32-bluepill
import './velxio-components/Ssd1306I2cElement'; // registers velxio-ssd1306-i2c-4pin
// Register every wokwi tag that the picker might try to instantiate as a
// thumbnail. The picker calls `document.createElement(tagName)`, so any tag
// that isn't already a registered custom element renders as an empty
// HTMLUnknownElement (blank card preview).
import '@wokwi/elements';
import '../velxio-elements';
import './ComponentPickerModal.css';

interface ComponentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectComponent: (metadata: ComponentMetadata) => void;
  onSelectBoard?: (kind: BoardKind) => void;
}

/**
 * wokwi-elements ships art for boards PenixLab does not emulate; the metadata
 * auto-scan sweeps them into the registry as plain components. Listing one in
 * the picker promises a board that will never boot, so they are hidden here —
 * NOT deleted from components-metadata.json, because saved projects that
 * already contain one still need the element to render.
 */
const UNSIMULATED_BOARD_SHELLS = new Set(['nano-rp2040-connect']);

/**
 * Maker-first category order for the picker grid and the category filter.
 * PenixLab's audience is hobbyist-heavy: everyday digital parts (sensors,
 * LEDs/outputs, displays, buttons) lead, while diodes/resistors/capacitors
 * ('passive'), transistors/op-amps/instruments ('analog') and logic gates
 * sink to the end of the list.
 */
const CATEGORY_ORDER: string[] = [
  'sensors',
  'output',
  'displays',
  'input',
  'motors',
  'communication',
  'electromech',
  'boards',
  'other',
  'passive',
  'analog',
  'logic',
];

function categoryRank(category: string): number {
  const i = CATEGORY_ORDER.indexOf(category);
  // Unknown/future categories land before the passive tail, not after it.
  return i === -1 ? CATEGORY_ORDER.indexOf('other') : i;
}

export const ComponentPickerModal: React.FC<ComponentPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectComponent,
  onSelectBoard,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ComponentCategory | 'all' | 'boards'>(
    'all',
  );
  const [registry] = useState(() => ComponentRegistry.getInstance());
  const registryVersion = useSyncExternalStore(
    registry.subscribe,
    registry.getVersion,
    registry.getVersion,
  );

  const [isLoading, setIsLoading] = useState(true);
  // Floating datasheet popover shown on card hover. A single instance is
  // driven from here so only one panel ever exists in the DOM. Hiding is
  // DEFERRED through a grace-period timer so the pointer can travel from the
  // card onto the panel (to scroll a long doc or click Buy) without it
  // vanishing: the card's leave arms the hide, the panel's enter cancels it.
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  // Monotonic generation stamped when a card arms its show timer. Bumping it
  // invalidates any already-armed show so a grid change (scroll/filter/search)
  // can't pop a panel at a now-stale card rect after the pointer's card reflows.
  const showGenRef = useRef(0);
  const cancelHide = () => window.clearTimeout(hideTimer.current);
  const showPanel = (t: HoverTarget) => {
    window.clearTimeout(hideTimer.current);
    setHoverTarget(t);
  };
  const scheduleHide = () => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHoverTarget(null), HIDE_DELAY);
  };
  // Immediate hide — used when the grid itself changes under the pointer
  // (scroll, filter, search) so a stale panel never lingers. Also invalidates
  // any armed (not-yet-fired) show timer.
  const clearHover = () => {
    showGenRef.current++;
    window.clearTimeout(hideTimer.current);
    setHoverTarget(null);
  };
  const hoverApi: CardHoverApi = {
    show: showPanel,
    cancelHide,
    scheduleHide,
    showGen: () => showGenRef.current,
  };
  // Clear any pending hide timer if the modal unmounts mid-hover.
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);
  // The modal stays mounted (parent toggles `isOpen`), so reset the popover
  // when it closes — otherwise a panel left showing at close (e.g. clicking a
  // card to add it, or ESC while hovering) reappears detached on reopen.
  useEffect(() => {
    if (!isOpen) {
      showGenRef.current++;
      window.clearTimeout(hideTimer.current);
      setHoverTarget(null);
    }
  }, [isOpen]);

  // Wait for registry to load
  useEffect(() => {
    const loadRegistry = async () => {
      await registry.load();
      setIsLoading(false);
    };
    loadRegistry();
  }, [registry]);

  // Filter components based on search and category
  const filteredComponents = useMemo(() => {
    if (isLoading) return [];

    let components = searchQuery ? registry.search(searchQuery) : registry.getAllComponents();

    if (selectedCategory !== 'all') {
      components = components.filter((c) => c.category === selectedCategory);
    }

    // Registry entries that ARE boards (the injected Raspberry Pi family)
    // must never render as component cards: the boards row above already
    // shows every BoardKind with the real art, and adding one through the
    // component path drops a dead canvas part instead of a running board
    // (that is how "add a Pi 4" placed a 40-pin prop that never boots).
    components = components.filter((c) => !(c.id in BOARD_KIND_LABELS));

    // wokwi-elements board shells with no simulator behind them. They come
    // in through the metadata auto-scan and offering them reads as board
    // support we don't have. Filtered here rather than removed from the
    // metadata: saved projects that already placed one must keep rendering.
    components = components.filter((c) => !UNSIMULATED_BOARD_SHELLS.has(c.id));

    // Maker-first ordering: most users reach for a sensor, an LED or a
    // display far more often than a bare transistor or a 74HC gate, so
    // passives / analog / logic sink to the end. Array.sort is stable —
    // the registry's own order is preserved within each category.
    components = [...components].sort(
      (a, b) => categoryRank(a.category) - categoryRank(b.category),
    );

    return components;
  }, [searchQuery, selectedCategory, registry, isLoading, registryVersion]);


  const allBoards = useMemo(() => {
    return listBoardProfiles().map((profile) => profile.id as BoardKind);
  }, []);

  // Get available categories — same maker-first order as the grid.
  const categories = useMemo(() => {
    if (isLoading) return [];
    return [...registry.getCategories()].sort(
      (a, b) => categoryRank(a) - categoryRank(b),
    );
  }, [registry, isLoading]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Portal to <body>: the picker must escape the canvas subtree so no ancestor
  // stacking context can pin it below floating panels (e.g. the AI chat).
  return createPortal(
    <div className="component-picker-overlay" onClick={onClose}>
      <div className="component-picker-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header: title + inline search + category filter + close, all on
            one row to maximise the space left for the components grid. */}
        <div className="modal-header">
          <h2>{t('editor.componentPicker.title')}</h2>

          <div className="header-search-wrapper">
            <svg
              className="search-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder={t('editor.componentPicker.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                clearHover();
              }}
              autoFocus
            />
            {searchQuery && (
              <button
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label={t('editor.componentPicker.clearSearch')}
              >
                X
              </button>
            )}
          </div>

          <select
            className="category-select"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value as ComponentCategory | 'all' | 'boards');
              clearHover();
            }}
            aria-label="Filter by category"
          >
            <option value="all">{t('editor.componentPicker.allComponents')}</option>
            {categories
              .filter((c) => c !== 'boards')
              .map((category) => (
                <option key={category} value={category}>
                  {ComponentRegistry.getCategoryDisplayName(category)}
                </option>
              ))}
            {onSelectBoard && (
              <option value="boards">{t('editor.componentPicker.boards')}</option>
            )}
          </select>

          <button className="close-btn" onClick={onClose} aria-label={t('editor.componentPicker.close')}>
            X
          </button>
        </div>

        {/* Boards Panel */}
        {selectedCategory === 'boards' ? (
          <div className="components-grid" onScroll={clearHover}>
            {allBoards.map((kind) => (
              <BoardCard
                key={kind}
                kind={kind}
                onSelect={() => {
                  onSelectBoard?.(kind);
                  onClose();
                }}
                hoverApi={hoverApi}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Single scrollable area wrapping both the boards row (only in
                "All Components" view) and the components grid, so the modal
                shows ONE scrollbar instead of two stacked ones. */}
            <div className="components-scroll" onScroll={clearHover}>
              {selectedCategory === 'all' && onSelectBoard && (
                <div
                  className="components-grid components-grid--inline"
                  style={{ borderBottom: '1px solid #333', paddingBottom: 8, marginBottom: 4 }}
                >
                  {allBoards.filter(
                    (k) =>
                      !searchQuery ||
                      BOARD_KIND_LABELS[k].toLowerCase().includes(searchQuery.toLowerCase()),
                  ).map((kind) => (
                    <BoardCard
                      key={kind}
                      kind={kind}
                      onSelect={() => {
                        onSelectBoard(kind);
                        onClose();
                      }}
                      hoverApi={hoverApi}
                    />
                  ))}
                </div>
              )}

              <div className="components-grid components-grid--inline">
                {isLoading ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>{t('editor.componentPicker.loading')}</p>
                  </div>
                ) : filteredComponents.length === 0 ? (
                  <div className="no-results">
                    <p>{t('editor.componentPicker.noResults')}</p>
                    {searchQuery && (
                      <button
                        className="clear-filters-btn"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategory('all');
                        }}
                      >
                        {t('editor.componentPicker.clearFilters')}
                      </button>
                    )}
                  </div>
                ) : (
                  filteredComponents.map((component) => (
                    <ComponentCard
                      key={component.id}
                      component={component}
                      hoverApi={hoverApi}
                      onSelect={() => {
                        onSelectComponent(component);
                      }}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Footer Info */}
            <div className="modal-footer">
              <span className="component-count">
                {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''}{' '}
                available
              </span>
            </div>
          </>
        )}
      </div>

      {/* Floating datasheet popover (portals to <body>). Keyed on the anchor
          so it remounts per card and re-measures its position cleanly. */}
      {hoverTarget && (
        <ComponentInfoPanel
          key={`${hoverTarget.data.name}-${Math.round(hoverTarget.rect.left)}-${Math.round(
            hoverTarget.rect.top,
          )}`}
          target={hoverTarget}
          onPanelEnter={cancelHide}
          onPanelLeave={scheduleHide}
        />
      )}
    </div>,
    document.body
  );
};
/**
 * Shared hover behaviour for the picker cards: on enter/focus cancel any
 * pending hide and arm a delayed "show panel"; on leave/blur cancel that arm
 * and hand off to the modal's grace-period hide (so the pointer can travel
 * onto the panel). Always clears its own arm timer on unmount.
 */
function useCardHover(buildData: () => PanelData, api: CardHoverApi) {
  const timer = useRef<number | undefined>(undefined);
  const start = (e: React.MouseEvent | React.FocusEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    api.cancelHide();
    window.clearTimeout(timer.current);
    const gen = api.showGen();
    timer.current = window.setTimeout(() => {
      // Voided if a grid change (clearHover) bumped the generation meanwhile.
      if (api.showGen() !== gen) return;
      api.show({ data: buildData(), rect });
    }, HOVER_DELAY);
  };
  const end = () => {
    window.clearTimeout(timer.current);
    api.scheduleHide();
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { onMouseEnter: start, onMouseLeave: end, onFocus: start, onBlur: end };
}

/**
 * Component Card - Individual component display in the grid
 */
interface ComponentCardProps {
  component: ComponentMetadata;
  onSelect: () => void;
  hoverApi: CardHoverApi;
}

// Passive components (resistor / capacitor / inductor) come with metadata
// thumbnails that already encode the preset value (color bands for resistors,
// value labels for caps/inductors). The live wokwi elements either ignore
// `value` visually or render it identically across presets, so for these we
// short-circuit to the SVG. Everything else still uses the live element so
// LEDs, displays, etc. preview correctly.
const PASSIVE_TAGS = new Set([
  'wokwi-resistor',
  'wokwi-capacitor',
  'velxio-capacitor-electrolytic',
  'wokwi-inductor',
]);

// Static illustrations for the Pi Linux family. A live velxio-raspberry-pi-*
// custom element at natural size + CSS scale keeps its unscaled layout box,
// so the 100px thumbnail clips it to a sliver — images render fully instead.
// Keyed by tagName because the registry's Pi Zero/1/2 entries deliberately
// reuse the Pi 3 board art.
const PI_BOARD_ART: Record<string, string> = {
  'velxio-raspberry-pi-3': raspberryPi3Svg,
  'velxio-raspberry-pi-4': raspberryPi4Png,
  'velxio-raspberry-pi-5': raspberryPi5Png,
};
const ComponentCard: React.FC<ComponentCardProps> = ({ component, onSelect, hoverApi }) => {
  const thumbnailRef = React.useRef<HTMLDivElement>(null);
  const hover = useCardHover(
    () => ({
      id: component.id,
      name: component.name,
      category: ComponentRegistry.getCategoryDisplayName(component.category),
      description: component.description,
      pinCount: component.pinCount,
      properties: component.properties,
      tags: component.tags,
      thumbnail: component.thumbnail,
    }),
    hoverApi,
  );
  // Passives short-circuit to their preset SVG (value-encoded look).
  const usePresetSvg =
    PASSIVE_TAGS.has(component.tagName) &&
    typeof component.thumbnail === 'string' &&
    component.thumbnail.trim().startsWith('<svg');
  const boardArt = PI_BOARD_ART[component.tagName];

  // Render actual web component as thumbnail
  React.useEffect(() => {
    if (!thumbnailRef.current) return;
    if (usePresetSvg) return; // SVG is rendered via dangerouslySetInnerHTML below
    if (boardArt) return; // static illustration rendered below

    // Create the actual wokwi element
    const element = document.createElement(component.tagName);

    // Scale factors for different component types
    let scale = 0.5;
    if (component.tagName.includes('arduino') || component.tagName.includes('esp32')) {
      scale = 0.35; // Boards are larger, scale them down more
    } else if (component.tagName.includes('lcd') || component.tagName.includes('display')) {
      scale = 0.4; // Displays need a bit more space
    }

    (element as HTMLElement).style.transform = `scale(${scale})`;
    (element as HTMLElement).style.transformOrigin = 'center center';

    // Pass the preset's defaults through so variant-sensitive elements render
    // the right look in the picker — e.g. wokwi-resistor color bands (value)
    // or the M5Stack Chain matrix light/dark housing (mono). Same property
    // assignment DynamicComponent performs when the part is placed, so any
    // element that tolerates placement tolerates the preview.
    for (const [key, val] of Object.entries(component.defaultValues ?? {})) {
      try {
        (element as any)[key] = val;
      } catch {
        /* read-only prop on some upstream element — skip */
      }
    }

    // Set default properties for better preview appearance
    if (component.tagName === 'wokwi-led') {
      (element as any).value = true; // Turn on LED
      (element as any).color = component.defaultValues?.color || 'red';
    } else if (component.tagName === 'wokwi-rgb-led') {
      (element as any).red = true;
      (element as any).green = true;
      (element as any).blue = true;
    } else if (component.tagName === 'wokwi-pushbutton') {
      (element as any).color = component.defaultValues?.color || 'red';
    } else if (component.tagName === 'wokwi-lcd1602' || component.tagName === 'wokwi-lcd2004') {
      (element as any).text = 'Hello World!';
    }

    thumbnailRef.current.innerHTML = '';
    thumbnailRef.current.appendChild(element);

    return () => {
      if (thumbnailRef.current) {
        thumbnailRef.current.innerHTML = '';
      }
    };
  }, [component.tagName, component.defaultValues, usePresetSvg, boardArt]);

  return (
    <button className="component-card" onClick={onSelect} style={{ position: 'relative' }} {...hover}>
      <div className="card-thumbnail">
        {boardArt ? (
          <img
            src={boardArt}
            alt={component.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        ) : usePresetSvg ? (
          <div
            className="component-preview"
            dangerouslySetInnerHTML={{ __html: component.thumbnail }}
          />
        ) : (
          <div ref={thumbnailRef} className="component-preview" />
        )}
      </div>
      <div className="card-content">
        <div className="card-name">{component.name}</div>
        {component.description && <div className="card-description">{component.description}</div>}
        <div className="card-meta">
          <span className="card-category">{component.category}</span>
          {component.pinCount > 0 && <span className="card-pins">{component.pinCount} pins</span>}
        </div>
      </div>
    </button>
  );
};

// Tag name used to render a thumbnail for each board kind.
// Boards without a tag will show a generic chip icon.
const BOARD_TAG: Partial<Record<BoardKind, string>> = {
  'arduino-uno': 'wokwi-arduino-uno',
  'arduino-nano': 'wokwi-arduino-nano',
  'arduino-mega': 'wokwi-arduino-mega',
  'raspberry-pi-pico': 'wokwi-nano-rp2040-connect',
  'pi-pico-w': 'velxio-pi-pico-w',
  esp32: 'velxio-esp32',
  'esp32-devkit-c-v4': 'velxio-esp32',
  'esp32-cam': 'velxio-esp32',
  'wemos-lolin32-lite': 'velxio-esp32',
  'esp32-s3': 'velxio-esp32',
  'xiao-esp32-s3': 'velxio-esp32',
  'arduino-nano-esp32': 'velxio-esp32',
  'esp32-c3': 'velxio-esp32',
  'xiao-esp32-c3': 'velxio-esp32',
  'aitewinrobot-esp32c3-supermini': 'velxio-esp32',
  'stm32-bluepill': 'velxio-stm32-bluepill',
  'stm32-blackpill': 'velxio-stm32-blackpill',
  'stm32-bluepill-f103cb': 'velxio-stm32-bluepill-f103cb',
  'stm32-blackpill-f401': 'velxio-stm32-blackpill-f401',
  'stm32-f4-discovery': 'velxio-stm32-f4-discovery',
  'stm32-olimex-h405': 'velxio-stm32-olimex-h405',
  'stm32-netduino-plus2': 'velxio-stm32-netduino-plus2',
  'stm32-netduino2': 'velxio-stm32-netduino2',
};

interface BoardCardProps {
  kind: BoardKind;
  onSelect: () => void;
  hoverApi: CardHoverApi;
}

const BoardCard: React.FC<BoardCardProps> = ({ kind, onSelect, hoverApi }) => {
  const thumbnailRef = React.useRef<HTMLDivElement>(null);
  const profile = getBoardProfile(kind);
  const hover = useCardHover(
    () => ({
      id: kind,
      name: BOARD_KIND_LABELS[kind],
      category: 'Boards',
      description: profile?.description ?? getProBoard(kind)?.description ?? '',
      pinCount: 0,
      properties: [],
      tags: [],
    }),
    hoverApi,
  );

  React.useEffect(() => {
    if (!thumbnailRef.current) return;
    // Static-image boards handled below via reactThumbnail: the whole Pi
    // Linux family uses board illustrations (a live custom element at
    // natural size + CSS scale keeps its unscaled layout box, so the
    // 100px thumbnail clips it to a narrow sliver).
    if (
      kind === 'raspberry-pi-zero' ||
      kind === 'raspberry-pi-1' ||
      kind === 'raspberry-pi-2' ||
      kind === 'raspberry-pi-3' ||
      kind === 'raspberry-pi-4' ||
      kind === 'raspberry-pi-5' ||
      kind === 'attiny85'
    )
      return;

    const tag = BOARD_TAG[kind] ?? getProBoard(kind)?.tag;
    if (!tag) return;

    const el = document.createElement(tag) as HTMLElement;
    // Use setAttribute so observedAttributes + connectedCallback read the correct value
    el.setAttribute('board-kind', kind);
    el.style.transform = 'scale(0.28)';
    el.style.transformOrigin = 'center center';

    thumbnailRef.current.innerHTML = '';
    thumbnailRef.current.appendChild(el);

    return () => {
      if (thumbnailRef.current) thumbnailRef.current.innerHTML = '';
    };
  }, [kind]);

  const reactThumbnail =
    // Zero/1/2 render on canvas through the Pi-3 element (same 40-pin art),
    // so their cards reuse the same illustration.
    kind === 'raspberry-pi-3' ||
    kind === 'raspberry-pi-zero' ||
    kind === 'raspberry-pi-1' ||
    kind === 'raspberry-pi-2' ? (
      <img
        src={raspberryPi3Svg}
        alt={BOARD_KIND_LABELS[kind]}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
      />
    ) : kind === 'raspberry-pi-4' ? (
      <img
        src={raspberryPi4Png}
        alt="Raspberry Pi 4"
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
      />
    ) : kind === 'raspberry-pi-5' ? (
      <img
        src={raspberryPi5Png}
        alt="Raspberry Pi 5"
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
      />
    ) : kind === 'attiny85' ? (
      <div style={{ transform: 'scale(0.55)', transformOrigin: 'center center' }}>
        <Attiny85 />
      </div>
    ) : null;

  return (
    <button
      className="component-card"
      onClick={onSelect}
      style={{ position: 'relative' }}
      {...hover}
    >
      <div className="card-thumbnail">
        {reactThumbnail ? reactThumbnail : <div ref={thumbnailRef} className="component-preview" />}
      </div>
      <div className="card-content">
        <div className="card-name">{BOARD_KIND_LABELS[kind]}</div>
        <div className="card-description">{profile?.description ?? getProBoard(kind)?.description}</div>
      </div>
    </button>
  );
};

