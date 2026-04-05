import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone, CheckCircle2, ExternalLink } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      
      // Show the prompt after a delay
      setTimeout(() => {
        if (!localStorage.getItem('pwa_prompt_dismissed')) {
          setIsVisible(true);
        }
      }, 1000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
      console.log('PWA was installed');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [deferredPrompt, isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const dismissPrompt = () => {
    setIsVisible(false);
    // Optional: Don't show again for 24 hours or ever
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (isInstalled) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-200 mx-auto mb-6">
                <Smartphone className="text-white w-10 h-10" />
              </div>
              
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Install App</h3>
              <p className="text-slate-500 text-sm mb-8">
                Install our app for a better and faster experience.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleInstallClick}
                  disabled={!deferredPrompt}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={20} />
                  <span>Install</span>
                </button>
                
                <button
                  onClick={dismissPrompt}
                  className="w-full py-3 text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
            
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex items-center justify-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified Pharmacy System</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
