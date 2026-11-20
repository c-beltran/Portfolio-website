import Link from 'next/link';
import { Header } from '@/components/header/Header';

export default function NotFound() {
  return (
    <>
      <Header />
      <main>
        <h2>Nothing on the desk here.</h2>
        <p>
          <Link href="/">Back to the desk</Link>
        </p>
      </main>
    </>
  );
}
