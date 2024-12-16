const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder
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
let selectedGroup = null;
let gameState = gameStatus.waiting;

// デバッグ用
let Isdebug = false;

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
                        if(Isdebug) console.log(`Already Joined : join_word_wolf/user:${i.user.id}`); // デバッグ用
                        return;
                    }

                    participants.set(i.user.id, { user: i.user, word: null });
                    await i.reply(`${i.user.displayName} さんが参加しました！`);
                    if(Isdebug) console.log(`Join : join_word_wolf/user:${i.user.id}`); // デバッグ用
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

                if (participants.size < 1) {
                    await interaction.reply('ゲームを開始するには少なくとも3人の参加者が必要だよ！\n 友達を連れてこよう🌚');
                    return;
                }

                selectedGroup = wordGroups[Math.floor(Math.random() * wordGroups.length)];
                currentTheme = selectedGroup.theme; // テーマを取得
                const words = selectedGroup.words;
                if(Isdebug) console.log(`Theme : ${currentTheme}`); // デバッグ用

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
                        if(Isdebug) console.log(`Wolf : wolf_user:${i.user.id} / wolf_word:${wolfWord}`); // デバッグ用
                    } else {
                        participant.word = citizenWord;
                        participant.user.send(`**あなたのワードは「${citizenWord}」です。**`).catch(console.error);
                        if(Isdebug) console.log(`Citizen : Citizen_user:${i.user.id} / Citizen_word:${citizenWord}`); // デバッグ用
                    }
                });

                console.log(`assign: ${currentTheme}`);

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

                console.log(`vote: ${currentTheme}`);

                votes.set(interaction.user.id, target.id);

                // 投票進捗表示に必要
                const completedVotes = votes.size;
                const totalParticipants = participants.size;

                const voterNames = Array.from(votes.keys()).map(id => participants.get(id).user.displayName).join(', ');

                if(Isdebug) console.log(`Voted: ${interaction.user.id} -> ${target.id}\n${completedVotes}/${totalParticipants})\n投票済み: ${voterNames}`); // デバッグ用
                await interaction.reply({ content: `${interaction.user.displayName} さんが投票しました！ (${completedVotes}/${totalParticipants})\n投票済み: ${voterNames}`, ephemeral: false });
            }
        },
        {
            data: new SlashCommandBuilder()
                .setName('wordwlf_reveal')
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
                        wolfOutput += `${user.displayName} : ${word}\n`;
                    } else {
                        citizenOutput += `${user.displayName} : ${word}\n`;
                    }
                });

                votes.forEach((votedId, voterId) => {
                    const voter = participants.get(voterId).user.displayName;
                    const voted = participants.get(votedId).user.displayName;
                    voteOutput += `${voter} -> ${voted}\n`;
                });

                if (mostVotedId) {
                    const wolfPlayer = participants.get(mostVotedId).user.displayName;
                  
                    if (participants.get(mostVotedId).word !== wolfWord) {
                        // 投票負け(1)
                        const resultEmbed = new EmbedBuilder()
                            .setTitle('🏆 **結果発表** 🏆')
                            .setDescription(`${wolfOutput}${citizenOutput}${voteOutput}\n\n村人たちは人狼を当てられなかった... \n**人狼の勝利！** 👿🐺`)
                            .setColor('Red');

                        await interaction.reply({ embeds: [resultEmbed] });
                        await ResetGame();

                    } else {
                        const resultEmbed = new EmbedBuilder()
                            .setTitle('🐺 **投票結果** 🐺')
                            .setDescription(`ウルフは **@${wolfPlayer}** でした...\nウルフは市民側のワードを推測して的中することで逆転勝利するチャンス！！ 🎯\n\n${voteOutput}`)
                            .setColor('Gold');

                        const menuOptions = selectedGroup.words
                            .filter(word => word !== wolfWord) // 人狼のワードを除外
                            .map(word => ({
                                label: word,
                                value: word
                            }));

                        const actionRowMenu = new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('citizen_word_guess')
                                .setPlaceholder('市民のワードを予想してね！')
                                .addOptions(menuOptions)
                        );

                        await interaction.reply({
                            content: '🐺 **人狼だけが操作できるよ！** 大逆転を目指そう',
                            embeds: [resultEmbed],
                            components: [actionRowMenu]
                        });

                        // インタラクション処理
                        const filter = (i) => i.customId === 'citizen_word_guess' || i.customId === 'wolf_guess_submit';
                        const collector = interaction.channel.createMessageComponentCollector({
                            filter,
                            time:0
                        });

                        let selectedWord = null;

                        collector.on('collect', async (i) => {
                            if (i.user.id !== mostVotedId) {
                                await i.reply({ content: '君は人狼じゃないだろう！実に馬鹿だな！👹', ephemeral: true });
                                return;
                            }

                            if (i.customId === 'citizen_word_guess') {
                                selectedWord = i.values[0]; // 選択したワードを取得
                                //await i.reply({ content: `選んだワード: ${selectedWord}`, ephemeral: true });
                                if(Isdebug) console.log(`Choosen: ${selectedWord}`); // デバッグ用

                                collector.stop();

                                // 結果を表示
                                const resultEmbed = new EmbedBuilder()
                                    .setTitle('🎉 **最終結果発表** 🎉')
                                    .setColor('Blue')
                                    .setDescription(`${wolfOutput}${citizenOutput}\n\n`);

                                if (selectedWord === citizenWord) {
                                    // 逆転勝ち(2)
                                    resultEmbed.setDescription(`${resultEmbed.data.description}ウルフ🐺が市民のワードを当てました！\n**ウルフの大逆転勝利！** 😈`);
                                } else {
                                    // 推測負け(3)
                                    resultEmbed.setDescription(`${resultEmbed.data.description}ウルフは市民のワードを当てられなかった...\n**村人たちの大勝利！** 🎉`);
                                }

                                resultEmbed.addFields({ name: '📝 **ウルフの推測**', value: selectedWord, inline: true });
                                await i.reply({ embeds: [resultEmbed] });
                                await ResetGame();
                            }
                        });

                    }
                }

                // もともとここでリセットしてた
            }
        },
        {
            data: new SlashCommandBuilder()
                .setName('wordwlf_forcequit')
                .setDescription('ワードウルフを強制終了させる'),
            execute: async function(interaction) {
                gameState = gameStatus.waiting;
                participants.clear();
                votes.clear();
                wolfWord = null;
                citizenWord = null;
                currentTheme = null;
                selectedGroup = null;
                await interaction.reply('ワードウルフを強制終了したよ');
            }
        },
        {
            data:SlashCommandBuilder()
                .setName('__debug__')
                .setDescription('(開発者用) ログをonにします'),
            execute: async function(interaction){
                Isdebug = !Isdebug;
                if(interaction.user.id === 'suoqa'){
                    await interaction.reply({ content: `Debug:${Isdebug}`, ephemeral: true});
                }else{
                    await interaction.reply({ content: 'あなたは実行できません。', ephemeral: true });
                }
            }
        }
    ]
}

function ResetGame(){
    gameState = gameStatus.waiting;
    participants.clear();
    votes.clear();
    wolfWord = null;
    citizenWord = null;
    currentTheme = null;
}