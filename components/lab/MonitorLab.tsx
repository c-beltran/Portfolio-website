'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { summarize } from '@/lib/fps';
import ClipMonitor from './ClipMonitor';
import type { Framing, View } from './transition';

const LiveMonitor = dynamic(() => import('./LiveMonitor'), { ssr: false });

const PORTRAIT = '(max-width: 719px) and (orientation: portrait)'; // the site's phone layout

/** M3b Part A: the same overview ↔ monitor move, live (baked R3F) or as Cycles clips. */
export function MonitorLab() {
  const [mode, setMode] = useState<'live' | 'clips'>('clips');
  const [view, setView] = useState<View>('overview');
  const [settled, setSettled] = useState<View>('overview');
  const [lamp, setLamp] = useState(false);
  const [framing, setFraming] = useState<Framing>('desktop');
  const [liveReady, setLiveReady] = useState(false);
  const [fps, setFps] = useState('');
  const frames = useRef<number[]>([]);
  const moving = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT);
    const set = () => setFraming(mq.matches ? 'phone' : 'desktop');
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  }, []);

  // Live: every animation frame during a move. Clips: every presented video frame (onFrame).
  const onFrame = useCallback((t: number) => frames.current.push(t), []);
  const onMove = useCallback((m: boolean) => {
    moving.current = m;
    if (m) {
      frames.current = [];
      return;
    }
    const t = frames.current;
    const s = summarize(t.slice(1).map((v, i) => v - t[i]!));
    setFps(`avg ${s.avgFps.toFixed(1)} fps · min ${s.minFps.toFixed(1)} fps · ${s.frames} frames`);
    setSettled((v) => (v === 'overview' ? 'monitor' : 'overview'));
  }, []);
  useEffect(() => {
    if (mode !== 'live') return;
    let id = 0;
    const loop = (t: number) => {
      if (moving.current) frames.current.push(t);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [mode]);

  const go = (v: View) => !moving.current && v !== view && setView(v);
  const switchMode = (m: 'live' | 'clips') => {
    setMode(m);
    setView('overview');
    setSettled('overview');
    setFps('');
  };

  return (
    <main className="lab">
      <h1 className="lab__title">Monitor test: live 3D or pre-rendered clips</h1>
      <div className={`lab__stage lab__stage--${framing}`}>
        {/* First paint: the approved still. The live canvas or the clip covers it when ready. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- static export; the still is pre-encoded WebP */}
        <img
          className="lab__media"
          src={`/lab/still-${framing}.webp`}
          alt="The workspace (still)"
        />
        {mode === 'live' && (
          <div className="lab__media" style={{ opacity: liveReady ? 1 : 0 }}>
            <LiveMonitor
              view={view}
              framing={framing}
              lamp={lamp}
              onMove={onMove}
              onReady={() => setLiveReady(true)}
            />
          </div>
        )}
        {mode === 'clips' && (
          <ClipMonitor view={view} framing={framing} onMove={onMove} onFrame={onFrame} />
        )}
      </div>
      <div className="lab__controls">
        <fieldset>
          <legend>Mode</legend>
          {(['live', 'clips'] as const).map((m) => (
            <label key={m}>
              <input type="radio" name="mode" checked={mode === m} onChange={() => switchMode(m)} />
              {m === 'live' ? 'Live 3D' : 'Clips'}
            </label>
          ))}
        </fieldset>
        <button type="button" onClick={() => go('monitor')}>
          Monitor
        </button>
        <button type="button" onClick={() => go('overview')}>
          Back
        </button>
        <button
          type="button"
          onClick={() => setLamp((l) => !l)}
          disabled={mode !== 'live'}
          aria-pressed={lamp}
        >
          Lamp (live only)
        </button>
      </div>
      <p>
        View: <output data-testid="lab-state">{settled}</output> · Framing: {framing} · Last move:{' '}
        <output data-testid="lab-fps">{fps || '—'}</output>
      </p>
    </main>
  );
}
