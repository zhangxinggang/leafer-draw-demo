import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('./import.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
})
const { parseCabinetConfigurationJson: parse } = await import(
	`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
const example = () => ({
	schemeContent: {
		schemeUserConfigInfo: {
			more: { realPixWidth: 6720, realPixHeight: 3780 },
			moduleRatio: { width: 480, height: 270 },
		},
		schemeContent: {
			receiveCardInventory: { module: { width: 0, height: 0 }, cableMaxHeight: 65535 },
			sendCardInventory: {
				hardwareProductName: 'H_16路网口+2路光口发送卡',
				limit: { width: '10240', height: '10240' },
				bear: 10485760,
				internetAccess: 16,
			},
		},
	},
})

test('maps the supplied scheme field paths and preserves the specified port load', () => {
	const input = JSON.stringify(example()).replace('"height":270}', '"height":270,}')
	assert.deepEqual(parse(input), {
		senderName: 'H_16路网口+2路光口发送卡',
		configuration: {
			screenWidth: 6720,
			screenHeight: 3780,
			moduleWidth: 480,
			moduleHeight: 270,
			receiverColumns: 1,
			receiverRows: 1,
			senderMaxWidth: 10240,
			senderMaxHeight: 10240,
			senderMaxLoad: 10485760,
			senderPorts: 16,
			portLoad: 65535,
		},
	})
	assert.deepEqual(parse(JSON.stringify(example().schemeContent)), parse(input))
})

test('trailing-comma support preserves punctuation and escaped quotes inside strings', () => {
	const input = example()
	input.schemeContent.schemeContent.sendCardInventory.hardwareProductName = 'model,} \\"name",]'
	assert.equal(
		parse(JSON.stringify(input)).senderName,
		input.schemeContent.schemeContent.sendCardInventory.hardwareProductName,
	)
})

test('invalid syntax, missing fields, unsafe numbers, null, booleans and large inputs fail', () => {
	for (const value of ['{}', 'null', '[]', '({})', '{"x":', 'x'.repeat(1_000_001)])
		assert.throws(() => parse(value))
	for (const value of [undefined, null, true, '', -1, 1.5, 'NaN', 1e20]) {
		const input = example()
		input.schemeContent.schemeUserConfigInfo.more.realPixWidth = value
		assert.throws(() => parse(JSON.stringify(input)), /realPixWidth/)
	}
})
