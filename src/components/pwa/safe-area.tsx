// Web only (native uses safe-area.native.tsx, which renders its children unchanged).
//
// On web, Expo Router's own safe-area provider always reports 0 for every inset, so on an
// iPhone Home Screen app the tab bar sat under the home bar. This provider reads the real
// values from CSS env(safe-area-inset-*) and gives them to everything below it
// (useSafeAreaInsets, the tab bar, headers).
import { useEffect, useState, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { SafeAreaFrameContext, SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';

const ZERO: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export function WebSafeArea({ children }: { children: ReactNode }) {
  const [insets, setInsets] = useState<EdgeInsets>(ZERO);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
    const read = () => {
      const cs = getComputedStyle(probe);
      const next = {
        top: parseFloat(cs.paddingTop) || 0,
        right: parseFloat(cs.paddingRight) || 0,
        bottom: parseFloat(cs.paddingBottom) || 0,
        left: parseFloat(cs.paddingLeft) || 0,
      };
      setInsets((cur) =>
        cur.top === next.top && cur.right === next.right && cur.bottom === next.bottom && cur.left === next.left ? cur : next,
      );
    };
    read();
    // iOS can report the values a moment after launch, and they change on rotation.
    const early = [100, 300, 700, 1500, 3000].map((ms) => setTimeout(read, ms));
    const slow = setInterval(read, 2000);
    window.addEventListener('resize', read);
    document.addEventListener('visibilitychange', read);
    return () => {
      early.forEach(clearTimeout);
      clearInterval(slow);
      window.removeEventListener('resize', read);
      document.removeEventListener('visibilitychange', read);
      probe.remove();
    };
  }, []);

  return (
    <SafeAreaFrameContext.Provider value={{ x: 0, y: 0, width, height }}>
      <SafeAreaInsetsContext.Provider value={insets}>{children}</SafeAreaInsetsContext.Provider>
    </SafeAreaFrameContext.Provider>
  );
}
