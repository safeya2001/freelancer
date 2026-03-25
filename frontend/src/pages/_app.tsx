import type { AppProps } from 'next/app';
import { appWithTranslation } from 'next-i18next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { SocketProvider } from '@/contexts/SocketContext';
import '@/styles/globals.css';

function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <SocketProvider>
        <Component {...pageProps} />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: { fontFamily: 'inherit', borderRadius: '12px', fontSize: '14px' },
            success: { iconTheme: { primary: '#2D6A4F', secondary: '#fff' } },
          }}
        />
      </SocketProvider>
    </AuthProvider>
  );
}

export default appWithTranslation(App);
