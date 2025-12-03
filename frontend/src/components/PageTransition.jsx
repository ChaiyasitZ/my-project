import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * PageTransition component provides smooth fade/slide animations
 * when navigating between pages, preventing the blinking effect.
 */
function PageTransition({ children }) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState('enter');
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    // If the path changed, start exit animation
    if (location.pathname !== previousPath.current) {
      setTransitionStage('exit');
      
      // After exit animation, update children and start enter animation
      const exitTimer = setTimeout(() => {
        setDisplayChildren(children);
        setTransitionStage('enter');
        previousPath.current = location.pathname;
      }, 150); // Match the CSS transition duration
      
      return () => clearTimeout(exitTimer);
    } else {
      // Same path, just update children
      setDisplayChildren(children);
    }
  }, [children, location.pathname]);

  return (
    <div
      className={`page-transition ${transitionStage}`}
      style={{
        opacity: transitionStage === 'exit' ? 0 : 1,
        transform: transitionStage === 'exit' ? 'translateY(8px)' : 'translateY(0)',
        transition: 'opacity 150ms ease-out, transform 150ms ease-out',
      }}
    >
      {displayChildren}
    </div>
  );
}

export default PageTransition;
