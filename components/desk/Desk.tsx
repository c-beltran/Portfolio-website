'use client';

import { useDeskState } from '@/lib/useDeskState';
import { Panel } from '../panel/Panel';
import { Drawer } from './Drawer';

/** The desk, shared by "/" and "/[section]". M1 stub: drawer + panel; M2 adds the still desk. */
export function Desk() {
  const { selected, open, close } = useDeskState();
  return (
    <main className="desk">
      <Drawer selected={selected} onOpen={open} />
      <Panel slug={selected} onClose={close} />
    </main>
  );
}
