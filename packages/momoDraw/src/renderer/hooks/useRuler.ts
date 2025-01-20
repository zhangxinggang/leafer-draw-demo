import { App } from 'leafer-ui';
import { Ruler } from 'leafer-x-ruler';
import { useEffect, useRef } from 'react';

export const useRuler = ({
  rulerVisible,
  darkMode,
}: {
  rulerVisible: boolean;
  darkMode?: boolean;
}) => {
  const rulerRef = useRef<Ruler | null>(null);

  useEffect(() => {
    if (!rulerRef.current) return;
    // 更新ruler可见性
    rulerRef.current.enabled = rulerVisible;
  }, [rulerVisible]);

  useEffect(() => {
    if (!rulerRef.current?.changeTheme) return;
    // 切换标尺主题
    if (darkMode) {
      (rulerRef.current as any).changeTheme('dark');
    } else {
      (rulerRef.current as any).changeTheme('light');
    }
  }, [darkMode]);

  const initRuler = (app: App) => {
    const ruler = new Ruler(app, {
      enabled: true,
    });
    rulerRef.current = ruler;
    ruler.addTheme('dark', {
      backgroundColor: '#16161a',
      textColor: '#rgba(255, 255, 255, 0.5)',
      borderColor: '#686868',
      highlightColor: 'rgba(0, 102, 255, 0.5)',
    });
  };

  const changeTheme = (theme: string) => {
    if (!rulerRef.current) return;
    (rulerRef.current as any).changeTheme(theme);
  };

  return { changeTheme, initRuler };
};
