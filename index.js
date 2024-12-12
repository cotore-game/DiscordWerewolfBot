const { Client, Events, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');
const { commands } = require('./commands/fund.js');

// クライアントインスタンスを作成
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// クライアントオブジェクトが準備OKとなったとき一度だけ実行される(と思う)
client.once(Events.ClientReady, c => {
    console.log(`準備OKです! ${c.user.tag}がログインします。`);
});

// スラッシュコマンドに応答するためのイベントリスナー
client.on(Events.InteractionCreate, async interaction => {

    // ここでスラッシュがついているかどうかを判断してreturn
    if (!interaction.isChatInputCommand()) return;

    // 実行されたコマンドを探索
    const command = commands.find(cmd => cmd.data.name === interaction.commandName);

    if (!command) {
        console.error(`${interaction.commandName}というコマンドには対応していません。`);
        return;
    }

    try {
        // コマンドの実行
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'コマンド実行時にエラーになりました。', ephemeral: true });
        } else {
            await interaction.reply({ content: 'コマンド実行時にエラーになりました。', ephemeral: true });
        }
    }
});

// ログイン
client.login(token);