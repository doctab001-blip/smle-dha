import './globals.css';
import { SITE_NAME } from '@/lib/constants';

export const metadata = {
  title: { default: `${SITE_NAME} — SMLE & DHA exam preparation`, template: `%s · ${SITE_NAME}` },
  description:
    'Question bank, timed mock exams and high-yield notes for the Saudi Medical Licensing Exam (SMLE) and UAE DHA licensing exams.',
};

export const viewport = { themeColor: '#0f5c6e' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
