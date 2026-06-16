const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = '8501862664:AAGI3rJVaW4c9Baud3hXs7WO2Ryi0wuxfjA'; 
const ADMIN_CHAT_ID = '7485181331'; 
const CHECK_INTERVAL = 15000; // Har 15 Seconds me stock refresh hoga
const RENDER_URL = 'https://instamart-tracker-bot.onrender.com/'; // Live URL configured!

// 📍 FIXED LOCATION: SONU SAGAR DAIRY LOCKED INTERNAL COORDINATES
const FIXED_LAT = '28.708143';  
const FIXED_LNG = '77.305382';  
// ---------------------

const bot = new Telegraf(BOT_TOKEN);
const activeUsers = {};

global.instamartApprovedList = global.instamartApprovedList || [ADMIN_CHAT_ID.toString()];

// --- EXPRESS SERVER FOR PORT BINDING ---
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.status(200).send('Instamart Official API Engine Online!'));
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Instamart Port Binding Successful on ${PORT}`));

// 🔥 NON-STOP JHATKA SYSTEM (SERVER KO ALIVE RAKHNE KE LIYE)
setInterval(() => {
    axios.get(RENDER_URL).catch(() => {}); 
}, 30000); // Strict 30 Seconds Self-Ping Loop

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
        return ctx.answerCbQuery("⚠️ Already stopped.").catch(() => {});
    }

    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) return ctx.answerCbQuery("❌ Unauthorized!").catch(() => {});
    const targetUserId = data.split('_')[1];
    
    if (data.startsWith('approve_')) {
        if (!global.instamartApprovedList.includes(targetUserId.toString())) {
            global.instamartApprovedList.push(targetUserId.toString());
        }
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ **Status: Approved!**`).catch(() => {});
        bot.telegram.sendMessage(targetUserId, "🥳 Approved! Use: `/start_track <Instamart_URL>`").catch(() => {});
    } else if (data.startsWith('decline_')) {
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ **Status: Declined!**`).catch(() => {});
    }
    await ctx.answerCbQuery().catch(() => {});
});

bot.start((ctx) => {
    const userId = ctx.from.id.toString();
    if (global.instamartApprovedList.includes(userId)) {
        return ctx.reply("🤖 Instamart API Tracker Bot Active!\n\n🔹 **Format:**\n`/start_track <Instamart_URL>`\n\n🔹 `/list_track`\n🔹 `/stop_all`");
    }
    ctx.reply(`🔒 **Access Denied!** ID: \`${userId}\``);
});

bot.command('approve', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) return ctx.reply("❌ Admin Only!");
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    if (args.length < 2) return ctx.reply("⚠️ Format: `/approve <User_ID>`");
    const targetUserId = args[1].trim();
    if (!global.instamartApprovedList.includes(targetUserId)) {
        global.instamartApprovedList.push(targetUserId);
        ctx.reply(`✅ User ID \`${targetUserId}\` approved successfully.`);
        bot.telegram.sendMessage(targetUserId, "🥳 Approved! Use: `/start_track <Instamart_URL>`").catch(() => {});
    }
});

bot.command('start_track', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!global.instamartApprovedList.includes(userId)) return ctx.reply("❌ Unapproved!");
    
    const chatId = ctx.chat.id.toString();
    const args = ctx.message.text.replace(/\n/g, ' ').split(' ').filter(arg => arg.trim() !== '');
    
    let instamartLink = args.find(arg => arg.includes('swiggy.com/instamart') || arg.includes('swiggy.com/stores/instamart') || arg.includes('item/'));
    if (!instamartLink) return ctx.reply("❌ Valid Swiggy Instamart link bhejo!");
    
    // Automatic Product ID Filter Engine
    let itemId = "";
    try {
        const parts = instamartLink.split('?')[0].split('/');
        itemId = parts[parts.length - 1];
        if (!itemId || itemId.length < 4) {
            const match = instamartLink.match(/item\/([A-Z0-9]+)/i);
            if (match) itemId = match[1];
        }
    } catch (e) { itemId = ""; }

    if (!itemId) return ctx.reply("❌ Link me se Product ID nahi mil payi! Sahi website link copy karke bhejo.");
    
    if (!activeUsers[chatId]) activeUsers[chatId] = [];
    if (activeUsers[chatId].some(item => item.id === itemId)) return ctx.reply("⚠️ Yeh item pehle se track ho raha hai!");
    
    const intervalId = setInterval(() => { checkInstamartAPI(ctx, chatId, itemId, instamartLink); }, CHECK_INTERVAL);
    activeUsers[chatId].push({ id: itemId, url: instamartLink, interval: intervalId });
    
    ctx.reply(`🚀 **API Hyperlocal Tracking Active!**\n🆔 Product ID Locked: \`${itemId}\`\n📍 Location Fixed: *Sonu Sagar Dairy*\nDatabase checking live...`);
    checkInstamartAPI(ctx, chatId, itemId, instamartLink);
});

bot.command('list_track', (ctx) => {
    const userId = ctx.from.id.toString();
    if (!global.instamartApprovedList.includes(userId)) return ctx.reply("❌ Unapproved!");
    const chatId = ctx.chat.id.toString();
    if (!activeUsers[chatId] || activeUsers[chatId].length === 0) return ctx.reply("😴 Koyi active tracking nahi hai.");
    let msg = "📋 **Active Tracking Links:**\n\n";
    activeUsers[chatId].forEach((item, i) => { msg += `${i + 1}. \`${item.id}\` -> ${item.url}\n\n`; });
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

async function checkInstamartAPI(ctx, chatId, itemId, originalUrl) {
    if (!activeUsers[chatId]) return;
    const itemIndex = activeUsers[chatId].findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;

    // 🔥 BACKEND DATABASE HIT WITH FIXED COORDINATES
    const apiTargetUrl = `https://www.swiggy.com/api/instamart/item/${itemId}?lat=${FIXED_LAT}&lng=${FIXED_LNG}`;

    try {
        const response = await axios.get(apiTargetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/605.1.15',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            timeout: 8000
        });

        if (response.data && response.data.data) {
            const itemData = response.data.data;
            
            // Exact Price Scraper Block
            let price = "N/A";
            if (itemData.price) {
                price = `₹${itemData.price / 100 || itemData.price}`;
            } else if (itemData.variations && itemData.variations[0] && itemData.variations[0].price) {
                let rawPrice = itemData.variations[0].price;
                price = `₹${rawPrice > 500 ? rawPrice / 100 : rawPrice}`;
            }

            // Real Inventory Validation Block
            let inStock = false;
            
            if (itemData.inventory !== undefined && itemData.inventory > 0) {
                inStock = true;
            } else if (itemData.in_stock === true || itemData.is_available === true) {
                inStock = true;
            } else if (itemData.variations && itemData.variations[0] && itemData.variations[0].inventory > 0) {
                inStock = true;
            }

            // Explicit Hard Out-of-stock validation check
            if (itemData.out_of_stock === true || itemData.is_out_of_stock === true) {
                inStock = false;
            }

            // FINAL DISPATCH TRIGGER
            if (inStock) {
                await bot.telegram.sendMessage(chatId, `🚨 INSTAMART API STOCK ALERT 🚨\n\n🔥 bhai *Sonu Sagar Dairy* wale area pr item wapas aa gaya hai! 🔥\n\n📦 **Product ID:** \`${itemId}\`\n💰 **Price:** ${price}\n\nLink:\n${originalUrl}`,
                    Markup.inlineKeyboard([[Markup.button.callback('Stop Tracking 🛑', `stop_url_${itemIndex}`)]])
                ).catch(() => {});
            }
        }
    } catch (e) {
        // Silent catch for network jitter protection
    }
}

bot.launch().then(() => console.log("Instamart Direct API Tracker Live..."));
