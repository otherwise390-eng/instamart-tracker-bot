const { Telegraf, Markup } = require('telegraf');
const { chromium } = require('playwright'); // 🔥 Real Browser Engine
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = '8501862664:AAGI3rJVaW4c9Baud3hXs7WO2Ryi0wuxfjA'; 
const ADMIN_CHAT_ID = '7485181331'; 
const CHECK_INTERVAL = 30000; // Browser automation ke liye minimum 30 Seconds ka gap zaroori hai bhai
const RENDER_URL = 'https://instamart-tracker-bot.onrender.com/'; 

// 📍 FIXED LOCATION: SONU SAGAR DAIRY LOCKED INTERNAL COORDINATES
const FIXED_LAT = 28.708143;  
const FIXED_LNG = 77.305382;  
// ---------------------

const bot = new Telegraf(BOT_TOKEN);
const activeUsers = {};

if (!global.instamartApprovedList) {
    global.instamartApprovedList = [ADMIN_CHAT_ID.toString()];
}

const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.status(200).send('Instamart Browser Automation Engine Live!'));
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Port Binding Successful on ${PORT}`));

function isUserApproved(userId) {
    if (!userId) return false;
    return global.instamartApprovedList.map(String).includes(userId.toString());
}

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.chat.id.toString();
    
    if (data.startsWith('stop_url_')) {
        const index = parseInt(data.split('_')[2]);
        if (activeUsers[chatId] && activeUsers[chatId][index]) {
            const removedItem = activeUsers[chatId][index];
            clearInterval(removedItem.interval);
            activeUsers[chatId].splice(index, 1);
            await ctx.answerCbQuery("Tracking band kar di gayi hai! 🛑").catch(() => {});
            return ctx.reply(`🛑 Tracking stopped for:\n${removedItem.url}`, { disable_web_page_preview: true });
        }
    }
});

bot.start((ctx) => {
    const userId = ctx.from.id.toString();
    if (isUserApproved(userId)) {
        return ctx.reply("🤖 Instamart Real Browser Tracker Bot Active!\n\n🔹 **Format:**\n`/start_track <Instamart_URL>`\n\n🔹 `/stop_all`");
    }
    ctx.reply(`🔒 **Access Denied!** ID: \`${userId}\``);
});

bot.command('start_track', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return ctx.reply("❌ Aap approved nahi hain.");
    
    const chatId = ctx.chat.id.toString();
    const args = ctx.message.text.replace(/\n/g, ' ').split(' ').filter(arg => arg.trim() !== '');
    
    let instamartLink = args.find(arg => arg.includes('swiggy.com/'));
    if (!instamartLink) return ctx.reply("❌ Valid Swiggy Instamart link bhejo!");
    
    if (!activeUsers[chatId]) activeUsers[chatId] = [];
    
    ctx.reply(`🚀 **Real Browser Tracking Active!**\n📍 Location Locked: *Sonu Sagar Dairy*\nBackground browser start ho raha hai...`);
    
    // Background automation engine init
    const intervalId = setInterval(() => { checkStockWithBrowser(ctx, chatId, instamartLink); }, CHECK_INTERVAL);
    activeUsers[chatId].push({ url: instamartLink, interval: intervalId });
    
    checkStockWithBrowser(ctx, chatId, instamartLink);
});

bot.command('stop_all', (ctx) => {
    const chatId = ctx.chat.id.toString();
    if (activeUsers[chatId] && activeUsers[chatId].length > 0) {
        activeUsers[chatId].forEach(item => clearInterval(item.interval));
        delete activeUsers[chatId];
        ctx.reply("🛑 Saari tracking band kar di gayi.");
    } else { ctx.reply("⚠️ Koyi active tracking nahi mili."); }
});

async function checkStockWithBrowser(ctx, chatId, targetUrl) {
    let browser;
    try {
        // Launch real headless browser to bypass cloudflare/anti-bot
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // Grant coordinates permission specifically for Sonu Sagar Dairy
        const context = await browser.newContext({
            geolocation: { latitude: FIXED_LAT, longitude: FIXED_LNG },
            permissions: ['geolocation'],
            viewport: { width: 375, height: 812 }, // Mobile View Simulation
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/605.1.15'
        });

        const page = await context.newPage();
        
        // Inject locked address cookies before load
        await context.addCookies([
            { name: '_lat', value: FIXED_LAT.toString(), domain: 'www.swiggy.com', path: '/' },
            { name: '_lng', value: FIXED_LNG.toString(), domain: 'www.swiggy.com', path: '/' },
            { name: 'locationAddress', value: 'Sonu_Sagar_Dairy', domain: 'www.swiggy.com', path: '/' }
        ]);

        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 20000 });
        
        // Wait 2 seconds for JS execution
        await page.waitForTimeout(2000);

        const bodyText = await page.innerText('body');
        const lowerText = bodyText.toLowerCase();

        // --- 🎯 EXTRACT CURRENT PRICE ---
        let price = "N/A";
        const priceElement = await page.$('span[class*="price"], div[class*="Price"], div[class*="itemPrice"]');
        if (priceElement) {
            let rawPrice = await priceElement.innerText();
            price = rawPrice.replace(/[^₹0-9.]/g, '').trim();
            if (price && !price.includes('₹')) price = `₹${price}`;
        }

        // --- 🛑 STRICT STOCK VALIDATION ---
        const isSoldOut = lowerText.includes('out of stock') || 
                          lowerText.includes('currently unavailable') || 
                          lowerText.includes('item unavailable') || 
                          lowerText.includes('not deliverable');

        const hasAddButton = lowerText.includes('add') || lowerText.includes('+ add');

        // Fire alert if ADD button is present visually and no out of stock label is blocking it
        if (!isSoldOut && hasAddButton) {
            const itemIndex = activeUsers[chatId].findIndex(item => item.url === targetUrl);
            await bot.telegram.sendMessage(chatId, `🚨 INSTAMART REAL ALERT 🚨\n\n🔥 bhai *Sonu Sagar Dairy* wale location par item LIVE mil gaya hai! 🔥\n\n💰 **Price:** ${price}\n\nLink:\n${targetUrl}`,
                Markup.inlineKeyboard([[Markup.button.callback('Stop Tracking 🛑', `stop_url_${itemIndex}`)]])
            ).catch(() => {});
        }

    } catch (err) {
        console.log(`⚠️ Browser Engine Error: ${err.message}`);
    } finally {
        if (browser) await browser.close();
    }
}

bot.launch().then(() => console.log("Instamart Browser Automation Engine Active..."));
