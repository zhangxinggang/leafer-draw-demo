import type { CabinetConfiguration } from './index'

export const MAX_CABINET_JSON_LENGTH = 1_000_000

function record(value: unknown, path: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`缺少或无效的对象：${path}`)
	return value as Record<string, unknown>
}

function integer(value: unknown, path: string, minimumOne = false): number {
	const number = typeof value === 'string' && value.trim() ? Number(value) : value
	if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < (minimumOne ? 0 : 1))
		throw new Error(`${path} 必须是${minimumOne ? '非负' : '正'}整数。`)
	return minimumOne ? Math.max(1, number) : number
}

/** Removes only trailing commas outside JSON strings, including escaped string contents. */
function withoutTrailingCommas(text: string) {
	let inString = false
	let escaped = false
	const output: string[] = []
	for (let i = 0; i < text.length; i++) {
		const char = text[i]
		if (inString) {
			if (escaped) escaped = false
			else if (char === '\\') escaped = true
			else if (char === '"') inString = false
		} else if (char === '"') inString = true
		else if (char === ',') {
			let next = i + 1
			while (/\s/.test(text[next] ?? '') && next < text.length) next++
			if (text[next] === '}' || text[next] === ']') continue
		}
		output.push(char)
	}
	return output.join('')
}

export function parseCabinetConfigurationJson(text: string): {
	configuration: CabinetConfiguration
	senderName: string
} {
	if (text.length > MAX_CABINET_JSON_LENGTH)
		throw new Error('JSON 过大，请仅导入 1 MB 以内的方案参数。')
	let parsed: unknown
	try {
		parsed = JSON.parse(withoutTrailingCommas(text.trim()))
	} catch {
		throw new Error('JSON 格式错误，请粘贴完整的方案 JSON（支持尾随逗号）。')
	}
	const root = record(parsed, '方案')
	const scheme = root.schemeUserConfigInfo ? root : record(root.schemeContent, 'schemeContent')
	const config = record(scheme.schemeUserConfigInfo, 'schemeUserConfigInfo')
	const more = record(config.more, 'schemeUserConfigInfo.more')
	const moduleRatio = record(config.moduleRatio, 'schemeUserConfigInfo.moduleRatio')
	const content = record(scheme.schemeContent, 'schemeContent.schemeContent')
	const receiver = record(content.receiveCardInventory, 'receiveCardInventory')
	const module = record(receiver.module, 'receiveCardInventory.module')
	const sender = record(content.sendCardInventory, 'sendCardInventory')
	const limit = record(sender.limit, 'sendCardInventory.limit')
	if (typeof sender.hardwareProductName !== 'string' || !sender.hardwareProductName.trim())
		throw new Error('缺少发送卡名称：sendCardInventory.hardwareProductName')
	if (sender.hardwareProductName.trim().length > 120)
		throw new Error('发送卡名称过长，最多支持 120 个字符。')
	return {
		senderName: sender.hardwareProductName.trim(),
		configuration: {
			screenWidth: integer(more.realPixWidth, 'more.realPixWidth'),
			screenHeight: integer(more.realPixHeight, 'more.realPixHeight'),
			moduleWidth: integer(moduleRatio.width, 'moduleRatio.width'),
			moduleHeight: integer(moduleRatio.height, 'moduleRatio.height'),
			receiverColumns: integer(module.width, 'receiveCardInventory.module.width', true),
			receiverRows: integer(module.height, 'receiveCardInventory.module.height', true),
			senderMaxWidth: integer(limit.width, 'sendCardInventory.limit.width'),
			senderMaxHeight: integer(limit.height, 'sendCardInventory.limit.height'),
			senderMaxLoad: integer(sender.bear, 'sendCardInventory.bear'),
			senderPorts: integer(sender.internetAccess, 'sendCardInventory.internetAccess'),
			portLoad: integer(receiver.cableMaxHeight, 'receiveCardInventory.cableMaxHeight'),
		},
	}
}
