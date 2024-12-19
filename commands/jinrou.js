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
const roleFile = require('../gameData/werewolf/roles.json');
const configFile = require('../gameData/werewolf/setting.json');
//const client = require('../index.js');
//const { sendMessage, updateChannelPermissions } = require('../index.js');
const client = require('../client.js'); // 循環依存回避 client専用のファイルから取得する

// 参加者リストを保持するセット
const participants = new Set();
// Enumの代わり
const gameStatus = Object.freeze({
    waiting: 'waiting',
    active: 'active',
    ended: 'ended',
})

let gameState = gameStatus.waiting; // ゲームの状態

let gameProgress = {
    dayCount: 0,                   // 経過日数
    stakeholderDeathDays: null,    // ステークホルダー死亡日数 (nullで未死亡)
    dazaiActionCount: 0,           // 太宰の活動回数
    roles: {},                     // 全員の役職
    lightWarrior: null,            // 光の戦士
    demonTarget: null,             // 悪魔の指名先
    turnState: {
        investigated: null,        // 占われた人
        frozen: null,              // 雪女による発言不能者
        disabled: [],              // 行動不能者リスト (発狂者、太宰)
        knightTarget: null         // 騎士の守る対象
    }
};

// 役職名を選択肢に変換する関数
function generateRoleChoices() {
    return roleFile.map(role => ({
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
                    content: '**新しいゲームが始まりました！**\n人狼ゲームに参加する人は下のボタンを押して参加してください。',
                    components: [actionRow]
                });

                const filter = i => i.customId === 'join_game';
                const collector = interaction.channel.createMessageComponentCollector({ filter });

                collector.on('collect', async i => {
                    if (gameState !== gameStatus.waiting) {
                        await i.reply({ content: '現在のゲームは進行中か終了済みのため、参加できないよ。', ephemeral: true });
                        return;
                    }

                    if (participants.has(i.user)) {
                        await i.reply({ content: '⚠️ 君はすでに参加してるよ？目立ちたがり屋なんだね。', ephemeral: true });
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
            execute: async function (interaction) {
                // 例外処理
                if (gameState === gameStatus.ended) {
                    await interaction.reply(`ゲームを開始できません。新規ゲームを作成してください。`);
                    return;
                }

                if (gameState === gameStatus.active) {
                    await interaction.reply('ゲームを開始できません。現在のゲームは進行中です。');
                    return;
                }

                if (participants.size < 4) {
                    await interaction.reply('ゲームを開始できません。参加人数が4人未満です。');
                    return;
                }

                const numOfPpl = participants.size;
                const setting = configFile.find(config => config.NumOfPpl === numOfPpl)?.Setting;

                if (!setting) {
                    await interaction.reply(`設定ファイルに ${numOfPpl} 人の配役が見つかりませんでした。管理者に連絡してください。`);
                    return;
                }

                // プレイヤー配役をランダム化
                const roles = Object.entries(setting).flatMap(([role, count]) => Array(count).fill(role));
                const shuffledRoles = roles.sort(() => Math.random() - 0.5);
                const players = Array.from(participants);
                const genders = players.map(() => (Math.random() < 0.5 ? '男' : '女')); // ランダムで性別割当

                // 各プレイヤーに役職を配布
                for (let i = 0; i < players.length; i++) {
                    const user = players[i];
                    const roleName = shuffledRoles[i];
                    const gender = genders[i];
                    const role = roleFile.find(r => r.RoleName === roleName);

                    if (!role) {
                        console.error(`役職データが見つかりません: ${roleName}`);
                        continue;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('↓君の役職↓！')
                        .setDescription(`**役職名**: ${role.RoleName}\n**説明**: ${role.Description}`)
                        .addFields(
                            { name: '性別', value: gender, inline: true },
                            { name: '陣営', value: role.Party, inline: true },
                            { name: '白黒', value: role.Identity, inline: true }
                        )
                        .setColor(0x0099FF);

                    try {
                        console.log(`${user.username}: 役職/${role.RoleName}`);
                        await user.send({ embeds: [embed] });
                    } catch (error) {
                        console.error(`DM送信に失敗しました: ${user.username}`);
                    }
                }

                gameState = gameStatus.active;
                await interaction.reply(`ゲームが開始されました！各プレイヤーに役職が配布されました。`);
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
                const role = roleFile.find(r => r.RoleName === roleName);

                if (!role) {
                    await interaction.reply({ content: 'その役職は存在しないよ？！(ﾟ∀ﾟ)', ephemeral: true });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle(`役職情報: ${role.RoleName}`)
                    .setDescription(role.Description)
                    .addFields(
                        { name: '陣営', value: role.Party, inline: true },
                        { name: '白黒', value: role.Identity, inline: true }
                    )
                    .setColor(0x191970);

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        },
        {
            data: new SlashCommandBuilder()
                .setName('jinrou_progress')
                .setDescription('ゲームの進行状況を表示します (GM専用)'),
            execute: async function(interaction) {
                // 経過日数、太宰回数、ステークホルダーの状況などを表示
                const progressEmbed = new EmbedBuilder()
                    .setTitle('現在のゲーム進行状況')
                    .addFields(
                        { name: '経過日数', value: `${gameProgress.dayCount} 日目`, inline: true },
                        { name: '太宰の活動回数', value: `${gameProgress.dazaiActionCount} 回`, inline: true },
                        { name: 'ステークホルダー死亡日', value: gameProgress.stakeholderDeathDays !== null ? `${gameProgress.stakeholderDeathDays} 日目` : '未死亡', inline: true },
                        { name: '光の戦士', value: gameProgress.lightWarrior || '未指名', inline: true },
                        { name: '悪魔の指名先', value: gameProgress.demonTarget || '未指名', inline: true },
                        { name: '行動不能者', value: gameProgress.turnState.disabled.length > 0 ? gameProgress.turnState.disabled.join(', ') : 'なし', inline: false },
                        { name: '騎士の守る対象', value: gameProgress.turnState.knightTarget || '未指定', inline: true },
                        { name: '雪女の発言不能', value: gameProgress.turnState.frozen || 'なし', inline: true }
                    )
                    .setColor(0xFF4500);

                await interaction.reply({ embeds: [progressEmbed], ephemeral: true });
            }
        },
        {
            // 仮想メンバーを追加するコマンド
            data: new SlashCommandBuilder()
                .setName('jinrou_addbot')
                .setDescription('仮想メンバーをゲームに追加します')
                .addStringOption(option =>
                    option.setName('botname')
                        .setDescription('仮想メンバーの名前を指定します')
                        .setRequired(true)
                ),
            execute: async function (interaction) {
                // ゲームが進行中または終了済みの場合はエラー
                if (gameState !== gameStatus.waiting) {
                    await interaction.reply({ content: '仮想メンバーを追加できません。', ephemeral: true });
                    return;
                }

                const botName = interaction.options.getString('botname');
                const botUser = {
                    username: botName,
                    id: interaction.user.id, // 実行者ID + タイムスタンプで一意のIDを生成
                    isBot: false,
                    addedBy: interaction.user.id // 実行者のIDを保存
                };

                // 仮想メンバーを参加者リストに追加
                participants.add(botUser);

                await interaction.reply({ content: `仮想メンバー「${botName}」をゲームに追加しました。現在の参加者数: ${participants.size}`, ephemeral: false });
            }
        }
    ]
};

function nextDay(){
    gameProgress.dayCount++; // 日数を進める

    // ステークホルダー死亡から4日経過時の敗北判定
    if (gameProgress.stakeholderDeathDays !== null &&
        gameProgress.dayCount - gameProgress.stakeholderDeathDays >= 4) {
        return;
    }

    // 状態リセット (行動不能者、守護対象、雪女の効果など)
    gameProgress.turnState.disabled = [];
    gameProgress.turnState.knightTarget = null;
    gameProgress.turnState.frozen = null;
    gameProgress.turnState.investigated = null;
}

// 特定のチャンネルに送信
function sendMessage(channelId, message) {
    const channel = client.channels.cache.get(channelId);
    if (!channel) {
        console.error(`チャンネルID ${channelId} が見つかりません`);
        return;
    }
    channel.send(message).catch(console.error);
}

// 権限変更
function updateChannelPermissions(channelId, memberId, allow = true) {
    const channel = client.channels.cache.get(channelId);
    if (!channel) {
        console.error(`チャンネルID ${channelId} が見つかりません`);
        return;
    }

    channel.permissionOverwrites.edit(memberId, {
        VIEW_CHANNEL: allow,
        SEND_MESSAGES: allow,
    }).catch(console.error);
}

/**
 * TimerSet - 指定した秒数でタイマーを設定
 * @param {string} channelId - タイマーを表示するチャンネルのID
 * @param {number} timerSec - タイマーの秒数
 */
async function TimerSet(channelId, timerSec) {
    if (timerSec <= 0) {
        console.error('タイマー秒数が無効です。正の整数を指定してください。');
        return;
    }

    let remainingTime = timerSec;

    // タイマー開始Embed
    const embed = new EmbedBuilder()
        .setTitle('⏳ タイマー開始')
        .setDescription(`**残り時間: ${remainingTime}秒**`)
        .setColor(0x00FF00);

    // 初期メッセージ送信
    const timerMessage = await sendMessage(channelId, { embeds: [embed] });

    // タイマー処理
    const timer = setInterval(async () => {
        remainingTime--;

        // タイマー終了時
        if (remainingTime <= 0) {
            clearInterval(timer);
            embed.setDescription('**タイマーが終了しました！**').setColor(0xFF0000);
            await timerMessage.edit({ embeds: [embed] });
            return;
        }

        // タイマー進行中の更新
        embed.setDescription(`**残り時間: ${remainingTime}秒**`);
        await timerMessage.edit({ embeds: [embed] });
    }, 1000); // 1秒ごとに実行
}
