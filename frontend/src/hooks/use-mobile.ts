import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Initialize state directly if window is available, otherwise undefined (for SSR safety)
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false; // Or handle SSR case as needed, default to false
    }
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  React.useEffect(() => {
    // Ensure this effect only runs client-side
    if (typeof window === 'undefined') {
      return;
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    const onChange = () => {
      setIsMobile(mql.matches); // Use mql.matches for consistency
    };

    // Set initial state based on mql.matches for consistency with listener
    // This ensures the state is accurate after hydration and before first interaction
    setIsMobile(mql.matches);
    
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []); // Empty dependency array means it runs once on mount

  return isMobile; // No need for !!isMobile if state is always boolean
}
