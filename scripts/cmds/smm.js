const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "smmConfig.json");
const ORDERS_PATH = path.join(__dirname, "smmOrders.json");
const DEPOSITS_PATH = path.join(__dirname, "smmDeposits.json");

// ==================== LOAD / SAVE ====================
function loadConfig() {
	try {
		return fs.readJsonSync(CONFIG_PATH);
	} catch (e) {
		return {
			apiUrl: "https://cruxsmm.com/api/v2",
			apiKey: "ba0cb1af8eaad9154e62b77358cf4131",
			markupPercent: 30,
			currency: "USD",
			bdtRate: 130,
			minDepositUSD: 1,
			minDepositBDT: 130,
			adminUID: [],
			platforms: {
				facebook: ["facebook", "fb", "meta"],
				instagram: ["instagram", "ig", "insta"],
				youtube: ["youtube", "yt", "youtu"],
				twitter: ["twitter", "x.com", "tweet"],
				tiktok: ["tiktok", "tt"],
				telegram: ["telegram", "tg"],
				spotify: ["spotify"],
				other: []
			}
		};
	}
}

function loadOrders() {
	try { return fs.readJsonSync(ORDERS_PATH); } catch (e) { return {}; }
}
function saveOrders(data) {
	fs.writeJsonSync(ORDERS_PATH, data, { spaces: 2 });
}

function loadDeposits() {
	try { return fs.readJsonSync(DEPOSITS_PATH); } catch (e) { return {}; }
}
function saveDeposits(data) {
	fs.writeJsonSync(DEPOSITS_PATH, data, { spaces: 2 });
}

// ==================== API ====================
async function apiRequest(params) {
	const config = loadConfig();
	if (!config.apiKey || config.apiKey.includes("YOUR_")) {
		return { error: "API Key not configured. Contact Admin." };
	}
	try {
		const res = await axios.post(config.apiUrl, null, {
			params: { key: config.apiKey, ...params },
			timeout: 30000
		});
		return res.data;
	} catch (err) {
		return { error: err.response?.data?.error || err.message || "API Connection Error" };
	}
}

function formatMoney(amount) {
	return parseFloat(amount || 0).toFixed(4);
}

function calculatePrice(rate, quantity, markup) {
	const cost = (parseFloat(rate) / 1000) * quantity;
	const sell = cost * (1 + (markup || 30) / 100);
	return {
		cost: formatMoney(cost),
		sell: formatMoney(sell),
		profit: formatMoney(sell - cost)
	};
}

// ==================== USER BALANCE ====================
async function getUserBalance(usersData, uid) {
	const data = await usersData.get(uid) || {};
	return parseFloat(data.smmBalance || 0);
}

async function setUserBalance(usersData, uid, amount) {
	const data = await usersData.get(uid) || {};
	data.smmBalance = parseFloat(amount);
	await usersData.set(uid, data);
}

async function addUserBalance(usersData, uid, amount) {
	const current = await getUserBalance(usersData, uid);
	const newBal = current + parseFloat(amount);
	await setUserBalance(usersData, uid, newBal);
	return newBal;
}

// ==================== MAIN COMMAND ====================
module.exports = {
	config: {
		name: "smm",
		version: "3.1.0",
		author: "Toxic Sabbir | Professional Trader",
		countDown: 2,
		role: 0,
		description: {
			en: "Full SMM Panel with Deposit System"
		},
		category: "SMM PANEL",
		guide: {
			en: "{pn} → Open Panel\n{pn} balance → Check balance\n{pn} deposit → Add funds\n{pn} status <orderID>\n{pn} myorders"
		}
	},

	onStart: async function ({ api, event, args, message, usersData, role }) {
		const { senderID } = event;
		const config = loadConfig();
		const bal = await getUserBalance(usersData, senderID);

		// BALANCE
		if (args[0] && ["balance", "bal", "wallet"].includes(args[0].toLowerCase())) {
			return message.reply(
				`💰 𝗬𝗢𝗨𝗥 𝗦𝗠𝗠 𝗕𝗔𝗟𝗔𝗡𝗖𝗘\n\n` +
				`💵 Balance: $${formatMoney(bal)} USD\n\n` +
				`To add funds type: smm deposit`
			);
		}

		// MY ORDERS
		if (args[0] && ["myorders", "orders", "history"].includes(args[0].toLowerCase())) {
			const orders = loadOrders();
			const userOrders = orders[senderID] || [];
			if (userOrders.length === 0) return message.reply("📭 You have no orders yet.");
			let msg = `📋 𝗬𝗢𝗨𝗥 𝗢𝗥𝗗𝗘𝗥𝗦 (Last 10)\n\n`;
			userOrders.slice(0, 10).forEach((o, i) => {
				msg += `${i + 1}. ID: ${o.orderId}\n`;
				msg += `   ${o.serviceName.substring(0, 40)}\n`;
				msg += `   Qty: ${o.quantity} | $${o.charge} | ${o.status}\n\n`;
			});
			return message.reply(msg);
		}

		// STATUS
		if (args[0] && ["status", "st", "check"].includes(args[0].toLowerCase())) {
			const orderID = args[1];
			if (!orderID) return message.reply("❌ Usage: smm status <orderID>");
			const data = await apiRequest({ action: "status", order: orderID });
			if (data.error) return message.reply(`❌ ${data.error}`);
			return message.reply(
				`📦 𝗢𝗥𝗗𝗘𝗥 𝗦𝗧𝗔𝗧𝗨𝗦\n\n` +
				`Order ID: ${orderID}\n` +
				`Status: ${data.status}\n` +
				`Charge: $${data.charge}\n` +
				`Start Count: ${data.start_count}\n` +
				`Remains: ${data.remains}`
			);
		}

		// DEPOSIT
		if (args[0] && ["deposit", "addfund", "recharge", "topup"].includes(args[0].toLowerCase())) {
			return startDeposit(api, event, message);
		}

		// MAIN MENU
		const platforms = Object.keys(config.platforms).filter(p => p !== "other");
		let menu = `🚀 𝗦𝗠𝗠 𝗣𝗔𝗡𝗘𝗟\n\n`;
		menu += `💰 Your Balance: $${formatMoney(bal)} USD\n\n`;

		if (bal <= 0) {
			menu += `⚠️ Balance is $0 — You cannot place orders\nType: smm deposit\n\n`;
		}

		menu += `📌 Select Platform:\n\n`;
		platforms.forEach((p, i) => {
			const emoji = { facebook: "📘", instagram: "📸", youtube: "▶️", twitter: "🐦", tiktok: "🎵", telegram: "✈️", spotify: "🎧" }[p] || "🔹";
			menu += `${i + 1}. ${emoji} ${p.toUpperCase()}\n`;
		});
		menu += `\n8️⃣ 💳 Deposit Funds\n9️⃣ 💰 My Balance\n\n👉 Reply with number`;

		const sent = await message.reply(menu);
		if (sent) {
			global.GoatBot.onReply.set(sent.messageID, {
				commandName: "smm",
				messageID: sent.messageID,
				author: senderID,
				type: "mainMenu",
				platforms
			});
		}
	},

	onReply: async function ({ api, event, Reply, message, usersData, role }) {
		const { senderID, body, threadID, messageID, attachments } = event;
		if (Reply.author !== senderID) {
			return api.sendMessage("❌ This is not for you!", threadID, messageID);
		}

		const choice = (body || "").trim().toLowerCase();
		const config = loadConfig();

		// ========== MAIN MENU ==========
		if (Reply.type === "mainMenu") {
			if (choice === "8" || choice === "deposit") {
				global.GoatBot.onReply.delete(Reply.messageID);
				try { await api.unsendMessage(Reply.messageID); } catch (e) {}
				return startDeposit(api, event, message);
			}
			if (choice === "9" || choice === "balance") {
				const bal = await getUserBalance(usersData, senderID);
				return message.reply(`💰 Your Balance: $${formatMoney(bal)} USD`);
			}

			const index = parseInt(choice) - 1;
			if (isNaN(index) || index < 0 || index >= Reply.platforms.length) {
				return message.reply("❌ Invalid choice. Reply with correct number.");
			}

			const bal = await getUserBalance(usersData, senderID);
			if (bal <= 0) {
				return message.reply(`❌ Your balance is $0\n\nPlease deposit first:\nsmm deposit`);
			}

			const platform = Reply.platforms[index];
			global.GoatBot.onReply.delete(Reply.messageID);
			try { await api.unsendMessage(Reply.messageID); } catch (e) {}

			await message.reply(`⏳ Loading ${platform.toUpperCase()} services...`);
			const services = await apiRequest({ action: "services" });

			if (services.error || !Array.isArray(services)) {
				return message.reply(`❌ Failed: ${services.error || "Unknown error"}`);
			}

			const keywords = config.platforms[platform] || [platform];
			const filtered = services.filter(s => {
				const cat = (s.category || "").toLowerCase();
				const name = (s.name || "").toLowerCase();
				return keywords.some(k => cat.includes(k) || name.includes(k));
			});

			if (filtered.length === 0) {
				return message.reply(`❌ No services found for ${platform.toUpperCase()}.`);
			}

			return showPlatformServices(api, event, message, platform, filtered, 1);
		}

		// ========== DEPOSIT CURRENCY ==========
		if (Reply.type === "depositCurrency") {
			if (choice === "1" || choice === "usd") {
				global.GoatBot.onReply.delete(Reply.messageID);
				const sent = await message.reply(
					`💵 𝗗𝗘𝗣𝗢𝗦𝗜𝗧 𝗨𝗦𝗗\n\nMinimum: $${config.minDepositUSD}\n\nSend the amount (example: 10):`
				);
				if (sent) {
					global.GoatBot.onReply.set(sent.messageID, {
						commandName: "smm",
						messageID: sent.messageID,
						author: senderID,
						type: "depositAmount",
						currency: "USD",
						rate: 1
					});
				}
				return;
			}
			if (choice === "2" || choice === "bdt") {
				global.GoatBot.onReply.delete(Reply.messageID);
				const sent = await message.reply(
					`🇧🇩 𝗗𝗘𝗣𝗢𝗦𝗜𝗧 𝗕𝗗𝗧\n\nRate: 1 USD = ${config.bdtRate} BDT\nMinimum: ${config.minDepositBDT} BDT\n\nSend amount in BDT (example: 1300):`
				);
				if (sent) {
					global.GoatBot.onReply.set(sent.messageID, {
						commandName: "smm",
						messageID: sent.messageID,
						author: senderID,
						type: "depositAmount",
						currency: "BDT",
						rate: config.bdtRate
					});
				}
				return;
			}
			return message.reply("❌ Reply 1 for USD or 2 for BDT");
		}

		// ========== DEPOSIT AMOUNT ==========
		if (Reply.type === "depositAmount") {
			const amount = parseFloat(choice);
			const min = Reply.currency === "USD" ? config.minDepositUSD : config.minDepositBDT;

			if (isNaN(amount) || amount < min) {
				return message.reply(`❌ Minimum is ${min} ${Reply.currency}`);
			}

			const usdAmount = Reply.currency === "USD" ? amount : (amount / Reply.rate);

			global.GoatBot.onReply.delete(Reply.messageID);
			const sent = await message.reply(
				`✅ Amount: ${amount} ${Reply.currency}\n≈ $${formatMoney(usdAmount)} USD\n\nNow send your Transaction ID (TRX ID):`
			);
			if (sent) {
				global.GoatBot.onReply.set(sent.messageID, {
					commandName: "smm",
					messageID: sent.messageID,
					author: senderID,
					type: "depositTRX",
					currency: Reply.currency,
					amount: amount,
					usdAmount: usdAmount
				});
			}
			return;
		}

		// ========== DEPOSIT TRX ==========
		if (Reply.type === "depositTRX") {
			const trx = body.trim();
			if (!trx || trx.length < 5) {
				return message.reply("❌ Please send a valid Transaction ID.");
			}

			global.GoatBot.onReply.delete(Reply.messageID);
			const sent = await message.reply(
				`✅ TRX ID: ${trx}\n\n📸 Now send the Screenshot of payment\n(Send image only)`
			);
			if (sent) {
				global.GoatBot.onReply.set(sent.messageID, {
					commandName: "smm",
					messageID: sent.messageID,
					author: senderID,
					type: "depositScreenshot",
					currency: Reply.currency,
					amount: Reply.amount,
					usdAmount: Reply.usdAmount,
					trx: trx
				});
			}
			return;
		}

		// ========== DEPOSIT SCREENSHOT + FORWARD TO ADMIN ==========
		if (Reply.type === "depositScreenshot") {
			if (!attachments || attachments.length === 0 || attachments[0].type !== "photo") {
				return message.reply("❌ Please send a screenshot (image).");
			}

			const photoUrl = attachments[0].url || attachments[0].previewUrl || null;
			const deposits = loadDeposits();
			const depositId = `DEP${Date.now()}`;

			deposits[depositId] = {
				id: depositId,
				userID: senderID,
				currency: Reply.currency,
				amount: Reply.amount,
				usdAmount: Reply.usdAmount,
				trx: Reply.trx,
				screenshot: photoUrl,
				status: "pending",
				time: new Date().toISOString()
			};
			saveDeposits(deposits);

			global.GoatBot.onReply.delete(Reply.messageID);

			// Notify User
			await message.reply(
				`✅ 𝗗𝗘𝗣𝗢𝗦𝗜𝗧 𝗦𝗨𝗕𝗠𝗜𝗧𝗧𝗘𝗗\n\n` +
				`Deposit ID: ${depositId}\n` +
				`Amount: ${Reply.amount} ${Reply.currency}\n` +
				`USD Value: $${formatMoney(Reply.usdAmount)}\n` +
				`TRX: ${Reply.trx}\n\n` +
				`⏳ Waiting for Admin approval...\nYou will be notified.`
			);

			// ===== FORWARD TO ADMIN INBOX =====
			const adminList = global.GoatBot?.config?.adminBot || [];
			const adminMsg =
				`💳 𝗡𝗘𝗪 𝗗𝗘𝗣𝗢𝗦𝗜𝗧 𝗥𝗘𝗤𝗨𝗘𝗦𝗧\n\n` +
				`Deposit ID: ${depositId}\n` +
				`User ID: ${senderID}\n` +
				`Amount: ${Reply.amount} ${Reply.currency}\n` +
				`USD Value: $${formatMoney(Reply.usdAmount)}\n` +
				`TRX ID: ${Reply.trx}\n\n` +
				`👉 Reply this message with:\n` +
				`approve\n` +
				`or\n` +
				`reject`;

			for (const admin of adminList) {
				try {
					let sentMsg;
					if (photoUrl && global.utils?.getStreamFromURL) {
						sentMsg = await api.sendMessage({
							body: adminMsg,
							attachment: await global.utils.getStreamFromURL(photoUrl)
						}, admin);
					} else {
						sentMsg = await api.sendMessage(adminMsg, admin);
					}

					// Set onReply so admin can just reply "approve" or "reject"
					if (sentMsg && sentMsg.messageID) {
						global.GoatBot.onReply.set(sentMsg.messageID, {
							commandName: "smmadmin",
							messageID: sentMsg.messageID,
							author: admin,
							type: "depositAction",
							depositId: depositId
						});
					}
				} catch (e) {
					console.log("Failed to send deposit to admin:", admin, e.message);
				}
			}
			return;
		}

		// ========== PLATFORM SERVICES ==========
		if (Reply.type === "platformServices") {
			if (choice === "next" || choice === "n") {
				return showPlatformServices(api, event, message, Reply.platform, Reply.services, Reply.page + 1);
			}
			if (choice === "prev" || choice === "p") {
				return showPlatformServices(api, event, message, Reply.platform, Reply.services, Math.max(1, Reply.page - 1));
			}
			if (choice === "back" || choice === "menu") {
				global.GoatBot.onReply.delete(Reply.messageID);
				try { await api.unsendMessage(Reply.messageID); } catch (e) {}
				return module.exports.onStart({ api, event, args: [], message, usersData, role });
			}

			const num = parseInt(choice);
			if (!isNaN(num) && num >= 1 && num <= Reply.pageServices.length) {
				const selected = Reply.pageServices[num - 1];
				global.GoatBot.onReply.delete(Reply.messageID);
				try { await api.unsendMessage(Reply.messageID); } catch (e) {}

				const priceInfo = calculatePrice(selected.rate, selected.min, config.markupPercent);
				const detail =
					`📌 𝗦𝗘𝗥𝗩𝗜𝗖𝗘 𝗗𝗘𝗧𝗔𝗜𝗟𝗦\n\n` +
					`ID: ${selected.service}\n` +
					`Name: ${selected.name}\n` +
					`Category: ${selected.category}\n` +
					`Rate: $${selected.rate} / 1000\n` +
					`Min: ${selected.min} | Max: ${selected.max}\n` +
					`Refill: ${selected.refill ? "✅ Yes" : "❌ No"}\n\n` +
					`💰 From $${priceInfo.sell}\n\n` +
					`👉 Reply with quantity to order\n👉 Or type "back"`;

				const sent = await message.reply(detail);
				if (sent) {
					global.GoatBot.onReply.set(sent.messageID, {
						commandName: "smm",
						messageID: sent.messageID,
						author: senderID,
						type: "enterQuantity",
						service: selected
					});
				}
				return;
			}
			return message.reply("❌ Invalid. Reply number / next / prev / back");
		}

		// ========== ENTER QUANTITY ==========
		if (Reply.type === "enterQuantity") {
			if (choice === "back") {
				global.GoatBot.onReply.delete(Reply.messageID);
				return message.reply("❌ Cancelled.");
			}

			const qty = parseInt(choice);
			const service = Reply.service;
			if (isNaN(qty) || qty < parseInt(service.min) || qty > parseInt(service.max)) {
				return message.reply(`❌ Quantity must be ${service.min} - ${service.max}`);
			}

			const priceInfo = calculatePrice(service.rate, qty, config.markupPercent);
			const userBal = await getUserBalance(usersData, senderID);

			if (userBal < parseFloat(priceInfo.sell)) {
				return message.reply(
					`❌ Insufficient Balance!\n\nRequired: $${priceInfo.sell}\nYour Balance: $${formatMoney(userBal)}\n\nDeposit: smm deposit`
				);
			}

			global.GoatBot.onReply.delete(Reply.messageID);
			const sent = await message.reply(
				`🛒 Confirm Order\n\nService: ${service.name}\nQty: ${qty}\nPrice: $${priceInfo.sell}\nBalance after: $${formatMoney(userBal - priceInfo.sell)}\n\n📎 Now send the Link:`
			);
			if (sent) {
				global.GoatBot.onReply.set(sent.messageID, {
					commandName: "smm",
					messageID: sent.messageID,
					author: senderID,
					type: "enterLink",
					service,
					quantity: qty,
					price: priceInfo
				});
			}
			return;
		}

		// ========== PLACE ORDER ==========
		if (Reply.type === "enterLink") {
			const link = body.trim();
			if (!link.startsWith("http")) {
				return message.reply("❌ Send a valid link (http/https)");
			}

			const { service, quantity, price } = Reply;
			const userBal = await getUserBalance(usersData, senderID);

			if (userBal < parseFloat(price.sell)) {
				global.GoatBot.onReply.delete(Reply.messageID);
				return message.reply("❌ Insufficient balance.");
			}

			const orderRes = await apiRequest({
				action: "add",
				service: service.service,
				link: link,
				quantity: quantity
			});

			global.GoatBot.onReply.delete(Reply.messageID);

			if (orderRes.error || !orderRes.order) {
				return message.reply(`❌ Order Failed: ${orderRes.error || "Unknown error"}`);
			}

			const newBal = await addUserBalance(usersData, senderID, -parseFloat(price.sell));

			const orders = loadOrders();
			if (!orders[senderID]) orders[senderID] = [];
			orders[senderID].unshift({
				orderId: orderRes.order,
				serviceId: service.service,
				serviceName: service.name,
				link,
				quantity,
				charge: price.sell,
				cost: price.cost,
				profit: price.profit,
				status: "Pending",
				time: new Date().toISOString()
			});
			saveOrders(orders);

			return message.reply(
				`✅ 𝗢𝗥𝗗𝗘𝗥 𝗣𝗟𝗔𝗖𝗘𝗗\n\n` +
				`Order ID: ${orderRes.order}\n` +
				`Service: ${service.name}\n` +
				`Qty: ${quantity}\n` +
				`Charged: $${price.sell}\n` +
				`New Balance: $${formatMoney(newBal)}\n\n` +
				`Track: smm status ${orderRes.order}`
			);
		}
	}
};

// ==================== HELPERS ====================
async function startDeposit(api, event, message) {
	const { senderID } = event;
	const config = loadConfig();
	const sent = await message.reply(
		`💳 𝗗𝗘𝗣𝗢𝗦𝗜𝗧 𝗙𝗨𝗡𝗗𝗦\n\n` +
		`Select Currency:\n\n` +
		`1️⃣ USD\n` +
		`2️⃣ BDT (1 USD = ${config.bdtRate} BDT)\n\n` +
		`👉 Reply 1 or 2`
	);
	if (sent) {
		global.GoatBot.onReply.set(sent.messageID, {
			commandName: "smm",
			messageID: sent.messageID,
			author: senderID,
			type: "depositCurrency"
		});
	}
}

async function showPlatformServices(api, event, message, platform, services, page = 1) {
	const { senderID } = event;
	const config = loadConfig();
	const perPage = 8;
	const totalPages = Math.ceil(services.length / perPage) || 1;
	if (page > totalPages) page = totalPages;
	if (page < 1) page = 1;

	const start = (page - 1) * perPage;
	const pageServices = services.slice(start, start + perPage);

	let msg = `📋 ${platform.toUpperCase()} SERVICES\nPage ${page}/${totalPages} | Total: ${services.length}\n\n`;
	pageServices.forEach((s, i) => {
		const p = calculatePrice(s.rate, s.min, config.markupPercent);
		msg += `${i + 1}. [ID:${s.service}] ${s.name.substring(0, 42)}\n`;
		msg += `   $${s.rate}/1k | Min ${s.min} → $${p.sell}\n\n`;
	});
	msg += `👉 number / next / prev / back`;

	const sent = await message.reply(msg);
	if (sent) {
		global.GoatBot.onReply.set(sent.messageID, {
			commandName: "smm",
			messageID: sent.messageID,
			author: senderID,
			type: "platformServices",
			platform,
			services,
			page,
			pageServices
		});
	}
}
