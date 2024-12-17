// SlashCommandBuilder という部品を discord.js からインポート
const { SlashCommandBuilder } = require('discord.js');

// 以下の形式にすることで、他のファイルでインポートして使用できるようになるらしい。
module.exports = {
    commands: [
        {
            data: new SlashCommandBuilder()
                .setName('epen')
                .setDescription('Epenを労るコマンドです(笑)'),
            execute: async function(interaction) {
                await interaction.reply('まいにちがんばっててえらいね:Bikyaku:、えぺんちゃん！よしよし( T_T)＼(^-^ )');
            },
        },
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

            // ここの役職一覧、およびその説明はjsonかcsvなどの外部ファイル形式で管理するか、DB使いたいねぇ
            data: new SlashCommandBuilder()
                .setName('intro')
                .setDescription('人狼ゲームの役職と陣営について説明します')
                .addStringOption(option => 
                    option.setName('role')
                        .setDescription('知りたい役職を選択してください')
                        .setRequired(true)
                        .addChoices(
                            { name: '占い師', value: 'seer' },
                            { name: '人狼', value: 'werewolf' },
                            { name: '村人', value: 'villager' }
                        )),
            execute: async function(interaction) {
                const role = interaction.options.getString('role');
                let description = '';

                switch (role) {
                    case 'seer':
                        description = '占い師: 毎晩1人を占い、その人が人狼かどうかを知ることができます。村人陣営です。';
                        break;
                    case 'werewolf':
                        description = '人狼: 夜に村人を1人襲撃します。人狼陣営です。村人の数を人狼の数以下にすることが目標です。';
                        break;
                    case 'villager':
                        description = '村人: 特別な能力はありませんが、投票で人狼を見つけることが目標です。村人陣営です。';
                        break;
                    default:
                        description = '指定された役職が見つかりません。';
                }

                await interaction.reply(description);
            },
        },
        {
            data: new SlashCommandBuilder()
                .setName('wtf')
                .setDescription('迷言'),
            execute: async function(interaction) {
                const jokes = [
                    'うわなにをするくぁwせdrftgyふじこlp',
                    '病気かな？ 病気じゃないよ 病気だよ',
                    'まるで将棋だな。',
                    'おもしれー女',
                    '真の男女平等主義者な俺は、女の子相手でもドロップキックをくらわせられる男',
                    '芋けんぴ髪に付いてたよ',
                    'ギャーギャーギャーギャーやかましいんだよ。発情期ですかコノヤロー',
                    '野球拳をしたら全裸になるのが常識だろう？',
                    '健康的な下乳を見ると健康になれるから最高！！'
                ];
                const joke = jokes[Math.floor(Math.random() * jokes.length)];
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