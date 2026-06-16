const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = '8501862664:AAGI3rJVaW4c9Baud3hXs7WO2Ryi0wuxfjA'; 
const ADMIN_CHAT_ID = '7485181331'; 
const CHECK_INTERVAL = 15000; // Har 15 Seconds me Stock Check hoga
const RENDER_URL = 'https://instamart-stock-bot.onrender.com/'; // ⚠️ Note: Render par deploy ke baad jo link mile, wo yahan badal dena bhai!

// 📍 LOCKED HYPERLOCAL LOCATION COORDINATES
const FIXED_LAT = '28.708';  
const FIXED_LNG = '77.305';  
// ---------------------

const bot = new Telegraf(BOT_TOKEN);
const activeUsers = {};

global.instamartApprovedList = global.instamartApprovedList || [ADMIN_CHAT_ID.toString()];

const USER_AGENTS = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/605.1.15',
    'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
];

// --- EXPRESS SERVER FOR PORT BINDING ---
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.status(200).send('Instamart Locked Hyperlocal Engine Online!'));
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Instamart Port Binding Successful on ${PORT}`));

// 🔥 NON-STOP JHATKA SYSTEM (SERVER KO SOYNE NAHI DEGA, LOGS EKDOM CLEAN)
setInterval(() => {
    axios.get(RENDER_URL).catch(() => {}); 
}, 30000); // Strict 30 Seconds Loop!

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id.toString();
    
    if (data.startsWith('stop_url_')) {
        const index = parseInt(data.split('_')[2]);
        const chatId = ctx.chat.id.toString();
        
        if (activeUsers[chatId] && activeUsers[chatId][index]) {
            const removedItem = activeUsers[chatId][index];
            clearInterval(removedItem.interval);
            activeUsers[chatId].splice(index, 1);
            await ctx.answerCbQuery("Tracking band kar di gayi hai! 🛑").catch(() => {});
            return ctx.reply(`🛑 Tracking stopped for:\n${removedItem.url}`, { disable_web_page_preview: true });
        } else {
            return ctx.answerCbQuery("⚠️ Already stopped.").catch(() => {});
        }
    }

    if (userId !== ADMIN_CHAT_ID.toString()) return ctx.answerCbQuery("Unauthorized!").catch(() => {});
    const targetUserId = data.split('_')[1];
    
    if (data.startsWith('approve_')) {
        if (!global.instamartApprovedList.includes(targetUserId.toString())) {
            global.instamartApprovedList.push(targetUserId.toString());
        }
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ **Status: Approved!**`).catch(() => {});
        bot.telegram.sendMessage(targetUserId, "🥳 Approved! Use: `/start_track <Instamart_URL>`");
    } else if (data.startsWith('decline_')) {
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ **Status: Declined!**`).catch(() => {});
    }
    await ctx.answerCbQuery().catch(() => {});
});

bot.start((ctx) => {
    const userId = ctx.from.id.toString();
    const name = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'No Name';
    
    if (global.instamartApprovedList.includes(userId)) {
        return ctx.reply("🤖 Instamart Tracker Bot Active!\n\n🔹 **Format:**\n`/start_track <Instamart_URL>`\n\n🔹 `/list_track`\n🔹 `/stop_all`");
    }
    
    ctx.reply(`🔒 **Access Denied!**\n\nAap abhi approved nahi hain.\nAapki Telegram ID: \`${userId}\`\n\nAdmin ko apni ID send karein approval ke liye.`);
    
    bot.telegram.sendMessage(ADMIN_CHAT_ID, 
        `🚨 **New Instamart Bot Request!**\n\n👤 Name: ${name}\n🆔 ID: \`${userId}\`\n\n👉 Approve manually:\n\`/approve ${userId}\``,
        Markup.inlineKeyboard([[Markup.button.callback('Approve ✅', `approve_${userId}`), Markup.button.callback('Decline ❌', `decline_${userId}`)]])
    ).catch(() => {});
});

bot.command('approve', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) return ctx.reply("❌ Admin Only!");
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    if (args.length < 2) return ctx.reply("⚠️ Format: `/approve <User_ID>`");
    const targetUserId = args[1].trim();
    if (!global.instamartApprovedList.includes(targetUserId)) {
        global.instamartApprovedList.push(targetUserId);
        ctx.reply(`✅ User ID \`${targetUserId}\` approved.`);
        bot.telegram.sendMessage(targetUserId, "🥳 Approved! Use: `/start_track <Instamart_URL>`");
    }
});

bot.command('list_users', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) return ctx.reply("❌ Admin Only!");
    if (global.instamartApprovedList.length <= 1) return ctx.reply("👥 Koyi approved user nahi hai.");
    let msg = "👥 **Approved Users:**\n\n";
    global.instamartApprovedList.forEach((userId, i) => { if (userId !== ADMIN_CHAT_ID) msg += `${i}. \`${userId}\`\n`; });
    ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('remove_user', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) return ctx.reply("❌ Admin Only!");
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    if (args.length < 2) return ctx.reply("⚠️ Format: `/remove_user <User_ID>`");
    const targetUserId = args[1].trim();
    const index = global.instamartApprovedList.indexOf(targetUserId);
    if (index > -1) {
        global.instamartApprovedList.splice(index, 1);
        if (activeUsers[targetUserId]) {
            activeUsers[targetUserId].forEach(item => clearInterval(item.interval));
            delete activeUsers[targetUserId];
        }
        ctx.reply(`✅ User ID ${targetUserId} removed.`);
    }
});

bot.command('start_track', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!global.instamartApprovedList.includes(userId)) return ctx.reply("❌ Unapproved!");
    
    const chatId = ctx.chat.id.toString();
    const args = ctx.message.text.replace(/\n/g, ' ').split(' ').filter(arg => arg.trim() !== '');
    
    const instamartLink = args.find(arg => arg.includes('swiggy.com/instamart'));
    if (!instamartLink) return ctx.reply("❌ Valid Swiggy Instamart link bhejo!");
    
    if (!activeUsers[chatId]) activeUsers[chatId] = [];
    if (activeUsers[chatId].some(item => item.url === instamartLink)) return ctx.reply("⚠️ Pehle se track ho raha hai!");
    
    // Auto-inject locked lat/lng into tracking engine
    const intervalId = setInterval(() => { checkInstamartStock(ctx, chatId, instamartLink, FIXED_LAT, FIXED_LNG); }, CHECK_INTERVAL);
    activeUsers[chatId].push({ url: instamartLink, interval: intervalId });
    
    ctx.reply(`🚀 **Hyperlocal Tracking Active!**\n📍 Location Fixed Internally: \`${FIXED_LAT}, ${FIXED_LNG}\`\nStock check shuru ho gaya hai...`);
    checkInstamartStock(ctx, chatId, instamartLink, FIXED_LAT, FIXED_LNG);
});

bot.command('list_track', (ctx) => {
    const userId = ctx.from.id.toString();
    if (!global.instamartApprovedList.includes(userId)) return ctx.reply("❌ Unapproved!");
    const chatId = ctx.chat.id.toString();
    if (!activeUsers[chatId] || activeUsers[chatId].length === 0) return ctx.reply("😴 Koyi active tracking nahi hai.");
    let msg = "📋 **Active Tracking Links:**\n\n";
    activeUsers[chatId].forEach((item, i) => { msg += `${i + 1}. ${item.url}\n\n`; });
    ctx.reply(msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
});

bot.command('stop_all', (ctx) => {
    const userId = ctx.from.id.toString();
    if (!global.instamartApprovedList.includes(userId)) return ctx.reply("❌ Unapproved!");
    const chatId = ctx.chat.id.toString();
    if (activeUsers[chatId] && activeUsers[chatId].length > 0) {
        activeUsers[chatId].forEach(item => clearInterval(item.interval));
        delete activeUsers[chatId];
        ctx.reply("🛑 Saari tracking band kar di gayi.");
    } else { ctx.reply("⚠️ Koyi active tracking nahi mili."); }
});

async function checkInstamartStock(ctx, chatId, targetUrl, lat, lng) {
    if (!activeUsers[chatId]) return;
    const itemIndex = activeUsers[chatId].findIndex(item => item.url === targetUrl);
    if (itemIndex === -1) return;

    const randomAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    try {
        const response = await axios.get(targetUrl, { 
            headers: { 
                'User-Agent': randomAgent, 
                'Accept-Language': 'en-US,en;q=0.9',
                // 🔥 SPREADING COOKIES FOR HYPERLOCAL LOCATION
                'Cookie': `_lat=${lat}; _lng=${lng}; locationAddress=Locked_Area;`
            }, 
            timeout: 10000 
        });
        
        const $ = cheerio.load(response.data);
        const pageText = $('body').text().toLowerCase();
        
        const isOutOfStock = pageText.includes('out of stock') || 
                             pageText.includes('item unavailable') || 
                             pageText.includes('not deliverable') ||
                             pageText.includes('currently unavailable');
                             
        const isAvailable = pageText.includes('add') || pageText.includes('add to cart') || pageText.includes('in stock');
        
        if (!isOutOfStock && isAvailable) {
            await bot.telegram.sendMessage(chatId, `🚨 INSTAMART STOCK ALERT 🚨\n\n🔥 bhai aapki locked location pr item wapas aa gaya hai! 🔥\n\nLink:\n${targetUrl}`,
                Markup.inlineKeyboard([[Markup.button.callback('Stop Tracking 🛑', `stop_url_${itemIndex}`)]])
            ).catch(() => {});
        }
    } catch (e) {
        // Silent block protection
    }
}

bot.launch().then(() => console.log("Instamart Fixed Location Bot Live..."));
