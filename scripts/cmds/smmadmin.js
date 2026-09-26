const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

const CONFIG_PATH = path.join(__dirname, "smmConfig.json");
const ORDERS_PATH = path.join(__dirname, "smmOrders.json");
const DEPOSITS_PATH = path.join(__dirname, "smmDeposits.json");

function loadConfig() {
	try { return fs.readJsonSync(CONFIG_PATH); } 
	catch (e) { 
		return {
			apiUrl: "https://cruxsmm.com/api/v2",
			apiKey: "ba0cb1af8eaad9154e62b77358cf4131",
			markupPercent: 30,
			bdtRate: 130,
			currency: "USD",
			adminUID: []
		}; 
	}
}

function saveConfig(data) {
	fs.writeJsonSync(CONFIG_PATH, data, { spaces: 2 });
}

function loadOrders() {
	try { return fs.readJsonSync(ORDERS_PATH); } catch (e) { return {}; }
}

function loadDeposits() {
	try { return fs.readJsonSync(DEPOSITS_PATH); } catch (e) { return {}; }
}

function saveDeposits(data) {
	fs.writeJsonSync(DEPOSITS_PATH, data, { spaces: 2 });
}

async function apiRequest(params) {
	const config = loadConfig();
	try {
		const res = await axios.post(config.apiUrl, null, {
			params: { key: config.apiKey, ...params },
			timeout: 20000
		});
		return res.data;
	} catch (err) {
		return { error: err.response?.data?.error || err.message };
	}
}

// ==================== BALANCE (SAME AS smm.js) ====================
async function getUserBalance(usersData, uid) {
	try {
		const data = await usersData.get(String(uid));
		if (!data) return 0;
		const bal = data.smmBalance !== undefined ? data.smmBalance : (data.data?.smmBalance || 0);
		return parseFloat(bal) || 0;
	} catch (e) {
		return 0;
	}
}

async function setUserBalance(usersData, uid, amount) {
	try {
		let data = await usersData.get(String(uid)) || {};
		data.smmBalance = parseFloat(amount) || 0;
		await usersData.set(String(uid), data);
		return true;
	} catch (e) {
		console.log("setUserBalance error:", e.message);
		return false;
	}
}

async function addUserBalance(usersData, uid, amount) {
	const current = await getUserBalance(usersData, uid);
	const newBal = current + parseFloat(amount);
	await setUserBalance(usersData, uid, newBal);
	return newBal;
}

function formatMoney(amount) {
	return parseFloat(amount || 0).toFixed(4);
}

module.exports = {
	config: {
		name: "smmadmin",
		version: "3.2.0",
		author: "Toxic Sabbir | Professional Trader",
		countDown: 2,
		role: 2,
		description: {
			en: "SMM Admin Panel - Interactive + Deposit Approve"
		},
		category: "SMM PANEL",
		guide: {
			en: "{pn} → Open Admin Menu\n{pn} approve <ID>\n{pn} reject <ID>\n{pn} pending\n{pn} credit <uid> <amount>"
		}
	},

	onStart: async function ({ api, event, args, message, usersData, role }) {
		if (role < 2) return message.reply("❌ Bot Admin only.");

		const config = loadConfig();

		// Direct commands
		if (args[0]) {
			const cmd = args[0].toLowerCase();

			if (cmd === "approve") {
				return handleApprove(api, event, args[1], message, usersData);
			}
			if (cmd === "reject") {
				return handleReject(api, event, args[1], message, usersData);
			}
			if (cmd === "pending" || cmd === "deposits") {
				return showPending(message);
			}
			if (cmd === "credit" || cmd === "add") {
				const uid = args[1];
				const amount = parseFloat(args[2]);
				if (!uid || isNaN(amount) || amount <= 0) return message.reply("❌ Usage: smmadmin credit <uid> <amount>");
				const newBal = await addUserBalance(usersData, uid, amount);
				try {
					await api.sendMessage(`✅ Balance Credited!\n\nAmount: +$${formatMoney(amount)}\nNew Balance: $${formatMoney(newBal)}`, uid);
				} catch (e) {}
				return message.reply(`✅ Credited $${formatMoney(amount)} to ${uid}\nNew Balance: $${formatMoney(newBal)}`);
			}
			if (cmd === "debit" || cmd === "remove") {
				const uid = args[1];
				const amount = parseFloat(args[2]);
				if (!uid || isNaN(amount) || amount <= 0) return message.reply("❌ Usage: smmadmin debit <uid> <amount>");
				const current = await getUserBalance(usersData, uid);
				const newBal = Math.max(0, current - amount);
				await setUserBalance(usersData, uid, newBal);
				try {
					await api.sendMessage(`⚠️ Balance Debited\n\nAmount: -$${formatMoney(amount)}\nNew Balance: $${formatMoney(newBal)}`, uid);
				} catch (e) {}
				return message.reply(`✅ Debited $${formatMoney(amount)} from ${uid}\nNew Balance: $${formatMoney(newBal)}`);
			}
			if (cmd === "setbal") {
				const uid = args[1];
				const amount = parseFloat(args[2]);
				if (!uid || isNaN(amount)) return message.reply("❌ Usage: smmadmin setbal <uid> <amount>");
				await setUserBalance(usersData, uid, amount);
				return message.reply(`✅ Balance of ${uid} set to $${formatMoney(amount)}`);
			}
			if (cmd === "bal" || cmd === "balance") {
				const uid = args[1] || event.senderID;
				const bal = await getUserBalance(usersData, uid);
				return message.reply(`💰 User: ${uid}\nBalance: $${formatMoney(bal)}`);
			}
			if (cmd === "setkey") {
				const key = args[1];
				if (!key) return message.reply("❌ Usage: smmadmin setkey <api_key>");
				config.apiKey = key;
				saveConfig(config);
				return message.reply("✅ API Key updated!");
			}
			if (cmd === "seturl") {
				const url = args[1];
				if (!url || !url.startsWith("http")) return message.reply("❌ Usage: smmadmin seturl https://...");
				config.apiUrl = url;
				saveConfig(config);
				return message.reply(`✅ API URL updated`);
			}
			if (cmd === "setmarkup") {
				const percent = parseFloat(args[1]);
				if (isNaN(percent) || percent < 0) return message.reply("❌ Usage: smmadmin setmarkup 30");
				config.markupPercent = percent;
				saveConfig(config);
				return message.reply(`✅ Markup set to ${percent}%`);
			}
			if (cmd === "setbdtrate") {
				const rate = parseFloat(args[1]);
				if (isNaN(rate) || rate <= 0) return message.reply("❌ Usage: smmadmin setbdtrate 130");
				config.bdtRate = rate;
				saveConfig(config);
				return message.reply(`✅ BDT Rate: 1 USD = ${rate} BDT`);
			}
			if (cmd === "setadmin") {
				// Quick way to add admin UID to smmConfig
				const uid = args[1];
				if (!uid) return message.reply("❌ Usage: smmadmin setadmin <uid>");
				if (!config.adminUID) config.adminUID = [];
				if (!config.adminUID.includes(uid)) {
					config.adminUID.push(uid);
					saveConfig(config);
				}
				return message.reply(`✅ Added ${uid} to SMM Admin list\nCurrent: ${config.adminUID.join(", ")}`);
			}
			if (cmd === "config") {
				return message.reply(
					`⚙️ 𝗦𝗠𝗠 𝗖𝗢𝗡𝗙𝗜𝗚\n\n` +
					`API URL: ${config.apiUrl}\n` +
					`API Key: ${config.apiKey ? config.apiKey.substring(0, 6) + "****" : "Not set"}\n` +
					`Markup: ${config.markupPercent}%\n` +
					`BDT Rate: 1 USD = ${config.bdtRate} BDT\n` +
					`SMM Admins: ${(config.adminUID || []).join(", ") || "None"}`
				);
			}
			if (cmd === "providerbal" || cmd === "pbal") {
				const data = await apiRequest({ action: "balance" });
				if (data.error) return message.reply(`❌ ${data.error}`);
				return message.reply(`💰 Provider Balance: $${data.balance} ${data.currency || "USD"}`);
			}
			if (cmd === "stats") {
				const orders = loadOrders();
				const deposits = loadDeposits();
				let totalOrders = 0, totalRevenue = 0, totalProfit = 0, totalUsers = 0, totalDeposited = 0, pendingCount = 0;
				for (const uid in orders) {
					totalUsers++;
					orders[uid].forEach(o => {
						totalOrders++;
						totalRevenue += parseFloat(o.charge || 0);
						totalProfit += parseFloat(o.profit || 0);
					});
				}
				Object.values(deposits).forEach(d => {
					if (d.status === "approved") totalDeposited += parseFloat(d.usdAmount || 0);
					if (d.status === "pending") pendingCount++;
				});
				return message.reply(
					`📊 𝗦𝗠𝗠 𝗦𝗧𝗔𝗧𝗦\n\n` +
					`Users: ${totalUsers}\nOrders: ${totalOrders}\n` +
					`Revenue: $${totalRevenue.toFixed(4)}\nProfit: $${totalProfit.toFixed(4)}\n` +
					`Deposited: $${totalDeposited.toFixed(4)}\nPending: ${pendingCount}`
				);
			}
		}

		// ===== INTERACTIVE MENU =====
		const menu =
			`🛠️ 𝗦𝗠𝗠 𝗔𝗗𝗠𝗜𝗡 𝗣𝗔𝗡𝗘𝗟\n\n` +
			`1️⃣ Pending Deposits\n` +
			`2️⃣ Credit User\n` +
			`3️⃣ Debit User\n` +
			`4️⃣ Check User Balance\n` +
			`5️⃣ Provider Balance\n` +
			`6️⃣ Panel Stats\n` +
			`7️⃣ Config / Settings\n\n` +
			`👉 Reply with number (1-7)`;

		const sent = await message.reply(menu);
		if (sent) {
			global.GoatBot.onReply.set(sent.messageID, {
				commandName: "smmadmin",
				messageID: sent.messageID,
				author: event.senderID,
				type: "adminMenu"
			});
		}
	},

	onReply: async function ({ api, event, Reply, message, usersData, role }) {
		const { senderID, body, threadID, messageID } = event;

		if (Reply.author && Reply.author !== senderID && role < 2) {
			return api.sendMessage("❌ This is not for you!", threadID, messageID);
		}

		const choice = (body || "").trim().toLowerCase();
		const config = loadConfig();

		// ========== DEPOSIT ACTION (reply approve / reject) ==========
		if (Reply.type === "depositAction") {
			const depId = Reply.depositId;

			if (choice === "approve" || choice === "yes" || choice === "ok" || choice === "a") {
				global.GoatBot.onReply.delete(Reply.messageID);
				return handleApprove(api, event, depId, message, usersData);
			}
			if (choice === "reject" || choice === "no" || choice === "r") {
				global.GoatBot.onReply.delete(Reply.messageID);
				return handleReject(api, event, depId, message, usersData);
			}
			return message.reply("❌ Reply with: approve  or  reject");
		}

		// ========== ADMIN MENU ==========
		if (Reply.type === "adminMenu") {
			if (choice === "1") {
				global.GoatBot.onReply.delete(Reply.messageID);
				return showPending(message);
			}
			if (choice === "2") {
				global.GoatBot.onReply.delete(Reply.messageID);
				const sent = await message.reply("💰 Credit User\n\nSend: <uid> <amount>\nExample: 1000123456789 50");
				if (sent) {
					global.GoatBot.onReply.set(sent.messageID, {
						commandName: "smmadmin",
						messageID: sent.messageID,
						author: senderID,
						type: "creditUser"
					});
				}
				return;
			}
			if (choice === "3") {
				global.GoatBot.onReply.delete(Reply.messageID);
				const sent = await message.reply("💸 Debit User\n\nSend: <uid> <amount>\nExample: 1000123456789 10");
				if (sent) {
					global.GoatBot.onReply.set(sent.messageID, {
						commandName: "smmadmin",
						messageID: sent.messageID,
						author: senderID,
						type: "debitUser"
					});
				}
				return;
			}
			if (choice === "4") {
				global.GoatBot.onReply.delete(Reply.messageID);
				const sent = await message.reply("🔍 Check Balance\n\nSend User ID:");
				if (sent) {
					global.GoatBot.onReply.set(sent.messageID, {
						commandName: "smmadmin",
						messageID: sent.messageID,
						author: senderID,
						type: "checkBal"
					});
				}
				return;
			}
			if (choice === "5") {
				global.GoatBot.onReply.delete(Reply.messageID);
				const data = await apiRequest({ action: "balance" });
				if (data.error) return message.reply(`❌ ${data.error}`);
				return message.reply(`💰 Provider Balance: $${data.balance} ${data.currency || "USD"}`);
			}
			if (choice === "6") {
				global.GoatBot.onReply.delete(Reply.messageID);
				const orders = loadOrders();
				const deposits = loadDeposits();
				let totalOrders = 0, totalRevenue = 0, totalProfit = 0, totalUsers = 0, totalDeposited = 0, pendingCount = 0;
				for (const uid in orders) {
					totalUsers++;
					orders[uid].forEach(o => {
						totalOrders++;
						totalRevenue += parseFloat(o.charge || 0);
						totalProfit += parseFloat(o.profit || 0);
					});
				}
				Object.values(deposits).forEach(d => {
					if (d.status === "approved") totalDeposited += parseFloat(d.usdAmount || 0);
					if (d.status === "pending") pendingCount++;
				});
				return message.reply(
					`📊 𝗦𝗠𝗠 𝗦𝗧𝗔𝗧𝗦\n\n` +
					`Users: ${totalUsers}\nOrders: ${totalOrders}\n` +
					`Revenue: $${totalRevenue.toFixed(4)}\nProfit: $${totalProfit.toFixed(4)}\n` +
					`Deposited: $${totalDeposited.toFixed(4)}\nPending: ${pendingCount}`
				);
			}
			if (choice === "7") {
				global.GoatBot.onReply.delete(Reply.messageID);
				return message.reply(
					`⚙️ 𝗦𝗠𝗠 𝗖𝗢𝗡𝗙𝗜𝗚\n\n` +
					`API URL: ${config.apiUrl}\n` +
					`API Key: ${config.apiKey ? config.apiKey.substring(0, 6) + "****" : "Not set"}\n` +
					`Markup: ${config.markupPercent}%\n` +
					`BDT Rate: 1 USD = ${config.bdtRate} BDT\n` +
					`SMM Admins: ${(config.adminUID || []).join(", ") || "None"}\n\n` +
					`Commands:\nsmmadmin setkey ...\nsmmadmin setmarkup 30\nsmmadmin setadmin YOUR_UID`
				);
			}
			return message.reply("❌ Invalid. Reply 1-7");
		}

		// ========== CREDIT / DEBIT / CHECK ==========
		if (Reply.type === "creditUser") {
			const parts = body.trim().split(/\s+/);
			const uid = parts[0];
			const amount = parseFloat(parts[1]);
			if (!uid || isNaN(amount) || amount <= 0) return message.reply("❌ Format: <uid> <amount>");
			global.GoatBot.onReply.delete(Reply.messageID);
			const newBal = await addUserBalance(usersData, uid, amount);
			try {
				await api.sendMessage(`✅ Balance Credited!\n\nAmount: +$${formatMoney(amount)}\nNew Balance: $${formatMoney(newBal)}`, uid);
			} catch (e) {}
			return message.reply(`✅ Credited $${formatMoney(amount)} to ${uid}\nNew Balance: $${formatMoney(newBal)}`);
		}

		if (Reply.type === "debitUser") {
			const parts = body.trim().split(/\s+/);
			const uid = parts[0];
			const amount = parseFloat(parts[1]);
			if (!uid || isNaN(amount) || amount <= 0) return message.reply("❌ Format: <uid> <amount>");
			global.GoatBot.onReply.delete(Reply.messageID);
			const current = await getUserBalance(usersData, uid);
			const newBal = Math.max(0, current - amount);
			await setUserBalance(usersData, uid, newBal);
			try {
				await api.sendMessage(`⚠️ Balance Debited\n\nAmount: -$${formatMoney(amount)}\nNew Balance: $${formatMoney(newBal)}`, uid);
			} catch (e) {}
			return message.reply(`✅ Debited $${formatMoney(amount)} from ${uid}\nNew Balance: $${formatMoney(newBal)}`);
		}

		if (Reply.type === "checkBal") {
			const uid = body.trim();
			if (!uid) return message.reply("❌ Send User ID");
			global.GoatBot.onReply.delete(Reply.messageID);
			const bal = await getUserBalance(usersData, uid);
			return message.reply(`💰 User: ${uid}\nBalance: $${formatMoney(bal)}`);
		}
	}
};

// ==================== APPROVE / REJECT ====================
async function handleApprove(api, event, depId, message, usersData) {
	if (!depId) return message.reply("❌ Deposit ID missing");

	const deposits = loadDeposits();
	const dep = deposits[depId];
	if (!dep) return message.reply("❌ Deposit ID not found.");
	if (dep.status !== "pending") return message.reply(`❌ Already ${dep.status}`);

	const addAmount = parseFloat(dep.usdAmount);
	const newBal = await addUserBalance(usersData, dep.userID, addAmount);

	dep.status = "approved";
	dep.approvedBy = event.senderID;
	dep.approvedAt = new Date().toISOString();
	saveDeposits(deposits);

	// Clear notification to user with correct amount
	try {
		await api.sendMessage(
			`✅ 𝗗𝗘𝗣𝗢𝗦𝗜𝗧 𝗔𝗣𝗣𝗥𝗢𝗩𝗘𝗗\n\n` +
			`Deposit ID: ${depId}\n` +
			`Amount Added: $${formatMoney(addAmount)} USD\n` +
			`Your New Balance: $${formatMoney(newBal)}\n\n` +
			`Thank you! Now type: smm`,
			dep.userID
		);
	} catch (e) {
		console.log("Failed to notify user:", e.message);
	}

	return message.reply(
		`✅ 𝗗𝗘𝗣𝗢𝗦𝗜𝗧 𝗔𝗣𝗣𝗥𝗢𝗩𝗘𝗗\n\n` +
		`ID: ${depId}\n` +
		`User: ${dep.userID}\n` +
		`Added: $${formatMoney(addAmount)}\n` +
		`User New Balance: $${formatMoney(newBal)}`
	);
}

async function handleReject(api, event, depId, message, usersData) {
	if (!depId) return message.reply("❌ Deposit ID missing");

	const deposits = loadDeposits();
	const dep = deposits[depId];
	if (!dep) return message.reply("❌ Deposit ID not found.");
	if (dep.status !== "pending") return message.reply(`❌ Already ${dep.status}`);

	dep.status = "rejected";
	dep.rejectedBy = event.senderID;
	dep.rejectedAt = new Date().toISOString();
	saveDeposits(deposits);

	try {
		await api.sendMessage(
			`❌ 𝗗𝗘𝗣𝗢𝗦𝗜𝗧 𝗥𝗘𝗝𝗘𝗖𝗧𝗘𝗗\n\n` +
			`Deposit ID: ${depId}\n` +
			`Amount: ${dep.amount} ${dep.currency}\n` +
			`TRX: ${dep.trx}\n\n` +
			`Please contact admin if needed.`,
			dep.userID
		);
	} catch (e) {}

	return message.reply(`✅ Deposit ${depId} rejected.\nUser notified.`);
}

async function showPending(message) {
	const deposits = loadDeposits();
	const pending = Object.values(deposits).filter(d => d.status === "pending");
	if (pending.length === 0) return message.reply("✅ No pending deposits.");

	let msg = `💳 𝗣𝗘𝗡𝗗𝗜𝗡𝗚 𝗗𝗘𝗣𝗢𝗦𝗜𝗧𝗦 (${pending.length})\n\n`;
	pending.forEach((d, i) => {
		msg += `${i + 1}. ${d.id}\n`;
		msg += `   User: ${d.userID}\n`;
		msg += `   ${d.amount} ${d.currency} → $${parseFloat(d.usdAmount).toFixed(4)}\n`;
		msg += `   TRX: ${d.trx}\n\n`;
	});
	msg += `Approve: smmadmin approve <ID>\nOr reply "approve" under the notification.`;
	return message.reply(msg);
}
