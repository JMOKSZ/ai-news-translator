# AI News Translator

AI驱动的新闻翻译工具，支持多语言互译，特别适用于国际新闻的快速翻译和传播。

## 功能特色

- 🤖 **AI驱动翻译** - 使用Azure OpenAI、OpenAI或Claude进行高质量翻译
- 🌍 **多语言支持** - 支持中英文及其他主流语言互译
- 📰 **新闻优化** - 针对新闻文本优化的翻译模型
- ⚡ **批量处理** - 支持批量新闻翻译
- 📄 **格式保持** - 保持原文档格式和结构

## 安装

```bash
git clone https://github.com/JMOKSZ/ai-news-translator.git
cd ai-news-translator
npm install
```

## 使用

```bash
# 翻译单篇文章
node index.js --input "news_article.txt" --from en --to zh

# 批量翻译
node index.js --batch ./articles --from en --to zh

# 实时监控RSS源并翻译
node index.js --rss "https://example.com/rss" --to zh
```

## 配置

复制 `.env.example` 为 `.env` 并填入相应配置：

```bash
cp .env.example .env
```

## API支持

本工具支持以下AI模型：
- Azure OpenAI
- OpenAI GPT系列
- Anthropic Claude
- 以及其他兼容的API

## 贡献

欢迎提交Issue和Pull Request来帮助改进此项目。