'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  ['/dashboard', 'Dashboard'],
  ['/qbank', 'Question bank'],
  ['/mock', 'Mock exams'],
  ['/revision', 'Revision'],
  ['/notes', 'High-yield notes'],
  ['/flagged', 'Flagged'],
];

export default function NavLinks() {
  const path = usePathname();
  return (
    <nav className="nav">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className={path.startsWith(href) ? 'active' : ''}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
