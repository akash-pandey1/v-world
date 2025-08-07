import { Nunito_Sans, DM_Sans } from 'next/font/google'
import "./globals.css";
import Layout from '@/components/Layout/Layout'

const nunito = Nunito_Sans({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
})

const dmSans = DM_Sans({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
})

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000"

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "V-World by Akash Pandey",
  description: "A collaborative virtual space app where users can create and customize their own realms.",
}

console.log('Rendering layout');
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={dmSans.className}>
      <body style={{ border: '5px solid blue' }}>
        <Layout>
            {children}
        </Layout>
      </body>
    </html>
  );
}
