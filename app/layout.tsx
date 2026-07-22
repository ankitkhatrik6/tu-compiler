import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

const siteUrl = 'https://tucompiler.ankitak.com.np';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'TU Compiler — Browser-Based C/C++ IDE',
    template: '%s | TU Compiler',
  },
  description:
    'TU Compiler is a free, browser-based C and C++ IDE with an integrated terminal. Write, compile, and run your programs online — no installation needed. Made for Tribhuvan University students.',
  keywords: [
    'C compiler online',
    'C++ compiler online',
    'online IDE',
    'TU compiler',
    'Tribhuvan University compiler',
    'browser C++ IDE',
    'compile C online',
    'compile C++ online',
    'online C++ editor',
    'free C compiler',
    'Monaco editor C++',
  ],
  authors: [{ name: 'Ankit Khatri KC', url: siteUrl }],
  creator: 'Ankit Khatri KC',
  publisher: 'Ankit Khatri KC',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'TU Compiler',
    title: 'TU Compiler — Browser-Based C/C++ IDE',
    description:
      'Write, compile, and run C and C++ programs directly in your browser. Free online IDE with an integrated terminal — made for Tribhuvan University students.',
    images: [
      {
        url: '/preview.png',
        width: 1200,
        height: 630,
        alt: 'TU Compiler — Browser-Based C/C++ IDE',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TU Compiler — Browser-Based C/C++ IDE',
    description:
      'Write, compile, and run C/C++ programs in your browser. Free online IDE with integrated terminal. Made for Tribhuvan University students.',
    images: ['/preview.png'],
    creator: '@ankitkhatrik6',
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  verification: {
    google: 'kV4VPBDYMLp7-qjktWPDpYWcNWjGsfLeTxkT_9J09B0',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
