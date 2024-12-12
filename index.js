// discord.jsライブラリの中から必要な設定を呼び出し、変数に保存します
const { Client, Events, GatewayIntentBits } = require('discord.js');

// 設定ファイルからトークン情報を呼び出し、変数に保存します
const { token } = require('./config.json');

// クライアントインスタンスと呼ばれるオブジェクトを作成します
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// クライアントオブジェクトが準備OKとなったとき一度だけ実行されます
client.once(Events.ClientReady, c => {
	console.log(`準備OKです! ${c.user.tag}がログインします。`);
});

// ログインします
client.login(token);