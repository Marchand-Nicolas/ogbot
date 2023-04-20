"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_js_1 = require("discord.js");
const rest_1 = require("@discordjs/rest");
const v9_1 = require("discord-api-types/v9");
const dotenv_1 = tslib_1.__importDefault(require("dotenv"));
const fs_1 = tslib_1.__importDefault(require("fs"));
dotenv_1.default.config();
const client = new discord_js_1.Client({
    intents: [discord_js_1.Intents.FLAGS.GUILDS, discord_js_1.Intents.FLAGS.GUILD_MESSAGES],
});
client.login(process.env.BOT_TOKEN);
fs_1.default.readdir("./events/", (error, f) => {
    if (error) {
        return console.error(error);
    }
    console.log(`${f.length} events chargés`);
    f.forEach((f) => {
        let events = require(`./events/${f}`);
        let event = f.split(".")[0];
        client.on(event, events.bind(null, client));
    });
});
let wallets = {};
const commands = [];
const rest = new rest_1.REST({ version: "9" }).setToken(process.env.BOT_TOKEN);
(async () => {
    try {
        console.log("Started refreshing application (/) commands.");
        await rest.put(v9_1.Routes.applicationCommands(process.env.CLIENT_ID), {
            body: commands,
        });
        console.log("Successfully reloaded application (/) commands.");
    }
    catch (error) {
        console.error(error);
    }
})();
