'use client';

import { usePathname } from 'next/navigation';
import { signIn, SessionProvider, useSession } from 'next-auth/react';
import { useEffect } from 'react';

/**
 * The app shell hides all navigation while signed out, so a signed-out visit
 * would otherwise sit on loading skeletons with no way in. Send it to sign-in.
 */
function SignInRedirect() {
  const { status } = useSession();
  const pathname = usePathname();
  const onAuthPage = pathname.startsWith('/auth');

  useEffect(() => {
    // `/` already redirects to /dashboard on the server. Starting the async
    // sign-in here races that navigation and can abort the providers fetch.
    if (status === 'unauthenticated' && !onAuthPage && pathname !== '/') {
      void signIn();
    }
  }, [status, onAuthPage, pathname]);

  return null;
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <SignInRedirect />
      {children}
    </SessionProvider>
  );
}
