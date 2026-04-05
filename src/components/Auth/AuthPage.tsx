import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  AlertCircle, 
  ShieldCheck,
  Activity,
  Mail,
  UserPlus,
  CheckCircle2,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { db } from '../../db/db';
import { supabase } from '../../lib/supabase';

interface AuthPageProps {
  onLogin: (user: any) => void;
  initialMode?: 'login' | 'signup' | 'reset' | 'update-password';
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'update-password'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showResetOption, setShowResetOption] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    // Check for password reset hash
    if (window.location.hash && window.location.hash.includes('type=recovery')) {
      setMode('update-password');
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone || 
                        document.referrer.includes('android-app://');
    
    if (isStandalone) {
      setIsInstallable(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  const completeLogin = async (authUser: any, profileData?: any) => {
    const userData = {
      email: authUser.email,
      fullName: profileData?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
      role: profileData?.role || 'Staff',
      status: profileData?.status || 'active',
      id: authUser.id
    };

    // Sync to local DB
    const localUser = await db.users.where('email').equals(authUser.email!).first();
    if (!localUser) {
      await db.users.add({
        ...userData,
        username: authUser.email!.split('@')[0],
        password: password, // Store for offline if needed
        createdAt: new Date().toISOString()
      } as any);
    } else {
      await db.users.update(localUser.id!, { 
        fullName: userData.fullName,
        role: userData.role as any,
        status: userData.status as any
      });
    }

    onLogin(userData);
  };

  const handleLoginAttempt = async (trimmedEmail: string, pass: string) => {
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: pass,
    });

    if (signInError) {
      if (signInError.message.includes('Invalid login credentials')) {
        setShowResetOption(true);
        throw new Error('Invalid email or password.');
      }
      throw signInError;
    }

    if (!data.user) throw new Error('Login failed.');

    // Fetch profile
    let profileData: any = null;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      profileData = profile;
    } catch (pErr) {
      console.warn('Profile fetch error:', pErr);
    }

    await completeLogin(data.user, profileData);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);
    setShowResetOption(false);

    try {
      const trimmedEmail = email.trim().toLowerCase();

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: password,
          options: {
            data: {
              full_name: fullName || trimmedEmail.split('@')[0],
            }
          }
        });

        if (signUpError) {
          // If user already exists, try logging in automatically
          if (signUpError.message.includes('User already registered')) {
            await handleLoginAttempt(trimmedEmail, password);
            return;
          }
          throw signUpError;
        }

        if (data.user) {
          // If session is available (no email confirmation), log in immediately
          if (data.session) {
            await completeLogin(data.user);
          } else {
            // If email confirmation is required by Supabase settings, 
            // we still try to log in just in case or show a friendly message.
            // But per requirements, we attempt direct access.
            await handleLoginAttempt(trimmedEmail, password);
          }
        }
        
      } else if (mode === 'login') {
        await handleLoginAttempt(trimmedEmail, password);
      } else if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}`,
        });
        if (resetError) throw resetError;
        setMessage('Password reset link sent! Check your inbox.');
      } else if (mode === 'update-password') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) await completeLogin(authUser);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-200 mb-4">
            <Activity className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Yousaf Pharma</h1>
          <p className="text-slate-500 text-sm mt-1">Pharmacy Management System</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 relative">
          {/* PWA Install Button */}
          <AnimatePresence>
            {isInstallable && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={handleInstall}
                className="absolute -top-4 right-8 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold py-2 px-4 rounded-full shadow-lg flex items-center gap-2 transition-all active:scale-95 z-10"
              >
                <Download size={12} />
                INSTALL APP
              </motion.button>
            )}
          </AnimatePresence>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              {mode === 'login' ? 'Welcome Back' : 
               mode === 'signup' ? 'Create Account' : 
               mode === 'reset' ? 'Reset Password' : 'Set New Password'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {mode === 'login' ? 'Enter your credentials to access dashboard' : 
               mode === 'signup' ? 'Get started with your pharmacy management' : 
               mode === 'reset' ? 'Enter your email to receive a reset link' : 'Enter a new password for your account'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 border border-red-100 rounded-xl p-3 flex flex-col gap-2 text-red-600 text-xs font-medium"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <p>{error}</p>
                  </div>
                  
                  {showResetOption && (
                    <button 
                      type="button"
                      onClick={() => { setMode('reset'); setError(null); }}
                      className="w-full bg-white px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition-colors font-bold text-center"
                    >
                      Forgot Password?
                    </button>
                  )}
                </motion.div>
              )}
              {message && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2 text-emerald-600 text-xs font-medium"
                >
                  <CheckCircle2 size={16} className="shrink-0" />
                  <p>{message}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={18} />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            {mode === 'update-password' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">New Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Confirm New Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>
            )}

            {mode !== 'update-password' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="admin@yousaf.com"
                  />
                </div>
              </div>
            )}

            {(mode === 'login' || mode === 'signup') && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(null); setMessage(null); }}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-slate-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'login' ? 'Login' : 
                     mode === 'signup' ? 'Sign Up' : 
                     mode === 'reset' ? 'Send Reset Link' : 'Update Password'}
                  </span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
                setMessage(null);
                setShowResetOption(false);
              }}
              className="text-sm text-slate-500 hover:text-emerald-600 transition-colors font-medium"
            >
              {mode === 'login' ? "Don't have an account? Sign Up" : 
               mode === 'signup' ? "Already have an account? Login" : 
               mode === 'reset' || mode === 'update-password' ? "Back to Login" : ""}
            </button>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4 text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Secure Access</span>
          </div>
          <div className="w-1 h-1 bg-slate-300 rounded-full" />
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest">v2.2.1</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
