'use client';

import { useEffect } from 'react';
import { useDeskState } from '@/lib/useDeskState';
import { Panel } from '../panel/Panel';
import { DeskStill } from './DeskStill';
import { Drawer } from './Drawer';
import { markHintSeen } from './hint';
import { TurnHint } from './TurnHint';

/** The desk, shared by "/" and "/[section]": the still desk, its drawer, and the panel. */
export function Desk() {
  const { selected, open, close } = useDeskState();
  // The turn-sideways hint is for arriving on the desk: a direct load of a section skips it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void (selected !== null && markHintSeen()), []);
  return (
    <main className="desk">
      <div className="desk__stage">
        <DeskStill selected={selected} onOpen={open} onClose={close} />
        <Drawer selected={selected} onOpen={open} />
      </div>
      <Panel slug={selected} onClose={close} />
      {selected === null && <TurnHint />}
    </main>
  );
}
