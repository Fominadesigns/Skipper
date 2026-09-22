import './globals.css';

export const metadata = {
  title: 'Skipper — CRM човнової станції',
  description: 'Облік стоянки човнів, рахунки й оплати',
};

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#141d42" />
      </head>
      <body>{children}</body>
    </html>
  );
}
