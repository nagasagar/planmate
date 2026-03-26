import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthPage() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [signupData, setSignupData] = useState({ name: '', email: '', password: '' });
  const [loginData, setLoginData] = useState({ email: '', password: '' });

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.signup(signupData);
      loginUser(res.token, res.user);
      toast.success('Account created!');
      navigate('/');
    } catch (err) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.login(loginData);
      loginUser(res.token, res.user);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" data-testid="auth-page">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <LayoutGrid className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-slate-900 text-lg tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            Planning Poker
          </span>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl" style={{ fontFamily: 'var(--font-heading)' }}>Welcome</CardTitle>
            <CardDescription>Sign in to create and manage poker rooms</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login" data-testid="login-tab">Sign In</TabsTrigger>
                <TabsTrigger value="signup" data-testid="signup-tab">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" required value={loginData.email}
                      onChange={(e) => setLoginData(p => ({ ...p, email: e.target.value }))}
                      data-testid="login-email-input" placeholder="you@team.com" />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" type="password" required value={loginData.password}
                      onChange={(e) => setLoginData(p => ({ ...p, password: e.target.value }))}
                      data-testid="login-password-input" placeholder="Your password" />
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading} data-testid="login-submit-button">
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <Label htmlFor="signup-name">Name</Label>
                    <Input id="signup-name" required value={signupData.name}
                      onChange={(e) => setSignupData(p => ({ ...p, name: e.target.value }))}
                      data-testid="signup-name-input" placeholder="Your name" />
                  </div>
                  <div>
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" required value={signupData.email}
                      onChange={(e) => setSignupData(p => ({ ...p, email: e.target.value }))}
                      data-testid="signup-email-input" placeholder="you@team.com" />
                  </div>
                  <div>
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" required minLength={6} value={signupData.password}
                      onChange={(e) => setSignupData(p => ({ ...p, password: e.target.value }))}
                      data-testid="signup-password-input" placeholder="Min 6 characters" />
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading} data-testid="signup-submit-button">
                    {loading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center mt-4">
          <Button variant="ghost" className="text-slate-500" onClick={() => navigate('/')} data-testid="back-home-button">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to home
          </Button>
        </div>
      </div>
    </div>
  );
}
