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
import GuideTabs from './components/Guide/GuideTabs';
import { DEFAULT_GUIDE_BY_VIEW } from './components/Guide/guideConfig';

function App() {
  const initPersistentData = useAppStore(state => state.initPersistentData);
  const setSidebarOpen = useAppStore(state => state.setSidebarOpen);
  const setActiveGuideId = useAppStore(state => state.setActiveGuideId);
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

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const syncSidebar = (event) => {
      setSidebarOpen(event.matches);
    };

    syncSidebar(mediaQuery);
    mediaQuery.addEventListener('change', syncSidebar);
    return () => mediaQuery.removeEventListener('change', syncSidebar);
  }, [setSidebarOpen]);

  const handleViewChange = (view, guideId = DEFAULT_GUIDE_BY_VIEW[view]) => {
    setCurrentView(view);
    if (guideId) {
      setActiveGuideId(guideId);
    }
  };

  const handleVideoSelect = (file) => {
    setSelectedFile(file);
    handleViewChange('watch', 'guide-watch');
  };

  const handleGoHome = () => {
    setSelectedFile(null);
    handleViewChange('home', 'guide-home');
  };

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-bg-light text-text-light-primary transition-colors duration-500 dark:bg-bg-dark dark:text-text-dark-primary">
      <OnboardingModal />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      <Navbar onGoHome={handleGoHome} onOpenSettings={() => setIsSettingsOpen(true)} />
      
      <div className="relative mx-auto flex w-full max-w-[1680px] flex-col md:flex-row md:items-start">
        <Sidebar onViewChange={handleViewChange} currentView={currentView} />
        
        <main className="relative min-w-0 flex-1 overflow-visible scroll-smooth bg-transparent transition-all duration-500">
          <div className="relative z-10 w-full px-3 pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] pt-3 sm:px-4 sm:pb-28 sm:pt-4 lg:px-8 lg:pb-20 lg:pt-6">
            <GuideTabs currentView={currentView} onNavigate={handleViewChange} hasSelectedFile={!!selectedFile} />
            {currentView === 'home' && <HomeFeed onVideoSelect={handleVideoSelect} onViewChange={handleViewChange} />}
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
