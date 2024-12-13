const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 参加者リストを保持するセット
const participants = new Set();

module.exports = {
    commands: [
        {
            data: new SlashCommandBuilder()
                .setName('newgame')
                .setDescription('新しいゲームを開始します。参加者を募集します。'),
            execute: async function(interaction) {
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
                const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

                collector.on('collect', async i => {
                    participants.add(i.user);
                    await i.reply({ content: `${i.user.username} さんが参加しました！`, ephemeral: true });
                });

                collector.on('end', async () => {
                    await interaction.followUp({
                        content: '参加受付を終了しました。',
                        components: []
                    });
                });
            }
        },
        {
            data: new SlashCommandBuilder()
                .setName('startgame')
                .setDescription('現在の参加者でゲームを開始します。'),
            execute: async function(interaction) {
                if (participants.size === 0) {
                    await interaction.reply('ゲームを開始できません。参加者がいません。');
                    return;
                }

                const userList = Array.from(participants).map(user => user.username).join(', ');

                for (const user of participants) {
                    try {
                        await user.send('ゲームが開始されました！楽しんでください！');
                    } catch (error) {
                        console.error(`DM送信に失敗しました: ${user.username}`);
                    }
                }

                participants.clear();

                await interaction.reply(`ゲームが開始されました！参加者: ${userList}`);
            }
        }
    ]
};