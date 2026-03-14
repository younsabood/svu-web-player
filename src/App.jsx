import React, { useEffect, useState } from 'react';
import Navbar from './components/Layout/Navbar';
import Sidebar from './components/Layout/Sidebar';
import Explore from './components/Explore/Explore';
import HomeFeed from './components/Home/HomeFeed';
import SubscriptionsManager from './components/Explore/SubscriptionsManager';
import SettingsModal from './components/Settings/SettingsModal';
import Watch from './components/Watch/Watch';
import Exports from './components/Exports/Exports';
import { useAppStore } from './store/useAppStore';
import OnboardingModal from './components/Settings/OnboardingModal';

function App() {
  const initPersistentData = useAppStore(state => state.initPersistentData);
  const [currentView, setCurrentView] = useState('home'); 
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    initPersistentData();
  }, [initPersistentData]);

  useEffect(() => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
  }, []);

  const handleVideoSelect = (file) => {
    setSelectedFile(file);
    setCurrentView('watch');
  };

  const handleGoHome = () => {
    setCurrentView('home');
    setSelectedFile(null);
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-bg-light dark:bg-bg-dark text-text-light-primary dark:text-text-dark-primary transition-colors duration-500">
      <OnboardingModal />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      <Navbar onGoHome={handleGoHome} onOpenSettings={() => setIsSettingsOpen(true)} />
      
      <div className="flex flex-1 overflow-hidden relative w-full">
        <Sidebar onViewChange={setCurrentView} currentView={currentView} />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full relative scroll-smooth bg-gradient-to-br from-bg-light via-bg-light to-primary/5 dark:from-bg-dark dark:via-bg-dark dark:to-primary/10 transition-all duration-500">
          <div className="relative z-10 w-full h-full p-3 md:p-8 pb-32 md:pb-20">
            {currentView === 'home' && <HomeFeed onVideoSelect={handleVideoSelect} onViewChange={setCurrentView} />}
            {currentView === 'explore' && <Explore onVideoSelect={handleVideoSelect} />}
            {currentView === 'classes' && <SubscriptionsManager />}
            {currentView === 'watch' && <Watch file={selectedFile} />}
            {currentView === 'exports' && <Exports />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
