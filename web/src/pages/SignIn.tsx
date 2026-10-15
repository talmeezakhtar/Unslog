import { Logo } from '../components/Layout';
import { AuthComponent } from '../components/ui/sign-up';

export function SignIn() {
  return <AuthComponent logo={<Logo />} brandName="Unslog" />;
}
