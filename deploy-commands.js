// discord.js v14では、下のようにRESTとRoutesはdiscord.jsパッケージから直接インポート可能
const { REST, Routes } = require('discord.js');
// 環境変数としてapplicationId, guildId, tokenの3つが必要
const { applicationId, guildId, token } = require('./config.json');
// hey.jsのmodule.exportsを呼び出す
const { commands } = require('./commands/fund.js');

// すべてのコマンドをリスト形式で登録
const commandData = commands.map(command => command.data.toJSON());

// DiscordのAPIには現在最新のversion10を指定
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(applicationId, guildId),
            { body: commandData },
        );
        console.log('サーバー固有のコマンドが登録されました！');
    } catch (error) {
        console.error('コマンドの登録中にエラーが発生しました:', error);
    }
})();