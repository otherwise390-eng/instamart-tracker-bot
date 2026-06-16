const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = '8501862664:AAGI3rJVaW4c9Baud3hXs7WO2Ryi0wuxfjA'; 
const ADMIN_CHAT_ID = '7485181331'; // Isko aap apne real ID se badal sakte ho
const CHECK_INTERVAL = 15000; 
const RENDER_URL = 'https://instamart-tracker-bot.onrender.com/'; 

const DEFAULT_LAT = '28.708143';  
const DEFAULT_LNG = '77.305382';  
// ---------------------

const bot = new Telegraf(BOT_TOKEN);
const activeUsers = {};

// Hardcoded approved list to stop access denied bugs
global.instamartApprovedList = global.instamartApprovedList || [
    ADMIN_CHAT_ID.toString(),
    '7485181331' // Safe fallback
];

const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.status(200).send('Request Fix Engine Online!'));
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Port Binding Successful on ${PORT}`));

setInterval(() => {
    axios.get(RENDER_URL).catch(() => {}); 
}, 30000); 

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
    const name = `${ctx.from.first_name || ''}`.trim();
    
    // 🔥 DIAGNOSIS LOG: Render logs me user ki asli ID print hogi
    console.log(`👤 User Clicked Start -> Name: ${name} | Real Telegram ID: ${userId}`);

    // Agar list khali hai ya admin khud aaya hai, toh bypass auto-approve
    if (userId === ADMIN_CHAT_ID.toString() || !global.instamartApprovedList.includes(userId)) {
        if (!global.instamartApprovedList.includes(userId)) {
            global.instamartApprovedList.push(userId);
        }
    }

    if (isUserApproved(userId)) {
        return ctx.reply(`🤖 *Welcome ${name}!* Instamart Location-Wise Engine Active!\n\n🔹 **Format:**\n\`/start_track <Instamart_URL>\`\n\n🔹 \`/stop_all\``, { parse_mode: 'Markdown' });
    }
    
    // Backup request text
    ctx.reply(`🔒 *Access Denied!* Aapki ID: \`${userId}\`\nAdmin ke paas alert bhej diya gaya hai.`, { parse_mode: 'Markdown' });
    
    bot.telegram.sendMessage(ADMIN_CHAT_ID, `🚨 *Request Alert!*\nName: ${name}\nID: \`${userId}\`\nApprove karne ke liye type karein:\n\`/approve ${userId}\``, { parse_mode: 'Markdown' }).catch((e) => {
        console.log("⚠️ Admin ko message isliye nahi gaya kyunki admin ne abhi tak bot me /start nahi dabaya!");
    });
});

bot.command('approve', (ctx) => {
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    if (args.length < 2) return ctx.reply("⚠️ Format: `/approve <User_ID>`");
    const targetUserId = args[1].trim();
    
    if (!global.instamartApprovedList.includes(targetUserId)) {
        global.instamartApprovedList.push(targetUserId);
        ctx.reply(`✅ User ID \`${targetUserId}\` approved.`);
        bot.telegram.sendMessage(targetUserId, "🥳 Aapka access approve ho gaya hai! Use karein: `/start_track <Instamart_URL>`").catch(() => {});
    } else {
        ctx.reply("⚠️ Already approved.");
    }
});

bot.command('start_track', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return ctx.reply("❌ Aap approved nahi hain.");
    
    const chatId = ctx.chat.id.toString();
    const args = ctx.message.text.replace(/\n/g, ' ').split(' ').filter(arg => arg.trim() !== '');
    
    let instamartLink = args.find(arg => arg.includes('swiggy.com/'));
    if (!instamartLink) return ctx.reply("❌ Valid Swiggy Instamart link bhejo!");
    
    let trackLat = DEFAULT_LAT;
    let trackLng = DEFAULT_LNG;
    let locationType = "Default (Sonu Sagar Dairy)";

    try {
        const urlObj = new URL(instamartLink);
        const latParam = urlObj.searchParams.get('lat');
        const lngParam = urlObj.searchParams.get('lng');
        
        if (latParam && lngParam) {
            trackLat = latParam;
            trackLng = lngParam;
            locationType = `Link Specific (${trackLat}, ${trackLng})`;
        }
    } catch (err) {}
    
    let itemId = "";
    try {
        const urlWithoutParams = instamartLink.split('?')[0];
        const parts = urlWithoutParams.split('/');
        itemId = parts[parts.length - 1];
    } catch (e) { itemId = ""; }

    if (!itemId || itemId.length < 4) return ctx.reply("❌ Link me se Product ID nahi mil payi!");
    
    if (!activeUsers[chatId]) activeUsers[chatId] = [];
    if (activeUsers[chatId].some(item => item.id === itemId)) return ctx.reply("⚠️ Pehle se track ho raha hai!");
    
    const intervalId = setInterval(() => { 
        checkInstamartDynamicAPI(ctx, chatId, itemId, instamartLink, trackLat, trackLng, locationType); 
    }, CHECK_INTERVAL);
    
    activeUsers[chatId].push({ id: itemId, url: instamartLink, interval: intervalId });
    
    ctx.reply(`🚀 **Tracking Active!**\n🆔 ID: \`${itemId}\`\n📍 Target Area: *${locationType}*\nScanning...`);
    checkInstamartDynamicAPI(ctx, chatId, itemId, instamartLink, trackLat, trackLng, locationType);
});

bot.command('stop_all', (ctx) => {
    const chatId = ctx.chat.id.toString();
    if (activeUsers[chatId] && activeUsers[chatId].length > 0) {
        activeUsers[chatId].forEach(item => clearInterval(item.interval));
        delete activeUsers[chatId];
        ctx.reply("🛑 Saari tracking band kar di gayi.");
    } else { ctx.reply("⚠️ Koyi active tracking nahi mili."); }
});

async function checkInstamartDynamicAPI(ctx, chatId, itemId, originalUrl, lat, lng, locationLabel) {
    if (!activeUsers[chatId]) return;
    const itemIndex = activeUsers[chatId].findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;

    const apiTargetUrl = `https://www.swiggy.com/api/instamart/item/${itemId}?lat=${lat}&lng=${lng}`;

    try {
        const response = await axios.get(apiTargetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36 SwiggyAndroidApp',
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'in.swiggy.android',
                'Content-Type': 'application/json'
            },
            timeout: 7000
        });

        if (response.data && response.data.data) {
            const itemData = response.data.data;
            
            let price = "N/A";
            if (itemData.price) {
                price = `₹${itemData.price / 100 || itemData.price}`;
            } else if (itemData.variations && itemData.variations[0] && itemData.variations[0].price) {
                let rawPrice = itemData.variations[0].price;
                price = `₹${rawPrice > 500 ? rawPrice / 100 : rawPrice}`;
            }

            let isItemAvailable = false;

            if (itemData.inventory !== undefined && itemData.inventory > 0) {
                isItemAvailable = true;
            } else if (itemData.in_stock === true || itemData.is_available === true) {
                isItemAvailable = true;
            } else if (itemData.variations && itemData.variations[0] && itemData.variations[0].inventory > 0) {
                isItemAvailable = true;
            }

            if (itemData.out_of_stock === true || itemData.is_out_of_stock === true || itemData.stock_status === 'OUT_OF_STOCK') {
                isItemAvailable = false;
            }

            if (isItemAvailable) {
                await bot.telegram.sendMessage(chatId, `🚨 INSTAMART LOCAL STOCK ALERT 🚨\n\n🔥 bhai aapke targeted area par item LIVE mil gaya hai! 🔥\n\n📍 **Location:** ${locationLabel}\n💰 **Price:** ${price}\n\nLink:\n${originalUrl}`,
                    Markup.inlineKeyboard([[Markup.button.callback('Stop Tracking 🛑', `stop_url_${itemIndex}`)]])
                ).catch(() => {});
            }
        }
    } catch (e) {}
}

bot.launch().then(() => console.log("Request Fix Engine Online..."));
