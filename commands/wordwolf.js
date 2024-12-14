const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const wordGroups = require('../gameData/wordwolf/wordgroupsData.json'); // 外部ファイルからワード群をインポート

let participants = new Map(); // ユーザーと割り当てられたワードを保持
let votes = new Map(); // 誰が誰に投票したか
let wolfWord = null;
let citizenWord = null;
let gameState = "waiting";

module.exports = {
    commands: [
        {
            data: new SlashCommandBuilder()
                .setName('wordwlf_newgame')
                .setDescription('ワードウルフをはじめ、メンバーを募集します'),
            execute: async function(interaction) {
                if (gameState !== "waiting") {
                    await interaction.reply({ content: '現在のゲームは進行中か終了済みのため、新しいゲームを開始できません。', ephemeral: true });
                    return;
                }

                gameState = "active";
                participants.clear();
                votes.clear();
                wolfWord = null;
                citizenWord = null;

                const joinButton = new ButtonBuilder()
                    .setCustomId('join_wordwolf')
                    .setLabel('参加する')
                    .setStyle(ButtonStyle.Primary);

                const actionRow = new ActionRowBuilder().addComponents(joinButton);

                await interaction.reply({
                    content: 'ワードウルフゲームが始まりました！下のボタンを押して参加してください。',
                    components: [actionRow]
                });

                const filter = i => i.customId === 'join_wordwolf';
                const collector = interaction.channel.createMessageComponentCollector({ filter });

                collector.on('collect', async i => {
                    if (participants.has(i.user.id)) {
                        await i.reply({ content: 'あなたはすでに参加しています！', ephemeral: true });
                        return;
                    }

                    participants.set(i.user.id, { user: i.user, word: null });
                    await i.reply(`${i.user.username} さんが参加しました！`);
                });
            }
        },
        {
            data: new SlashCommandBuilder()
                .setName('wordwlf_assign')
                .setDescription('参加者にワードを割り当ててゲームを開始します(ワードウルフ用)'),
            execute: async function(interaction) {
                if (gameState !== "active") {
                    await interaction.reply('ゲームは開始されていません。');
                    return;
                }

                if (participants.size < 3) {
                    await interaction.reply('ゲームを開始するには少なくとも3人の参加者が必要です。');
                    return;
                }

                const selectedGroup = wordGroups[Math.floor(Math.random() * wordGroups.length)];
                wolfWord = selectedGroup[Math.floor(Math.random() * selectedGroup.length)];
                do {
                    citizenWord = selectedGroup[Math.floor(Math.random() * selectedGroup.length)];
                } while (wolfWord === citizenWord);

                const participantArray = Array.from(participants.values());
                const wolfIndex = Math.floor(Math.random() * participantArray.length);

                participantArray.forEach((participant, index) => {
                    if (index === wolfIndex) {
                        participant.word = wolfWord;
                        participant.user.send(`あなたのワードは「${wolfWord}」です。`).catch(console.error);
                    } else {
                        participant.word = citizenWord;
                        participant.user.send(`あなたのワードは「${citizenWord}」です。`).catch(console.error);
                    }
                });

                await interaction.reply('ワードが全員に配布されました！議論を始めてください！(投票はwordwlf_voteで可能です)');
            }
        },
        {
            data: new SlashCommandBuilder()
                .setName('wordwlf_vote')
                .setDescription('ウルフだと思う人を選んで投票できます。(ワードウルフ用)')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('投票先ユーザー')
                        .setRequired(true)
                ),
            execute: async function(interaction) {
                if (gameState !== "active") {
                    await interaction.reply('ゲームは進行中ではありません。');
                    return;
                }

                if (!participants.has(interaction.user.id)) {
                    await interaction.reply({ content: 'あなたはゲームに参加していません。', ephemeral: true });
                    return;
                }

                const target = interaction.options.getUser('target');
                if (!participants.has(target.id)) {
                    await interaction.reply({ content: '投票先はゲームに参加していません。', ephemeral: true });
                    return;
                }

                votes.set(interaction.user.id, target.id);

                const completedVotes = votes.size;
                const totalParticipants = participants.size;
                const voterNames = Array.from(votes.keys()).map(id => participants.get(id).user.username).join(', ');

                await interaction.reply({ content: `@${interaction.user.username} が投票しました！ (${completedVotes}/${totalParticipants})\n投票済み: ${voterNames}`, ephemeral: false });
            }
        },
        {
            data: new SlashCommandBuilder()
                .setName('wordwlf_reveal')
                .setDescription('全員のワードと投票結果を公開して答え合わせをします(ワードウルフ用)'),
            execute: async function(interaction) {
                if (gameState !== "active") {
                    await interaction.reply('ゲームは進行中ではありません。');
                    return;
                }

                let wolfOutput = `--wolf--\n`;
                let citizenOutput = `--citizen--\n`;
                let voteOutput = `--votes--\n`;

                participants.forEach(({ user, word }) => {
                    if (word === wolfWord) {
                        wolfOutput += `@${user.username} : ${word}\n`;
                    } else {
                        citizenOutput += `@${user.username} : ${word}\n`;
                    }
                });

                votes.forEach((votedId, voterId) => {
                    const voter = participants.get(voterId).user.username;
                    const voted = participants.get(votedId).user.username;
                    voteOutput += `@${voter} -> @${voted}\n`;
                });

                gameState = "waiting";
                participants.clear();
                votes.clear();
                wolfWord = null;
                citizenWord = null;

                await interaction.reply(`${wolfOutput}${citizenOutput}${voteOutput}`);
            }
        }
    ]
};