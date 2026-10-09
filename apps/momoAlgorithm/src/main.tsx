import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<ConfigProvider
			locale={zhCN}
			theme={{
				token: {
					colorPrimary: '#087f8c',
					borderRadius: 10,
					fontFamily: '"Segoe UI", "Microsoft YaHei UI", sans-serif',
				},
			}}
		>
			<App />
		</ConfigProvider>
	</StrictMode>,
)
