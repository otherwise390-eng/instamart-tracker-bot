const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = '8501862664:AAGI3rJVaW4c9Baud3hXs7WO2Ryi0wuxfjA'; 
const ADMIN_CHAT_ID = '7485181331'; // Admin ID fixed
const CHECK_INTERVAL = 15000; 
const RENDER_URL = 'https://instamart-tracker-bot.onrender.com/'; 

// 📍 FIXED LOCATION: SONU SAGAR DAIRY LOCKED INTERNAL COORDINATES
const FIXED_LAT = '28.708143';  
const FIXED_LNG = '77.305382';  
// ---------------------

const bot = new Telegraf(BOT_TOKEN);
const activeUsers = {};

// Waterproof Global Approved List initialization
if (!global.instamartApprovedList) {
    global.instamartApprovedList = [ADMIN_CHAT_ID.toString()];
}

const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.status(200).send('Instamart Access Engine Fixed Live!'));
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Instamart Port Binding Successful on ${PORT}`));

// 🔥 NON-STOP JHATKA SYSTEM
setInterval(() => {
    axios.get(RENDER_URL).catch(() => {}); 
}, 30000); 

// Helper function to strictly check user approval status
function isUserApproved(userId) {
    if (!userId) return false;
    return global.instamartApprovedList.map(String).includes(userId.toString());
}

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.chat.id.toString();
    const clickerId = ctx.from.id.toString();
    
    if (data.startsWith('stop_url_')) {
        const index = parseInt(data.split('_')[2]);
        if (activeUsers[chatId] && activeUsers[chatId][index]) {
            const removedItem = activeUsers[chatId][index];
            clearInterval(removedItem.interval);
            activeUsers[chatId].splice(index, 1);
            await ctx.answerCbQuery("Tracking band kar di gayi hai! 🛑").catch(() => {});
            return ctx.reply(`🛑 Tracking stopped for:\n${removedItem.url}`, { disable_web_page_preview: true });
        }
        return ctx.answerCbQuery("⚠️ Already stopped.").catch(() => {});
    }

    // Strict validation for admin action buttons
    if (clickerId !== ADMIN_CHAT_ID.toString()) {
        return ctx.answerCbQuery("❌ Unauthorized! Sirf Admin click kar sakta hai.").catch(() => {});
    }
    
    const targetUserId = data.split('_')[1];
    
    if (data.startsWith('approve_')) {
        if (!global.instamartApprovedList.map(String).includes(targetUserId.toString())) {
            global.instamartApprovedList.push(targetUserId.toString());
        }
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ **Status: Approved!**`).catch(() => {});
        await bot.telegram.sendMessage(targetUserId, "🥳 Aapka access approve ho gaya hai! Use karein: `/start_track <Instamart_URL>`").catch(() => {});
    } else if (data.startsWith('decline_')) {
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ **Status: Declined!**`).catch(() => {});
    }
    await ctx.answerCbQuery().catch(() => {});
});

bot.start((ctx) => {
    const userId = ctx.from.id.toString();
    const name = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'No Name';
    
    if (isUserApproved(userId)) {
        return ctx.reply("🤖 Instamart Dual-Engine Tracker Bot Active!\n\n🔹 **Format:**\n`/start_track <Instamart_URL>`\n\n🔹 `/list_track`\n🔹 `/stop_all`");
    }
    
    ctx.reply(`🔒 **Access Denied!**\n\nAap abhi approved nahi hain.\nAapki Telegram ID: \`${userId}\`\n\nAdmin ke paas request bhej di gayi hai.`);
    
    // Send standard request with strict string values to Admin
    bot.telegram.sendMessage(ADMIN_CHAT_ID, 
        `🚨 **New Instamart Bot Request!**\n\n👤 Name: ${name}\n🆔 ID: \`${userId}\`\n\n👉 Approve karne ke liye niche click karein ya type karein:\n\`/approve ${userId}\``,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('Approve ✅', `approve_${userId}`), 
                    Markup.button.callback('Decline ❌', `decline_${userId}`)
                ]
            ])
        }
    ).catch(() => {});
});

bot.command('approve', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) return ctx.reply("❌ Sirf Admin hi approve kar sakta hai!");
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    if (args.length < 2) return ctx.reply("⚠️ Format: `/approve <User_ID>`");
    
    const targetUserId = args[1].trim();
    if (!global.instamartApprovedList.map(String).includes(targetUserId)) {
        global.instamartApprovedList.push(targetUserId);
        ctx.reply(`✅ User ID \`${targetUserId}\` ko access de diya gaya hai.`);
        bot.telegram.sendMessage(targetUserId, "🥳 Aapka access approve ho gaya hai! Use karein: `/start_track <Instamart_URL>`").catch(() => {});
    } else {
        ctx.reply("⚠️ Yeh user pehle se hi approved hai.");
    }
});

bot.command('start_track', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return ctx.reply("❌ Access Denied! Aap approved nahi hain.");
    
    const chatId = ctx.chat.id.toString();
    const args = ctx.message.text.replace(/\n/g, ' ').split(' ').filter(arg => arg.trim() !== '');
    
    let instamartLink = args.find(arg => arg.includes('swiggy.com/instamart') || arg.includes('swiggy.com/stores/instamart'));
    if (!instamartLink) return ctx.reply("❌ Valid Swiggy Instamart link bhejo!");
    
    let itemId = "";
    try {
        const parts = instamartLink.split('?')[0].split('/');
        itemId = parts[parts.length - 1];
    } catch (e) { itemId = ""; }

    if (!itemId || itemId.length < 4) return ctx.reply("❌ Link me se Product ID nahi mil payi!");
    
    if (!activeUsers[chatId]) activeUsers[chatId] = [];
    if (activeUsers[chatId].some(item => item.id === itemId)) return ctx.reply("⚠️ Pehle se track ho raha hai!");
    
    const intervalId = setInterval(() => { checkInstamartDualEngine(ctx, chatId, itemId, instamartLink); }, CHECK_INTERVAL);
    activeUsers[chatId].push({ id: itemId, url: instamartLink, interval: intervalId });
    
    ctx.reply(`🚀 **Dual-Engine Tracking Active!**\n🆔 ID: \`${itemId}\`\n📍 Location Fixed: *Sonu Sagar Dairy*\nScanning initiated...`);
    checkInstamartDualEngine(ctx, chatId, itemId, instamartLink);
});

bot.command('stop_all', (ctx) => {
    const chatId = ctx.chat.id.toString();
    if (activeUsers[chatId] && activeUsers[chatId].length > 0) {
        activeUsers[chatId].forEach(item => clearInterval(item.interval));
        delete activeUsers[chatId];
        ctx.reply("🛑 Saari tracking band kar di gayi.");
    } else { ctx.reply("⚠️ Koyi active tracking nahi mili."); }
});

async function checkInstamartDualEngine(ctx, chatId, itemId, originalUrl) {
    if (!activeUsers[chatId]) return;
    const itemIndex = activeUsers[chatId].findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;

    // --- ENGINE 1: DIRECT API METHOD ---
    const apiTargetUrl = `https://www.swiggy.com/api/instamart/item/${itemId}?lat=${FIXED_LAT}&lng=${FIXED_LNG}`;
    let engine1Success = false;

    try {
        const response = await axios.get(apiTargetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/605.1.15',
                'Accept': 'application/json'
            },
            timeout: 6000
        });

        if (response.data && response.data.data) {
            engine1Success = true;
            const itemData = response.data.data;
            
            let price = itemData.price ? `₹${itemData.price / 100 || itemData.price}` : "N/A";
            let outOfStockField = itemData.out_of_stock === true || itemData.is_out_of_stock === true;
            let hasInventory = itemData.inventory !== undefined ? itemData.inventory > 0 : true;

            if (!outOfStockField && hasInventory) {
                return triggerAlert(chatId, itemId, price, originalUrl, itemIndex);
            }
        }
    } catch (err) {
        console.log(`⚠️ Engine 1 (API) Failed: ${err.message}`);
    }

    // --- ENGINE 2: WEB HTML SCRAPING FALLBACK ---
    if (!engine1Success) {
        try {
            const webResponse = await axios.get(originalUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Cookie': `_lat=${FIXED_LAT}; _lng=${FIXED_LNG}; locationAddress=Sonu_Sagar_Dairy;`
                },
                timeout: 8000
            });

            const html = webResponse.data;
            const lowerHtml = html.toLowerCase();

            const isSoldOut = lowerHtml.includes('out of stock') || 
                              lowerHtml.includes('currently unavailable') || 
                              lowerHtml.includes('item unavailable') || 
                              lowerHtml.includes('soldout');

            const hasAddButton = lowerHtml.includes('add') || html.includes('ADD') || html.includes('Add');

            if (!isSoldOut && hasAddButton && !lowerHtml.includes('captcha')) {
                let priceMatch = html.match(/₹\s*\d+/);
                let price = priceMatch ? priceMatch[0] : "N/A";
                return triggerAlert(chatId, itemId, price, originalUrl, itemIndex);
            }
        } catch (webErr) {
            console.log(`⚠️ Engine 2 (Web) Failed: ${webErr.message}`);
        }
    }
}

async function triggerAlert(chatId, itemId, price, originalUrl, itemIndex) {
    await bot.telegram.sendMessage(chatId, `🚨 INSTAMART STOCK ALERT 🚨\n\n🔥 bhai *Sonu Sagar Dairy* wale area pr item Mil Gaya Hai! 🔥\n\n💰 **Price:** ${price}\n\nLink:\n${originalUrl}`,
        Markup.inlineKeyboard([[Markup.button.callback('Stop Tracking 🛑', `stop_url_${itemIndex}`)]])
    ).catch(() => {});
}

bot.launch().then(() => console.log("Instamart Access Strict Fixed Engine Live..."));
