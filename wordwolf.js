const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');
const wordGroups = require('../gameData/wordwolf/wordgroupsData.json'); // 外部ファイルからワード群をインポート

const gameStatus = Object.freeze({
    waiting: 'waiting',
    active: 'active',
})

let participants = new Map(); // ユーザーと割り当てられたワードを保持
let votes = new Map(); // 誰が誰に投票したか
let wolfWord = null;
let citizenWord = null;
let currentTheme = null; // 現在のテーマ
let gameState = gameStatus.waiting;

module.exports = {
    commands: [
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
                if (gameState !== gameStatus.active) {
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

                // 投票進捗表示に必要
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
                if (gameState !== gameStatus.active) {
                    await interaction.reply('ゲームは進行中ではありません。');
                    return;
                }

                if (votes.size < participants.size) {
                    await interaction.reply('全員が投票を完了するまで結果を公開できません。');
                    return;
                }

                const voteCounts = new Map();
                votes.forEach(votedId => {
                    voteCounts.set(votedId, (voteCounts.get(votedId) || 0) + 1);
                });

                let mostVotedId = null;
                let mostVotes = 0;
                voteCounts.forEach((count, id) => {
                    if (count > mostVotes) {
                        mostVotes = count;
                        mostVotedId = id;
                    }
                });

                let wolfOutput = `--🛑 **ウルフ** --\n`;
                let citizenOutput = `--🟢 **市民** --\n`;
                let voteOutput = `--📊 **投票結果** --\n`;

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

                const resultEmbed = new EmbedBuilder()
                    .setTitle('🎉 **結果発表** 🎉')
                    .setDescription(`${wolfOutput}${citizenOutput}${voteOutput}`)
                    .setColor('Gold');

                if (mostVotedId) {
                    if (participants.get(mostVotedId).word === wolfWord) {
                        resultEmbed.addFields({ name: '🏆 **結果**', value: 'ウルフが投票で選ばれました！村人たちの勝利です！ 🎉' });
                    } else {
                        const answerButton = new ButtonBuilder()
                            .setCustomId('wolf_guess')
                            .setLabel('市民のワードを予想')
                            .setStyle(ButtonStyle.Primary);

                        const actionRow = new ActionRowBuilder().addComponents(answerButton);

                        await interaction.reply({ embeds: [resultEmbed], components: [actionRow] });

                        const filter = i => i.customId === 'wolf_guess' && i.user.id === mostVotedId;
                        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });

                        collector.on('collect', async i => {
                            await i.reply({ content: '市民のワードを入力してください:', ephemeral: true });

                            const messageFilter = m => m.author.id === mostVotedId;
                            const messageCollector = interaction.channel.createMessageCollector({ filter: messageFilter, time: 30000 });

                            messageCollector.on('collect', async msg => {
                                const guess = msg.content.toLowerCase();
                                if (guess === citizenWord.toLowerCase()) {
                                    resultEmbed.addFields({ name: '🎯 **逆転勝利！**', value: 'ウルフ🐺が市民のワードを当てました！ウルフの勝利です！ 😈' });
                                } else {
                                    resultEmbed.addFields({ name: '🏆 **結果**', value: 'ウルフは市民のワードを当てられませんでした！村人たちの勝利です！ 🎉' });
                                }
                                messageCollector.stop();
                                await interaction.followUp({ embeds: [resultEmbed] });
                            });

                            messageCollector.on('end', collected => {
                                if (collected.size === 0) {
                                    i.followUp({ content: '時間切れです！', ephemeral: true });
                                }
                            });
                        });
                    }
                }

                gameState = gameStatus.waiting;
                participants.clear();
                votes.clear();
                wolfWord = null;
                citizenWord = null;
                currentTheme = null;
            }
        }
    ]
}