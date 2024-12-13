const { Client, Events, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');
//const { commands } = require('./commands/fund.js');
// ディレクトリから読み込む
const { readdirSync } = require('fs');

// コマンドを保持するマップ
const commands = new Map();
const commandFiles = readdirSync('./commands').filter(file => file.endsWith('.js'));

// 各コマンドファイルからコマンドをロード
for (const file of commandFiles) {
    const commandModule = require(`./commands/${file}`);
    if (Array.isArray(commandModule.commands)) {
        for (const cmd of commandModule.commands) {
            commands.set(cmd.data.name, cmd);
        }
    }
}

// クライアントインスタンスを作成
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// クライアントオブジェクトが準備OKとなったとき一度だけ実行される(と思う)
client.once(Events.ClientReady, c => {
    console.log(`準備OKです! ${c.user.tag}がログインします。`);
    console.log('Your Discord.js Version is ' + require('discord.js').version);
});

// スラッシュコマンドに応答するためのイベントリスナー
client.on(Events.InteractionCreate, async interaction => {

    // ここでスラッシュがついているかどうかを判断してreturn。 StartWithでも挙動はおなじ？だが、メソッド用意されてるなら使おう精神。
    if (!interaction.isChatInputCommand()) return;

    // 実行されたコマンドを探索
    //const command = commands.find(cmd => cmd.data.name === interaction.commandName);
    const command = commands.get(interaction.commandName);

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