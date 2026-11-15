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
      <div className="desk__stage">
        <DeskStill selected={selected} onOpen={open} onClose={close} />
        <Drawer selected={selected} onOpen={open} />
      </div>
      <Panel slug={selected} onClose={close} />
    </main>
  );
}
