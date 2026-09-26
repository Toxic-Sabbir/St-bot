const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

// ==================== CONFIG ====================
// Put your SpyroSMM API Key here
const API_KEY = "ba0cb1af8eaad9154e62b77358cf4131";
const API_URL = "https://cruxsmm.com/api/v2";

// Your markup percentage (e.g. 30 = 30% profit)
const MARKUP_PERCENT = 30;

// ==================== HELPER ====================
async function apiRequest(params) {
	try {
		const res = await axios.post(API_URL, null, {
			params: {
				key: API_KEY,
				...params
			},
			timeout: 30000
		});
		return res.data;
	} catch (err) {
		return { error: err.response?.data?.error || err.message || "API Error" };
	}
}

function formatMoney(amount) {
	return parseFloat(amount).toFixed(4);
}

function calculatePrice(rate, quantity) {
	const cost = (parseFloat(rate) / 1000) * quantity;
	const sell = cost * (1 + MARKUP_PERCENT / 100);
	return {
		cost: formatMoney(cost),
		sell: formatMoney(sell),
		profit: formatMoney(sell - cost)
	};
}

// ==================== MAIN COMMAND ====================
module.exports = {
	config: {
		name: "smm",
		version: "1.0.0",
		author: "Toxic Sabbir | Professional Binary Trader",
		countDown: 3,
		role: 0,
		description: {
			en: "Full SMM Panel - Order services, check status, view services & balance"
		},
		category: "SMM PANEL SERVICE",
		guide: {
			en: "{pn} → Open SMM Panel\n{pn} services → Browse services\n{pn} order → Place new order\n{pn} status <orderID> → Check order\n{pn} balance → Check balance (Admin)"
		}
	},

	langs: {
		en: {
			menu: `🚀 𝗦𝗠𝗠 𝗣𝗔𝗡𝗘𝗟\n\n` +
				`1️⃣ Services List\n` +
				`2️⃣ Place New Order\n` +
				`3️⃣ Check Order Status\n` +
				`4️⃣ My Orders\n` +
				`5️⃣ Balance (Admin)\n\n` +
				`👉 Reply with number (1-5)`,
			noApiKey: "❌ API Key not set. Please contact admin.",
			loading: "⏳ Loading...",
			invalid: "❌ Invalid choice. Please try again.",
			onlyAdmin: "❌ This feature is for Admin only."
		}
	},

	onStart: async function ({ api, event, args, message, role, getLang }) {
		const { threadID, senderID, messageID } = event;

		if (API_KEY === "YOUR_SPYROSMM_API_KEY_HERE") {
			return message.reply(getLang("noApiKey"));
		}

		// Direct commands
		if (args[0]) {
			const cmd = args[0].toLowerCase();

			// ===== BALANCE =====
			if (cmd === "balance" || cmd === "bal") {
				if (role < 2) return message.reply(getLang("onlyAdmin"));
				const data = await apiRequest({ action: "balance" });
				if (data.error) return message.reply(`❌ Error: ${data.error}`);
				return message.reply(
					`💰 𝗦𝗠𝗠 𝗕𝗔𝗟𝗔𝗡𝗖𝗘\n\n` +
					`Balance: $${data.balance}\n` +
					`Currency: ${data.currency || "USD"}\n` +
					`Markup: ${MARKUP_PERCENT}%`
				);
			}

			// ===== STATUS =====
			if (cmd === "status" || cmd === "st") {
				const orderID = args[1];
				if (!orderID) return message.reply("❌ Usage: smm status <orderID>");
				const data = await apiRequest({ action: "status", order: orderID });
				if (data.error) return message.reply(`❌ Error: ${data.error}`);
				return message.reply(
					`📦 𝗢𝗥𝗗𝗘𝗥 𝗦𝗧𝗔𝗧𝗨𝗦\n\n` +
					`Order ID: ${orderID}\n` +
					`Status: ${data.status}\n` +
					`Charge: $${data.charge}\n` +
					`Start Count: ${data.start_count}\n` +
					`Remains: ${data.remains}\n` +
					`Currency: ${data.currency || "USD"}`
				);
			}

			// ===== SERVICES =====
			if (cmd === "services" || cmd === "service" || cmd === "list") {
				return showServices(api, event, message, 1);
			}

			// ===== ORDER =====
			if (cmd === "order" || cmd === "new") {
				return startOrderFlow(api, event, message);
			}
		}

		// Default: Show Menu
		const sent = await message.reply(getLang("menu"));
		if (sent) {
			global.GoatBot.onReply.set(sent.messageID, {
				commandName: "smm",
				messageID: sent.messageID,
				author: senderID,
				type: "mainMenu"
			});
		}
	},

	onReply: async function ({ api, event, Reply, message, role }) {
		const { threadID, senderID, body, messageID } = event;

		if (Reply.author !== senderID) {
			return api.sendMessage("❌ This menu is not for you!", threadID, messageID);
		}

		const choice = body.trim().toLowerCase();

		// ========== MAIN MENU ==========
		if (Reply.type === "mainMenu") {
			if (choice === "1" || choice === "services") {
				global.GoatBot.onReply.delete(Reply.messageID);
				try { await api.unsendMessage(Reply.messageID); } catch (e) {}
				return showServices(api, event, message, 1);
			}
			if (choice === "2" || choice === "order") {
				global.GoatBot.onReply.delete(Reply.messageID);
				try { await api.unsendMessage(Reply.messageID); } catch (e) {}
				return startOrderFlow(api, event, message);
			}
			if (choice === "3" || choice === "status") {
				global.GoatBot.onReply.delete(Reply.messageID);
				try { await api.unsendMessage(Reply.messageID); } catch (e) {}
				const sent = await message.reply("📦 Enter Order ID to check status:");
				if (sent) {
					global.GoatBot.onReply.set(sent.messageID, {
						commandName: "smm",
						messageID: sent.messageID,
						author: senderID,
						type: "checkStatus"
					});
				}
				return;
			}
			if (choice === "4" || choice === "myorders") {
				return message.reply("📋 My Orders feature coming in next update.\nUse: smm status <orderID>");
			}
			if (choice === "5" || choice === "balance") {
				if (role < 2) return message.reply("❌ Admin only.");
				const data = await apiRequest({ action: "balance" });
				if (data.error) return message.reply(`❌ ${data.error}`);
				return message.reply(
					`💰 𝗦𝗠𝗠 𝗕𝗔𝗟𝗔𝗡𝗖𝗘\n\nBalance: $${data.balance}\nCurrency: ${data.currency || "USD"}`
				);
			}
			return message.reply("❌ Invalid choice. Reply 1-5");
		}

		// ========== CHECK STATUS ==========
		if (Reply.type === "checkStatus") {
			const orderID = body.trim();
			global.GoatBot.onReply.delete(Reply.messageID);
			const data = await apiRequest({ action: "status", order: orderID });
			if (data.error) return message.reply(`❌ Error: ${data.error}`);
			return message.reply(
				`📦 𝗢𝗥𝗗𝗘𝗥 𝗦𝗧𝗔𝗧𝗨𝗦\n\n` +
				`Order ID: ${orderID}\n` +
				`Status: ${data.status}\n` +
				`Charge: $${data.charge}\n` +
				`Start Count: ${data.start_count}\n` +
				`Remains: ${data.remains}`
			);
		}

		// ========== SERVICES PAGE ==========
		if (Reply.type === "services") {
			if (choice === "next" || choice === "n") {
				return showServices(api, event, message, Reply.page + 1, Reply.services);
			}
			if (choice === "prev" || choice === "p") {
				return showServices(api, event, message, Math.max(1, Reply.page - 1), Reply.services);
			}
			if (choice === "back" || choice === "menu") {
				global.GoatBot.onReply.delete(Reply.messageID);
				try { await api.unsendMessage(Reply.messageID); } catch (e) {}
				const sent = await message.reply(module.exports.langs.en.menu);
				if (sent) {
					global.GoatBot.onReply.set(sent.messageID, {
						commandName: "smm",
						messageID: sent.messageID,
						author: senderID,
						type: "mainMenu"
					});
				}
				return;
			}

			// Select service by number
			const num = parseInt(choice);
			if (!isNaN(num) && num >= 1 && num <= Reply.pageServices.length) {
				const selected = Reply.pageServices[num - 1];
				global.GoatBot.onReply.delete(Reply.messageID);
				try { await api.unsendMessage(Reply.messageID); } catch (e) {}

				const priceInfo = calculatePrice(selected.rate, selected.min);
				const msg =
					`📌 𝗦𝗘𝗥𝗩𝗜𝗖𝗘 𝗗𝗘𝗧𝗔𝗜𝗟𝗦\n\n` +
					`ID: ${selected.service}\n` +
					`Name: ${selected.name}\n` +
					`Category: ${selected.category}\n` +
					`Rate: $${selected.rate} / 1000\n` +
					`Min: ${selected.min} | Max: ${selected.max}\n` +
					`Refill: ${selected.refill ? "✅" : "❌"} | Cancel: ${selected.cancel ? "✅" : "❌"}\n\n` +
					`💰 Price for Min (${selected.min}): $${priceInfo.sell}\n\n` +
					`👉 To order this service reply:\n` +
					`order ${selected.service}`;

				const sent = await message.reply(msg);
				if (sent) {
					global.GoatBot.onReply.set(sent.messageID, {
						commandName: "smm",
						messageID: sent.messageID,
						author: senderID,
						type: "serviceSelected",
						service: selected
					});
				}
				return;
			}
			return message.reply("❌ Invalid. Reply number / next / prev / back");
		}

		// ========== ORDER FLOW ==========
		if (Reply.type === "orderService") {
			const serviceID = body.trim();
			if (!serviceID || isNaN(serviceID)) {
				return message.reply("❌ Please enter a valid Service ID number.");
			}
			// Fetch service info
			const services = await apiRequest({ action: "services" });
			if (services.error || !Array.isArray(services)) {
				return message.reply("❌ Failed to load services.");
			}
			const service = services.find(s => String(s.service) === String(serviceID));
			if (!service) {
				return message.reply("❌ Service ID not found.");
			}

			global.GoatBot.onReply.delete(Reply.messageID);
			const sent = await message.reply(
				`✅ Selected: ${service.name}\n\n` +
				`📎 Now send the Link:`
			);
			if (sent) {
				global.GoatBot.onReply.set(sent.messageID, {
					commandName: "smm",
					messageID: sent.messageID,
					author: senderID,
					type: "orderLink",
					service: service
				});
			}
			return;
		}

		if (Reply.type === "orderLink") {
			const link = body.trim();
			if (!link.startsWith("http")) {
				return message.reply("❌ Please send a valid link (starting with http)");
			}

			global.GoatBot.onReply.delete(Reply.messageID);
			const sent = await message.reply(
				`🔗 Link: ${link}\n\n` +
				`📊 Enter Quantity (Min: ${Reply.service.min} | Max: ${Reply.service.max}):`
			);
			if (sent) {
				global.GoatBot.onReply.set(sent.messageID, {
					commandName: "smm",
					messageID: sent.messageID,
					author: senderID,
					type: "orderQuantity",
					service: Reply.service,
					link: link
				});
			}
			return;
		}

		if (Reply.type === "orderQuantity") {
			const qty = parseInt(body.trim());
			const service = Reply.service;

			if (isNaN(qty) || qty < parseInt(service.min) || qty > parseInt(service.max)) {
				return message.reply(`❌ Quantity must be between ${service.min} and ${service.max}`);
			}

			const price = calculatePrice(service.rate, qty);

			global.GoatBot.onReply.delete(Reply.messageID);

			const confirmMsg =
				`🛒 𝗖𝗢𝗡𝗙𝗜𝗥𝗠 𝗢𝗥𝗗𝗘𝗥\n\n` +
				`Service: ${service.name}\n` +
				`ID: ${service.service}\n` +
				`Link: ${Reply.link}\n` +
				`Quantity: ${qty}\n\n` +
				`💰 Your Price: $${price.sell}\n` +
				`(Cost: $${price.cost} | Profit: $${price.profit})\n\n` +
				`👉 Reply YES to confirm or NO to cancel`;

			const sent = await message.reply(confirmMsg);
			if (sent) {
				global.GoatBot.onReply.set(sent.messageID, {
					commandName: "smm",
					messageID: sent.messageID,
					author: senderID,
					type: "orderConfirm",
					service: service,
					link: Reply.link,
					quantity: qty,
					price: price
				});
			}
			return;
		}

		if (Reply.type === "orderConfirm") {
			if (choice !== "yes" && choice !== "y") {
				global.GoatBot.onReply.delete(Reply.messageID);
				return message.reply("❌ Order cancelled.");
			}

			// Place order
			const data = await apiRequest({
				action: "add",
				service: Reply.service.service,
				link: Reply.link,
				quantity: Reply.quantity
			});

			global.GoatBot.onReply.delete(Reply.messageID);

			if (data.error || !data.order) {
				return message.reply(`❌ Order Failed: ${data.error || "Unknown error"}`);
			}

			return message.reply(
				`✅ 𝗢𝗥𝗗𝗘𝗥 𝗣𝗟𝗔𝗖𝗘𝗗 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬\n\n` +
				`Order ID: ${data.order}\n` +
				`Service: ${Reply.service.name}\n` +
				`Quantity: ${Reply.quantity}\n` +
				`Link: ${Reply.link}\n` +
				`Charged: $${Reply.price.sell}\n\n` +
				`Use: smm status ${data.order} to track`
			);
		}

		// From service details
		if (Reply.type === "serviceSelected") {
			if (choice.startsWith("order")) {
				const parts = choice.split(" ");
				const sid = parts[1] || Reply.service.service;
				global.GoatBot.onReply.delete(Reply.messageID);
				const sent = await message.reply(`📎 Send the Link for service ${sid}:`);
				if (sent) {
					global.GoatBot.onReply.set(sent.messageID, {
						commandName: "smm",
						messageID: sent.messageID,
						author: senderID,
						type: "orderLink",
						service: Reply.service
					});
				}
			}
		}
	}
};

// ==================== SERVICES LIST FUNCTION ====================
async function showServices(api, event, message, page = 1, cachedServices = null) {
	const { threadID, senderID } = event;

	let services = cachedServices;
	if (!services) {
		const data = await apiRequest({ action: "services" });
		if (data.error || !Array.isArray(data)) {
			return message.reply(`❌ Failed to load services: ${data.error || "Unknown"}`);
		}
		services = data;
	}

	const perPage = 10;
	const totalPages = Math.ceil(services.length / perPage);
	if (page > totalPages) page = totalPages;
	if (page < 1) page = 1;

	const start = (page - 1) * perPage;
	const pageServices = services.slice(start, start + perPage);

	let msg = `📋 𝗦𝗘𝗥𝗩𝗜𝗖𝗘𝗦 𝗟𝗜𝗦𝗧 (Page ${page}/${totalPages})\n`;
	msg += `Total Services: ${services.length}\n\n`;

	pageServices.forEach((s, i) => {
		const price = calculatePrice(s.rate, s.min);
		msg += `${i + 1}. [ID:${s.service}] ${s.name}\n`;
		msg += `   📂 ${s.category} | $${s.rate}/1k | Min:${s.min}\n`;
		msg += `   💰 From $${price.sell}\n\n`;
	});

	msg += `👉 Reply number to view details\n`;
	msg += `👉 next / prev / back`;

	const sent = await message.reply(msg);
	if (sent) {
		global.GoatBot.onReply.set(sent.messageID, {
			commandName: "smm",
			messageID: sent.messageID,
			author: senderID,
			type: "services",
			page: page,
			services: services,
			pageServices: pageServices
		});
	}
}

// ==================== START ORDER FLOW ====================
async function startOrderFlow(api, event, message) {
	const { senderID } = event;
	const sent = await message.reply(
		`🛒 𝗡𝗘𝗪 𝗢𝗥𝗗𝗘𝗥\n\n` +
		`Please enter the Service ID:\n` +
		`(Use smm services to find ID)`
	);
	if (sent) {
		global.GoatBot.onReply.set(sent.messageID, {
			commandName: "smm",
			messageID: sent.messageID,
			author: senderID,
			type: "orderService"
		});
	}
}
