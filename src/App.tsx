import { ConfigProvider } from 'antd';
import Editor from './editor';

import { primaryColor } from './styles/theme';
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
      }}
    >
      <Editor />
    </ConfigProvider>
  );
}

export default App;
