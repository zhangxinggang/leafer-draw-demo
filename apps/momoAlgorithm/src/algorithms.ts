export const ALGORITHM_LIST = [
	{
		id: 'rectangle-escape',
		name: '防逃逸',
		category: '几何约束',
		description: '拖动小矩形，观察包围框如何随之变化。让面积与边长始终处于设定范围内。',
		tags: ['最小包围框', '连续拖动', '边界约束'],
		isAvailable: true,
	},
	{
		id: 'extreme-cabinet',
		name: '极限箱体',
		category: '带载优化',
		description: '从模组到发送卡，计算最少设备的矩形分区，查看行、列两种接线布局。',
		tags: ['精确优化', '矩形分区', '接线规划'],
		isAvailable: true,
	},
	{
		id: 'packing',
		name: '矩形装箱',
		category: '空间优化',
		description: '探索有限空间内的矩形布局。',
		tags: ['布局优化'],
		isAvailable: false,
	},
	{
		id: 'pathfinding',
		name: '路径寻优',
		category: '路径搜索',
		description: '观察起点与终点之间的路径选择。',
		tags: ['路径搜索'],
		isAvailable: false,
	},
]
