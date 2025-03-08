require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');

const API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_URL = process.env.YOUTUBE_URL;

const jsonFilePath = 'idYoutube.json';

const rawData = fs.readFileSync(jsonFilePath);
const { usernames } = JSON.parse(rawData);

async function getYoutubeId(channelHandle) {
    try {
        const channelUrl = `${YOUTUBE_URL}/channels?part=id&forHandle=${channelHandle}&key=${API_KEY}`;
        const channelResponse = await axios.get(channelUrl);

        if (channelResponse.data.items && channelResponse.data.items.length > 0) {
            return channelResponse.data.items[0].id; // Extract Channel ID
        } else {
            console.warn(`No data found for @${channelHandle}`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching channel @${channelHandle}:`, error.message);
        return null;
    }
}

// Fetch all YouTube Channel IDs and log in JSON format
(async () => {
    const channelIds = [];

    for (const username of usernames) {
        const channelId = await getYoutubeId(username);
        if (channelId) {
            channelIds.push(channelId);
        }
    }

    console.log(JSON.stringify(channelIds, null, 2)); // Pretty print JSON output
})();