import { ConfigProvider } from 'antd';
// import LeaferCanvas from './components/LeaferCanvas';
import SuperEditor, { primaryColor } from './components/SuperEditor';

import './App.css';

function App() {
  return (
    <ConfigProvider
      theme={{
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
