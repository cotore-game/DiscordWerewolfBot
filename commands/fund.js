// SlashCommandBuilder という部品を discord.js からインポート
const { SlashCommandBuilder } = require('discord.js');
const words = require('../gameData/wtf.json');

// 以下の形式にすることで、他のファイルでインポートして使用できるようになるらしい。
module.exports = {
    commands: [
        {
            data: new SlashCommandBuilder()
                .setName('selfintro')
                .setDescription('ボットの自己紹介を送信するコマンドです'),
            execute: async function(interaction) {
                try {
                    // インタラクションのプロパティにuserがあり、それが送信者の情報を保持してるみたい
                    await interaction.user.send('こんにちは！私は人狼ゲームをサポートするボットです。ゲームの進行や役職説明などを行います。ぜひ使ってみてください！');

                    // このephemeral属性は、コマンド送信者のみに表示されるメッセージかどうかのフラグ
                    await interaction.reply({ content: 'DMに自己紹介を送信しました！', ephemeral: true });
                } catch (error) {
                    console.error(error);
                    await interaction.reply({ content: 'DMの送信に失敗しました。DMが有効になっているか確認してください。', ephemeral: true });
                }
            },
        },
        {
            data: new SlashCommandBuilder()
                .setName('wtf')
                .setDescription('迷言'),
            execute: async function(interaction) {
                const joke = words.phrases[Math.floor(Math.random() * words.phrases.length)];
                await interaction.reply(joke);
            }
        }
    ]
};

// module.exportsの補足
// キー・バリューの連想配列のような形で構成されています。
//
// module.exports = {
//    キー: バリュー,
//    キー: バリュー,
// };
//