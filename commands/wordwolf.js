const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
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
                .setName('wordwlf_newgame')
                .setDescription('ワードウルフのメンバーを募集します'),
            execute: async function(interaction) {
                if (gameState !== gameStatus.waiting) {
                    await interaction.reply({ content: '現在のゲームは進行中か終了済みのため、新しいゲームを開始できません。', ephemeral: true });
                    return;
                }

                gameState = gameStatus.active;
                participants.clear();
                votes.clear();
                wolfWord = null;
                citizenWord = null;
                currentTheme = null;

                const joinButton = new ButtonBuilder()
                    .setCustomId('join_wordwolf')
                    .setLabel('参加する')
                    .setStyle(ButtonStyle.Primary);

                const actionRow = new ActionRowBuilder().addComponents(joinButton);

                const message = await interaction.reply({
                    content: '🗣️ **ワードウルフゲームが始まりました！** 下のボタンを押して参加してください！',
                    components: [actionRow],
                    fetchReply: true
                });

                const filter = i => i.customId === 'join_wordwolf';
                const collector = message.createMessageComponentCollector({ filter });

                collector.on('collect', async i => {
                    if (participants.has(i.user.id)) {
                        await i.reply({ content: '⚠️ 君はすでに参加してるよ？目立ちたがり屋なんだね。', ephemeral: true });
                        return;
                    }

                    participants.set(i.user.id, { user: i.user, word: null });
                    await i.reply(`${i.user.username} さんが参加しました！`);
                });

                collector.on('end', async () => {
                    try {
                        await message.edit({ content: '🛑 **参加募集が終了しました。**', components: [] });
                    } catch (error) {
                        console.error('Collector終了時のメッセージ編集エラー:', error);
                    }
                });
            }
        },
        {
            data: new SlashCommandBuilder()
                .setName('wordwlf_assign')
                .setDescription('参加者にワードを割り当ててゲームを開始します(ワードウルフ用)'),
            execute: async function(interaction) {
                if (gameState !== gameStatus.active) {
                    await interaction.reply('ゲームは始まっていないよ。');
                    return;
                }

                if (participants.size < 3) {
                    await interaction.reply('ゲームを開始するには少なくとも3人の参加者が必要だよ！\n友達を連れてこよう🌚');
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
                        participant.user.send(`**あなたのワードは「${wolfWord}」です。**`).catch(console.error);
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
                if (gameState !== gameStatus.active) {
                    await interaction.reply('ゲームは進行中ではないよ。/wordwlf_newgameで新しいゲームを始めてね。');
                    return;
                }

                if (!participants.has(interaction.user.id)) {
                    await interaction.reply({ content: '君はゲームに参加してないよ！/n...仲間外れなんだね...可愛そうに（泣）', ephemeral: true });
                    return;
                }

                const target = interaction.options.getUser('target');
                if (!participants.has(target.id)) {
                    await interaction.reply({ content: '投票先はゲームに参加してないよ！\nよく見て！！！', ephemeral: true });
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
                    await interaction.reply('ゲームは進行中ではないよ。/wordwlf_newgameで新しいゲームを始めてね。');
                    return;
                }
            
                if (votes.size < participants.size) {
                    await interaction.reply('全員が投票を完了するまで結果を公開できないヨ？');
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
            
                        const filter = i => i.customId === 'wolf_guess_modal';
                        const collector = interaction.channel.createMessageComponentCollector({ filter });
            
                        collector.on('collect', async i => {
                            if (i.user.id !== mostVotedId) {
                                await i.reply({ content: '君は人狼じゃないだろう！実に馬鹿だな！♠️', ephemeral: true });
                                return;
                            }
            
                            const modal = new ModalBuilder()
                                .setCustomId('guess_word_modal')
                                .setTitle('ワード予想')
                                .addComponents(
                                    new ActionRowBuilder().addComponents(
                                        new TextInputBuilder()
                                            .setCustomId('citizen_word_guess')
                                            .setLabel('予想ワードを入力してね')
                                            .setStyle(TextInputStyle.Short)
                                            .setRequired(true)
                                    )
                                );
            
                            await i.showModal(modal);
            
                            try {
                                const modalInteraction = await i.awaitModalSubmit({
                                    filter: modalInteraction => modalInteraction.customId === 'guess_word_modal' && modalInteraction.user.id === mostVotedId,
                                    time: 0 // 時間切れを無効化
                                });
            
                                const guess = modalInteraction.fields.getTextInputValue('citizen_word_guess');
                                let finalEmbed = new EmbedBuilder()
                                    .setTitle('🎉 **最終結果発表** 🎉')
                                    .setColor('Blue')
                                    .setDescription(`${wolfOutput}${citizenOutput}\n\n`);
            
                                if (guess === citizenWord) {
                                    finalEmbed.setDescription(`${finalEmbed.data.description}ウルフ🐺が市民のワードを当てました！\n**ウルフの大逆転勝利！** 😈`);
                                } else {
                                    finalEmbed.setDescription(`${finalEmbed.data.description}ウルフは市民のワードを当てられなかった...\n**村人たちの大勝利！** 🎉`);
                                }
            
                                finalEmbed.addFields({ name: '📝 **ウルフの推測**', value: guess || 'なし', inline: true });
                                await modalInteraction.reply({ embeds: [finalEmbed] });
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
}