'use client';

import { useEffect, useRef, useState } from 'react';
import { openedFor, sideOf, type OpenedId } from '@/content/opened';
import { useDeskState } from '@/lib/useDeskState';
import { useTheme } from '@/lib/useTheme';
import { Panel } from '../panel/Panel';
import { DeskStill } from './DeskStill';
import { Drawer } from './Drawer';
import { markHintSeen } from './hint';
import { MotionToggle } from './MotionToggle';
import { Opened } from './Opened';
import { TurnHint } from './TurnHint';

/** How long a closed object's art takes to fade (globals.css, .opened[data-leaving]). */
const FADE_MS = 300;

/**
 * The object to draw: the open one, or for FADE_MS after a close the one that just went back. A
 * switch straight to another object drops the old art at once, so it never sits under the panel.
 */
function useShown(open: OpenedId | null): { id: OpenedId | null; leaving: boolean } {
  const [last, setLast] = useState(open);
  if (open && open !== last) setLast(open);
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setLast(null), FADE_MS);
    return () => clearTimeout(t);
  }, [open]);
  return open ? { id: open, leaving: false } : { id: last, leaving: last !== null };
}

/** The desk, shared by "/" and "/[section]": the still desk, its drawer, and the panel. */
export function Desk() {
  const { selected, open, close } = useDeskState();
  const { theme } = useTheme();
  const opened = openedFor(selected);
  const shown = useShown(opened);
  const main = useRef<HTMLElement>(null);
  // The turn-sideways hint is for arriving on the desk: a direct load of a section skips it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void (selected !== null && markHintSeen()), []);
  // Once the visitor changes what's open, opening and closing animate; a direct load paints still
  // (no animation on first load)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (main.current) main.current.dataset.animate = '';
  }, [selected]);
  return (
    <main
      ref={main}
      className="desk"
      data-open={opened ?? undefined}
      data-side={opened ? sideOf(opened) : undefined}
    >
      <div className="desk__stage">
        <DeskStill selected={selected} onOpen={open} onClose={close} />
        <Drawer selected={selected} onOpen={open} />
        <MotionToggle />
      </div>
      {shown.id && (
        <Opened
          key={shown.id}
          id={shown.id}
          mode={theme === 'lamp' ? 'lamp' : 'day'}
          leaving={shown.leaving}
        />
      )}
      <Panel slug={selected} onClose={close} />
      {selected === null && <TurnHint />}
    </main>
  );
}
