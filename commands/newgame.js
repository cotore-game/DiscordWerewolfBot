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
                .setName('newgame')
                .setDescription('新しいゲームを開始します'),
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
                .setName('forcetoendgame')
                .setDescription('すおくあ以外はコマンドを実行しないこと。'),
            execute: async function(interaction){
                gameState = gameStatus.waiting;
                participants.clear();
                await interaction.reply('むりやりゲーム終了');
                return;
            }
        },

        // ゲーム開始
        {
            data: new SlashCommandBuilder()
                .setName('startgame')
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

        // ゲームの進行設定 ボタンとかトグル系のUIに変更すべき
        {
            data: new SlashCommandBuilder()
                .setName('settings')
                .setDescription('ゲームの設定を変更します'),
            execute: async function(interaction) {
                const modal = new ModalBuilder()
                    .setCustomId('game_settings')
                    .setTitle('ゲーム設定');

                const roleInput = new TextInputBuilder()
                    .setCustomId('roles')
                    .setLabel('役職設定 (例: 占い師1,人狼1,村人2)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('占い師1,人狼1,村人2');

                const minPlayersInput = new TextInputBuilder()
                    .setCustomId('min_players')
                    .setLabel('最低人数')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(`${gameSettings.minPlayers}`);

                const firstNightSeerInput = new TextInputBuilder()
                    .setCustomId('first_night_seer')
                    .setLabel('初夜に占いを許可する (true/false)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(`${gameSettings.firstNightSeer}`);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(roleInput),
                    new ActionRowBuilder().addComponents(minPlayersInput),
                    new ActionRowBuilder().addComponents(firstNightSeerInput)
                );

                await interaction.showModal(modal);

                const filter = i => i.customId === 'game_settings' && i.user.id === interaction.user.id;
                interaction.awaitModalSubmit({ filter })
                    .then(async modalInteraction => {
                        const roles = modalInteraction.fields.getTextInputValue('roles');
                        const minPlayers = parseInt(modalInteraction.fields.getTextInputValue('min_players'), 10);
                        const firstNightSeer = modalInteraction.fields.getTextInputValue('first_night_seer').toLowerCase() === 'true';

                        try {
                            const rolePairs = roles.split(',').map(role => role.trim().split(/\s+/));
                            gameSettings.roles = Object.fromEntries(rolePairs.map(([role, count]) => [role, parseInt(count, 10)]));
                            gameSettings.minPlayers = minPlayers;
                            gameSettings.firstNightSeer = firstNightSeer;

                            await modalInteraction.reply('設定が更新されました！');
                        } catch (error) {
                            console.error(error);
                            await modalInteraction.reply('設定の更新に失敗しました。形式を確認してください。', { ephemeral: true });
                        }
                    })
                    .catch(() => {
                        interaction.followUp('設定がタイムアウトしました。再度お試しください。');
                    });
            }
        }
    ]
};