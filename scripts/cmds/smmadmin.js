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
			currency: "USD"
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

module.exports = {
	config: {
		name: "smmadmin",
		version: "3.0.0",
		author: "Toxic Sabbir | Professional Trader",
		countDown: 2,
		role: 2,
		description: {
			en: "SMM Admin Panel - Credit, Debit, Approve Deposit, Config"
		},
		category: "SMM PANEL",
		guide: {
			en:
				"{pn}\n" +
				"{pn} credit <uid> <amount>\n" +
				"{pn} debit <uid> <amount>\n" +
				"{pn} setbal <uid> <amount>\n" +
				"{pn} bal <uid>\n" +
				"{pn} approve <depositID>\n" +
				"{pn} reject <depositID>\n" +
				"{pn} pending → See pending deposits\n" +
				"{pn} setkey <key>\n" +
				"{pn} seturl <url>\n" +
				"{pn} setmarkup <percent>\n" +
				"{pn} setbdtrate <rate>\n" +
				"{pn} config\n" +
				"{pn} providerbal\n" +
				"{pn} stats"
		}
	},

	onStart: async function ({ api, event, args, message, usersData, role }) {
		if (role < 2) return message.reply("❌ Bot Admin only.");

		const config = loadConfig();

		if (!args[0]) {
			return message.reply(
				`🛠️ 𝗦𝗠𝗠 𝗔𝗗𝗠𝗜𝗡 𝗣𝗔𝗡𝗘𝗟\n\n` +
				`💰 Balance Control:\n` +
				`• credit <uid> <amount>\n` +
				`• debit <uid> <amount>\n` +
				`• setbal <uid> <amount>\n` +
				`• bal <uid>\n\n` +
				`💳 Deposit Control:\n` +
				`• pending\n` +
				`• approve <depositID>\n` +
				`• reject <depositID>\n\n` +
				`⚙️ Settings:\n` +
				`• setkey <api_key>\n` +
				`• seturl <url>\n` +
				`• setmarkup <percent>\n` +
				`• setbdtrate <rate>\n` +
				`• config\n` +
				`• providerbal\n` +
				`• stats`
			);
		}

		const cmd = args[0].toLowerCase();

		// ===== CREDIT =====
		if (cmd === "credit" || cmd === "add") {
			const uid = args[1];
			const amount = parseFloat(args[2]);
			if (!uid || isNaN(amount) || amount <= 0) {
				return message.reply("❌ Usage: smmadmin credit <uid> <amount>");
			}
			const newBal = await addUserBalance(usersData, uid, amount);
			try {
				await api.sendMessage(
					`✅ Your SMM balance has been credited!\n\n` +
					`Amount: +$${amount.toFixed(4)}\n` +
					`New Balance: $${newBal.toFixed(4)}`,
					uid
				);
			} catch (e) {}
			return message.reply(`✅ Credited $${amount.toFixed(4)} to ${uid}\nNew Balance: $${newBal.toFixed(4)}`);
		}

		// ===== DEBIT =====
		if (cmd === "debit" || cmd === "remove") {
			const uid = args[1];
			const amount = parseFloat(args[2]);
			if (!uid || isNaN(amount) || amount <= 0) {
				return message.reply("❌ Usage: smmadmin debit <uid> <amount>");
			}
			const current = await getUserBalance(usersData, uid);
			const newBal = Math.max(0, current - amount);
			await setUserBalance(usersData, uid, newBal);
			try {
				await api.sendMessage(
					`⚠️ Your SMM balance has been debited.\n\n` +
					`Amount: -$${amount.toFixed(4)}\n` +
					`New Balance: $${newBal.toFixed(4)}`,
					uid
				);
			} catch (e) {}
			return message.reply(`✅ Debited $${amount.toFixed(4)} from ${uid}\nNew Balance: $${newBal.toFixed(4)}`);
		}

		// ===== SET BALANCE =====
		if (cmd === "setbal" || cmd === "setbalance") {
			const uid = args[1];
			const amount = parseFloat(args[2]);
			if (!uid || isNaN(amount)) return message.reply("❌ Usage: smmadmin setbal <uid> <amount>");
			await setUserBalance(usersData, uid, amount);
			return message.reply(`✅ Balance of ${uid} set to $${amount.toFixed(4)}`);
		}

		// ===== CHECK BALANCE =====
		if (cmd === "bal" || cmd === "balance") {
			const uid = args[1] || event.senderID;
			const bal = await getUserBalance(usersData, uid);
			return message.reply(`💰 User: ${uid}\nBalance: $${bal.toFixed(4)}`);
		}

		// ===== PENDING DEPOSITS =====
		if (cmd === "pending" || cmd === "deposits") {
			const deposits = loadDeposits();
			const pending = Object.values(deposits).filter(d => d.status === "pending");
			if (pending.length === 0) return message.reply("✅ No pending deposits.");

			let msg = `💳 𝗣𝗘𝗡𝗗𝗜𝗡𝗚 𝗗𝗘𝗣𝗢𝗦𝗜𝗧𝗦 (${pending.length})\n\n`;
			pending.forEach((d, i) => {
				msg += `${i + 1}. ${d.id}\n`;
				msg += `   User: ${d.userID}\n`;
				msg += `   ${d.amount} ${d.currency} ($${parseFloat(d.usdAmount).toFixed(4)})\n`;
				msg += `   TRX: ${d.trx}\n`;
				msg += `   Time: ${new Date(d.time).toLocaleString()}\n\n`;
			});
			msg += `Approve: smmadmin approve <ID>\nReject: smmadmin reject <ID>`;
			return message.reply(msg);
		}

		// ===== APPROVE DEPOSIT =====
		if (cmd === "approve") {
			const depId = args[1];
			if (!depId) return message.reply("❌ Usage: smmadmin approve <depositID>");

			const deposits = loadDeposits();
			const dep = deposits[depId];
			if (!dep) return message.reply("❌ Deposit ID not found.");
			if (dep.status !== "pending") return message.reply(`❌ Already ${dep.status}`);

			const newBal = await addUserBalance(usersData, dep.userID, dep.usdAmount);
			dep.status = "approved";
			dep.approvedBy = event.senderID;
			dep.approvedAt = new Date().toISOString();
			saveDeposits(deposits);

			try {
				await api.sendMessage(
					`✅ 𝗗𝗘𝗣𝗢𝗦𝗜𝗧 𝗔𝗣𝗣𝗥𝗢𝗩𝗘𝗗\n\n` +
					`Deposit ID: ${depId}\n` +
					`Amount: ${dep.amount} ${dep.currency}\n` +
					`Added: $${parseFloat(dep.usdAmount).toFixed(4)} USD\n` +
					`New Balance: $${newBal.toFixed(4)}\n\n` +
					`Thank you! You can now place orders.`,
					dep.userID
				);
			} catch (e) {}

			return message.reply(
				`✅ Deposit Approved!\n\n` +
				`ID: ${depId}\n` +
				`User: ${dep.userID}\n` +
				`Added: $${parseFloat(dep.usdAmount).toFixed(4)}\n` +
				`User New Balance: $${newBal.toFixed(4)}`
			);
		}

		// ===== REJECT DEPOSIT =====
		if (cmd === "reject") {
			const depId = args[1];
			if (!depId) return message.reply("❌ Usage: smmadmin reject <depositID>");

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
					`Reason: Invalid transaction / Screenshot issue\n` +
					`Please contact admin if you think this is a mistake.`,
					dep.userID
				);
			} catch (e) {}

			return message.reply(`✅ Deposit ${depId} has been rejected.\nUser notified.`);
		}

		// ===== SET API KEY =====
		if (cmd === "setkey" || cmd === "apikey") {
			const key = args[1];
			if (!key) return message.reply("❌ Usage: smmadmin setkey <your_api_key>");
			config.apiKey = key;
			saveConfig(config);
			return message.reply("✅ API Key updated!");
		}

		// ===== SET API URL =====
		if (cmd === "seturl") {
			const url = args[1];
			if (!url || !url.startsWith("http")) return message.reply("❌ Usage: smmadmin seturl https://...");
			config.apiUrl = url;
			saveConfig(config);
			return message.reply(`✅ API URL updated to:\n${url}`);
		}

		// ===== SET MARKUP =====
		if (cmd === "setmarkup" || cmd === "markup") {
			const percent = parseFloat(args[1]);
			if (isNaN(percent) || percent < 0) return message.reply("❌ Usage: smmadmin setmarkup 30");
			config.markupPercent = percent;
			saveConfig(config);
			return message.reply(`✅ Markup set to ${percent}%`);
		}

		// ===== SET BDT RATE =====
		if (cmd === "setbdtrate" || cmd === "bdtrate") {
			const rate = parseFloat(args[1]);
			if (isNaN(rate) || rate <= 0) return message.reply("❌ Usage: smmadmin setbdtrate 130");
			config.bdtRate = rate;
			saveConfig(config);
			return message.reply(`✅ BDT Rate set to 1 USD = ${rate} BDT`);
		}

		// ===== CONFIG =====
		if (cmd === "config" || cmd === "settings") {
			return message.reply(
				`⚙️ 𝗦𝗠𝗠 𝗖𝗢𝗡𝗙𝗜𝗚\n\n` +
				`API URL: ${config.apiUrl}\n` +
				`API Key: ${config.apiKey ? config.apiKey.substring(0, 6) + "****" : "Not set"}\n` +
				`Markup: ${config.markupPercent}%\n` +
				`BDT Rate: 1 USD = ${config.bdtRate} BDT\n` +
				`Currency: ${config.currency || "USD"}`
			);
		}

		// ===== PROVIDER BALANCE =====
		if (cmd === "providerbal" || cmd === "pbal") {
			const data = await apiRequest({ action: "balance" });
			if (data.error) return message.reply(`❌ ${data.error}`);
			return message.reply(`💰 Provider Balance: $${data.balance} ${data.currency || "USD"}`);
		}

		// ===== STATS =====
		if (cmd === "stats") {
			const orders = loadOrders();
			const deposits = loadDeposits();
			let totalOrders = 0, totalRevenue = 0, totalProfit = 0, totalUsers = 0;
			let totalDeposited = 0, pendingCount = 0;

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
				`Users Ordered: ${totalUsers}\n` +
				`Total Orders: ${totalOrders}\n` +
				`Revenue: $${totalRevenue.toFixed(4)}\n` +
				`Profit: $${totalProfit.toFixed(4)}\n` +
				`Total Deposited: $${totalDeposited.toFixed(4)}\n` +
				`Pending Deposits: ${pendingCount}\n` +
				`Markup: ${config.markupPercent}%`
			);
		}

		return message.reply("❌ Unknown command. Type smmadmin");
	}
};
