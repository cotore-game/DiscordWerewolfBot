const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    StringSelectMenuBuilder
} = require('discord.js');
const wordGroups = require('../gameData/wordwolf/wordgroupsData.json'); // 外部ファイルからワード群をインポート

const gameStatus = Object.freeze({
    waiting: 'waiting',
    active: 'active',
});
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
                .setName('wordwolf_assign')
                .setDescription('参加者にワードを割り当ててゲームを開始します(ワードウルフ用)'),
            execute: async function (interaction) {
                if (gameState !== gameStatus.waiting) {
                    await interaction.reply('ゲームは既に進行中です。');
                    return;
                }

                const selectedGroup = wordGroups[Math.floor(Math.random() * wordGroups.length)];
                currentTheme = selectedGroup.theme; // テーマを取得
                const words = selectedGroup.words;
                wolfWord = words[Math.floor(Math.random() * words.length)];
                do {
                    citizenWord = words[Math.floor(Math.random() * words.length)];
                } while (wolfWord === citizenWord);

                const participantArray = Array.from(participants.values());
                const wolfIndex = Math.floor(Math.random() * participantArray.length);

                participantArray.forEach((participant, index) => {
                    if (index === wolfIndex) {
                        participant.word = wolfWord;
                        participant.user.send(`**🐺あなたのワードは「${wolfWord}」です。**`).catch(console.error);
                    } else {
                        participant.word = citizenWord;
                        participant.user.send(`**あなたのワードは「${citizenWord}」です。**`).catch(console.error);
                    }
                });

                const embed = new EmbedBuilder()
                    .setTitle('🗣️ 話し合いのテーマ')
                    .setDescription(`ワードのテーマはこれだ！！\n**テーマ:** ${currentTheme}`)
                    .setColor('Blue');
                await interaction.reply({ embeds: [embed] });

                gameState = gameStatus.active;
            },
        },
        {
            data: new SlashCommandBuilder()
                .setName('wordwolf_reveal')
                .setDescription('全員のワードと投票結果を公開して答え合わせをします(ワードウルフ用)'),
            execute: async function (interaction) {
                if (gameState !== gameStatus.active) {
                    await interaction.reply('ゲームは進行中ではないよ。/wordwlf_newgameで新しいゲームを始めてね。');
                    return;
                }

                if (votes.size < participants.size) {
                    await interaction.reply('全員が投票を完了するまで結果を公開できないヨ？');
                    return;
                }

                const voteCounts = new Map();
                votes.forEach((votedId) => {
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

                let wolfOutput = `--🐺 **ウルフ** --\n`;
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

                if (mostVotedId) {
                    const wolfPlayer = participants.get(mostVotedId).user.username;

                    if (participants.get(mostVotedId).word !== wolfWord) {
                        const resultEmbed = new EmbedBuilder()
                            .setTitle('🏆 **結果発表** 🏆')
                            .setDescription(`${wolfOutput}${citizenOutput}${voteOutput}\n\n村人たちは人狼を当てられなかった... \n**人狼の勝利！** 🎉`)
                            .setColor('Red');
                        await interaction.reply({ embeds: [resultEmbed] });
                    } else {
                        const resultEmbed = new EmbedBuilder()
                            .setTitle('🐺 **ウルフ投票結果** 🐺')
                            .setDescription(`ウルフは **@${wolfPlayer}** でした...\nウルフは市民側のワードを推測して的中することで逆転勝利するチャンス！！ 🎯\n\n${voteOutput}`)
                            .setColor('Gold');

                        const answerButton = new ButtonBuilder()
                            .setCustomId('wolf_guess_modal')
                            .setLabel('市民のワードを予想してね！')
                            .setStyle(ButtonStyle.Primary);

                        const actionRow = new ActionRowBuilder().addComponents(answerButton);

                        await interaction.reply({ embeds: [resultEmbed], components: [actionRow] });

                        const filter = (i) => i.customId === 'wolf_guess_modal';
                        const collector = interaction.channel.createMessageComponentCollector({ filter });

                        collector.on('collect', async (i) => {
                            if (i.user.id !== mostVotedId) {
                                if (!i.replied && !i.deferred) {
                                    await i.reply({ content: '君は人狼じゃないだろう！実に馬鹿だな！♠️', ephemeral: true });
                                }
                                return;
                            }

                            const options = wordGroups
                                .find((group) => group.words.includes(wolfWord) || group.words.includes(citizenWord))
                                ?.words.filter((word) => word !== wolfWord)
                                .map((word) => ({
                                    label: word.toString(),
                                    value: word.toString(),
                                }));

                            if (!options || options.length < 2) {
                                console.error('エラー: ワードオプションが不足しています。');
                                if (!i.replied && !i.deferred) {
                                    await i.reply({ content: '選択肢が正しく設定されていません。', ephemeral: true });
                                } else {
                                    await i.editReply({ content: '選択肢が正しく設定されていません。' });
                                }
                                return;
                            }

                            const modal = new ModalBuilder()
                                .setCustomId('guess_word_modal')
                                .setTitle('ワード予想')
                                .addComponents(
                                    new ActionRowBuilder().addComponents(
                                        new StringSelectMenuBuilder()
                                            .setCustomId('citizen_word_guess')
                                            .setPlaceholder('市民のワードを選んでください')
                                            .addOptions(options)
                                    )
                                );

                            try {
                                if (!i.replied && !i.deferred) {
                                    await i.showModal(modal);
                                } else {
                                    console.error('既に応答済みのインタラクションでモーダルを送信しようとしました。');
                                }
                            } catch (error) {
                                console.error('モーダル送信エラー:', error);
                            }
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
};