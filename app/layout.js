import './globals.css'

export const metadata = {
  title: 'VidKing Stream - Movies, TV Shows & Anime',
  description: 'Stream unlimited movies, TV shows, and anime with VidKing player integration',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}