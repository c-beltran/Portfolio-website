import type { Metadata } from 'next';
import { MonitorLab } from '@/components/lab/MonitorLab';

// M3b Part A: the monitor-only live-vs-clips test. Throwaway: never indexed or linked, deleted
// when Part C starts.
export const metadata: Metadata = {
  title: 'Monitor test (lab)',
  robots: { index: false, follow: false },
};

export default function MonitorLabPage() {
  return <MonitorLab />;
}
