/**
 * AI News Translator
 * AI驱动的新闻翻译工具
 */

require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class NewsTranslator {
  constructor() {
    // 初始化AI客户端
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY,
      baseURL: process.env.AZURE_OPENAI_ENDPOINT || undefined,
      defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || undefined },
      defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY || undefined }
    });
    
    if (process.env.CLAUDE_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.CLAUDE_API_KEY,
      });
    }
    
    this.model = process.env.MODEL_NAME || 'gpt-4';
  }

  /**
   * 使用AI翻译文本
   */
  async translateText(text, sourceLang = 'en', targetLang = 'zh') {
    try {
      const systemPrompt = `你是一位专业的翻译员，擅长将${sourceLang === 'en' ? '英文' : '中文'}新闻翻译成${targetLang === 'zh' ? '中文' : '英文'}。请保持原文意思不变，但用更符合目标语言习惯的方式表达。翻译结果应准确、流畅、自然。`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `请将以下${sourceLang === 'en' ? '英文' : '中文'}新闻翻译成${targetLang === 'zh' ? '中文' : '英文'}：\n\n${text}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('翻译过程中出错:', error.message);
      throw error;
    }
  }

  /**
   * 从网页提取新闻内容
   */
  async extractNewsContent(url) {
    try {
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      const content = await page.evaluate(() => {
        // 移除广告和无关元素
        const selectorsToRemove = [
          'script', 'style', 'nav', 'header', 'footer', 
          '.advertisement', '.ads', '.sidebar', '.related-stories'
        ];
        
        selectorsToRemove.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => el.remove());
        });
        
        // 获取主要内容
        const mainContent = document.querySelector('main') ||
                           document.querySelector('.content') ||
                           document.querySelector('.post-body') ||
                           document.querySelector('.article-body') ||
                           document.querySelector('article') ||
                           document.querySelector('.entry-content') ||
                           document.body;
                           
        return mainContent ? mainContent.innerText : '';
      });
      
      await browser.close();
      return content.substring(0, 3000); // 限制长度
    } catch (error) {
      console.error('提取内容时出错:', error.message);
      return '';
    }
  }

  /**
   * 翻译整篇文章
   */
  async translateArticle(url, sourceLang = 'en', targetLang = 'zh') {
    console.log(`正在处理: ${url}`);
    
    // 提取文章内容
    const content = await this.extractNewsContent(url);
    
    if (!content) {
      throw new Error('无法提取文章内容');
    }
    
    console.log(`提取到 ${content.length} 字符的内容`);
    
    // 翻译内容
    const translated = await this.translateText(content, sourceLang, targetLang);
    
    return {
      original: content,
      translated: translated,
      sourceUrl: url
    };
  }

  /**
   * 批量翻译文章
   */
  async translateBatch(urls, sourceLang = 'en', targetLang = 'zh') {
    console.log(`开始批量翻译 ${urls.length} 篇文章`);
    
    const results = [];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`正在翻译第 ${i + 1}/${urls.length} 篇: ${url}`);
      
      try {
        const result = await this.translateArticle(url, sourceLang, targetLang);
        results.push(result);
        
        // 避免请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`翻译第 ${i + 1} 篇文章时出错:`, error.message);
        results.push({
          sourceUrl: url,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * 保存翻译结果
   */
  async saveTranslation(translation, filename) {
    const result = `# 翻译结果\n\n`;
    const source = `**原文链接**: ${translation.sourceUrl}\n\n`;
    const original = `## 原文\n\n${translation.original}\n\n`;
    const translated = `## 翻译\n\n${translation.translated}\n\n`;
    
    const content = result + source + original + translated;
    await fs.writeFile(filename, content, 'utf8');
    
    console.log(`翻译结果已保存到: ${filename}`);
  }

  /**
   * 从RSS源获取新闻链接
   */
  async getRssLinks(rssUrl) {
    try {
      const response = await axios.get(rssUrl);
      const $ = cheerio.load(response.data, { xmlMode: true });
      
      const links = [];
      $('item').each((index, element) => {
        const link = $(element).find('link').text();
        if (link) {
          links.push(link);
        }
      });
      
      return links.slice(0, 10); // 只取前10个
    } catch (error) {
      console.error('获取RSS链接时出错:', error.message);
      return [];
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const args = process.argv.slice(2);
  const translator = new NewsTranslator();
  
  // 解析命令行参数
  const inputIndex = args.indexOf('--input');
  const batchIndex = args.indexOf('--batch');
  const rssIndex = args.indexOf('--rss');
  const fromIndex = args.indexOf('--from');
  const toIndex = args.indexOf('--to');
  
  (async () => {
    try {
      if (inputIndex !== -1) {
        // 单篇文章翻译
        const input = args[inputIndex + 1];
        const from = fromIndex !== -1 ? args[fromIndex + 1] : 'en';
        const to = toIndex !== -1 ? args[toIndex + 1] : 'zh';
        
        // 从文件读取URL
        const url = await fs.readFile(input, 'utf8');
        const result = await translator.translateArticle(url.trim(), from, to);
        await translator.saveTranslation(result, `translation_${Date.now()}.md`);
        
        console.log('翻译完成！');
      } else if (rssIndex !== -1) {
        // RSS源翻译
        const rssUrl = args[rssIndex + 1];
        const from = fromIndex !== -1 ? args[fromIndex + 1] : 'en';
        const to = toIndex !== -1 ? args[toIndex + 1] : 'zh';
        
        const urls = await translator.getRssLinks(rssUrl);
        console.log(`从RSS获取到 ${urls.length} 个链接`);
        
        const results = await translator.translateBatch(urls, from, to);
        
        for (let i = 0; i < results.length; i++) {
          if (!results[i].error) {
            await translator.saveTranslation(
              results[i], 
              `rss_translation_${i}_${Date.now()}.md`
            );
          }
        }
        
        console.log('RSS翻译完成！');
      } else {
        console.log('请提供参数，例如:');
        console.log('node index.js --input article_url.txt --from en --to zh');
        console.log('node index.js --rss https://example.com/rss --from en --to zh');
      }
    } catch (error) {
      console.error('执行过程中出错:', error);
    }
  })();
}

module.exports = NewsTranslator;