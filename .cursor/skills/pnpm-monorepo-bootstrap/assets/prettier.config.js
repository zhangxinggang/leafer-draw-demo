// 配置文档: https://prettier.nodejs.cn/
export default {
  // 每行最大宽度，超过换行
  printWidth: 100,
  // 缩进级别的空格数
  tabWidth: 2,
  // 用制表符而不是空格缩进行
  useTabs: false,
  // 语句末尾用分号
  semi: true,
  // 使用单引号而不是双引号
  singleQuote: true,
  // 在 JSX 中使用单引号而不是双引号
  jsxSingleQuote: true,
  // 尾随逗号
  trailingComma: 'all',
  // 对象字面量中括号之间有空格 { foo: bar }
  bracketSpacing: true,
  // 将多行 HTML（HTML、JSX）元素的 > 放在最后一行的末尾，而不是单独放在下一行
  bracketSameLine: true,
  // 在唯一的箭头函数参数周围包含括号(avoid：省略括号, always：不省略括号)
  arrowParens: 'always',
  // 换行符使用 lf 结尾 可选值 auto|lf|crlf|cr
  endOfLine: 'auto',
  // 不自动换行
  proseWrap: 'never',
  // HTML 空白字符敏感度
  htmlWhitespaceSensitivity: 'strict',
  // Prettier 插件
  plugins: [
    'prettier-plugin-organize-imports',
    'prettier-plugin-packagejson',
    '@trivago/prettier-plugin-sort-imports',
    'prettier-plugin-tailwindcss'
  ],
  // 导入排序配置
  importOrder: ['<THIRD_PARTY_MODULES>', '^@(.*)', '^[./]'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderGroupNamespaceSpecifiers: false,
  // 文件特定配置
  "overrides": [
    {
      "files": ".prettierrc",
      "options": { "parser": "json" }
    },
    {
      "files": "*rc",
      "options": {
        "parser": "json"
      }
    },
    {
      "files": "*.ts",
      "options": {
        "parser": "typescript"
      }
    }
  ]
}