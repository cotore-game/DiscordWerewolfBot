// discord.js v14では、下のようにRESTとRoutesはdiscord.jsパッケージから直接インポート可能
const { REST, Routes } = require('discord.js');
// 環境変数としてapplicationId, guildId, tokenの3つが必要
const { applicationId, guildId, token } = require('./config.json');
// jsのmodule.exportsを呼び出す
//const { commands } = require('./commands/fund.js');

// ディレクトリを読み込む為
const { readdirSync } = require('fs');

// すべてのコマンドをリスト形式で登録
//const commandData = commands.map(command => command.data.toJSON());

// コマンドフォルダをスキャンしてすべてのコマンドを収集
const commands = [];
const commandFiles = readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const commandModule = require(`./commands/${file}`);
    if (Array.isArray(commandModule.commands)) {
        commands.push(...commandModule.commands.map(cmd => cmd.data.toJSON()));
    }
}

// DiscordのAPIには現在最新のversion10を指定
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(applicationId, guildId),
            { body: commands },
        );
        console.log('サーバー固有のコマンドが登録されました！');
    } catch (error) {
        console.error('コマンドの登録中にエラーが発生しました:', error);
    }
})();