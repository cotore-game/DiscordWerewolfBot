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
    EmbedBuilder
} = require('discord.js');
const fs = require('fs');
const roleFilePath = './gameData/werewolf/roles.json';
const configFilePath = './gameData/werewolf/setting.json';

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

let roleInfo = [];
let gameConfig = {};

// 役職データ読み込み関数
function loadRoleData() {
    try {
        const data = fs.readFileSync(roleFilePath, 'utf8');
        roleInfo = JSON.parse(data);
    } catch (error) {
        console.error('役職データの読み込みに失敗しました:', error);
        roleInfo = [];
    }
}

// 設定データの保存関数
function saveConfigData(config) {
    try {
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        console.error('設定データの保存に失敗しました:', error);
    }
}

// 初期データ読み込み
loadRoleData();

// 役職名を選択肢に変換する関数
function generateRoleChoices() {
    return roleInfo.map(role => ({
        name: role.RoleName,
        value: role.RoleName
    }));
}

module.exports = {
    commands: [
        {
            // 新規ゲーム作成
            data: new SlashCommandBuilder()
                .setName('jinrou_newgame')
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
        {
            // ゲーム開始
            data: new SlashCommandBuilder()
                .setName('jinrou_startgame')
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
        {
            data: new SlashCommandBuilder()
                .setName('jinrou_roleinfo')
                .setDescription('役職の説明をコマンドの使用者にのみ表示します')
                .addStringOption(option =>
                    option
                        .setName('rolename')
                        .setDescription('役職名を選択してください')
                        .setRequired(true)
                        .addChoices(...generateRoleChoices()) // 動的に選択肢を追加
                ),
            execute: async function (interaction) {
                const roleName = interaction.options.getString('rolename');
                const role = roleInfo.find(r => r.RoleName === roleName);

                if (!role) {
                    await interaction.reply({ content: 'その役職は存在しません。', ephemeral: true });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle(`役職情報: ${role.RoleName}`)
                    .setDescription(role.Description)
                    .addFields(
                        { name: '陣営', value: role.Party, inline: true },
                        { name: '白黒', value: role.Identity, inline: true }
                    )
                    .setColor(0x0099FF);

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        },
        {
            // 役職設定を入力・保存するコマンド
            data: new SlashCommandBuilder()
                .setName('jinrou_config')
                .setDescription('役職の人数や有無を設定します'),
            execute: async function (interaction) {
                // モーダル表示
                const modal = new ModalBuilder()
                    .setCustomId('jinrou_config_modal')
                    .setTitle('役職設定');

                const rolesInput = new TextInputBuilder()
                    .setCustomId('roles_input')
                    .setLabel('役職ごとの人数設定 (例: 占い師=1,人狼=2)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('役職=人数 をカンマ区切りで入力してください。')
                    .setRequired(true);

                const actionRow = new ActionRowBuilder().addComponents(rolesInput);
                modal.addComponents(actionRow);

                await interaction.showModal(modal);

                // モーダル送信後の処理
                const filter = i => i.customId === 'jinrou_config_modal';
                interaction.client.once('interactionCreate', async (modalInteraction) => {
                    if (!filter(modalInteraction)) return;

                    const input = modalInteraction.fields.getTextInputValue('roles_input');
                    const newConfig = {};

                    try {
                        // 入力をパースして保存
                        input.split(',').forEach(item => {
                            const [role, count] = item.split('=').map(s => s.trim());
                            newConfig[role] = parseInt(count, 10);
                        });

                        saveConfigData(newConfig);
                        gameConfig = newConfig;

                        await modalInteraction.reply({ content: '設定が保存されました！', ephemeral: true });
                    } catch (error) {
                        console.error('設定の保存中にエラー:', error);
                        await modalInteraction.reply({ content: '設定の保存に失敗しました。形式を確認してください。', ephemeral: true });
                    }
                });
            }
        }
    ]
};