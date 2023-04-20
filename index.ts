import {
  Client,
  GuildMemberRoleManager,
  Intents,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
  Permissions,
} from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import dotenv from "dotenv";
import fs from "fs";
import { ec } from "starknet";
import { sign } from "starknet/dist/utils/ellipticCurve";
import mysql from "mysql2/promise";

dotenv.config();

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});
client.login(process.env.BOT_TOKEN);

fs.readdir("./events/", (error, f) => {
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

type Wallets = {
  [key: string]: string;
};

let wallets: Wallets = {};

const commands: any = [
  /*{
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
  },*/
];

const rest = new REST({ version: "9" }).setToken(
  process.env.BOT_TOKEN as string
);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID as string),
      {
        body: commands,
      }
    );

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();

client.on("interactionCreate", async (interaction) => {
  const userId = interaction.user.id;
  if (interaction.isCommand()) {
    if (interaction.commandName === "claim") {
      // Check if the user has the role
      if (
        !(interaction.member?.roles as GuildMemberRoleManager).cache.has(
          process.env.OG_ROLE_ID as string
        )
      )
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
          content:
            "❌ Invalid wallet address. Please provide a starknet wallet address",
          ephemeral: true,
        });
      wallets[userId] = wallet as string;
      const embed = new MessageEmbed().setTitle("Claim your OG domain")
        .setDescription(`Your wallet address is: ${wallet}
  After clicking __continue anyway__, you won't be able to change your wallet address. Are you sure you want to continue? Check you provided a valid **mainnet** wallet address. Please click __CHECK ADDRESS__ to check if you provided a valid deployed address.`);
      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setLabel("CHECK ADDRESS")
          .setStyle("LINK")
          .setURL(`https://starkscan.co/contract/${wallet}`),
        new MessageButton()
          .setCustomId("yes")
          .setLabel("continue anyway")
          .setStyle("DANGER"),
        new MessageButton()
          .setCustomId("no")
          .setLabel("cancel")
          .setStyle("SECONDARY")
      );
      interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
      });
    } else if (interaction.commandName === "remove") {
      if (
        !(interaction.member?.permissions as any).has(
          Permissions.FLAGS.ADMINISTRATOR
        )
      )
        return interaction.reply({
          content: "❌ You do not have the permission to use this command",
          ephemeral: true,
        });
      const user = interaction.options.getUser("user");
      if (!user) return interaction.reply({ content: "❌ No user provided" });
      const db = await mysql.createConnection({
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
  } else {
    if (interaction.isButton()) {
      switch (interaction.customId) {
        case "yes":
          const wallet = wallets[userId];
          const starkKeyPair = ec.getKeyPair(process.env.SIGNER_PRIVATE_KEY);
          try {
            const db = await mysql.createConnection({
              host: process.env.DB_HOST,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              database: process.env.DB_NAME,
            });
            await db.connect();
            const [rows] = await db.query(
              "SELECT * FROM `users` WHERE `user_id` = ?",
              [userId]
            );
            const message = wallet.toString();
            const signature = sign(starkKeyPair, message);
            const [row] = rows as any;
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
            } else {
              await db.query(
                "INSERT INTO `users` (`user_id`, `wallet`) VALUES (?, ?)",
                [userId, wallet]
              );
            }
            db.end();
            const embed = new MessageEmbed().setTitle("Claim your OG domain");
            const rowComponent = new MessageActionRow().addComponents(
              new MessageButton()
                .setLabel("Claim")
                .setStyle("LINK")
                .setURL(
                  `${
                    process.env.WEBSITE_URL as string
                  }?signature=${signature}&wallet=${wallet}`
                )
            );
            interaction.update({
              embeds: [embed],
              components: [rowComponent],
            });
          } catch (error) {
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
          } catch {}
          break;
      }
    }
  }
});
