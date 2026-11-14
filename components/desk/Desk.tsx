'use client';

import type { SectionSlug } from '@/content/objects';
import { useDeskState } from '@/lib/useDeskState';
import { Panel } from '../panel/Panel';
import { Drawer } from './Drawer';

/** The desk, shared by "/" and "/[section]". M1 stub: drawer + panel; M2 adds the still desk. */
export function Desk({ initial }: { initial: SectionSlug | null }) {
  const { selected, open, close } = useDeskState(initial);
  return (
    <main className="desk">
      <Drawer selected={selected} onOpen={open} />
      <Panel slug={selected} onClose={close} />
    </main>
  );
}
