import { ConfigProvider, theme as antdTheme } from 'antd';
// import LeaferCanvas from './components/LeaferCanvas';
import { useShallow } from 'zustand/react/shallow';
import SuperEditor, { primaryColor } from './components/SuperEditor';
import useCanvasStore from './components/SuperEditor/store/canvas';
import './index.css';

function App() {
  const { darkMode } = useCanvasStore(
    useShallow((state) => ({
      darkMode: state.darkMode,
    })),
  );

  return (
    <ConfigProvider
      theme={{
        algorithm: darkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: primaryColor,
        },
        components: {
          Slider: {
            trackBg: primaryColor,
          },
        },
      }}>
      <SuperEditor />
    </ConfigProvider>
  );
}

export default App;
