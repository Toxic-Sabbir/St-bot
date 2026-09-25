
const { getPrefix } = global.utils;

module.exports = {
    config: {
        name: "activestatus",
        aliases: ["active", "onlinestatus"],
        version: "2.4.73",
        author: "Sabbir",
        countDown: 3,
        role: 2,
        description: "Set your active status on/off on Facebook",
        category: "ADMIN & BOT CONTROL",
        guide: {
            en: "{pn} on - Turn on active status\n{pn} off - Turn off active status\n{pn} status - Check current status"
        }
    },

    ST: async function ({ message, args, api, event }) {
        const action = args[0];

        if (!action) {
            return message.reply(`📱 Active Status Commands:\n\n• ${getPrefix(event.threadID)}activestatus on - Turn on active status\n• ${getPrefix(event.threadID)}activestatus off - Turn off active status\n• ${getPrefix(event.threadID)}activestatus status - Check current status`);
        }

        try {
            switch (action.toLowerCase()) {
                case "on": {
                    const result = await new Promise((resolve, reject) => {
                        api.setActiveStatus(true, (err, data) => {
                            if (err) reject(err);
                            else resolve(data);
                        });
                    });

                    return message.reply("✅ Active status turned ON");
                }

                case "off": {
                    const result = await new Promise((resolve, reject) => {
                        api.setActiveStatus(false, (err, data) => {
                            if (err) reject(err);
                            else resolve(data);
                        });
                    });

                    return message.reply("✅ Active status turned OFF");
                }

                case "status": {
                    return message.reply(`📱 Active Status Info:\n\n🔍 Use "on" or "off" to change your active status\n\n• ON: Friends can see when you're active\n• OFF: You appear offline to friends\n\nNote: This affects your visibility across Facebook Messenger.`);
                }

                default:
                    return message.reply("❌ Invalid action! Use: on, off, or status");
            }
        } catch (error) {
            console.error("Active Status Error:", error);
            return message.reply("❌ An error occurred while setting active status. Please try again later.");
        }
    }
};
