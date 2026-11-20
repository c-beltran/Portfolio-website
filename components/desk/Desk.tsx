'use client';

import { useDeskState } from '@/lib/useDeskState';
import { Panel } from '../panel/Panel';
import { DeskStill } from './DeskStill';
import { Drawer } from './Drawer';

/** The desk, shared by "/" and "/[section]": the still desk, its drawer, and the panel. */
export function Desk() {
  const { selected, open, close } = useDeskState();
  return (
    <main className="desk">
      {/* Until the name moves onto the monitor (M3c Task 5): the page's one h1. */}
      <h1 className="visually-hidden">Carlos Beltran</h1>
      <div className="desk__stage">
        <DeskStill selected={selected} onOpen={open} onClose={close} />
        <Drawer selected={selected} onOpen={open} />
      </div>
      <Panel slug={selected} onClose={close} />
    </main>
  );
}
