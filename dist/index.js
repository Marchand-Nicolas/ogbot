"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_js_1 = require("discord.js");
const rest_1 = require("@discordjs/rest");
const v9_1 = require("discord-api-types/v9");
const dotenv_1 = tslib_1.__importDefault(require("dotenv"));
const fs_1 = tslib_1.__importDefault(require("fs"));
const starknet_1 = require("starknet");
const ellipticCurve_1 = require("starknet/dist/utils/ellipticCurve");
const promise_1 = tslib_1.__importDefault(require("mysql2/promise"));
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
const commands = [
    {
        name: "claim",
        description: "Claim your OG domain.",
        options: [
            {
                name: "mainnet-wallet-address",
                description: "your mainnet wallet address",
                type: 3,
                required: true,
            },
        ],
    },
    {
        name: "remove",
        description: "Admin only.",
        options: [
            {
                name: "user",
                description: "user to remove from the blacklist",
                type: 6,
                required: true,
            },
        ],
    },
];
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
client.on("interactionCreate", async (interaction) => {
    const userId = interaction.user.id;
    if (interaction.isCommand()) {
        if (interaction.commandName === "claim") {
            if (!(interaction.member?.roles).cache.has(process.env.OG_ROLE_ID))
                return interaction.reply({
                    content: "❌ You do not have the OG role",
                    ephemeral: true,
                });
            const wallet = interaction.options.getString("mainnet-wallet-address");
            if (!wallet)
                return interaction.reply({
                    content: "❌ No wallet provided",
                    ephemeral: true,
                });
            if (wallet.length <= 42)
                return interaction.reply({
                    content: "❌ Invalid wallet address. Please provide a starknet wallet address",
                    ephemeral: true,
                });
            wallets[userId] = wallet;
            const embed = new discord_js_1.MessageEmbed().setTitle("Claim your OG domain")
                .setDescription(`Your wallet address is: ${wallet}
  After clicking __continue anyway__, you won't be able to change your wallet address. Are you sure you want to continue? Check you provided a valid **mainnet** wallet address. Please click __CHECK ACCOUNT__ to check if you provided a valid deployed account.`);
            const row = new discord_js_1.MessageActionRow().addComponents(new discord_js_1.MessageButton()
                .setLabel("CHECK ACCOUNT")
                .setStyle("LINK")
                .setURL(`https://starkscan.co/contract/${wallet}`), new discord_js_1.MessageButton()
                .setCustomId("yes")
                .setLabel("continue anyway")
                .setStyle("DANGER"), new discord_js_1.MessageButton()
                .setCustomId("no")
                .setLabel("cancel")
                .setStyle("SECONDARY"));
            interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true,
            });
        }
        else if (interaction.commandName === "remove") {
            if (!(interaction.member?.permissions).has(discord_js_1.Permissions.FLAGS.ADMINISTRATOR))
                return interaction.reply({
                    content: "❌ You do not have the permission to use this command",
                    ephemeral: true,
                });
            const user = interaction.options.getUser("user");
            if (!user)
                return interaction.reply({ content: "❌ No user provided" });
            const db = await promise_1.default.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
            });
            await db.connect();
            await db.query("DELETE FROM `users` WHERE `user_id` = ?", [user.id]);
            db.end();
            interaction.reply({
                content: "✅ User removed from the blacklist",
                ephemeral: true,
            });
        }
    }
    else {
        if (interaction.isButton()) {
            switch (interaction.customId) {
                case "yes":
                    const wallet = wallets[userId];
                    const starkKeyPair = starknet_1.ec.getKeyPair(process.env.SIGNER_PRIVATE_KEY);
                    try {
                        const db = await promise_1.default.createConnection({
                            host: process.env.DB_HOST,
                            user: process.env.DB_USER,
                            password: process.env.DB_PASSWORD,
                            database: process.env.DB_NAME,
                        });
                        await db.connect();
                        const [rows] = await db.query("SELECT * FROM `users` WHERE `user_id` = ?", [userId]);
                        const message = wallet.toString();
                        const signature = (0, ellipticCurve_1.sign)(starkKeyPair, message);
                        const [row] = rows;
                        if (row) {
                            if (row.wallet !== wallet) {
                                db.end();
                                interaction.update({
                                    content: `❌ You already claimed your OG domain, for the following address : ${row.wallet}`,
                                    embeds: [],
                                    components: [],
                                });
                                return;
                            }
                        }
                        else {
                            await db.query("INSERT INTO `users` (`user_id`, `wallet`) VALUES (?, ?)", [userId, wallet]);
                        }
                        db.end();
                        const embed = new discord_js_1.MessageEmbed().setTitle("Claim your OG domain");
                        const rowComponent = new discord_js_1.MessageActionRow().addComponents(new discord_js_1.MessageButton()
                            .setLabel("Claim")
                            .setStyle("LINK")
                            .setURL(`${process.env.WEBSITE_URL}?signature=${signature}&wallet=${wallet}`));
                        interaction.update({
                            embeds: [embed],
                            components: [rowComponent],
                        });
                    }
                    catch (error) {
                        interaction.update({
                            content: "❌ This is not a wallet address.",
                            embeds: [],
                            components: [],
                        });
                    }
                    break;
                case "no":
                    try {
                        interaction.update({
                            content: "❌ Cancelled.",
                            embeds: [],
                            components: [],
                        });
                    }
                    catch { }
                    break;
            }
        }
    }
});
