import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const { outputText } = ts.transpileModule(
	await readFile(new URL('./index.ts', import.meta.url), 'utf8'),
	{
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
	},
)
const { optimizeCabinet, validateCabinetSolution } = await import(
	`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)

// Two-dimensional occupied-cell recursion, independent of skyline/component normalization.
function oracle(width, height, allowed) {
	const all = (1 << (width * height)) - 1
	const memo = new Map()
	function visit(mask) {
		if (mask === all) return 0
		if (memo.has(mask)) return memo.get(mask)
		let first = 0
		while (mask & (1 << first)) first++
		const x = first % width
		const y = Math.floor(first / width)
		let best = Infinity
		for (const [w, h] of allowed) {
			if (x + w > width || y + h > height) continue
			let bits = 0
			for (let row = y; row < y + h; row++)
				for (let column = x; column < x + w; column++) bits |= 1 << (row * width + column)
			if (!(mask & bits)) best = Math.min(best, 1 + visit(mask | bits))
		}
		memo.set(mask, best)
		return best
	}
	return visit(0)
}

test('translated, mirrored and separated residual regions preserve exact optima', () => {
	for (let width = 2; width <= 7; width++) {
		for (let maxWidth = 1; maxWidth <= width; maxWidth++) {
			for (let area = 1; area <= 8; area++) {
				const c = {
					screenWidth: width,
					screenHeight: 2,
					moduleWidth: 1,
					moduleHeight: 1,
					receiverColumns: width,
					receiverRows: 2,
					senderMaxWidth: maxWidth,
					senderMaxHeight: 2,
					senderMaxLoad: area,
					senderPorts: 1,
					portLoad: area,
				}
				const allowed = []
				for (let w = 1; w <= maxWidth; w++)
					for (let h = 1; h <= 2; h++) if (w * h <= area) allowed.push([w, h])
				const expected = oracle(width, 2, allowed)
				for (const direction of ['row', 'column']) {
					let result
					for (const progress of optimizeCabinet(c, direction))
						if (progress.solution) result = progress.solution
					assert.equal(result.isOptimal, true)
					assert.deepEqual(
						result.cost,
						[expected, expected, expected],
						`${JSON.stringify(c)} ${direction}`,
					)
					assert.deepEqual(validateCabinetSolution(result), [])
				}
			}
		}
	}
})
