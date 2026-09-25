const fs = require('fs');
const path = require('path');

module.exports = {
	config: {
		name: "help",
		version: "2.5.0",
		role: 0,
		countDown: 0,
		author: "Sabbir Hossain",
		description: "Displays all available commands and their categories.",
		category: "help"
	},

	ST: async ({ api, event, args }) => {
		const cmdsFolderPath = path.join(__dirname, '.');
		const files = fs.readdirSync(cmdsFolderPath).filter(file => file.endsWith('.js'));

		const sendMessage = async (message, threadID, messageID = null) => {
			try {
				return await api.sendMessage(message, threadID, messageID);
			} catch (error) {
				console.error('Error sending message:', error);
			}
		};

		const getCategories = () => {
			const categories = {};
			for (const file of files) {
				try {
					const command = require(path.join(cmdsFolderPath, file));
					const { category } = command.config;
					const categoryName = category || 'uncategorized';
					if (!categories[categoryName]) categories[categoryName] = [];
					categories[categoryName].push(command.config);
				} catch (error) {
					// Skip invalid command files
				}
			}
			return categories;
		};

		try {
			// If specific command requested directly
			if (args[0] && !args[0].match(/^\d+$/)) {
				const commandName = args[0].toLowerCase();
				const command = files.map(file => {
					try {
						return require(path.join(cmdsFolderPath, file));
					} catch {
						return null;
					}
				}).filter(cmd => cmd !== null)
				.find(cmd => cmd.config.name.toLowerCase() === commandName || (cmd.config.aliases && cmd.config.aliases.includes(commandName)));

				if (command) {
					const roleText = command.config.role === 0 ? "Everyone" : 
									 command.config.role === 1 ? "Group Admin" : 
									 command.config.role === 2 ? "Bot Admin" : "Unknown";

					const desc = typeof command.config.description === 'string' 
						? command.config.description 
						: (command.config.description?.en || 'No description available');

					const guideText = command.config.guide 
						? (typeof command.config.guide === 'string' 
							? command.config.guide 
							: (command.config.guide.en || 'No guide available'))
						: 'No guide available';

					let commandDetails = `✅ COMMAND DETAILS ✅\n\n`;
					commandDetails += `🚹 Name: "${command.config.name}"\n\n`;
					commandDetails += `ℹ️ Description: ${desc}\n\n`;
					commandDetails += `⚜️ Usage: "/${command.config.name}"\n\n`;
					commandDetails += `🔑 Permission: ${roleText}`;

					await sendMessage(commandDetails, event.threadID);
				} else {
					await sendMessage(`❌ Command not found: ${commandName}`, event.threadID);
				}
			} else {
				// Stage 1: Show categories
				const categories = getCategories();
				const categoryNames = Object.keys(categories).sort();
				
				let totalCommands = 0;
				categoryNames.forEach(cat => {
					totalCommands += categories[cat].length;
				});

				let helpMessage = `🧩Currently Available Categories🧩\n\n`;
				helpMessage += `✅ Categories : ${categoryNames.length}\n`;
				helpMessage += `✅ Commands : ${totalCommands}\n\n`;
				helpMessage += `👉Category List :\n\n`;

				categoryNames.forEach((category, index) => {
					helpMessage += `🟩 ${index + 1}. ${category.toUpperCase()}\n`;
				});

				helpMessage += `\n👉Reply with the Category ID to view the command list👈\n\n`;
				helpMessage += `✅ For More Contact Me : m.me/trader.sabbir.x1\n`;
				helpMessage += `👉Telegram : @toxicxsabbir`;

				const sentMessage = await sendMessage(helpMessage, event.threadID);
				
				if (sentMessage) {
					global.GoatBot.onReply.set(sentMessage.messageID, {
						commandName: "help",
						messageID: sentMessage.messageID,
						author: event.senderID,
						stage: 1,
						categories: categoryNames,
						categoriesData: categories
					});
				}
			}
		} catch (error) {
			console.error('Error generating help message:', error);
			await sendMessage('An error occurred while generating the help message.', event.threadID);
		}
	},

	onReply: async ({ api, event, Reply }) => {
		if (Reply.author != event.senderID) {
			return api.sendMessage("❌ This is not for you!", event.threadID, event.messageID);
		}

		const choice = parseInt(event.body.trim());

		try {
			if (Reply.stage === 1) {
				// Stage 2: Show commands of selected category
				if (isNaN(choice) || choice < 1 || choice > Reply.categories.length) {
					return api.sendMessage(`❌ Invalid choice. Please reply with a number between 1 and ${Reply.categories.length}.`, event.threadID, event.messageID);
				}

				const selectedCategory = Reply.categories[choice - 1];
				const commands = Reply.categoriesData[selectedCategory].sort((a, b) => a.name.localeCompare(b.name));

				let categoryMessage = `✅Commands\n\n`;

				commands.forEach((cmd, index) => {
					categoryMessage += `👉 ${index + 1}. ${cmd.name}\n`;
				});

				categoryMessage += `\n✅Reply with the Command ID to learn how to use the command😴`;

				global.GoatBot.onReply.delete(Reply.messageID);
				try {
					await api.unsendMessage(Reply.messageID);
				} catch (error) {}

				const sentMessage = await api.sendMessage(categoryMessage, event.threadID);

				if (sentMessage) {
					global.GoatBot.onReply.set(sentMessage.messageID, {
						commandName: "help",
						messageID: sentMessage.messageID,
						author: event.senderID,
						stage: 2,
						commands: commands,
						selectedCategory: selectedCategory,
						parentCategories: Reply.categories,
						parentCategoriesData: Reply.categoriesData
					});
				}

			} else if (Reply.stage === 2) {
				// Go back option (optional)
				if (choice === 0) {
					const categoryNames = Reply.parentCategories;
					const categories = Reply.parentCategoriesData;
					
					let totalCommands = 0;
					categoryNames.forEach(cat => {
						totalCommands += categories[cat].length;
					});

					let helpMessage = `🧩Currently Available Categories🧩\n\n`;
					helpMessage += `✅ Categories : ${categoryNames.length}\n`;
					helpMessage += `✅ Commands : ${totalCommands}\n\n`;
					helpMessage += `👉Category List :\n\n`;

					categoryNames.forEach((category, index) => {
						helpMessage += `🟩 ${index + 1}. ${category.toUpperCase()}\n`;
					});

					helpMessage += `\n👉Reply with the Category ID to view the command list👈\n\n`;
					helpMessage += `✅ For More Contact Me : m.me/trader.sabbir.x1\n`;
					helpMessage += `👉Telegram : @toxicxsabbir`;

					global.GoatBot.onReply.delete(Reply.messageID);
					try {
						await api.unsendMessage(Reply.messageID);
					} catch (error) {}

					const sentMessage = await api.sendMessage(helpMessage, event.threadID);
					
					if (sentMessage) {
						global.GoatBot.onReply.set(sentMessage.messageID, {
							commandName: "help",
							messageID: sentMessage.messageID,
							author: event.senderID,
							stage: 1,
							categories: categoryNames,
							categoriesData: categories
						});
					}
					return;
				}

				// Stage 3: Show command details
				if (isNaN(choice) || choice < 1 || choice > Reply.commands.length) {
					return api.sendMessage(`❌ Invalid choice. Please reply with a number between 1 and ${Reply.commands.length}.`, event.threadID, event.messageID);
				}

				const selectedCommand = Reply.commands[choice - 1];

				global.GoatBot.onReply.delete(Reply.messageID);
				try {
					await api.unsendMessage(Reply.messageID);
				} catch (error) {}

				try {
					const cmdsFolderPath = path.join(__dirname, '.');
					const files = fs.readdirSync(cmdsFolderPath).filter(file => file.endsWith('.js'));
					
					let fullCommand = null;
					for (const file of files) {
						try {
							const command = require(path.join(cmdsFolderPath, file));
							if (command.config.name.toLowerCase() === selectedCommand.name.toLowerCase()) {
								fullCommand = command;
								break;
							}
						} catch (error) {}
					}

					if (!fullCommand) {
						fullCommand = { config: selectedCommand };
					}

					const roleText = fullCommand.config.role === 0 ? "Everyone" : 
									 fullCommand.config.role === 1 ? "Group Admin" : 
									 fullCommand.config.role === 2 ? "Bot Admin" : "Unknown";

					const desc = typeof fullCommand.config.description === 'string' 
						? fullCommand.config.description 
						: (fullCommand.config.description?.en || 'No description available');

					let commandDetails = `✅ COMMAND DETAILS ✅\n\n`;
					commandDetails += `🚹 Name: "${fullCommand.config.name}"\n\n`;
					commandDetails += `ℹ️ Description: ${desc}\n\n`;
					commandDetails += `⚜️ Usage: "${guideText.replace(/{pn}/g, `!${command.config.name}`)}"\n\n`;
					commandDetails += `🔑 Permission: ${roleText}`;

					await api.sendMessage(commandDetails, event.threadID);
					
				} catch (error) {
					console.error('Error sending command details:', error);
					await api.sendMessage('❌ An error occurred while displaying command details.', event.threadID, event.messageID);
				}
			}
		} catch (error) {
			console.error('Error in help onReply:', error);
			api.sendMessage('❌ An error occurred while processing your request.', event.threadID, event.messageID);
		}
	}
};
