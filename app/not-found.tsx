import Link from 'next/link';
export default function NotFound() {
  return (
    <main>
      <h2>Nothing on the desk here.</h2>
      <p>
        <Link href="/">Back to the desk</Link>
      </p>
    </main>
  );
}
