// 新規ゲーム作成、終了、メンバー管理のみ
// ゲーム進行は別スクリプトにする

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    time
} = require('discord.js');

// 参加者リストを保持するセット
const participants = new Set();
// Enumの代わり
const gameStatus = Object.freeze({
    waiting: 'waiting',
    active: 'active',
    ended: 'ended',
})

let gameState = gameStatus.waiting; // ゲームの状態

let gameSettings = { // ゲーム設定の初期値 jsonでいずれ管理したい。DBでもいいよ
    roles: {
        seer: 1,
        werewolf: 1,
        villager: 2
    },
    minPlayers: 1,
    firstNightSeer: true
};

module.exports = {
    commands: [
        // 新規ゲーム作成
        {
            data: new SlashCommandBuilder()
                .setName('gcc-jinrou_newgame')
                .setDescription('新規人狼ゲームを作成します'),
            execute: async function(interaction) {
                // 例外処理
                if (gameState !== gameStatus.waiting) {
                    await interaction.reply({ content: '現在のゲームは進行中か終了済みのため、新しいゲームを開始できません。', ephemeral: true });
                    return;
                }

                // 参加ボタン作成
                const joinButton = new ButtonBuilder()
                    .setCustomId('join_game')
                    .setLabel('参加する')
                    .setStyle(ButtonStyle.Primary);

                const actionRow = new ActionRowBuilder().addComponents(joinButton);

                await interaction.reply({
                    content: '新しいゲームが始まりました！下のボタンを押して参加してください。',
                    components: [actionRow]
                });

                const filter = i => i.customId === 'join_game';
                const collector = interaction.channel.createMessageComponentCollector({ filter });

                collector.on('collect', async i => {
                    if (gameState !== gameStatus.waiting) {
                        await i.reply({ content: '現在のゲームは進行中か終了済みのため、参加できません。', ephemeral: true });
                        return;
                    }

                    if (participants.has(i.user)) {
                        await i.reply({ content: 'あなたはすでに参加しています！', ephemeral: true });
                    } else {
                        participants.add(i.user);
                        await i.reply(`${i.user.username} さんが参加しました！`);
                    }
                });
            }
        },

        // test用無理やりゲーム終了コマンド
        {
            data: new SlashCommandBuilder()
                .setName('gcc-jinrou_forcequit')
                .setDescription('すおくあ以外はコマンドを実行しないこと'),
            execute: async function(interaction){
                gameState = gameStatus.waiting;
                participants.clear();
                await interaction.reply('ゲーム強制終了');
                return;
            }
        },

        // ゲーム開始
        {
            data: new SlashCommandBuilder()
                .setName('gcc-jinrou_startgame')
                .setDescription('現在の参加者でゲームを開始します'),
            execute: async function(interaction) {
                // 例外処理
                if(gameState === gameStatus.ended) {
                    await interaction.reply(`ゲームを開始できません。新規ゲームを作成してください。`);
                    return;
                }

                if (gameState === gameStatus.active) {
                    await interaction.reply('ゲームを開始できません。現在のゲームは進行中です。');
                    return;
                }

                if (participants.size < gameSettings.minPlayers) {
                    await interaction.reply(`ゲームを開始できません。最低人数 (${gameSettings.minPlayers}) に達していません。`);
                    return;
                }

                //ゲーム開始時のDM
                const userList = Array.from(participants).map(user => user.username).join(', ');

                for (const user of participants) {
                    try {
                        await user.send('ゲームが開始されました！楽しんでください！');
                    } catch (error) {
                        console.error(`DM送信に失敗しました: ${user.username}`);
                    }
                }

                gameState = gameStatus.active;
                await interaction.reply(`ゲームが開始されました！参加者: ${userList}`);
            }
        },
    ]
};