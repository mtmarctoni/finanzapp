import SignInForm from './sign-in-form';

export const dynamic = 'force-dynamic';

export default function SignIn() {
  return <SignInForm isPreview={process.env.VERCEL_ENV === 'preview'} />;
}
