import { useState, useEffect } from 'react';
import Diagrams from './Diagrams';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage or system preference
    const saved = localStorage.getItem('diagramDarkMode');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('diagramDarkMode', JSON.stringify(darkMode));
    
    // Update document class for Tailwind dark mode
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  return (
    <Diagrams 
      darkMode={darkMode} 
      onToggleDarkMode={toggleDarkMode} 
    />
  );
}

export default App;
