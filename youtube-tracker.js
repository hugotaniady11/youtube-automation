require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const moment = require("moment-timezone");

const API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_URL = process.env.YOUTUBE_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
// const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const DATA_FILE = "last_videos.json";
const CHANNELS_FILE = "channels.json";

// Load channels from JSON file
function loadChannels() {
    if (fs.existsSync(CHANNELS_FILE)) {
        return JSON.parse(fs.readFileSync(CHANNELS_FILE)).channels;
    }
    console.error("❌ Error: channels.json not found!");
    return [];
}

const CHANNELS = loadChannels(); // Get channels from JSON

// Load last video IDs from file
function loadLastVideos() {
    if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE));
    }
    return {};
}

// Save last video IDs to file
function saveLastVideos(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get latest video from a YouTube channel
async function getLatestVideo(channelId) {
    try {
        let channelUrl = `${YOUTUBE_URL}/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`;
        let channelResponse = await axios.get(channelUrl);
        let playlistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;

        let videosUrl = `${YOUTUBE_URL}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=1&key=${API_KEY}`;
        let videosResponse = await axios.get(videosUrl);
        let video = videosResponse.data.items[0];

        return {
            title: video.snippet.title,
            videoId: video.snippet.resourceId.videoId,
            url: `https://www.youtube.com/watch?v=${video.snippet.resourceId.videoId}`,
            publishedAt: video.snippet.publishedAt
        };
    } catch (error) {
        console.error(`Error fetching channel ${channelId}:`, error.message);
        return null;
    }
}

async function sendTelegramNotification(video) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error("❌ Telegram credentials not set in .env!");
        return;
    }

    const message = `🎬 *New Video Uploaded!*\n📌 *${video.title}*\n🔗 [Watch Now](${video.url})`;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        let response = await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: "Markdown"
        });
        console.log(`✅ Telegram notification sent: ${video.title}`);
    } catch (error) {
        console.error("❌ Error sending Telegram notification:", error.message);
    }
}

// Function to send a generic message to Telegram
async function sendTelegramMessage(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error("❌ Telegram credentials not set in .env!");
        return;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        let response = await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: "Markdown"
        });
        // console.log(`✅ Telegram status message sent.`);
    } catch (error) {
        console.error("❌ Error sending Telegram message:", error.message);
    }
}

// Check for new videos
async function checkNewVideos() {
    let lastVideos = loadLastVideos();

    // Get current time in UTC
    let now = moment().utc();
    let tenMinutesAgo = now.clone().subtract(10, "minutes");

    for (let channelId of CHANNELS) {
        let latestVideo = await getLatestVideo(channelId);
        if (!latestVideo) continue;

        let publishedAt = moment(latestVideo.publishedAt).utc();

        // Check if the video was published in the last 10 minutes
        if (publishedAt.isBetween(tenMinutesAgo, now, null, "[)")) {
            console.log(`🎬 New Video: ${latestVideo.title} - ${latestVideo.url} (Published at: ${publishedAt.format()})`);

            // Send message to Telegram Group
            await sendTelegramNotification(latestVideo);

            // Update last video data
            lastVideos[channelId] = latestVideo.videoId;
        } else {
            // console.log(`🔕 Skipping video: ${latestVideo.title} (Published at: ${publishedAt.format()})`);
        }
    }

    saveLastVideos(lastVideos);
    console.log(`✅ YouTube tracker finished checking. ${moment().format('DD-MM-YYYY hh:mm:ss')}`);
    await sendTelegramMessage(`✅ YouTube tracker finished checking.\n------------------------------ ${moment().format('DD-MM-YYYY hh:mm:ss')}`);
}

// Run every 10 minutes and also run immediately once at startup
cron.schedule('*/10 * * * *', async () => {
    console.log("⏳ Running YouTube tracker cron job...");
    await checkNewVideos();
});

// Run once immediately at startup without duplicate execution
console.log("🚀 YouTube Tracker Started...");
checkNewVideos();

